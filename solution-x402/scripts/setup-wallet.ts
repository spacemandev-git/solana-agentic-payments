/**
 * One-time setup: generate the server and facilitator wallets, fund them
 * with SOL (for fees) and USDC (for settlement) via surfpool cheatcodes,
 * and print env vars to copy into `.env`.
 */
import { newKeypair } from "../src/wallet";

const RPC = process.env.SOLANA_RPC_URL ?? "http://127.0.0.1:8899";
const USDC = process.env.USDC_MINT ?? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

async function rpc(method: string, params: unknown[]) {
  const r = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await r.json();
  if (j.error) throw new Error(`${method}: ${JSON.stringify(j.error)}`);
  return j.result;
}

async function fund(address: string, label: string) {
  // 10 SOL for fees
  await rpc("surfnet_setAccount", [address, { lamports: 10_000_000_000 }]);
  // 1,000 USDC (6 decimals)
  await rpc("surfnet_setTokenAccount", [
    address,
    USDC,
    { amount: 1_000_000_000, state: "initialized" },
    TOKEN_PROGRAM,
  ]);
  console.log(`  funded ${label} (${address}) with 10 SOL + 1000 USDC`);
}

const server = await newKeypair();
const facilitator = await newKeypair();
console.log("Generated wallets, funding via surfpool cheatcodes...");
await fund(server.address, "server");
await fund(facilitator.address, "facilitator");

console.log("\nCopy the following into .env:\n");
console.log(`SERVER_WALLET_SECRET=${server.secret}`);
console.log(`SERVER_WALLET_ADDRESS=${server.address}`);
console.log(`FACILITATOR_WALLET_SECRET=${facilitator.secret}`);
console.log(`FACILITATOR_WALLET_ADDRESS=${facilitator.address}`);
