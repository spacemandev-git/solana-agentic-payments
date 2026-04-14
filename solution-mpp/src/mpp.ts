/**
 * MPP server setup.
 *
 * Unlike x402, there is **no facilitator** — the server itself verifies
 * payment credentials and (in "pull" mode) broadcasts the client-signed
 * transaction directly to the Solana RPC. One wallet, one process.
 *
 * The optional `signer` below enables fee sponsorship: the server signs the
 * transaction as fee payer before broadcasting, so the agent wallet doesn't
 * need any SOL — just USDC.
 */
import { Mppx, solana } from "@solana/mpp/server";
import { loadSignerFromEnv } from "./wallet";

const USDC = process.env.USDC_MINT!;
const NETWORK = (process.env.MPP_NETWORK ?? "mainnet-beta") as
  | "mainnet-beta" | "devnet" | "localnet";
const RPC = process.env.SOLANA_RPC_URL!;
const RECIPIENT = process.env.SERVER_WALLET_ADDRESS!;

const feePayer = await loadSignerFromEnv("SERVER_WALLET_SECRET");

/** Mppx bound to the server wallet as USDC recipient + fee payer. */
export const mppx = Mppx.create({
  secretKey: process.env.MPP_SECRET_KEY!,
  methods: [
    solana.charge({
      recipient: RECIPIENT,
      currency: USDC,
      decimals: 6,
      network: NETWORK,
      rpcUrl: RPC,
      signer: feePayer,
      html: true,
    }),
  ],
});

/**
 * Build an ad-hoc Mppx for a different recipient (used by secondary-market
 * listings — each listing routes USDC directly to the seller). The server
 * still fee-sponsors the transaction so the buyer only needs USDC.
 */
export function mppxForRecipient(recipient: string) {
  return Mppx.create({
    secretKey: process.env.MPP_SECRET_KEY!,
    methods: [
      solana.charge({
        recipient,
        currency: USDC,
        decimals: 6,
        network: NETWORK,
        rpcUrl: RPC,
        signer: feePayer,
        html: true,
      }),
    ],
  });
}

/** Convert micro-USDC (integer) to the base-unit string MPP wants. */
export const microToAmount = (micro: number) => String(micro);
