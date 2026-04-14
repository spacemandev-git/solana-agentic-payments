# 02 — Project setup

## Create the project

```bash
mkdir mlh-mpp-workshop && cd mlh-mpp-workshop
bun init -y
```

## Install dependencies

```bash
bun add hono drizzle-orm postgres zod
bun add @solana/mpp mppx
bun add @solana/kit @scure/base
bun add -d drizzle-kit @types/bun
```

Tour:

| Package | Why |
|---|---|
| `hono` | tiny HTTP framework, great Bun support |
| `drizzle-orm` + `drizzle-kit` | typed SQL + migrations for Postgres |
| `@solana/mpp` | the Solana payment method for MPP (ships `server` + `client` subpaths) |
| `mppx` | MPP's method-registry / `Mppx.create` runtime (peer dep of `@solana/mpp`) |
| `@solana/kit` | modern `@solana/web3.js` replacement — signers, tx builders |
| `@scure/base` | base58 encode/decode for Solana keys |
| `zod` | request validation |

Note: no `@x402/*` packages, no facilitator dep.

## `.env`

Copy [`solution-mpp/.env.example`](../solution-mpp/.env.example) to `.env`:

```bash
cp solution-mpp/.env.example .env
```

Key differences from the x402 `.env`:

- `DATABASE_URL` uses port **5434** (so both stacks can run side-by-side)
- `MPP_NETWORK` replaces `X402_NETWORK` — simple `"mainnet-beta"` string, no CAIP-2
- `MPP_SECRET_KEY` — a random string Mppx uses to sign challenges
- Only **one** wallet env pair (`SERVER_WALLET_*`) — no facilitator wallet
- `API_PORT` defaults to **4022** (x402 stack uses 4021)

## `tsconfig.json`

Same as [`solution-mpp/tsconfig.json`](../solution-mpp/tsconfig.json) — ESNext + bundler + strict.

## Project layout

```
solution-mpp/
├── src/
│   ├── index.ts              # Hono entrypoint
│   ├── wallet.ts             # keypair helpers
│   ├── fund.ts               # surfpool self-fund at boot
│   ├── mpp.ts                # Mppx + solana.charge — replaces x402-server.ts AND x402-facilitator.ts
│   ├── db/
│   │   ├── schema.ts
│   │   └── client.ts
│   └── routes/
│       ├── faucet.ts
│       ├── events.ts
│       └── listings.ts
├── scripts/setup-wallet.ts
├── agent-example/buy-event-ticket.ts
├── docker-compose.yml        # Postgres on :5434
└── drizzle.config.ts
```

Two files replaced one file: the x402 solution had `x402-facilitator.ts` + `x402-server.ts`; MPP collapses that into a single `mpp.ts`.

→ [Next: 03 — Database](./03-database.md)
