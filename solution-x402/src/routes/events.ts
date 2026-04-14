import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { paymentMiddleware } from "@x402/hono";
import { db } from "../db/client";
import { events, tickets } from "../db/schema";
import { resourceServer, usdcAccepts } from "../x402-server";

const SERVER = process.env.SERVER_WALLET_ADDRESS!;
const ONE_USDC = 1_000_000;

const Submit = z.object({
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(1000),
  maxTickets: z.number().int().positive().max(10_000),
  creator: z.string().min(32),
});

export const eventsRouter = new Hono();

/** Free reads: list all events + get one event with current ticket price. */
eventsRouter.get("/events", async (c) => {
  const all = await db.select().from(events);
  return c.json(all.map(withPrice));
});

eventsRouter.get("/events/:id", async (c) => {
  const [row] = await db.select().from(events).where(eq(events.id, c.req.param("id")));
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json(withPrice(row));
});

function withPrice(e: typeof events.$inferSelect) {
  return { ...e, nextTicketPriceMicroUsdc: ONE_USDC * (e.ticketsSold + 1) };
}

/**
 * Paid routes. Mount payment middleware that gates:
 *   POST /events              — flat $1
 *   GET  /events/:id/buy      — dynamic price (resolved per-request below)
 *
 * x402's `paymentMiddleware` accepts a route map keyed by "METHOD /path".
 */
eventsRouter.use(
  paymentMiddleware(
    {
      "POST /events": {
        accepts: usdcAccepts(ONE_USDC, SERVER, "submit an event"),
      },
      // Flat $1 here for simplicity. See chapter 07 for the dynamic-price pattern
      // you'd use to charge the real bonding curve of $1 × (sold+1).
      "GET /events/:id/buy": {
        accepts: usdcAccepts(ONE_USDC, SERVER, "buy a ticket"),
      },
    },
    resourceServer,
    undefined, undefined,
    false, // skip facilitator sync at import time — we start it ourselves in index.ts
  ),
);

eventsRouter.post("/events", async (c) => {
  const parsed = Submit.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const [created] = await db.insert(events).values(parsed.data).returning();
  return c.json(withPrice(created), 201);
});

eventsRouter.get("/events/:id/buy", async (c) => {
  const eventId = c.req.param("id");
  const buyer = c.req.query("buyer");
  if (!buyer) return c.json({ error: "missing ?buyer=<pubkey>" }, 400);

  const [evt] = await db.select().from(events).where(eq(events.id, eventId));
  if (!evt) return c.json({ error: "event not found" }, 404);
  if (evt.ticketsSold >= evt.maxTickets) return c.json({ error: "sold out" }, 409);

  const price = ONE_USDC * (evt.ticketsSold + 1);
  const [ticket] = await db.insert(tickets).values({
    eventId, owner: buyer, pricePaidMicroUsdc: price,
  }).returning();
  await db.update(events)
    .set({ ticketsSold: evt.ticketsSold + 1 })
    .where(eq(events.id, eventId));

  return c.json({ ticket, pricePaidMicroUsdc: price });
});
