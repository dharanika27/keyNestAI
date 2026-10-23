import { getSodium } from "./sodium.js";

/**
 * Generates a random UUIDv4 string using libsodium's CSPRNG, so record and
 * vault identifiers draw from the same audited entropy source as the rest
 * of this module instead of relying on `globalThis.crypto.randomUUID`,
 * which is not guaranteed to exist in every target runtime (e.g. React
 * Native/Hermes without a polyfill).
 */
export async function generateId(): Promise<string> {
  const sodium = await getSodium();
  const bytes = sodium.randombytes_buf(16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = sodium.to_hex(bytes);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
