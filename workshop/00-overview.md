# 00 — Overview

## What you're building

An HTTP API for an event marketplace where **every paid action costs real USDC** — no accounts, no API keys, no credit cards. An AI agent can discover your endpoints, pay for them, and compose them into workflows on its own.

The protocol that makes this work is **x402**. It's HTTP 402 Payment Required, revived for 2026:

```
1. client: GET /events/abc/buy
2. server: 402 Payment Required
             { price: $2.00 USDC, payTo: <server pubkey>, network: solana:... }
3. client: signs a USDC transfer on Solana, retries with X-PAYMENT header
4. server: verifies on-chain via a "facilitator" service, returns the resource
```

No state between requests. No session. Pure pay-per-call.

## Architecture

```
┌──────────────┐    402 challenge     ┌─────────────────┐
│  Agent       │ ───────────────────► │  Hono API       │  Postgres
│  (@x402/fetch)│ ◄─────────────────── │  (this workshop)│  ◄── events / tickets / listings
└──────┬───────┘   X-PAYMENT retry    └────────┬────────┘
       │                                       │ verify/settle
       │  signs Solana tx                      ▼
       │                              ┌─────────────────┐
       └─────────────────────────────►│  Facilitator    │
                                      │  (bundled)      │
                                      └────────┬────────┘
                                               │ submit tx
                                               ▼
                                      ┌─────────────────┐
                                      │  surfpool RPC   │  mainnet fork @ :8899
                                      └─────────────────┘
```

Four processes total — Postgres (Docker), surfpool (forked Solana validator), the facilitator (bundled in-process), and the Hono API. One `bun dev` brings up the last three; Docker handles Postgres.

## What you get from each workshop chapter

| # | Chapter | Outcome |
|---|---|---|
| 01 | Prereqs | bun, docker, surfpool installed |
| 02 | Project setup | bun project, dependencies, env |
| 03 | Database | Drizzle schema + running Postgres |
| 04 | Wallet & facilitator | server wallet funded, facilitator running |
| 05 | Faucet | `POST /faucet` gives anyone free USDC |
| 06 | Events API | submit/list/get/buy events via x402 |
| 07 | Listings | P2P resale URLs (URL = payment link) |
| 08 | Agent client | An agent that buys tickets autonomously |

Each chapter is ~5 minutes. Let's go.

→ [Next: 01 — Prerequisites](./01-prereqs.md)
