import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { paymentMiddleware } from "@x402/hono";
import { db } from "../db/client";
import { listings, tickets } from "../db/schema";
import { resourceServer, usdcAccepts } from "../x402-server";

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

/** Create a listing (free). The listing URL itself becomes the "payment link". */
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
 * Per-listing buy endpoint. The x402 middleware below reads the listing price
 * live from the DB via the `priceResolver` hook — each listing URL is paid at
 * its own custom price, routed to the seller's wallet.
 */
const NETWORK = process.env.X402_NETWORK!;

async function loadListing(path: string) {
  const match = path.match(/\/listings\/([^/]+)\/buy/);
  if (!match) throw new Error("bad path");
  const [row] = await db.select().from(listings).where(eq(listings.id, match[1]));
  if (!row || row.status !== "open") throw new Error("listing unavailable");
  return row;
}

listingsRouter.use(
  paymentMiddleware(
    {
      "GET /listings/:id/buy": {
        accepts: {
          scheme: "exact",
          network: NETWORK,
          maxTimeoutSeconds: 60,
          description: "buy a listed ticket",
          price: async (ctx) => {
            const row = await loadListing(ctx.path);
            return `$${(row.priceMicroUsdc / 1_000_000).toFixed(2)}`;
          },
          payTo: async (ctx) => (await loadListing(ctx.path)).seller,
        },
      },
    },
    resourceServer,
    undefined, undefined,
    false,
  ),
);

listingsRouter.get("/listings/:id/buy", async (c) => {
  const id = c.req.param("id");
  const buyer = c.req.query("buyer");
  if (!buyer) return c.json({ error: "missing ?buyer=<pubkey>" }, 400);

  const [listing] = await db.select().from(listings).where(eq(listings.id, id));
  if (!listing || listing.status !== "open") return c.json({ error: "unavailable" }, 410);

  // Payment already settled by middleware (directly to seller). Transfer DB ownership.
  await db.update(tickets).set({ owner: buyer }).where(eq(tickets.id, listing.ticketId));
  await db.update(listings).set({ status: "sold" }).where(eq(listings.id, id));

  return c.json({ ok: true, ticketId: listing.ticketId, newOwner: buyer });
});
