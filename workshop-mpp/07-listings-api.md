# 07 — Secondary market listings

Each listing's buy URL pays a different seller at a different price. In x402 this required the `DynamicPrice` / `DynamicPayTo` callback form in middleware. In MPP, because charging is a plain function call, we just build an Mppx bound to the seller on the fly.

See [`solution-mpp/src/routes/listings.ts`](../solution-mpp/src/routes/listings.ts).

## Create (free)

Identical to the x402 version — validate ownership, insert, return a `paymentUrl`:

```ts
listingsRouter.post("/listings", async (c) => {
  const { ticketId, seller, priceMicroUsdc } = Create.parse(await c.req.json());
  // ownership check + insert ...
  return c.json({ ...created, paymentUrl: `${origin}/listings/${created.id}/buy?buyer=<your-pubkey>` }, 201);
});
```

## Buy (dynamic recipient + dynamic amount)

```ts
listingsRouter.get("/listings/:id/buy", async (c) => {
  const [listing] = await db.select().from(listings).where(eq(listings.id, c.req.param("id")));
  if (!listing || listing.status !== "open") return c.json({ error: "unavailable" }, 410);

  const result = await mppxForRecipient(listing.seller).charge({
    amount: String(listing.priceMicroUsdc),
    currency: USDC,
    description: `buy listing ${listing.id}`,
    externalId: `listing:${listing.id}`,
  })(c.req.raw);
  if (result.status === 402) return result.challenge;

  // payment settled — seller received USDC on-chain, server paid SOL fees.
  await db.update(tickets).set({ owner: c.req.query("buyer")! }).where(eq(tickets.id, listing.ticketId));
  await db.update(listings).set({ status: "sold" }).where(eq(listings.id, listing.id));
  return result.withReceipt(c.json({ ok: true }));
});
```

The pattern:

1. Load the listing from the DB.
2. Build an Mppx bound to the listing's seller (`mppxForRecipient`).
3. Charge the listing's price.
4. After the receipt lands, mutate DB ownership + status.

**Peer-to-peer USDC, server-sponsored fees.** The USDC moves buyer → seller directly on-chain; the server neither touches nor takes a cut. It only pays the SOL fee.

## Marketplace fees via splits

If you wanted the server to take a platform fee, MPP has native support — add a `splits` array to `solana.charge(...)`:

```ts
solana.charge({
  recipient: listing.seller,
  splits: [
    { recipient: PLATFORM, amount: String(Math.floor(listing.priceMicroUsdc * 0.05)) },
  ],
  // ... everything else ...
});
```

Up to 8 split destinations. In x402 you'd have to add a second payment or settle two transfers manually.

→ [Next: 08 — Agent client](./08-agent-client.md)
