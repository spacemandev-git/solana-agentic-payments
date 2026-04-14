# 04 — Server wallet & x402 facilitator

Two Solana wallets matter in x402:

- **Server wallet** — receives primary-market USDC (event submissions, ticket sales).
- **Facilitator wallet** — sponsors transaction fees (pays SOL) and submits payment transactions to chain.

In production you'd point at the public `https://facilitator.x402.org`. For local surfpool, we run our own in-process.

## Generate both wallets

[`solution-x402/scripts/setup-wallet.ts`](../solution-x402/scripts/setup-wallet.ts) generates two fresh ed25519 keypairs and also funds them on surfpool (so you can watch the cheatcodes in action). Run it once:

```bash
bun run setup
```

Copy the four `*_SECRET` / `*_ADDRESS` lines it prints into your `.env`.

> **Why the addresses matter across restarts:** surfpool wipes state on restart. The server self-funds both wallets every time `bun dev` starts (see [`src/fund.ts`](../solution-x402/src/fund.ts) and [`src/index.ts`](../solution-x402/src/index.ts)) — so the addresses stay constant but the balances get refreshed automatically.

## Generating keypairs safely

[`solution-x402/src/wallet.ts`](../solution-x402/src/wallet.ts):

```ts
import { createKeyPairSignerFromPrivateKeyBytes } from "@solana/kit";
import { base58 } from "@scure/base";

export async function newKeypair() {
  const seed = crypto.getRandomValues(new Uint8Array(32));
  const signer = await createKeyPairSignerFromPrivateKeyBytes(seed, true);
  return { address: signer.address, secret: base58.encode(seed) };
}

export async function loadSignerFromEnv(envVar: string) {
  return createKeyPairSignerFromPrivateKeyBytes(base58.decode(process.env[envVar]!), true);
}
```

A Solana private key is just 32 random bytes. We pass `extractable: true` so the underlying WebCrypto key can be re-exported later if needed. Store the seed as base58 — the same format Solana wallets and CLIs use.

## The facilitator

[`solution-x402/src/x402-facilitator.ts`](../solution-x402/src/x402-facilitator.ts):

```ts
import { Hono } from "hono";
import { x402Facilitator } from "@x402/core/facilitator";
import { registerExactSvmScheme } from "@x402/svm/exact/facilitator";
import { toFacilitatorSvmSigner } from "@x402/svm";
import { loadSignerFromEnv } from "./wallet";

export async function startFacilitator() {
  const keypair = await loadSignerFromEnv("FACILITATOR_WALLET_SECRET");
  const signer = toFacilitatorSvmSigner(keypair, {
    defaultRpcUrl: process.env.SOLANA_RPC_URL,
  });

  const facilitator = new x402Facilitator();
  registerExactSvmScheme(facilitator, {
    networks: [process.env.X402_NETWORK!],
    signer,
  });

  const app = new Hono();
  app.post("/verify",    async (c) => c.json(await facilitator.verify(
    ...Object.values(await c.req.json()) as [any, any])));
  app.post("/settle",    async (c) => c.json(await facilitator.settle(
    ...Object.values(await c.req.json()) as [any, any])));
  app.get ("/supported", (c) => c.json(facilitator.getSupported()));

  Bun.serve({ port: Number(new URL(process.env.FACILITATOR_URL!).port), fetch: app.fetch });
}
```

An x402 facilitator is literally three HTTP routes. That's the whole protocol on this side.

## How the API talks to it

[`solution-x402/src/x402-server.ts`](../solution-x402/src/x402-server.ts):

```ts
import { x402ResourceServer } from "@x402/hono";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactSvmScheme } from "@x402/svm/exact/server";

const facilitatorClient = new HTTPFacilitatorClient({ url: process.env.FACILITATOR_URL! });

export const resourceServer = new x402ResourceServer(facilitatorClient)
  .register(process.env.X402_NETWORK!, new ExactSvmScheme());
```

The `resourceServer` object is what `paymentMiddleware()` uses to decide whether a request is paid or needs a 402.

## Bringing it all up in the right order

Because the API's `paymentMiddleware` needs to know what the facilitator supports before it can handle requests, startup order matters ([`solution-x402/src/index.ts`](../solution-x402/src/index.ts)):

```ts
await fundWallet(process.env.SERVER_WALLET_ADDRESS!, "server");
await fundWallet(process.env.FACILITATOR_WALLET_ADDRESS!, "facilitator");

await startFacilitator();              // 1. facilitator HTTP is now listening
await resourceServer.initialize();     // 2. API resource server fetches /supported

// 3. route handlers come up last
```

And in each route module, `paymentMiddleware(..., syncFacilitatorOnStart = false)` so middleware-import-time doesn't race the facilitator:

```ts
paymentMiddleware(routes, resourceServer, undefined, undefined, /* syncOnStart */ false);
```

→ [Next: 05 — Faucet](./05-faucet.md)
