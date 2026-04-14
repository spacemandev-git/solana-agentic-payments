import { Hono } from "hono";
import { z } from "zod";

const USDC = process.env.USDC_MINT!;
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const RPC = process.env.SOLANA_RPC_URL!;

const Body = z.object({
  address: z.string().min(32),
  amountUsdc: z.number().positive().max(10_000).default(100),
});

export const faucet = new Hono().post("/faucet", async (c) => {
  const parsed = Body.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const { address, amountUsdc } = parsed.data;

  const call = (method: string, params: unknown[]) =>
    fetch(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    }).then((r) => r.json());

  // Server sponsors fees so we give the buyer 0 SOL on purpose — proves MPP
  // fee sponsorship works even when the client wallet has nothing but USDC.
  const usdc = await call("surfnet_setTokenAccount", [
    address,
    USDC,
    { amount: Math.round(amountUsdc * 1_000_000), state: "initialized" },
    TOKEN_PROGRAM,
  ]);
  if (usdc.error) return c.json({ error: usdc.error }, 500);
  return c.json({ address, usdcMicro: Math.round(amountUsdc * 1_000_000) });
});
