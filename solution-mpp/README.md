# solution-mpp

Complete working implementation of the event marketplace gated by the **Machine Payments Protocol** via the Solana Foundation's [`@solana/mpp`](https://github.com/solana-foundation/mpp-sdk) SDK. This is the reference answer to [`workshop-mpp/`](../workshop-mpp).

## What this does

- **Hono API** on `:4022` exposing the event-invite marketplace.
- **Inline MPP payment checks** via `Mppx.create({ methods: [solana.charge(...)] })` — no facilitator, no middleware, no separate verification service. The server itself verifies each payment credential and broadcasts the client-signed transaction directly to Solana.
- **Fee sponsorship**: the server wallet is passed as `signer` to `solana.charge`, so it co-signs every client transaction as fee payer. **Agent wallets need only USDC** — they never touch SOL.
- **Postgres** on `:5434` (via `docker-compose.yml`) — stores events, tickets, listings.
- **surfpool** at `http://127.0.0.1:8899` — mainnet-forking Solana validator (shared with the x402 stack if you're running both).
- **Agent demo** (`bun run agent:demo`) — generates a fresh wallet, pulls USDC (no SOL!) from the faucet, submits an event, and buys the first ticket. Two real on-chain USDC transfers; zero SOL spent by the agent.

Only one on-chain wallet is required: the server wallet. It both receives USDC and sponsors Solana fees.

## Endpoints

| Method & path | Paid | Notes |
|---|---|---|
| `GET /events` | free | list events + next ticket price |
| `GET /events/:id` | free | single event |
| `POST /events` | $1 USDC | submit a new event |
| `GET /events/:id/buy?buyer=<pubkey>` | **dynamic** ($1 × (sold+1)) | true bonding-curve price, inline |
| `GET /listings` | free | secondary-market listings |
| `POST /listings` | free | list a ticket you own |
| `GET /listings/:id/buy?buyer=<pubkey>` | listing price | buy a resale; USDC → seller, server sponsors fees |
| `POST /faucet` | free | preload a wallet with **USDC only** |

Every 402 response also renders as an interactive browser payment page (`html: true` on `solana.charge`). Open a paid URL in a browser and MPP serves a Solana-wallet-connect UI; hit it from an agent with `Accept: application/json` and you get the raw challenge.

## E2E — one-command demo

```bash
# terminal A
surfpool

# terminal B — one-liner e2e (after .env is populated)
bun run e2e        # docker up → db push → dev server → agent demo
```

Or the manual version:

```bash
docker compose up -d
bun run db:push
bun run dev &
sleep 2
bun run agent:demo
```

`bun run agent:demo` is the end-to-end script. It generates a fresh wallet, USDC-faucets it (no SOL!), submits an event (paying $1 via MPP), and buys the first ticket ($1 × 1 = $1). Balance deltas printed inline prove each transfer settled on-chain.

## One-time setup

```bash
cp .env.example .env
docker compose up -d
bun install
bun run db:push
bun run setup         # generates the server wallet, funds it
# Paste the 2 SERVER_WALLET_* lines into .env
```

## Architecture

```
┌──────────────┐    402 challenge     ┌─────────────────┐
│  Agent       │ ───────────────────► │  Hono API       │  Postgres :5434
│  @solana/mpp │ ◄─────────────────── │  + @solana/mpp  │
│  /client     │   MPP-Credential     │  :4022          │
└──────────────┘                      └────────┬────────┘
                                               │ verify + co-sign (fee payer) + broadcast
                                               ▼
                                       surfpool :8899 (mainnet fork)
```

No facilitator. One wallet. One process.

## File tour

| File | What |
|---|---|
| `src/index.ts` | Hono entrypoint — tops up the server wallet at boot, wires routes |
| `src/mpp.ts` | `Mppx.create({ methods: [solana.charge({ recipient, signer, ... })] })`. Also exports `mppxForRecipient(addr)` for dynamic per-seller recipients |
| `src/routes/events.ts` | inline `mppx.charge(...)` with `if (result.status===402) return result.challenge; ... result.withReceipt(resp)` |
| `src/routes/listings.ts` | per-request Mppx bound to each listing's seller — dynamic recipient AND amount |
| `src/routes/faucet.ts` | surfpool cheatcode wrapper — **USDC only** (proves fee sponsorship works) |
| `src/wallet.ts` | base58 keypair helpers (`@solana/kit`) |
| `scripts/setup-wallet.ts` | one-time server wallet generation + funding |
| `scripts/e2e.sh` | one-command `bun run e2e` orchestration |
| `agent-example/buy-event-ticket.ts` | e2e demo — fresh wallet → faucet → submit → buy |

## Key differences from `solution-x402/`

- **1 wallet** (server, double-use as fee payer) vs 2 (server + facilitator)
- **No facilitator** HTTP service — verification happens inline inside the Hono handler
- **Agent wallet holds USDC only, never SOL** — server co-signs transactions as fee payer
- **Payment check is a function call**, not middleware → per-request amounts, descriptions, and recipients are one-liners (no `DynamicPrice` callback gymnastics for bonding-curve pricing)
- **Server broadcasts the client-signed transaction** ("pull" mode) — flip `broadcast: true` on the client to switch to "push" mode where the client broadcasts itself
- **`html: true`** on the server gives you an interactive browser payment page for free
- See the root [README](../README.md) for the full comparison table.
