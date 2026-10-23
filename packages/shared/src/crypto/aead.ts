import { getSodium } from "./sodium.js";
import { CryptoError } from "./errors.js";
import { CURRENT_FORMAT_VERSION, SUPPORTED_FORMAT_VERSIONS } from "./constants.js";

const FORMAT_VERSION_BYTES = 1;

/**
 * Encrypts `plaintext` with XChaCha20-Poly1305-IETF under a random 24-byte
 * nonce (docs/crypto-design.md §4). Returns a single self-describing blob:
 * formatVersion(1) || nonce(24) || ciphertext+tag.
 */
export async function encryptBlob(
  key: Uint8Array,
  plaintext: Uint8Array,
  aad: Uint8Array,
): Promise<Uint8Array> {
  const sodium = await getSodium();

  if (key.length !== sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES) {
    throw new CryptoError("Invalid key length for XChaCha20-Poly1305.");
  }

  const nonce = sodium.randombytes_buf(
    sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES,
  );

  const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    plaintext,
    aad,
    null,
    nonce,
    key,
  );

  const blob = new Uint8Array(FORMAT_VERSION_BYTES + nonce.length + ciphertext.length);
  blob[0] = CURRENT_FORMAT_VERSION;
  blob.set(nonce, FORMAT_VERSION_BYTES);
  blob.set(ciphertext, FORMAT_VERSION_BYTES + nonce.length);
  return blob;
}

/**
 * Decrypts a blob produced by encryptBlob. Fails closed (throws CryptoError)
 * on: unsupported format version, wrong key, tampered ciphertext, or
 * tampered AAD — never returns partial or unauthenticated plaintext.
 */
export async function decryptBlob(
  key: Uint8Array,
  blob: Uint8Array,
  aad: Uint8Array,
): Promise<Uint8Array> {
  const sodium = await getSodium();

  if (key.length !== sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES) {
    throw new CryptoError("Invalid key length for XChaCha20-Poly1305.");
  }

  const nonceBytes = sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES;
  if (blob.length < FORMAT_VERSION_BYTES + nonceBytes) {
    throw new CryptoError("Ciphertext blob is too short to be valid.");
  }

  const formatVersion = blob[0];
  if (formatVersion === undefined || !SUPPORTED_FORMAT_VERSIONS.includes(formatVersion)) {
    throw new CryptoError(`Unsupported crypto format version: ${String(formatVersion)}`);
  }

  const nonce = blob.slice(FORMAT_VERSION_BYTES, FORMAT_VERSION_BYTES + nonceBytes);
  const ciphertext = blob.slice(FORMAT_VERSION_BYTES + nonceBytes);

  try {
    return sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null,
      ciphertext,
      aad,
      nonce,
      key,
    );
  } catch {
    // libsodium throws on authentication failure. Re-thrown as a CryptoError
    // without leaking any detail about why (wrong key vs. tampering are
    // indistinguishable by design).
    throw new CryptoError("Decryption failed: wrong key or tampered ciphertext.");
  }
}
