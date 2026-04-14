# 00 — Overview (MPP edition)

## What you're building

The same event marketplace as the x402 workshop — submit events, buy tickets, resell on a secondary market — but metered with the **Machine Payments Protocol** via [`@solana/mpp`](https://github.com/solana-foundation/mpp-sdk).

MPP is a Solana Foundation payment method built on the `402 Payment Required` convention. The client flow looks like x402, but the server side is simpler:

```
1. client: GET /events/abc/buy
2. server: 402  { amount: "1000000", currency: "<USDC mint>", recipient, methodDetails }
3. client: signs a USDC transferChecked transaction, retries with MPP-Credential header
4. server: verifies + (optionally) broadcasts the tx itself; returns 200 + MPP-Receipt
```

## How MPP differs from x402

| | x402 | MPP (`@solana/mpp`) |
|---|---|---|
| Facilitator | separate `/verify` + `/settle` HTTP service | none — server verifies and broadcasts directly |
| Wallets | **2** (server + facilitator) | **1** (server — also doubles as fee payer) |
| Fee sponsorship | facilitator pays SOL fees | server co-signs as fee payer → agent wallet needs **only USDC** |
| Middleware | `paymentMiddleware({...})` declarative route map | `mppx.charge({...})(request)` called inline — dynamic price/recipient are trivial |
| Broadcast | client broadcasts (exact scheme) | server broadcasts (pull mode) **or** client broadcasts (push mode) |
| Browser UX | JSON challenge only | `html: true` returns an interactive payment page for browsers |
| Split payments | one `payTo` | up to 8 `splits` — great for marketplace fees |

The practical wins:

- **Agents don't need SOL.** This alone simplifies onboarding enormously.
- **Dynamic pricing is just a function call** — no `DynamicPrice` callbacks, no facilitator startup race.
- **One process, one wallet**, one less moving part when deploying.

## Architecture

```
┌──────────────┐    402 challenge     ┌─────────────────┐
│  Agent       │ ───────────────────► │  Hono API       │  Postgres
│  (@solana/mpp │ ◄─────────────────── │  + @solana/mpp  │  ◄── events / tickets / listings
│   /client)   │   MPP-Credential     │  (this workshop)│
└──────────────┘   retry              └────────┬────────┘
                                               │ verify + broadcast (co-signed as fee payer)
                                               ▼
                                      ┌─────────────────┐
                                      │  surfpool RPC   │  mainnet fork @ :8899
                                      └─────────────────┘
```

Three processes: Postgres (Docker), surfpool (forked Solana validator), the Hono API. No facilitator.

## Chapters

| # | Chapter | Outcome |
|---|---|---|
| 01 | Prereqs | bun, docker, surfpool |
| 02 | Project setup | bun project + deps + env |
| 03 | Database | Drizzle schema (same as x402) |
| 04 | Server wallet + MPP | one wallet, `Mppx.create({ methods: [solana.charge(...)] })` |
| 05 | Faucet | `POST /faucet` — **USDC-only**, no SOL needed |
| 06 | Events API | inline `mppx.charge(...)` with true bonding-curve pricing |
| 07 | Listings | per-seller recipient via `mppxForRecipient` |
| 08 | Agent client | `Mppx.create({ methods: [solana.charge({ signer })] }).fetch(url)` |

→ [Next: 01 — Prerequisites](./01-prereqs.md)
