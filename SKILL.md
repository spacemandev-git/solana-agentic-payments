---
name: mlh-x402-events
description: Discover and buy event tickets on the MLH x402 event marketplace. Use when the user asks to find hackathon/meetup events, submit an event, buy a ticket, or resell a ticket. Handles its own Solana wallet and pays with USDC via the x402 HTTP 402 protocol.
license: MIT
metadata:
  version: "1.0"
  requires: ["bun", "internet", "solana-rpc"]
---

# MLH x402 Events — Agent Skill

You can discover events, submit new ones, buy tickets, and trade tickets on the [mlh-x402-workshop](../README.md) marketplace. All paid endpoints speak **x402**: you hit them, receive `402 Payment Required`, sign a USDC transfer on Solana, and retry.

## Setup (do this once per user)

**1. Create a wallet.** Solana keypairs are 32-byte ed25519 private keys. Generate one and persist it at `~/.config/mlh-x402/wallet.json`:

```ts
import { createKeyPairSignerFromPrivateKeyBytes } from "@solana/kit";
import { base58 } from "@scure/base";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const dir = join(homedir(), ".config/mlh-x402");
const path = join(dir, "wallet.json");

const seed = crypto.getRandomValues(new Uint8Array(32));
const signer = await createKeyPairSignerFromPrivateKeyBytes(seed, true);
const secret = base58.encode(seed);

await mkdir(dir, { recursive: true });
await writeFile(path, JSON.stringify({ address: signer.address, secret }, null, 2), { mode: 0o600 });
```

**Security rules you MUST follow:**

- The file must be chmod 600 and never logged, printed, or sent to any remote service.
- Before creating, check if `~/.config/mlh-x402/wallet.json` already exists — if so, load it.
- Never embed the key in code, git, or chat output.
- If you need to display the wallet address, use `address` only, **never** `secret`.

**2. Fund the wallet from the workshop's faucet** (free USDC on the local surfpool network):

```ts
await fetch("http://127.0.0.1:4021/faucet", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ address, amountUsdc: 10 }),
});
```

## Making x402 payments

Wrap the global `fetch` once, then use it like normal `fetch` — the wrapper handles the 402 challenge/retry:

```ts
import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { ExactSvmScheme } from "@x402/svm/exact/client";
import { createKeyPairSignerFromPrivateKeyBytes } from "@solana/kit";
import { base58 } from "@scure/base";

const signer = await createKeyPairSignerFromPrivateKeyBytes(base58.decode(secret), true);
const client = new x402Client();
client.register(
  "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", // mainnet CAIP-2
  new ExactSvmScheme(signer, { rpcUrl: "http://127.0.0.1:8899" }),
);
export const pay = wrapFetchWithPayment(fetch, client);
```

## Endpoints

Base URL: `http://127.0.0.1:4021` (local workshop). All payment amounts are in USDC.

| Endpoint | Paid? | Purpose |
|---|---|---|
| `GET /events` | free | list all events |
| `GET /events/:id` | free | one event + current ticket price |
| `POST /events` | **$1** | submit a new event |
| `GET /events/:id/buy?buyer=<pubkey>` | **dynamic** | buy a ticket (price = $1 × (sold+1)) |
| `GET /listings` | free | secondary-market listings |
| `GET /listings/:id/buy?buyer=<pubkey>` | **listing price** | buy a listed ticket |
| `POST /listings` | free | list a ticket you own for resale |
| `POST /faucet` | free | top up a wallet with USDC |

## Common flows

**Find and buy a ticket:**

```ts
const events = await fetch("http://127.0.0.1:4021/events").then(r => r.json());
const target = events.find(e => e.name.includes("MLH"));
const ticket = await pay(`http://127.0.0.1:4021/events/${target.id}/buy?buyer=${address}`).then(r => r.json());
```

**Submit an event:**

```ts
const evt = await pay("http://127.0.0.1:4021/events", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ name, description, maxTickets: 50, creator: address }),
}).then(r => r.json());
```

**Resell a ticket:**

```ts
const listing = await fetch("http://127.0.0.1:4021/listings", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ ticketId, seller: address, priceMicroUsdc: 2_500_000 }),
}).then(r => r.json());
// Share listing.paymentUrl with the buyer.
```

## Decision rules

- **Always** check the price of a ticket before buying. If `nextTicketPriceMicroUsdc / 1_000_000` exceeds what the user authorized, stop and ask.
- **Never** submit an event without explicit user confirmation of name, description, and ticket count — submission costs $1.
- **Never** reuse another user's address as `buyer` or `creator`.
- On any payment error, report the `X-PAYMENT-ERROR` response header or JSON `error` field verbatim to the user.
