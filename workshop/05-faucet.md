# 05 — Faucet

Students and agents need test USDC without buying any. Surfpool's `surfnet_setTokenAccount` cheatcode mints any amount of any SPL token into any wallet — so `/faucet` is 20 lines:

See [`solution/src/routes/faucet.ts`](../solution/src/routes/faucet.ts):

```ts
faucet.post("/faucet", async (c) => {
  const { address, amountUsdc } = Body.parse(await c.req.json());

  await call("surfnet_setAccount", [address, { lamports: 5_000_000_000 }]);
  await call("surfnet_setTokenAccount", [
    address,
    USDC,
    { amount: Math.round(amountUsdc * 1_000_000), state: "initialized" },
    TOKEN_PROGRAM,
  ]);
  return c.json({ ok: true });
});
```

Two cheatcodes, two effects:

- `surfnet_setAccount` → 5 SOL so the wallet can pay transaction fees
- `surfnet_setTokenAccount` → N USDC at mainnet's real USDC mint

You can use this same pattern to preload **any** token for **any** address. Useful for seeding liquidity, testing edge cases ("what if a user has 0.0001 USDC?"), or forking mainnet whale positions.

## Test it

Once the API is up (next chapter), `curl`:

```bash
curl -s http://127.0.0.1:4021/faucet \
  -H 'content-type: application/json' \
  -d '{"address":"<any-solana-pubkey>","amountUsdc":10}'
```

→ [Next: 06 — Events API](./06-events-api.md)
