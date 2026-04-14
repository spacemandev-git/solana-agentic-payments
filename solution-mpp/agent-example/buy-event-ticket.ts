/**
 * End-to-end demo: an autonomous agent that generates a Solana wallet,
 * tops itself up with USDC from the faucet (no SOL — the server sponsors
 * fees!), submits an event, and buys the first ticket. All paid requests
 * settle through @solana/mpp.
 *
 * Run:  bun run agent:demo
 */
import { Mppx, solana } from "@solana/mpp/client";
import { createKeyPairSignerFromPrivateKeyBytes } from "@solana/kit";
import { base58 } from "@scure/base";
import { newKeypair } from "../src/wallet";

const API = `http://127.0.0.1:${process.env.API_PORT ?? 4022}`;
const RPC = process.env.SOLANA_RPC_URL ?? "http://127.0.0.1:8899";

const c = {
  reset: "\x1b[0m", dim: "\x1b[2m", bold: "\x1b[1m",
  red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m",
  blue: "\x1b[34m", magenta: "\x1b[35m", cyan: "\x1b[36m", gray: "\x1b[90m",
};
const W = 76;
const short = (s: string, n = 8) => s.length > n * 2 + 3 ? `${s.slice(0, n)}…${s.slice(-n)}` : s;

function banner(title: string) {
  const pad = Math.max(0, W - title.length - 4);
  console.log();
  console.log(c.cyan + "╭" + "─".repeat(W - 2) + "╮" + c.reset);
  console.log(c.cyan + "│" + c.reset + " " + c.bold + title + c.reset + " ".repeat(pad) + " " + c.cyan + "│" + c.reset);
  console.log(c.cyan + "╰" + "─".repeat(W - 2) + "╯" + c.reset);
}
function step(n: number, total: number, label: string) {
  console.log();
  console.log(c.magenta + c.bold + `  [${n}/${total}] ` + c.reset + c.bold + label + c.reset);
  console.log(c.gray + "  " + "─".repeat(W - 4) + c.reset);
}
function kv(k: string, v: string, color = c.cyan) {
  console.log(`    ${c.gray}${k.padEnd(18)}${c.reset} ${color}${v}${c.reset}`);
}
function ok(msg: string) { console.log(`    ${c.green}✓${c.reset} ${msg}`); }
function fail(msg: string) { console.log(`    ${c.red}✗${c.reset} ${msg}`); }

function mppFlow(method: string, path: string, price: string, payTo: string) {
  const lines = [
    `${c.blue}agent${c.reset}                              ${c.yellow}api / mpp${c.reset}`,
    `${c.gray}  │${c.reset}                                   ${c.gray}│${c.reset}`,
    `${c.gray}  ├──${c.reset} ${c.bold}${method} ${path}${c.reset} ${c.gray}────────────────▶│${c.reset}`,
    `${c.gray}  │◀─${c.reset} ${c.yellow}402 challenge${c.reset} (${price} → ${short(payTo)}) ${c.gray}──┤${c.reset}`,
    `${c.gray}  │${c.reset}  ${c.dim}(sign USDC transferChecked tx)${c.reset}  ${c.gray}│${c.reset}`,
    `${c.gray}  ├──${c.reset} ${c.bold}${method} ${path}${c.reset}                       ${c.gray}│${c.reset}`,
    `${c.gray}  │${c.reset}   ${c.dim}+ MPP-Credential header${c.reset}       ${c.gray}─▶│${c.reset}`,
    `${c.gray}  │${c.reset}                                   ${c.gray}├──${c.reset} ${c.dim}co-sign as fee payer${c.reset}`,
    `${c.gray}  │${c.reset}                                   ${c.gray}├──${c.reset} ${c.dim}broadcast${c.reset}`,
    `${c.gray}  │${c.reset}                                   ${c.gray}├──${c.reset} ${c.dim}verify on-chain${c.reset}`,
    `${c.gray}  │◀─${c.reset} ${c.green}200 + MPP-Receipt${c.reset} ${c.gray}────────────────┤${c.reset}`,
  ];
  for (const l of lines) console.log("    " + l);
}

async function usdcBalance(addr: string): Promise<number> {
  const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getTokenAccountsByOwner",
      params: [addr, { mint: process.env.USDC_MINT ?? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" }, { encoding: "jsonParsed" }] }) }).then(r => r.json());
  return r.result?.value?.[0]
    ? Number(r.result.value[0].account.data.parsed.info.tokenAmount.amount) / 1e6
    : 0;
}

banner(" MLH × MPP — Agent-to-Agent Payments Demo (no facilitator)");

step(1, 5, "Generate a fresh Solana wallet");
const kp = await newKeypair();
kv("address", kp.address);
kv("secret", short(kp.secret, 6) + c.gray + "  (32-byte ed25519 seed, base58)", c.dim);
ok("keypair created — holds USDC only; server will sponsor SOL fees");

step(2, 5, "Top up with USDC from the faucet (no SOL needed!)");
const faucetResp = await fetch(`${API}/faucet`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ address: kp.address, amountUsdc: 10 }),
});
if (!faucetResp.ok) { fail(`faucet failed: ${faucetResp.status}`); process.exit(1); }
kv("USDC after faucet", `${await usdcBalance(kp.address)}`);
ok("funded via surfnet_setTokenAccount cheatcode");

step(3, 5, "Build an MPP-capable fetch client");
const signer = await createKeyPairSignerFromPrivateKeyBytes(base58.decode(kp.secret), true);
const mppx = Mppx.create({
  methods: [solana.charge({ signer, rpcUrl: RPC })],
});
kv("rpc", RPC);
kv("method", "solana.charge (pull mode — server broadcasts)");
ok("agent can now transparently pay any 402-gated endpoint");

step(4, 5, "Submit a new event  (MPP-gated — costs $1 USDC)");
const serverAddr = process.env.SERVER_WALLET_ADDRESS ?? "<server>";
mppFlow("POST", "/events", "$1.00 USDC", serverAddr);
console.log();
const agentB1 = await usdcBalance(kp.address);
const serverB0 = await usdcBalance(serverAddr);
const resp = await mppx.fetch(`${API}/events`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    name: "MLH Hack Night 2026",
    description: "Agents only. BYO USDC.",
    maxTickets: 100,
    creator: kp.address,
  }),
});
if (!resp.ok) { fail(`submit failed: HTTP ${resp.status}`); console.log(await resp.text()); process.exit(1); }
const event = await resp.json() as { id: string; name: string; nextTicketPriceMicroUsdc: number };
const agentB2 = await usdcBalance(kp.address);
const serverB1 = await usdcBalance(serverAddr);
kv("event.id", event.id);
kv("event.name", event.name);
kv("agent USDC", `${agentB1} → ${agentB2}  (${c.red}${(agentB2 - agentB1).toFixed(2)}${c.reset})`);
kv("server USDC", `${serverB0} → ${serverB1}  (${c.green}+${(serverB1 - serverB0).toFixed(2)}${c.reset})`);
ok("$1 USDC moved from agent → server, server paid the SOL fee");

step(5, 5, "Buy the first ticket  (MPP-gated — $1 × (sold+1))");
mppFlow("GET", `/events/${short(event.id, 4)}/buy`, "$1.00 USDC", serverAddr);
console.log();
const buyResp = await mppx.fetch(`${API}/events/${event.id}/buy?buyer=${kp.address}`);
if (!buyResp.ok) { fail(`buy failed: HTTP ${buyResp.status}`); console.log(await buyResp.text()); process.exit(1); }
const ticket = await buyResp.json() as { ticket: { id: string; owner: string }; pricePaidMicroUsdc: number };
const agentB3 = await usdcBalance(kp.address);
const serverB2 = await usdcBalance(serverAddr);
kv("ticket.id", ticket.ticket.id);
kv("agent USDC", `${agentB2} → ${agentB3}  (${c.red}${(agentB3 - agentB2).toFixed(2)}${c.reset})`);
kv("server USDC", `${serverB1} → ${serverB2}  (${c.green}+${(serverB2 - serverB1).toFixed(2)}${c.reset})`);
ok("ticket minted to agent wallet");

console.log();
console.log(c.gray + "═".repeat(W) + c.reset);
console.log(`  ${c.green}${c.bold}✓ success${c.reset}  ${c.dim}two USDC transfers settled on-chain via MPP — no facilitator, no agent-side SOL${c.reset}`);
console.log(c.gray + "═".repeat(W) + c.reset);
console.log();
