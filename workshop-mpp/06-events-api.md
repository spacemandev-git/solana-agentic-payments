# 06 — Events API

See [`solution-mpp/src/routes/events.ts`](../solution-mpp/src/routes/events.ts).

## Free reads — identical to the x402 version

```ts
eventsRouter.get("/events", async (c) => {
  const all = await db.select().from(events);
  return c.json(all.map(withPrice));
});
```

`withPrice` attaches `nextTicketPriceMicroUsdc = 1_000_000 × (ticketsSold + 1)`.

## Paid writes — inline `mppx.charge(...)`

This is where MPP is noticeably nicer than x402. The payment check is just a function call inside the handler, so you can trivially:

- set the amount dynamically (bonding-curve pricing for free)
- include a `description` + `externalId` per request (great for reconciliation)
- control exactly when to return the receipt vs. short-circuit

```ts
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
```

### Dynamic per-ticket pricing (free!)

In the x402 version, true bonding-curve pricing on `/events/:id/buy` required `DynamicPrice` callbacks bound into middleware. In MPP, it's just:

```ts
eventsRouter.get("/events/:id/buy", async (c) => {
  const [evt] = await db.select().from(events).where(eq(events.id, c.req.param("id")));
  if (!evt) return c.json({ error: "event not found" }, 404);

  const price = 1_000_000 * (evt.ticketsSold + 1);

  const result = await mppx.charge({
    amount: String(price),
    currency: USDC,
    description: `buy ticket #${evt.ticketsSold + 1} for ${evt.name}`,
    externalId: `${evt.id}:${evt.ticketsSold + 1}`,
  })(c.req.raw);
  if (result.status === 402) return result.challenge;

  // ... mint ticket, bump ticketsSold ...
  return result.withReceipt(c.json({ ticket, pricePaidMicroUsdc: price }));
});
```

`externalId` is MPP's reconciliation hook — it comes back in the on-chain receipt, so you can correlate the Solana signature to your DB state.

## What the 402 looks like

```
$ curl -i http://127.0.0.1:4022/events
HTTP/1.1 402 Payment Required
Content-Type: application/json

{
  "method": "solana",
  "challenge": {
    "id": "...",
    "request": {
      "amount": "1000000",
      "currency": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      "recipient": "<server wallet>",
      "methodDetails": {
        "network": "mainnet-beta",
        "decimals": 6,
        "tokenProgram": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
        "feePayer": true,
        "feePayerKey": "<server wallet>",
        "recentBlockhash": "<prefetched>"
      }
    }
  }
}
```

Three things the client gets "for free" versus the x402 challenge:

- **`feePayerKey`** — the client knows it doesn't need SOL
- **`recentBlockhash`** — saves the client an RPC round-trip
- **`tokenProgram`** — explicit Token / Token-2022 selection

## Browser payment page

Because we set `html: true`, hitting the same URL in a browser returns an interactive page that opens a Solana wallet and signs the transaction for you. Useful for demos / human-facing flows without writing any frontend.

## Run it

```bash
bun run dev
```

→ [Next: 07 — Listings](./07-listings-api.md)
