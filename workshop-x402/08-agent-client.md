# 08 — Agent client

Time to spend money. [`solution-x402/agent-example/buy-event-ticket.ts`](../solution-x402/agent-example/buy-event-ticket.ts) is a ~40-line script that plays the role of an autonomous agent: it generates a fresh wallet, tops itself up, submits an event, and buys its own ticket.

## The essential five lines

Everything x402-specific on the client is this:

```ts
const signer = await createKeyPairSignerFromPrivateKeyBytes(base58.decode(secret), true);
const client = new x402Client();
client.register(X402_NETWORK, new ExactSvmScheme(signer, { rpcUrl }));
const pay = wrapFetchWithPayment(fetch, client);
```

From here, `pay(url, options)` is a drop-in replacement for `fetch`. It transparently:

1. Sends the initial request.
2. If it gets a 402, parses the challenge, signs a USDC transfer that matches it, retries with the `X-PAYMENT` header.
3. Returns the eventual response.

## Run the demo

With `bun dev` running in one terminal:

```bash
bun run agent:demo
```

Expected output:

```
agent wallet: 7xK...3Ha
{ address: '7xK...3Ha', solLamports: 5000000000, usdcMicro: 10000000 }
submitted event: { id: '...', name: 'MLH Hack Night', ..., nextTicketPriceMicroUsdc: 1000000 }
bought ticket: { ticket: { id: '...', eventId: '...', owner: '7xK...3Ha', ... } }
```

Three dollars of real on-chain USDC just moved between wallets that didn't exist sixty seconds ago, driven entirely by HTTP. No API keys. No accounts. That's agent-to-agent commerce.

## Hook up to a real agent

Feed your AI agent (Claude Code, Cursor agent, custom) the [`SKILL.md`](../SKILL.md) at the project root. It contains:

- wallet creation + secure storage steps
- the exact `pay = wrapFetchWithPayment(...)` recipe
- a table of endpoints
- decision rules (always check prices, never reuse user addresses, etc.)

Drop `SKILL.md` into `~/.claude/skills/mlh-x402-events/SKILL.md` (or your agent's equivalent skill directory) and ask it to "find an event and buy a ticket for me." The agent will set up its wallet, hit the faucet, inspect events, and pay — on its own.

## Where to go next

- Implement true bonding-curve pricing on `/events/:id/buy` using the `accepts` function form from chapter 07.
- Add `DELETE /listings/:id` (seller cancels).
- Add a `GET /tickets?owner=...` endpoint, then have the agent watch secondary listings and snipe underpriced ones.
- Deploy: swap `FACILITATOR_URL` to `https://facilitator.x402.org` and `X402_NETWORK` to mainnet — no code change, real payments.

You now know enough x402 to make any HTTP endpoint metered. Go build.
