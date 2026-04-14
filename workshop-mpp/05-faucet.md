# 05 — Faucet

MPP's fee sponsorship changes the faucet: **we hand out USDC only, not SOL**. Agent wallets can exist with zero lamports and still pay MPP-gated endpoints, because the server co-signs as fee payer.

See [`solution-mpp/src/routes/faucet.ts`](../solution-mpp/src/routes/faucet.ts):

```ts
faucet.post("/faucet", async (c) => {
  const { address, amountUsdc } = Body.parse(await c.req.json());

  // NOTE: no surfnet_setAccount for SOL — fee sponsorship covers gas.
  await call("surfnet_setTokenAccount", [
    address,
    USDC,
    { amount: Math.round(amountUsdc * 1_000_000), state: "initialized" },
    TOKEN_PROGRAM,
  ]);
  return c.json({ ok: true });
});
```

That's the demonstration. In the x402 version the faucet also gave out 5 SOL so the agent could pay transaction fees; here we deliberately don't, so you can see the sponsorship work end-to-end.

## Test

```bash
curl -s http://127.0.0.1:4022/faucet \
  -H 'content-type: application/json' \
  -d '{"address":"<any-solana-pubkey>","amountUsdc":10}'
```

→ [Next: 06 — Events API](./06-events-api.md)
