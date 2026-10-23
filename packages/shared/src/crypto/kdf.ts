import { getSodium } from "./sodium.js";
import { CryptoError } from "./errors.js";
import type { KdfParamsTier } from "./constants.js";

export interface DerivedKey {
  key: Uint8Array;
  salt: Uint8Array;
  tier: KdfParamsTier;
}

/**
 * Generates a fresh, random Argon2id salt. One salt per vault, stored
 * alongside the (non-secret) tier label — never reused across vaults.
 */
export async function generateSalt(): Promise<Uint8Array> {
  const sodium = await getSodium();
  return sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);
}

/**
 * Derives a 32-byte key from a password using Argon2id (docs/crypto-design.md
 * §3). Fails closed (throws CryptoError) if the WASM module or the algorithm
 * is unavailable — there is no fallback to a weaker KDF.
 */
export async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array,
  tier: KdfParamsTier,
): Promise<DerivedKey> {
  const sodium = await getSodium();

  if (salt.length !== sodium.crypto_pwhash_SALTBYTES) {
    throw new CryptoError("Invalid salt length for Argon2id key derivation.");
  }
  if (password.length === 0) {
    throw new CryptoError("Password must not be empty.");
  }

  const { opslimit, memlimit } = kdfParamsForTier(sodium, tier);

  try {
    const key = sodium.crypto_pwhash(
      32,
      password,
      salt,
      opslimit,
      memlimit,
      sodium.crypto_pwhash_ALG_ARGON2ID13,
    );
    return { key, salt, tier };
  } catch (err) {
    // libsodium throws on OOM / unsupported params rather than returning a
    // degraded key — surfaced here as a fail-closed CryptoError.
    throw new CryptoError(
      `Argon2id key derivation failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

function kdfParamsForTier(
  sodium: Awaited<ReturnType<typeof getSodium>>,
  tier: KdfParamsTier,
): { opslimit: number; memlimit: number } {
  switch (tier) {
    case "desktop_moderate":
      return {
        opslimit: sodium.crypto_pwhash_OPSLIMIT_MODERATE,
        memlimit: sodium.crypto_pwhash_MEMLIMIT_MODERATE,
      };
    case "mobile_constrained":
      // Lower memory ceiling for RAM-constrained devices, compensated with a
      // higher time cost. Documented tradeoff, not a silent downgrade — the
      // tier is stored with the wrapped key (docs/crypto-design.md §3).
      return {
        opslimit: sodium.crypto_pwhash_OPSLIMIT_SENSITIVE,
        memlimit: sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
      };
    default: {
      const exhaustive: never = tier;
      throw new CryptoError(`Unknown KDF parameter tier: ${String(exhaustive)}`);
    }
  }
}
