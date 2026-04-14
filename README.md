# MLH Workshop — Agent-to-Agent USDC Payments on Solana

A 45-minute workshop where you build an HTTP API that charges real USDC per request on Solana, then watch an AI agent autonomously pay for and compose those endpoints. You'll build the **same** event-invite marketplace **twice** — once with **x402** and once with **MPP** (`@solana/mpp`) — to feel the trade-offs between the two machine-payment protocols firsthand.

## What you'll build

An event-invite marketplace where every write costs USDC:

- `POST /events` — submit an event (costs **$1 USDC**)
- `GET /events` / `GET /events/:id` — free, list/inspect events
- `GET /events/:id/buy` — buy a ticket (price = `$1 × (tickets_sold + 1)`)
- `POST /listings` — list a ticket you own for resale
- `GET /listings/:id/buy` — buy a specific secondary-market listing (USDC → seller)
- `POST /faucet` — free USDC for testing

Every paid route speaks `402 Payment Required`: the server returns a challenge, the client signs a Solana USDC transfer, retries with a credential header, and the server verifies the transfer on-chain before returning the resource. No API keys. No accounts. No Stripe. Agents just pay.

---

## A quick intro to x402 and MPP

### HTTP 402 — the forgotten status code

Both protocols are modern takes on `402 Payment Required`, the status code the web left on the shelf in 1996. The pattern is the same on both:

```
1. client → server     GET /paid/resource
2. server → client     402 Payment Required  + { amount, recipient, network, ... }
3. client              signs a stablecoin transfer that matches the challenge
4. client → server     GET /paid/resource  + credential header
5. server              verifies the payment on-chain
6. server → client     200 OK + the resource  (and a receipt header)
```

No session. No state between requests. The HTTP URL itself is the payment link.

### x402

[x402](https://x402.org) is Coinbase-incubated and **chain-agnostic**. It splits the world into three actors:

- **Resource server** — your API. Gates routes with a `paymentMiddleware` that emits 402 challenges.
- **Client** — an agent (or browser) using a `pay`-wrapped `fetch` that auto-retries 402s by signing a transfer.
- **Facilitator** — a separate HTTP service exposing `/verify` and `/settle`. It's the only piece that touches chain — it validates the payment payload and (for the Solana `exact` scheme) broadcasts the transaction.

Resource servers are cheap to run because they don't hold chain credentials. The facilitator can be shared across many APIs (that's the design intent) or bundled in-process for local dev. Today x402 ships production-ready schemes for both EVM chains and Solana.

### MPP (`@solana/mpp`)

[MPP](https://github.com/solana-foundation/mpp-sdk) is the Solana Foundation's take on Stripe / Tempo's **Machine Payments Protocol** — Solana-native by design, bundled as a single SDK that does verify + settle **inline, in your server process**. There's no facilitator. Key ergonomics for Solana:

- **Fee sponsorship** — pass your server wallet as `signer` to `solana.charge(...)` and the server co-signs every client transaction as fee payer. Agent wallets hold USDC only. They never need SOL.
- **Inline payment checks** — `mppx.charge({ amount, currency, description })(request)` is a plain function call inside your handler, which makes dynamic pricing, per-seller recipients, and per-request `externalId`s trivial (no middleware callbacks).
- **Pull or push settlement** — client can sign-and-let-server-broadcast (pull, default) or sign-and-self-broadcast (push).
- **Splits built-in** — up to 8 recipients per payment (marketplace take-rates without extra transfers).
- **Browser UX free** — `html: true` turns every 402-gated URL into an interactive Solana-wallet payment page when opened in a browser.

The trade-off: MPP is Solana-only, and your server now holds keys (to sponsor fees), where x402 lets you push that responsibility to a facilitator operator.

### Side-by-side

|                           | **x402**                                                                         | **MPP (`@solana/mpp`)**                            |
| ------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------- |
| Architecture              | Resource server + **separate facilitator** (`/verify` + `/settle`)               | One server verifies and broadcasts directly        |
| Wallets                   | 2 (server receives USDC, facilitator pays SOL)                                   | 1 (server does both)                               |
| Agent needs SOL?          | Yes — agent signs and broadcasts                                                 | **No** — server co-signs as fee payer              |
| Integration               | Declarative middleware (`paymentMiddleware({ "POST /events": {accepts: ...} })`) | Inline (`const r = await mppx.charge({...})(req)`) |
| Dynamic price / recipient | `DynamicPrice` / `DynamicPayTo` callbacks                                        | Just arguments to each call                        |
| Settlement                | Client-broadcast (`exact` scheme)                                                | Pull (server) or push (client)                     |
| Marketplace splits        | Manual                                                                           | `splits: [...]` up to 8                            |
| Browser UX                | JSON only                                                                        | `html: true` → payment page                        |
| Network id                | CAIP-2 (`solana:5eykt4Us...`)                                                    | `"mainnet-beta"` \| `"devnet"` \| `"localnet"`     |
| Ecosystem                 | Chain-agnostic (EVM + SVM)                                                       | Solana-first                                       |

**Pick x402 when:** you want a protocol portable across chains, you like separating settlement from resource provision, or you're building a network of metered APIs that share a facilitator.

**Pick MPP when:** you're Solana-only, you want the simplest ops footprint (one process, one wallet), you want agents that hold USDC without ever touching SOL, or you need splits / dynamic pricing / browser payment pages with zero additional code.

---

## Repository layout

```
.
├── README.md                       ← you are here
├── SKILL.md                        ← agent skill file (x402 variant)
│
├── workshop-x402/                  ← x402 track — 8 chapters, ~5 min each
│   ├── 00-overview.md
│   ├── 01-prereqs.md
│   ├── 02-project-setup.md
│   ├── 03-database.md
│   ├── 04-wallet-and-facilitator.md
│   ├── 05-faucet.md
│   ├── 06-events-api.md
│   ├── 07-listings-api.md
│   └── 08-agent-client.md
│
├── solution-x402/                  ← x402 reference implementation (run `bun e2e`)
│   ├── README.md                   ← what it does, how to run, file tour
│   ├── src/
│   │   ├── index.ts                ← Hono entrypoint
│   │   ├── x402-facilitator.ts     ← bundled local facilitator
│   │   ├── x402-server.ts          ← resourceServer + paymentMiddleware wiring
│   │   ├── wallet.ts  fund.ts
│   │   ├── db/{schema,client}.ts
│   │   └── routes/{events,listings,faucet}.ts
│   ├── scripts/{setup-wallet.ts, e2e.sh}
│   ├── agent-example/buy-event-ticket.ts  ← autonomous agent demo
│   ├── docker-compose.yml          ← Postgres :5433
│   └── package.json                ← ports :4020 (facilitator) + :4021 (API)
│
├── workshop-mpp/                   ← MPP track — mirrored 8 chapters
│   ├── 00-overview.md              ← explicit x402-vs-MPP comparisons throughout
│   ├── 01-prereqs.md
│   ├── 02-project-setup.md
│   ├── 03-database.md
│   ├── 04-wallet-and-mpp.md        ← replaces "wallet-and-facilitator"
│   ├── 05-faucet.md                ← USDC-only (no SOL given to agent)
│   ├── 06-events-api.md            ← inline charge, true bonding-curve pricing
│   ├── 07-listings-api.md          ← per-request Mppx bound to each seller
│   └── 08-agent-client.md
│
└── solution-mpp/                   ← MPP reference implementation (run `bun e2e`)
    ├── README.md                   ← what it does, how to run, file tour
    ├── src/
    │   ├── index.ts                ← Hono entrypoint (no facilitator boot)
    │   ├── mpp.ts                  ← Mppx.create + solana.charge (replaces both x402 files)
    │   ├── wallet.ts  fund.ts
    │   ├── db/{schema,client}.ts
    │   └── routes/{events,listings,faucet}.ts
    ├── scripts/{setup-wallet.ts, e2e.sh}
    ├── agent-example/buy-event-ticket.ts
    ├── docker-compose.yml          ← Postgres :5434
    └── package.json                ← port :4022 (API only)
```

The two stacks use different ports (API 4021 vs 4022, Postgres 5433 vs 5434), so you can run both at the same time against one surfpool.

## Workshops vs. solutions

- **`workshop-*/`** — markdown chapters, 5 min each. Each one points at the corresponding file in `solution-*/` for the full code. Work top-to-bottom in order.
- **`solution-*/`** — the complete working code. Run `bun e2e` in either directory to bring up Postgres, push the schema, boot the API, and run the autonomous agent demo end-to-end. If you'd rather skip to running code before reading, start here.

---

## Prerequisites (both tracks)

- [Bun](https://bun.sh) ≥ 1.1
- [Docker](https://docker.com) (Postgres)
- [surfpool](https://docs.surfpool.run) — mainnet-forking Solana validator

## Run the x402 track

```bash
# Terminal 1 — validator
surfpool

# Terminal 2 — one-time setup, then e2e
cd solution-x402
cp .env.example .env
bun install
bun run setup         # generates server + facilitator wallets; paste printed env vars into .env
bun run e2e           # docker up → db push → API + facilitator → agent demo
```

See [`workshop-x402/00-overview.md`](./workshop-x402/00-overview.md) for the full chapter walk-through, or [`solution-x402/README.md`](./solution-x402/README.md) for an orientation on the code.

## Run the MPP track

```bash
# Terminal 1 — validator (share with x402 if already running)
surfpool

# Terminal 2 — one-time setup, then e2e
cd solution-mpp
cp .env.example .env
bun install
bun run setup         # generates the single server wallet; paste printed env vars into .env
bun run e2e           # docker up → db push → API → agent demo
```

Notice the MPP agent is funded with **USDC only** — fee sponsorship covers SOL. See [`workshop-mpp/00-overview.md`](./workshop-mpp/00-overview.md) or [`solution-mpp/README.md`](./solution-mpp/README.md).

## Agents

[`SKILL.md`](./SKILL.md) documents the x402 track as an agent skill — drop it into `~/.claude/skills/mlh-x402-events/SKILL.md` (or your agent's equivalent) and any capable agent can buy events and tickets on your behalf. An `@solana/mpp`-based skill is a straightforward port — the endpoints are identical, only the payment wrapper changes (`wrapFetchWithPayment(fetch, x402Client)` → `Mppx.create({ methods: [solana.charge({ signer })] }).fetch`).
