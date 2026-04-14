# 04 — Server wallet & MPP

Only **one** wallet in MPP — the server wallet, which both receives USDC *and* sponsors Solana transaction fees.

## Generate the wallet

[`solution-mpp/scripts/setup-wallet.ts`](../solution-mpp/scripts/setup-wallet.ts) generates a fresh ed25519 keypair and funds it on surfpool:

```bash
bun run setup
```

Copy the two `SERVER_WALLET_*` lines into your `.env`.

## Mppx + solana.charge

[`solution-mpp/src/mpp.ts`](../solution-mpp/src/mpp.ts):

```ts
import { Mppx, solana } from "@solana/mpp/server";
import { loadSignerFromEnv } from "./wallet";

const feePayer = await loadSignerFromEnv("SERVER_WALLET_SECRET");

export const mppx = Mppx.create({
  secretKey: process.env.MPP_SECRET_KEY!,
  methods: [
    solana.charge({
      recipient: process.env.SERVER_WALLET_ADDRESS!,
      currency: process.env.USDC_MINT!,   // SPL mint — "sol" for native SOL
      decimals: 6,
      network: "mainnet-beta",             // surfpool forks mainnet
      rpcUrl: process.env.SOLANA_RPC_URL,
      signer: feePayer,                    // ← fee sponsorship
      html: true,                          // browser payment page
    }),
  ],
});
```

Three things to notice:

1. **`recipient` is bound at construction time.** The Mppx is "this wallet charges USDC for things." For per-request dynamic recipients (like secondary-market listings), you build a second Mppx with a different recipient — see chapter 07.
2. **`signer` turns on fee sponsorship.** The server co-signs the client's transaction as fee payer before broadcasting. Agents never need SOL.
3. **`html: true` gives you a browser payment page** for free. Hit a 402-gated URL from a browser and MPP serves an interactive Solana wallet connector; hit it with an `Accept: application/json` and you get the raw challenge. Same endpoint, two UXs.

## Per-request dynamic recipients

Because `recipient` is baked into the method, for listings we build an Mppx on demand:

```ts
export function mppxForRecipient(recipient: string) {
  return Mppx.create({
    secretKey: process.env.MPP_SECRET_KEY!,
    methods: [solana.charge({ recipient, currency: USDC, decimals: 6,
      network, rpcUrl: RPC, signer: feePayer, html: true })],
  });
}
```

Mppx is cheap to construct — no network I/O, no state — so doing this per request is fine.

## Using it in a route

MPP isn't middleware. You call `mppx.charge(...)` on the raw Request and branch on `result.status`:

```ts
app.post("/events", async (c) => {
  const result = await mppx.charge({
    amount: "1000000",                 // base units (micro-USDC)
    currency: process.env.USDC_MINT!,
    description: "submit an event",
  })(c.req.raw);

  if (result.status === 402) return result.challenge;   // unpaid → send challenge

  // ... do the thing ...
  return result.withReceipt(c.json(created, 201));      // wrap response with receipt header
});
```

Three lines for the payment check, zero startup ordering. Compare against x402's `paymentMiddleware` + `resourceServer.initialize()` dance.

## Boot order

[`solution-mpp/src/index.ts`](../solution-mpp/src/index.ts):

```ts
await fundWallet(process.env.SERVER_WALLET_ADDRESS!, "server"); // surfpool top-up
// mpp.ts already ran at import — Mppx is ready.

const app = new Hono();
app.route("/", faucet);
app.route("/", eventsRouter);
app.route("/", listingsRouter);
Bun.serve({ port, fetch: app.fetch });
```

No facilitator to start, no resource-server initialization, no middleware-import ordering to worry about.

→ [Next: 05 — Faucet](./05-faucet.md)
