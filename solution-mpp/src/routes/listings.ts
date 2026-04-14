import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { listings, tickets } from "../db/schema";
import { mppxForRecipient, microToAmount } from "../mpp";

const USDC = process.env.USDC_MINT!;

const Create = z.object({
  ticketId: z.string().uuid(),
  seller: z.string().min(32),
  priceMicroUsdc: z.number().int().positive(),
});

export const listingsRouter = new Hono();

listingsRouter.get("/listings", async (c) => c.json(await db.select().from(listings)));

listingsRouter.get("/listings/:id", async (c) => {
  const [row] = await db.select().from(listings).where(eq(listings.id, c.req.param("id")));
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json(row);
});

listingsRouter.post("/listings", async (c) => {
  const parsed = Create.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const [ticket] = await db.select().from(tickets).where(eq(tickets.id, parsed.data.ticketId));
  if (!ticket) return c.json({ error: "ticket not found" }, 404);
  if (ticket.owner !== parsed.data.seller) {
    return c.json({ error: "not owner of ticket" }, 403);
  }

  const [created] = await db.insert(listings).values(parsed.data).returning();
  const origin = new URL(c.req.url).origin;
  return c.json({
    ...created,
    paymentUrl: `${origin}/listings/${created.id}/buy?buyer=<your-pubkey>`,
  }, 201);
});

/**
 * Buy a listing. Because `mppx.charge(...)` is a plain function call (not
 * middleware), dynamic per-listing price and recipient are a one-liner:
 * build an Mppx bound to the seller, then charge the listing price.
 *
 * USDC flows buyer → seller on-chain. The server only fee-sponsors.
 */
listingsRouter.get("/listings/:id/buy", async (c) => {
  const id = c.req.param("id");
  const buyer = c.req.query("buyer");
  if (!buyer) return c.json({ error: "missing ?buyer=<pubkey>" }, 400);

  const [listing] = await db.select().from(listings).where(eq(listings.id, id));
  if (!listing || listing.status !== "open") return c.json({ error: "unavailable" }, 410);

  const result = await mppxForRecipient(listing.seller)
    .charge({
      amount: microToAmount(listing.priceMicroUsdc),
      currency: USDC,
      description: `buy listing ${listing.id}`,
      externalId: `listing:${listing.id}`,
    })(c.req.raw);
  if (result.status === 402) return result.challenge;

  await db.update(tickets).set({ owner: buyer }).where(eq(tickets.id, listing.ticketId));
  await db.update(listings).set({ status: "sold" }).where(eq(listings.id, id));

  return result.withReceipt(c.json({
    ok: true, ticketId: listing.ticketId, newOwner: buyer,
  }));
});
