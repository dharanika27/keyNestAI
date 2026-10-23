import { encodeUtf8 } from "./textEncoding.js";

/**
 * Builds the associated data authenticated (not encrypted) by the AEAD tag,
 * binding each ciphertext to the specific record/vault/field it belongs to
 * so ciphertext cannot be swapped between contexts undetected
 * (docs/crypto-design.md §4).
 */
export interface AadContext {
  vaultId: string;
  recordId: string;
  fieldPurpose: string;
}

export function buildAad(formatVersion: number, context: AadContext): Uint8Array {
  const joined = `${formatVersion}|${context.vaultId}|${context.recordId}|${context.fieldPurpose}`;
  return encodeUtf8(joined);
}
