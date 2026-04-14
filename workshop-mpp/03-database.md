# 03 — Database

The schema is identical to the x402 workshop — MPP changes the payment layer, not the data model.

## Start Postgres

```bash
docker compose up -d
```

Single Postgres 16 container on host port **5434** (x402 uses 5433, so the two stacks coexist cleanly).

## Schema

Three tables, same as before ([`solution-mpp/src/db/schema.ts`](../solution-mpp/src/db/schema.ts)):

- `events` — name, description, maxTickets, ticketsSold, creator
- `tickets` — eventId, owner, pricePaidMicroUsdc
- `listings` — ticketId, seller, priceMicroUsdc, status

Prices stay in **micro-USDC** integer form. MPP's `amount` field also wants the base-unit amount as a string, so `microToAmount(micro) = String(micro)` is all the conversion you need.

## Push schema

```bash
bun run db:push
```

→ [Next: 04 — Server wallet & MPP](./04-wallet-and-mpp.md)
