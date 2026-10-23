/**
 * Thrown for every crypto failure (wrong key, tampered ciphertext, unsupported
 * format version, KDF unavailable). There is no silent fallback path in this
 * module — callers must treat every CryptoError as fail-closed.
 */
export class CryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CryptoError";
  }
}
