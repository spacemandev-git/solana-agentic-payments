import { Hono } from "hono";
import { logger } from "hono/logger";
import { startFacilitator } from "./x402-facilitator";
import { faucet } from "./routes/faucet";
import { eventsRouter } from "./routes/events";
import { listingsRouter } from "./routes/listings";
import { fundWallet } from "./fund";
import { resourceServer } from "./x402-server";

// Surfpool resets state on restart, so top up both wallets every boot.
await fundWallet(process.env.SERVER_WALLET_ADDRESS!, "server");
await fundWallet(process.env.FACILITATOR_WALLET_ADDRESS!, "facilitator");

await startFacilitator();
// Now the facilitator is up, sync its supported kinds into the resource server.
await resourceServer.initialize();

const app = new Hono();
app.use(logger());

app.get("/", (c) => c.json({
  name: "mlh-x402-workshop",
  endpoints: ["GET /events", "POST /events", "GET /events/:id", "GET /events/:id/buy",
    "GET /listings", "POST /listings", "GET /listings/:id/buy", "POST /faucet"],
}));

app.route("/", faucet);
app.route("/", eventsRouter);
app.route("/", listingsRouter);

const port = Number(process.env.API_PORT ?? 4021);
Bun.serve({ port, fetch: app.fetch });
console.log(`api          ready on http://127.0.0.1:${port}`);
