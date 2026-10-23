import { VaultValidationError } from "./errors.js";
import type { VaultRecordInput } from "./types.js";

const OPTIONAL_STRING_FIELDS = ["username", "url", "notes", "category"] as const;

export function isValidRecordInput(value: unknown): value is VaultRecordInput {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v["title"] !== "string" || typeof v["password"] !== "string") return false;
  for (const field of OPTIONAL_STRING_FIELDS) {
    if (v[field] !== undefined && typeof v[field] !== "string") return false;
  }
  return true;
}

/** Validates caller-supplied input before it is ever encrypted. Fails
 * closed on malformed input rather than persisting it. */
export function assertValidRecordInput(input: VaultRecordInput): void {
  if (typeof input.title !== "string" || input.title.trim().length === 0) {
    throw new VaultValidationError("Record title must be a non-empty string.");
  }
  if (typeof input.password !== "string") {
    throw new VaultValidationError("Record password must be a string.");
  }
  for (const field of OPTIONAL_STRING_FIELDS) {
    const fieldValue = input[field];
    if (fieldValue !== undefined && typeof fieldValue !== "string") {
      throw new VaultValidationError(`Record field "${field}" must be a string when provided.`);
    }
  }
}
