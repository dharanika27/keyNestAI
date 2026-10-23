import { getSodium } from "./sodium.js";

/**
 * Generates a random Vault Key (DEK) — docs/crypto-design.md §2. Never
 * derived from a password; the only source of entropy is the CSPRNG.
 */
export async function generateVaultKey(): Promise<Uint8Array> {
  const sodium = await getSodium();
  return sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES);
}
