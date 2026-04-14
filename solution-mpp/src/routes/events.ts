import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { events, tickets } from "../db/schema";
import { mppx, microToAmount } from "../mpp";

const USDC = process.env.USDC_MINT!;
const ONE_USDC = 1_000_000;

const Submit = z.object({
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(1000),
  maxTickets: z.number().int().positive().max(10_000),
  creator: z.string().min(32),
});

export const eventsRouter = new Hono();

function withPrice(e: typeof events.$inferSelect) {
  return { ...e, nextTicketPriceMicroUsdc: ONE_USDC * (e.ticketsSold + 1) };
}

/** Free reads. */
eventsRouter.get("/events", async (c) => {
  const all = await db.select().from(events);
  return c.json(all.map(withPrice));
});

eventsRouter.get("/events/:id", async (c) => {
  const [row] = await db.select().from(events).where(eq(events.id, c.req.param("id")));
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json(withPrice(row));
});

/**
 * Paid writes. MPP has no middleware concept — you call `mppx.charge(...)` on
 * the raw Request yourself. If it returns 402, hand the challenge back to the
 * client; otherwise wrap the response with `withReceipt` so the client sees a
 * signed receipt in the headers.
 */
eventsRouter.post("/events", async (c) => {
  const result = await mppx.charge({
    amount: microToAmount(ONE_USDC),
    currency: USDC,
    description: "submit an event",
  })(c.req.raw);
  if (result.status === 402) return result.challenge;

  const parsed = Submit.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const [created] = await db.insert(events).values(parsed.data).returning();
  return result.withReceipt(c.json(withPrice(created), 201));
});

eventsRouter.get("/events/:id/buy", async (c) => {
  const eventId = c.req.param("id");
  const buyer = c.req.query("buyer");
  if (!buyer) return c.json({ error: "missing ?buyer=<pubkey>" }, 400);

  const [evt] = await db.select().from(events).where(eq(events.id, eventId));
  if (!evt) return c.json({ error: "event not found" }, 404);
  if (evt.ticketsSold >= evt.maxTickets) return c.json({ error: "sold out" }, 409);

  // True bonding-curve pricing is trivial with MPP because `amount` is set
  // per-request — no middleware gymnastics required.
  const price = ONE_USDC * (evt.ticketsSold + 1);
  const result = await mppx.charge({
    amount: microToAmount(price),
    currency: USDC,
    description: `buy ticket #${evt.ticketsSold + 1} for ${evt.name}`,
    externalId: `${eventId}:${evt.ticketsSold + 1}`,
  })(c.req.raw);
  if (result.status === 402) return result.challenge;

  const [ticket] = await db.insert(tickets).values({
    eventId, owner: buyer, pricePaidMicroUsdc: price,
  }).returning();
  await db.update(events)
    .set({ ticketsSold: evt.ticketsSold + 1 })
    .where(eq(events.id, eventId));

  return result.withReceipt(c.json({ ticket, pricePaidMicroUsdc: price }));
});
