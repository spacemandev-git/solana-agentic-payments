# MLH Workshop — Agent-to-Agent USDC Payments on Solana

One workshop, two payment protocols. Build the same event-invite marketplace with **x402** and with **[MPP (`@solana/mpp`)](https://github.com/solana-foundation/mpp-sdk)**, then compare.

## What you'll build (either track)

An event-invite marketplace:

- `POST /events` — submit an event (costs **$1 USDC**)
- `GET /events` / `GET /events/:id` — free, list/inspect
- `GET /events/:id/buy` — buy a ticket (price = `$1 × (tickets_sold + 1)`)
- `POST /listings` — list a ticket you own for resale
- `GET /listings/:id/buy` — buy a specific listing (paid directly to seller)
- `POST /faucet` — free USDC for testing

Every paid route returns `402 Payment Required` with a challenge; an AI agent signs a Solana USDC transfer, retries, and gets the resource.

## Two tracks, two protocols

| | [x402 track](./workshop-x402/00-overview.md) | [MPP track](./workshop-mpp/00-overview.md) |
|---|---|---|
| Protocol | [x402](https://x402.org) (`@x402/*`) | MPP via [`@solana/mpp`](https://github.com/solana-foundation/mpp-sdk) |
| Solution | [`solution-x402/`](./solution-x402) | [`solution-mpp/`](./solution-mpp) |
| Chapters | [`workshop-x402/`](./workshop-x402) | [`workshop-mpp/`](./workshop-mpp) |
| API port | 4021 | 4022 |
| Postgres port | 5433 | 5434 |

Both tracks run side-by-side against the same surfpool RPC — spin up both if you want to compare.

## x402 vs. MPP — the gist

Both protocols are flavors of HTTP 402. They differ in where verification happens, how many wallets you run, and how dynamic pricing is expressed:

| | **x402** | **MPP (`@solana/mpp`)** |
|---|---|---|
| Architecture | Resource server + **separate Facilitator service** (`/verify` + `/settle`) | Single server verifies and broadcasts directly |
| Wallets needed | 2 — server (receives USDC) + facilitator (pays SOL fees) | 1 — server wallet doubles as fee payer |
| Client needs SOL? | Yes — client signs *and broadcasts* | **No** (pull mode + `signer`) — server co-signs as fee payer and broadcasts |
| Integration shape | Declarative middleware: `paymentMiddleware({ "POST /events": {accepts: ...} })` | Inline function call: `const r = await mppx.charge({...})(req); if (r.status===402) return r.challenge` |
| Dynamic price / payTo | `DynamicPrice` / `DynamicPayTo` callback fields on `accepts` | Trivial — `amount`/`recipient` are just arguments each call |
| Settlement modes | Client-broadcast only (exact scheme) | Pull (server broadcasts) **or** push (client broadcasts) |
| Marketplace splits | Manual — do multiple payments | Built in — `splits: [...]` up to 8 recipients |
| Browser UX | JSON challenge only | `html: true` → interactive payment page for browsers |
| Network identifier | CAIP-2 (`solana:5eykt4Us...`) | Plain string (`"mainnet-beta"` \| `"devnet"` \| `"localnet"`) |
| Ecosystem | Chain-agnostic by design — EVM, SVM, more | Solana-first, part of the broader MPP protocol (`mppx`) |

**When to pick x402**: you want a protocol that's portable across chains; you're OK running (or trusting) a facilitator; you're building a network of metered APIs. The facilitator separation is also a plus when you want settlement infra owned by a different entity than resource provision.

**When to pick MPP (`@solana/mpp`)**: you're Solana-only; you want the simplest operational footprint (one process, one wallet); you want your agents/users to hold USDC without also managing SOL; you need dynamic pricing, per-request reconciliation IDs, splits, or a zero-config browser payment page.

## Prerequisites (both tracks)

- [Bun](https://bun.sh) ≥ 1.1
- [Docker](https://docker.com) (Postgres)
- [surfpool](https://docs.surfpool.run) — mainnet-forking Solana validator

## Run the x402 track

```bash
# Terminal 1 — validator
surfpool

# Terminal 2 — API + bundled facilitator
cd solution-x402
cp .env.example .env
docker compose up -d
bun install
bun run db:push
bun run setup         # copy the four *_SECRET/*_ADDRESS lines into .env
bun run dev

# Terminal 3 — agent
cd solution-x402 && bun run agent:demo
```

See [`workshop-x402/00-overview.md`](./workshop-x402/00-overview.md) for the full chapter walk-through.

## Run the MPP track

```bash
# Terminal 1 — validator (share with x402 if already running)
surfpool

# Terminal 2 — API (no facilitator!)
cd solution-mpp
cp .env.example .env
docker compose up -d
bun install
bun run db:push
bun run setup         # copy the two SERVER_WALLET_* lines into .env
bun run dev

# Terminal 3 — agent
cd solution-mpp && bun run agent:demo
```

See [`workshop-mpp/00-overview.md`](./workshop-mpp/00-overview.md) for the walk-through. Notice the MPP agent is funded with **USDC only** — fee sponsorship covers SOL.

## Agents

[`SKILL.md`](./SKILL.md) documents the x402 track as an agent skill. An `@solana/mpp`-based skill is a straightforward port — the endpoints are identical, only the payment wrapper changes (`wrapFetchWithPayment(fetch, x402Client)` → `Mppx.create({ methods: [solana.charge({ signer })] }).fetch`).
