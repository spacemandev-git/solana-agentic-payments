import { Hono } from "hono";
import { logger } from "hono/logger";
import { faucet } from "./routes/faucet";
import { eventsRouter } from "./routes/events";
import { listingsRouter } from "./routes/listings";
import { fundWallet } from "./fund";

// Surfpool resets state on restart — top up the server wallet every boot.
await fundWallet(process.env.SERVER_WALLET_ADDRESS!, "server");

const app = new Hono();
app.use(logger());

app.get("/", (c) => c.json({
  name: "mlh-mpp-workshop",
  protocol: "MPP (Machine Payments Protocol) / @solana/mpp",
  endpoints: ["GET /events", "POST /events", "GET /events/:id", "GET /events/:id/buy",
    "GET /listings", "POST /listings", "GET /listings/:id/buy", "POST /faucet"],
}));

app.route("/", faucet);
app.route("/", eventsRouter);
app.route("/", listingsRouter);

const port = Number(process.env.API_PORT ?? 4022);
Bun.serve({ port, fetch: app.fetch });
console.log(`api          ready on http://127.0.0.1:${port}`);
