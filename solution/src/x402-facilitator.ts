/**
 * Local x402 facilitator for surfpool. In production you'd point at
 * https://facilitator.x402.org; for local surfpool we run our own.
 *
 * The facilitator is a tiny HTTP service that:
 *   - verifies x402 payment payloads against on-chain state
 *   - settles them by broadcasting to the Solana RPC
 * Its signer sponsors transaction fees — so it needs SOL.
 */
import { Hono } from "hono";
import { x402Facilitator } from "@x402/core/facilitator";
import { registerExactSvmScheme } from "@x402/svm/exact/facilitator";
import { toFacilitatorSvmSigner } from "@x402/svm";
import { loadSignerFromEnv } from "./wallet";

export async function startFacilitator() {
  const keypair = await loadSignerFromEnv("FACILITATOR_WALLET_SECRET");
  const signer = toFacilitatorSvmSigner(keypair, {
    defaultRpcUrl: process.env.SOLANA_RPC_URL,
  });

  const facilitator = new x402Facilitator();
  registerExactSvmScheme(facilitator, {
    networks: [process.env.X402_NETWORK!],
    signer,
  });

  // x402 facilitators speak three HTTP routes: /verify, /settle, /supported.
  const app = new Hono();
  app.post("/verify", async (c) => {
    const { paymentPayload, paymentRequirements } = await c.req.json();
    const result = await facilitator.verify(paymentPayload, paymentRequirements);
    if (!result.isValid) console.error("verify FAIL:", JSON.stringify(result));
    return c.json(result);
  });
  app.post("/settle", async (c) => {
    const { paymentPayload, paymentRequirements } = await c.req.json();
    const result = await facilitator.settle(paymentPayload, paymentRequirements);
    if (!result.success) console.error("settle FAIL:", JSON.stringify(result));
    return c.json(result);
  });
  app.get("/supported", (c) => c.json(facilitator.getSupported()));

  const port = Number(new URL(process.env.FACILITATOR_URL!).port);
  Bun.serve({ port, fetch: app.fetch });
  console.log(`facilitator  ready on ${process.env.FACILITATOR_URL}`);
}
