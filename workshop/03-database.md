# 03 — Database

## Start Postgres

```bash
docker compose up -d
```

That's it — `docker-compose.yml` defines a single Postgres 16 container on host port **5433** (we use 5433, not the standard 5432, to avoid clashing with any other Postgres you might have running).

Peek at [`solution/docker-compose.yml`](../solution/docker-compose.yml) if you want to see what's running.

## Schema

Three tables: events, tickets, listings.

See [`solution/src/db/schema.ts`](../solution/src/db/schema.ts):

```ts
export const events = pgTable("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  maxTickets: integer("max_tickets").notNull(),
  ticketsSold: integer("tickets_sold").notNull().default(0),
  creator: text("creator").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tickets = pgTable("tickets", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id").notNull().references(() => events.id),
  owner: text("owner").notNull(),
  pricePaidMicroUsdc: integer("price_paid_micro_usdc").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const listings = pgTable("listings", {
  id: uuid("id").defaultRandom().primaryKey(),
  ticketId: uuid("ticket_id").notNull().references(() => tickets.id).unique(),
  seller: text("seller").notNull(),
  priceMicroUsdc: integer("price_micro_usdc").notNull(),
  status: text("status", { enum: ["open", "sold", "cancelled"] }).notNull().default("open"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

Notes:

- **Owners and sellers are plain Solana base58 addresses** (strings). No separate "users" table — on-chain identity is enough.
- **Prices are micro-USDC** (USDC has 6 decimals → `1_000_000` = $1). Keep all money math in integers.
- `tickets.pricePaidMicroUsdc` is historical; the current primary price is always `$1 × (ticketsSold + 1)`.

## Push schema to Postgres

```bash
bun run db:push
```

Drizzle diffs your TS schema against the running DB and applies whatever's needed. No migration files to hand-edit.

Open `bun run db:studio` if you want a GUI.

→ [Next: 04 — Wallet & facilitator](./04-wallet-and-facilitator.md)
