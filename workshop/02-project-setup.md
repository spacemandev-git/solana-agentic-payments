# 02 — Project setup

## Create the project

```bash
mkdir mlh-x402-workshop && cd mlh-x402-workshop
bun init -y
```

## Install dependencies

```bash
bun add hono drizzle-orm postgres zod
bun add @x402/core @x402/hono @x402/svm @x402/fetch
bun add @solana/kit @scure/base
bun add -d drizzle-kit @types/bun
```

Quick tour:

| Package | Why |
|---|---|
| `hono` | tiny HTTP framework, great Bun support |
| `drizzle-orm` + `drizzle-kit` | typed SQL + migrations for Postgres |
| `@x402/hono` | Hono middleware that 402-gates routes |
| `@x402/svm` | Solana (SVM) implementation of the x402 `exact` scheme |
| `@x402/core` | facilitator client + `x402Client` registry |
| `@x402/fetch` | client-side wrapper that handles 402 retries |
| `@solana/kit` | modern replacement for `@solana/web3.js`; signers + keypairs |
| `@scure/base` | base58 encode/decode for Solana addresses & secret keys |
| `zod` | request validation |

## `.env`

Copy [`solution/.env.example`](../solution/.env.example) to `.env`:

```bash
cp solution/.env.example .env
```

You'll fill in the four wallet fields after chapter 04.

## `tsconfig.json`

Copy [`solution/tsconfig.json`](../solution/tsconfig.json) verbatim — modern ESNext + bundler resolution + strict mode.

## Project layout

```
solution/
├── src/
│   ├── index.ts              # Hono entrypoint
│   ├── wallet.ts             # keypair helpers
│   ├── fund.ts               # surfpool self-fund helper (runs at boot)
│   ├── x402-facilitator.ts   # local x402 facilitator (bundled)
│   ├── x402-server.ts        # paymentMiddleware wiring
│   ├── db/
│   │   ├── schema.ts         # Drizzle tables
│   │   └── client.ts
│   └── routes/
│       ├── faucet.ts
│       ├── events.ts
│       └── listings.ts
├── scripts/setup-wallet.ts   # generate & fund wallets
├── agent-example/buy-event-ticket.ts
├── docker-compose.yml        # Postgres on host port 5433
└── drizzle.config.ts
```

→ [Next: 03 — Database](./03-database.md)
