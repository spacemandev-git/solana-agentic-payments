# MLH x402 Workshop — Agent-to-Agent Payments on Solana

A 45-minute workshop where you build an HTTP API that charges real USDC per request on Solana, then use an AI agent to autonomously pay for and interact with it.

## What you'll build

An event-invite marketplace:

- `POST /events` — anyone can submit an event (costs **$1 USDC**, paid via x402)
- `GET /events` / `GET /events/:id` — free, list/inspect events
- `GET /events/:id/buy` — buy a ticket (price = `$1 × (tickets_sold + 1)`, paid via x402)
- `POST /listings` — list a ticket you own for resale at any USDC price
- `GET /listings/:id/buy` — buy a specific secondary-market listing (paid via x402)
- `POST /faucet` — free USDC for anyone testing (via surfpool cheatcode)

Every paid route speaks the [x402](https://x402.org) HTTP 402 protocol: an unauthenticated GET returns `402 Payment Required` with a challenge; the client signs a Solana USDC transfer and retries with an `X-PAYMENT` header; the server verifies on-chain and returns the resource.

## Why this matters

x402 turns any HTTP endpoint into a metered, machine-payable API. No API keys, no Stripe accounts, no OAuth — agents discover a price, pay, and get the resource. This is what agent-to-agent commerce looks like.

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.1
- [Docker](https://docker.com) (for Postgres)
- [surfpool](https://docs.surfpool.run) — mainnet-forking Solana validator

## Workshop structure

Work through these in order:

1. [Overview & architecture](./workshop/00-overview.md)
2. [Prerequisites & install](./workshop/01-prereqs.md)
3. [Project setup](./workshop/02-project-setup.md)
4. [Database schema (Drizzle + Postgres)](./workshop/03-database.md)
5. [Server wallet & local x402 facilitator](./workshop/04-wallet-and-facilitator.md)
6. [Free-USDC faucet (surfpool cheatcode)](./workshop/05-faucet.md)
7. [Events API (x402-gated)](./workshop/06-events-api.md)
8. [Secondary market listings](./workshop/07-listings-api.md)
9. [Building an agent client](./workshop/08-agent-client.md)

Need to skip ahead? The complete working code is in [`solution/`](./solution).

## Agents

See [`SKILL.md`](./SKILL.md) — drop it into your Claude / Cursor / custom-agent skill directory and any agent can buy events and tickets on your behalf.
