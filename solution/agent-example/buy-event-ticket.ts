/**
 * End-to-end demo: an autonomous agent that generates its own Solana wallet,
 * tops itself up via the faucet, submits an event to the marketplace, and
 * buys the first ticket — every paid request settled through x402.
 *
 * Run:  bun run agent:demo
 */
import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { ExactSvmScheme } from "@x402/svm/exact/client";
import { createKeyPairSignerFromPrivateKeyBytes } from "@solana/kit";
import { base58 } from "@scure/base";
import { newKeypair } from "../src/wallet";

const API = "http://127.0.0.1:4021";
const RPC = process.env.SOLANA_RPC_URL ?? "http://127.0.0.1:8899";
const NET = process.env.X402_NETWORK ?? "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";

// ─── UI helpers ──────────────────────────────────────────────────────────────
const c = {
  reset: "\x1b[0m", dim: "\x1b[2m", bold: "\x1b[1m",
  red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m",
  blue: "\x1b[34m", magenta: "\x1b[35m", cyan: "\x1b[36m", gray: "\x1b[90m",
};
const box = {
  tl: "╭", tr: "╮", bl: "╰", br: "╯", h: "─", v: "│",
  t: "┬", b: "┴", l: "├", r: "┤", x: "┼",
};
const W = 76;
const short = (s: string, n = 8) => s.length > n * 2 + 3 ? `${s.slice(0, n)}…${s.slice(-n)}` : s;

function hr(char = box.h) { console.log(c.gray + char.repeat(W) + c.reset); }
function banner(title: string) {
  const pad = Math.max(0, W - title.length - 4);
  console.log();
  console.log(c.cyan + box.tl + box.h.repeat(W - 2) + box.tr + c.reset);
  console.log(c.cyan + box.v + c.reset + " " + c.bold + title + c.reset + " ".repeat(pad) + " " + c.cyan + box.v + c.reset);
  console.log(c.cyan + box.bl + box.h.repeat(W - 2) + box.br + c.reset);
}
function step(n: number, total: number, label: string) {
  console.log();
  console.log(c.magenta + c.bold + `  [${n}/${total}] ` + c.reset + c.bold + label + c.reset);
  console.log(c.gray + "  " + box.h.repeat(W - 4) + c.reset);
}
function kv(k: string, v: string, color = c.cyan) {
  console.log(`    ${c.gray}${k.padEnd(18)}${c.reset} ${color}${v}${c.reset}`);
}
function log(prefix: string, msg: string, color = c.gray) {
  console.log(`    ${color}${prefix}${c.reset} ${c.dim}${msg}${c.reset}`);
}
function ok(msg: string) { console.log(`    ${c.green}✓${c.reset} ${msg}`); }
function fail(msg: string) { console.log(`    ${c.red}✗${c.reset} ${msg}`); }

// Flow diagram for the x402 handshake
function x402Flow(method: string, path: string, price: string, payTo: string) {
  const lines = [
    `${c.blue}agent${c.reset}                     ${c.yellow}api${c.reset}                     ${c.magenta}facilitator${c.reset}`,
    `${c.gray}  │${c.reset}                        ${c.gray}│${c.reset}                        ${c.gray}│${c.reset}`,
    `${c.gray}  ├──${c.reset} ${c.bold}${method} ${path}${c.reset} ${c.gray}──────▶│${c.reset}                        ${c.gray}│${c.reset}`,
    `${c.gray}  │◀─${c.reset} ${c.yellow}402 ${price} → ${short(payTo)}${c.reset} ${c.gray}──┤${c.reset}                        ${c.gray}│${c.reset}`,
    `${c.gray}  │${c.reset}  ${c.dim}(sign USDC transfer)${c.reset}  ${c.gray}│${c.reset}                        ${c.gray}│${c.reset}`,
    `${c.gray}  ├──${c.reset} ${c.bold}${method} ${path}${c.reset}                ${c.gray}│${c.reset}                        ${c.gray}│${c.reset}`,
    `${c.gray}  │${c.reset}   ${c.dim}+ X-PAYMENT header${c.reset}  ${c.gray}─▶│${c.reset}                        ${c.gray}│${c.reset}`,
    `${c.gray}  │${c.reset}                        ${c.gray}├──${c.reset} ${c.dim}verify payload${c.reset}    ${c.gray}──▶│${c.reset}`,
    `${c.gray}  │${c.reset}                        ${c.gray}│◀──${c.reset} ${c.green}isValid: true${c.reset} ${c.gray}──────┤${c.reset}`,
    `${c.gray}  │${c.reset}                        ${c.gray}├──${c.reset} ${c.dim}settle (broadcast)${c.reset}${c.gray}──▶│${c.reset}`,
    `${c.gray}  │${c.reset}                        ${c.gray}│◀──${c.reset} ${c.green}tx signature${c.reset}  ${c.gray}─────┤${c.reset}`,
    `${c.gray}  │◀─${c.reset} ${c.green}200 OK${c.reset} ${c.gray}─────────────────┤${c.reset}                        ${c.gray}│${c.reset}`,
  ];
  for (const l of lines) console.log("    " + l);
}

async function balance(addr: string): Promise<{ sol: number; usdc: number }> {
  const call = (m: string, p: unknown[]) =>
    fetch(RPC, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: m, params: p }) }).then(r => r.json());
  const [solR, tokR] = await Promise.all([
    call("getBalance", [addr]),
    call("getTokenAccountsByOwner", [addr, { mint: process.env.USDC_MINT ?? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" }, { encoding: "jsonParsed" }]),
  ]);
  const sol = (solR.result?.value ?? 0) / 1e9;
  const usdc = tokR.result?.value?.[0]
    ? Number(tokR.result.value[0].account.data.parsed.info.tokenAmount.amount) / 1e6
    : 0;
  return { sol, usdc };
}

function balanceLine(label: string, before: { sol: number; usdc: number }, after: { sol: number; usdc: number }) {
  const dSol = after.sol - before.sol;
  const dUsdc = after.usdc - before.usdc;
  const fmt = (n: number, sym = "") => {
    const sign = n > 0 ? "+" : "";
    const col = n > 0 ? c.green : n < 0 ? c.red : c.gray;
    return `${col}${sign}${n.toFixed(n === Math.floor(n) ? 0 : 4)}${sym}${c.reset}`;
  };
  console.log(`    ${c.gray}${label.padEnd(14)}${c.reset} ${c.cyan}${after.sol.toFixed(4)} SOL${c.reset} ${c.dim}(${fmt(dSol)})${c.reset}   ${c.cyan}${after.usdc.toFixed(2)} USDC${c.reset} ${c.dim}(${fmt(dUsdc)})${c.reset}`);
}

// ─── main ────────────────────────────────────────────────────────────────────
banner(" MLH × x402 — Agent-to-Agent Payments Demo");

step(1, 5, "Generate a fresh Solana wallet for this agent");
const kp = await newKeypair();
kv("address", kp.address, c.cyan);
kv("secret", short(kp.secret, 6) + c.gray + "  (32-byte ed25519 seed, base58)", c.dim);
ok("keypair created — non-custodial, lives only in this process");

step(2, 5, "Top up the wallet via the free USDC faucet");
const agentB0 = await balance(kp.address);
log("POST", `${API}/faucet  { address, amountUsdc: 10 }`);
const faucetResp = await fetch(`${API}/faucet`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ address: kp.address, amountUsdc: 10 }),
});
if (!faucetResp.ok) { fail(`faucet failed: ${faucetResp.status}`); process.exit(1); }
const agentB1 = await balance(kp.address);
balanceLine("before", agentB0, agentB0);
balanceLine("after", agentB0, agentB1);
ok("funded via surfnet_setTokenAccount cheatcode (no real money moved)");

step(3, 5, "Build an x402-capable fetch wrapper");
const signer = await createKeyPairSignerFromPrivateKeyBytes(base58.decode(kp.secret), true);
const client = new x402Client();
client.register(NET, new ExactSvmScheme(signer, { rpcUrl: RPC }));
const pay = wrapFetchWithPayment(fetch, client);
kv("network", NET);
kv("rpc", RPC);
kv("scheme", "exact (SPL-token transfer)");
ok("agent can now transparently pay any 402-gated endpoint");

step(4, 5, "Submit a new event  (x402-gated — costs $1 USDC)");
const serverAddr = process.env.SERVER_WALLET_ADDRESS ?? "<server>";
x402Flow("POST", "/events", "$1.00 USDC", serverAddr);
console.log();
const serverB0 = await balance(serverAddr);
const resp = await pay(`${API}/events`, {
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
const agentB2 = await balance(kp.address);
const serverB1 = await balance(serverAddr);
console.log();
kv("event.id", event.id);
kv("event.name", event.name);
kv("next ticket price", `$${event.nextTicketPriceMicroUsdc / 1e6}`);
console.log();
balanceLine("agent", agentB1, agentB2);
balanceLine("server", serverB0, serverB1);
ok("$1 USDC moved from agent → server on-chain");

step(5, 5, "Buy the first ticket  (x402-gated — $1 × (sold+1))");
x402Flow("GET", `/events/${short(event.id, 4)}/buy`, "$1.00 USDC", serverAddr);
console.log();
const serverB2 = await balance(serverAddr);
const buyResp = await pay(`${API}/events/${event.id}/buy?buyer=${kp.address}`);
if (!buyResp.ok) { fail(`buy failed: HTTP ${buyResp.status}`); console.log(await buyResp.text()); process.exit(1); }
const ticket = await buyResp.json() as { ticket: { id: string; owner: string }; pricePaidMicroUsdc: number };
const agentB3 = await balance(kp.address);
const serverB3 = await balance(serverAddr);
console.log();
kv("ticket.id", ticket.ticket.id);
kv("ticket.owner", ticket.ticket.owner);
kv("price paid", `$${ticket.pricePaidMicroUsdc / 1e6}`);
console.log();
balanceLine("agent", agentB2, agentB3);
balanceLine("server", serverB2, serverB3);
ok("ticket minted to agent wallet");

console.log();
hr("═");
console.log(`  ${c.green}${c.bold}✓ success${c.reset}  ${c.dim}two real USDC transfers settled on-chain via x402${c.reset}`);
console.log(`  ${c.gray}agent${c.reset}  ${c.cyan}${short(kp.address)}${c.reset}  ${c.gray}spent${c.reset} ${c.yellow}$${(agentB1.usdc - agentB3.usdc).toFixed(2)} USDC${c.reset}`);
console.log(`  ${c.gray}server${c.reset} ${c.cyan}${short(serverAddr)}${c.reset}  ${c.gray}earned${c.reset} ${c.green}+$${(serverB3.usdc - serverB0.usdc).toFixed(2)} USDC${c.reset}`);
hr("═");
console.log();
