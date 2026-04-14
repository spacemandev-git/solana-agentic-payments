/**
 * Top up a wallet with SOL + USDC via surfpool's cheatcodes. Called at
 * server startup so we don't depend on surfpool state surviving a restart.
 */
const RPC = process.env.SOLANA_RPC_URL!;
const USDC = process.env.USDC_MINT!;
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

export async function fundWallet(address: string, label: string) {
  await rpc("surfnet_setAccount", [address, { lamports: 10_000_000_000 }]);
  await rpc("surfnet_setTokenAccount", [
    address, USDC,
    { amount: 1_000_000_000, state: "initialized" },
    TOKEN_PROGRAM,
  ]);
  console.log(`funded ${label.padEnd(12)} ${address} (10 SOL, 1000 USDC)`);
}
