# 01 — Prerequisites

## Install Bun

```bash
curl -fsSL https://bun.sh/install | bash
bun --version   # ≥ 1.1
```

## Install Docker

If you don't already have it: <https://docs.docker.com/get-docker/>. `docker --version` should print something.

## Install surfpool

surfpool is a local Solana validator that **forks mainnet state on demand** — ideal for a workshop because you get real USDC, real programs, and no devnet flakiness.

```bash
curl -sL https://run.surfpool.run/ | bash
surfpool --version
```

## Start surfpool

Leave this running in its own terminal for the rest of the workshop:

```bash
surfpool
```

You'll see a TUI dashboard. RPC is live at `http://127.0.0.1:8899`. It will fork anything it needs from mainnet the first time you touch it.

## Smoke test

Fresh terminal:

```bash
curl -s http://127.0.0.1:8899 -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'
# => {"jsonrpc":"2.0","result":"ok","id":1}
```

If you see `"ok"`, you're done.

→ [Next: 02 — Project setup](./02-project-setup.md)
