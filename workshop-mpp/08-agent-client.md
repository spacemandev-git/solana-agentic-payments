# 08 — Agent client

See [`solution-mpp/agent-example/buy-event-ticket.ts`](../solution-mpp/agent-example/buy-event-ticket.ts).

## The essential four lines

Everything MPP-specific on the client:

```ts
import { Mppx, solana } from "@solana/mpp/client";

const signer = await createKeyPairSignerFromPrivateKeyBytes(base58.decode(secret), true);
const mppx = Mppx.create({ methods: [solana.charge({ signer, rpcUrl })] });
const pay = mppx.fetch.bind(mppx);   // drop-in for global fetch
```

`pay(url, options)` behaves like `fetch`, but on a 402 it:

1. Parses the MPP challenge (amount, currency, recipient, server fee-payer key, recent blockhash).
2. Builds a `transferChecked` Solana transaction using the agent's signer.
3. Sets the **server** as fee payer (because the challenge advertised `feePayer: true`).
4. Partially signs (just the transfer authority), base64-encodes, and retries with the `MPP-Credential` header.
5. Returns the eventual response, now carrying an `MPP-Receipt` header.

The agent wallet **never touches SOL**. You can verify this in the demo — the faucet gives zero lamports, and the payments still succeed.

## Pull mode vs. push mode

The client defaults to **pull mode** (`broadcast: false`): server receives the signed transaction bytes and broadcasts them. If you want the client to broadcast instead (useful when you want a signature before the server even sees the request, or to decouple from server RPC settings), pass `broadcast: true`:

```ts
solana.charge({ signer, rpcUrl, broadcast: true });
```

Push mode cannot use fee sponsorship — in that case the agent wallet needs enough SOL to pay fees itself.

## Run the demo

With `bun dev` running in one terminal:

```bash
bun run agent:demo
```

Expected flow:

```
[1/5] Generate a fresh Solana wallet
[2/5] Top up with USDC from the faucet (no SOL needed!)
[3/5] Build an MPP-capable fetch client
[4/5] Submit a new event  (MPP-gated — costs $1 USDC)
[5/5] Buy the first ticket  (MPP-gated — $1 × (sold+1))
✓ success  two USDC transfers settled on-chain via MPP — no facilitator, no agent-side SOL
```

## Where to go next

- Turn on **splits** for a marketplace take-rate (`solution-mpp/src/mpp.ts`).
- Try **push mode** — switch `broadcast: true` in the client and remove `signer:` from the server `solana.charge`; watch the agent wallet now need SOL for fees.
- Add a browser-driven flow: `html: true` is already on, so `http://localhost:4022/events/:id/buy?buyer=...` in a browser renders an MPP payment page.
- Swap the `Store.memory()` default for a persistent Redis store if you deploy — it's what prevents credential replay across restarts.

You've now seen the same app built two ways — pick the protocol that fits your ops + UX constraints. x402 leans facilitator-centric and composable across many resource servers; MPP is batteries-included for single-operator SaaS. Both settle real USDC on Solana in the same handful of milliseconds.
