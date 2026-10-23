import { encryptBlob, decryptBlob } from "./aead.js";

/**
 * Wraps (encrypts) one key under another using the same AEAD construction as
 * record encryption (docs/crypto-design.md §2). `purpose` distinguishes wrap
 * types (e.g. "vault-key/master", "vault-key/recovery") in the AAD so a
 * wrapped blob cannot be misapplied to a different unwrap context.
 */
export async function wrapKey(
  keyToWrap: Uint8Array,
  wrappingKey: Uint8Array,
  purpose: string,
): Promise<Uint8Array> {
  const aad = new TextEncoder().encode(`key-wrap|${purpose}`);
  return encryptBlob(wrappingKey, keyToWrap, aad);
}

/**
 * Unwraps a key produced by wrapKey. Fails closed (throws CryptoError) on
 * wrong wrapping key, tampered blob, or a `purpose` mismatch.
 */
export async function unwrapKey(
  wrapped: Uint8Array,
  wrappingKey: Uint8Array,
  purpose: string,
): Promise<Uint8Array> {
  const aad = new TextEncoder().encode(`key-wrap|${purpose}`);
  return decryptBlob(wrappingKey, wrapped, aad);
}
