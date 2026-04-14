/**
 * Helpers for wiring x402 payment gating into Hono routes.
 */
import { x402ResourceServer } from "@x402/hono";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactSvmScheme } from "@x402/svm/exact/server";

const NETWORK = process.env.X402_NETWORK!;

const facilitatorClient = new HTTPFacilitatorClient({
  url: process.env.FACILITATOR_URL!,
});

export const resourceServer = new x402ResourceServer(facilitatorClient)
  .register(NETWORK, new ExactSvmScheme());

/** Build an x402 `accepts` clause for a price in micro-USDC paid to `payTo`. */
export function usdcAccepts(microUsdc: number, payTo: string, description: string) {
  const dollars = (microUsdc / 1_000_000).toFixed(2);
  return {
    scheme: "exact" as const,
    price: `$${dollars}`,
    network: NETWORK,
    payTo,
    maxTimeoutSeconds: 60,
    description,
  };
}
