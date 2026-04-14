# 07 — Secondary market listings

Anyone who owns a ticket can list it at any price. The listing's buy URL **is the payment link** — share `http://.../listings/<id>/buy?buyer=...` and any agent can fetch+pay it.

See [`solution/src/routes/listings.ts`](../solution/src/routes/listings.ts).

## Create (free)

```ts
listingsRouter.post("/listings", async (c) => {
  const { ticketId, seller, priceMicroUsdc } = Create.parse(await c.req.json());

  const [ticket] = await db.select().from(tickets).where(eq(tickets.id, ticketId));
  if (!ticket) return c.json({ error: "ticket not found" }, 404);
  if (ticket.owner !== seller) return c.json({ error: "not owner" }, 403);

  const [created] = await db.insert(listings)
    .values({ ticketId, seller, priceMicroUsdc }).returning();

  const origin = new URL(c.req.url).origin;
  return c.json({
    ...created,
    paymentUrl: `${origin}/listings/${created.id}/buy?buyer=<your-pubkey>`,
  }, 201);
});
```

## Buy (dynamic x402 price per listing)

Here's the trick: the price and `payTo` need to come from the DB, not be baked into the middleware. `PaymentOption.price` and `PaymentOption.payTo` both accept a **function of the request context** (`DynamicPrice` / `DynamicPayTo`):

```ts
async function loadListing(path: string) {
  const id = path.match(/\/listings\/([^/]+)\/buy/)![1];
  const [row] = await db.select().from(listings).where(eq(listings.id, id));
  if (!row || row.status !== "open") throw new Error("listing unavailable");
  return row;
}

listingsRouter.use(paymentMiddleware(
  {
    "GET /listings/:id/buy": {
      accepts: {
        scheme: "exact",
        network: process.env.X402_NETWORK!,
        maxTimeoutSeconds: 60,
        price: async (ctx) => `$${(await loadListing(ctx.path)).priceMicroUsdc / 1_000_000}`,
        payTo: async (ctx) => (await loadListing(ctx.path)).seller,
      },
    },
  },
  resourceServer,
));
```

The `scheme` and `network` fields are static (needed at startup for route validation), but `price` and `payTo` resolve per-request against the DB. Every buy request:

1. resolves the listing from the DB
2. returns a 402 challenge for `priceMicroUsdc` paid **directly to `seller`** (not the server)
3. on retry, x402 settles the transfer on-chain
4. the handler flips the ticket's owner and marks the listing `sold`

```ts
listingsRouter.get("/listings/:id/buy", async (c) => {
  const id = c.req.param("id");
  const buyer = c.req.query("buyer");
  const [listing] = await db.select().from(listings).where(eq(listings.id, id));

  // Payment already settled (seller received USDC). Transfer DB ownership.
  await db.update(tickets).set({ owner: buyer }).where(eq(tickets.id, listing.ticketId));
  await db.update(listings).set({ status: "sold" }).where(eq(listings.id, id));
  return c.json({ ok: true, ticketId: listing.ticketId, newOwner: buyer });
});
```

**This is peer-to-peer** — the server takes no cut, and the USDC moves straight from buyer to seller on-chain. The server's role is just to gate access to the DB transition.

→ [Next: 08 — Agent client](./08-agent-client.md)
