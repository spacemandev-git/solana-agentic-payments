import { pgTable, text, integer, timestamp, uuid } from "drizzle-orm/pg-core";

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

export type Event = typeof events.$inferSelect;
export type Ticket = typeof tickets.$inferSelect;
export type Listing = typeof listings.$inferSelect;
