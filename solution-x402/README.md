# solution-x402

Complete working implementation of the event marketplace gated by the **[x402](https://x402.org) protocol** (`@x402/*` packages). This is the reference answer to [`workshop-x402/`](../workshop-x402).

## What this does

- **Hono API** on `:4021` exposing the event-invite marketplace (see endpoints below).
- **Local x402 facilitator** bundled in-process on `:4020` — verifies and settles payments that the API's `paymentMiddleware` hands off.
- **Postgres** on `:5433` (via `docker-compose.yml`) — stores events, tickets, listings.
- **surfpool** at `http://127.0.0.1:8899` — a mainnet-forking Solana validator you run yourself. The API self-funds its server + facilitator wallets at every boot via surfpool cheatcodes (so restarting surfpool doesn't brick the workshop).
- **Agent demo** (`bun run agent:demo`) — an autonomous script that generates a fresh wallet, faucets itself, submits an event, and buys the first ticket; every payment settles real USDC on-chain through the x402 handshake.

Two on-chain wallets are required: the **server wallet** (receives USDC) and the **facilitator wallet** (pays Solana transaction fees).

## Endpoints

| Method & path | Paid | Notes |
|---|---|---|
| `GET /events` | free | list events + next ticket price |
| `GET /events/:id` | free | single event |
| `POST /events` | $1 USDC | submit a new event |
| `GET /events/:id/buy?buyer=<pubkey>` | $1 USDC | mint the next ticket |
| `GET /listings` | free | secondary-market listings |
| `POST /listings` | free | list a ticket you own |
| `GET /listings/:id/buy?buyer=<pubkey>` | listing price | buy a resale (USDC → seller directly) |
| `POST /faucet` | free | preload a wallet with SOL + USDC (surfpool cheatcode) |

## E2E — one-command demo

After a one-time setup (below), the whole loop is:

```bash
# terminal A
surfpool

# terminal B — start the stack
bun run e2e        # docker up, db push, wallet setup/boot, dev server, agent demo

# or do it manually:
docker compose up -d
bun run db:push
bun run setup      # (first run only) paste the printed env vars into .env
bun run dev &      # API + facilitator
sleep 2
bun run agent:demo
```

`bun run agent:demo` is the end-to-end script. It generates a fresh agent wallet, pulls USDC from the faucet, submits an event (paying $1 via x402), and buys the first ticket (another $1). Each x402 handshake is diagrammed in the terminal with live before/after on-chain balance deltas.

## One-time setup

```bash
cp .env.example .env
docker compose up -d
bun install
bun run db:push
bun run setup         # generates server + facilitator wallets, funds them
# Paste the 4 *_SECRET / *_ADDRESS lines it prints into .env
```

## Architecture

```
┌──────────────┐    402 challenge     ┌─────────────────┐
│  Agent       │ ───────────────────► │  Hono API       │  Postgres :5433
│  @x402/fetch │ ◄─────────────────── │  :4021          │
└──────┬───────┘   X-PAYMENT retry    └────────┬────────┘
       │                                       │ /verify + /settle
       │  signs Solana tx                      ▼
       │                              ┌─────────────────┐
       └─────────────────────────────►│  Facilitator    │  :4020 (bundled)
                                      └────────┬────────┘
                                               │ broadcast
                                               ▼
                                       surfpool :8899 (mainnet fork)
```

## File tour

| File | What |
|---|---|
| `src/index.ts` | Hono entrypoint — wires routes, starts facilitator, tops up wallets |
| `src/x402-facilitator.ts` | local x402 facilitator — three HTTP routes (`/verify`, `/settle`, `/supported`) |
| `src/x402-server.ts` | `resourceServer` + `usdcAccepts()` helpers used by `paymentMiddleware` |
| `src/routes/events.ts` | paid `POST /events` + `GET /events/:id/buy`, gated via `paymentMiddleware` |
| `src/routes/listings.ts` | dynamic-price per-listing payments using `DynamicPrice` / `DynamicPayTo` |
| `src/routes/faucet.ts` | surfpool cheatcode wrapper — free SOL + USDC for any address |
| `src/wallet.ts` | base58 keypair helpers (`@solana/kit`) |
| `scripts/setup-wallet.ts` | one-time wallet generation + seed funding |
| `agent-example/buy-event-ticket.ts` | the e2e demo script |

## Compared to `solution-mpp/`

- Two wallets (server + facilitator) vs one
- Facilitator is a separate HTTP service vs no facilitator
- Agent wallet needs SOL for fees vs USDC-only
- Middleware-driven route gating vs inline `mppx.charge(...)` call
- See the root [README](../README.md) for the full comparison.
