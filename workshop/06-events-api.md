# 06 — Events API

The meat of the workshop. See [`solution/src/routes/events.ts`](../solution/src/routes/events.ts).

## Free reads

```ts
eventsRouter.get("/events", async (c) => {
  const all = await db.select().from(events);
  return c.json(all.map(withPrice));
});

eventsRouter.get("/events/:id", async (c) => {
  const [row] = await db.select().from(events).where(eq(events.id, c.req.param("id")));
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json(withPrice(row));
});
```

`withPrice` attaches the current primary-market price so a client knows what the next ticket will cost before hitting `/buy`:

```ts
function withPrice(e) {
  return { ...e, nextTicketPriceMicroUsdc: 1_000_000 * (e.ticketsSold + 1) };
}
```

## Paid writes (x402!)

This is where x402 earns its keep. One `paymentMiddleware` call gates both `POST /events` and `GET /events/:id/buy`:

```ts
eventsRouter.use(
  paymentMiddleware(
    {
      "POST /events": {
        accepts: usdcAccepts(1_000_000, SERVER, "submit an event"),
      },
      "GET /events/:id/buy": {
        accepts: usdcAccepts(1_000_000, SERVER, "buy a ticket"),
      },
    },
    resourceServer,
    undefined, undefined,
    false, // skip facilitator sync here — we call resourceServer.initialize() explicitly in index.ts after the facilitator starts
  ),
);
```

`usdcAccepts(microUsdc, payTo, description)` builds the x402 challenge payload:

```ts
{
  scheme: "exact",
  price: "$1.00",
  network: "solana:5eykt4...",
  payTo: "<server pubkey>",
  maxTimeoutSeconds: 60,
  description,
}
```

## What happens on an unpaid request

```
$ curl -i http://127.0.0.1:4021/events/abc/buy?buyer=SomePubkey
HTTP/1.1 402 Payment Required
Content-Type: application/json

{
  "x402Version": 2,
  "accepts": [{
    "scheme":"exact","network":"solana:5eykt4...","price":"$1.00",
    "payTo":"<server pubkey>","maxTimeoutSeconds":60,
    "description":"buy a ticket"
  }]
}
```

The client (`@x402/fetch`) reads this, signs a Solana USDC transfer for $1 to the `payTo` address, and retries with:

```
X-PAYMENT: <base64-signed-payment-payload>
```

The middleware hands the header to the facilitator (`/verify` → `/settle`), and on success lets the request through to the actual handler:

```ts
eventsRouter.post("/events", async (c) => {
  const parsed = Submit.parse(await c.req.json());
  const [created] = await db.insert(events).values(parsed).returning();
  return c.json(withPrice(created), 201);
});
```

## Run it

```bash
bun run dev
```

You should see:

```
facilitator  ready on http://127.0.0.1:4020
api          ready on http://127.0.0.1:4021
```

Try:

```bash
curl http://127.0.0.1:4021/events                         # []
curl -i http://127.0.0.1:4021/events \
  -X POST -H 'content-type: application/json' \
  -d '{"name":"test","description":"x","maxTickets":10,"creator":"<pubkey>"}'
# => 402 Payment Required  (correct! no X-PAYMENT header)
```

We'll pay for real from an agent in chapter 08.

## Exercise: dynamic per-ticket pricing

The solution charges a flat `$1` for every ticket to keep the middleware declarative. For the real bonding curve (`$1 × (sold+1)`), use `paymentMiddleware`'s `accepts` function form — just like we do for listings in the next chapter. Try it!

→ [Next: 07 — Listings](./07-listings-api.md)
