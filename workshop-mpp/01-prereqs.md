# 01 — Prerequisites

Identical to the x402 workshop — you need Bun, Docker, and surfpool.

If you've already done the x402 prereqs chapter, you can skip this page.

## Install Bun

```bash
curl -fsSL https://bun.sh/install | bash
bun --version   # ≥ 1.1
```

## Install Docker

<https://docs.docker.com/get-docker/>. `docker --version` should print something.

## Install surfpool

```bash
curl -sL https://run.surfpool.run/ | bash
surfpool --version
```

## Start surfpool

In its own terminal:

```bash
surfpool
```

RPC: `http://127.0.0.1:8899`.

## Smoke test

```bash
curl -s http://127.0.0.1:8899 -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'
# => {"jsonrpc":"2.0","result":"ok","id":1}
```

→ [Next: 02 — Project setup](./02-project-setup.md)
