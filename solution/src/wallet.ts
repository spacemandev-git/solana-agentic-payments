import { createKeyPairSignerFromPrivateKeyBytes } from "@solana/kit";
import { base58 } from "@scure/base";

/** Load a signer from a base58-encoded 32-byte private key stored in an env var. */
export async function loadSignerFromEnv(envVar: string) {
  const secret = process.env[envVar];
  if (!secret) throw new Error(`Missing ${envVar}. Run: bun run setup`);
  return createKeyPairSignerFromPrivateKeyBytes(base58.decode(secret), true);
}

/** Generate a fresh Solana keypair and return { address, secret } (base58 32-byte seed). */
export async function newKeypair() {
  const seed = crypto.getRandomValues(new Uint8Array(32));
  const signer = await createKeyPairSignerFromPrivateKeyBytes(seed, true);
  return { address: signer.address, secret: base58.encode(seed) };
}
