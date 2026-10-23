import {
  CryptoError,
  PasswordGeneratorError,
  RecordConflictError,
  RecordIntegrityError,
  RecordNotFoundError,
  VaultLockedError,
  VaultNotFoundError,
  VaultUnlockError,
  VaultValidationError,
} from '@keynest/shared'

/**
 * Maps known KeyNest error types to a safe, user-facing message. Every
 * mapped error class is documented (packages/shared/src/vault/errors.ts)
 * to never interpolate secret field values — only ids, counts, and
 * reasons — so these messages are safe to show directly. Anything else
 * falls back to a generic message rather than displaying a raw error.
 */
export function toUserMessage(error: unknown): string {
  if (error instanceof VaultUnlockError) return 'Incorrect master password.'
  if (error instanceof VaultNotFoundError) return 'This vault could not be found on this device.'
  if (error instanceof VaultLockedError) return 'The vault is locked. Please unlock it and try again.'
  if (error instanceof RecordNotFoundError) return 'That item could not be found — it may have been deleted.'
  if (error instanceof RecordConflictError) {
    return 'This item was changed by another tab or window. Please reload and try again.'
  }
  if (error instanceof RecordIntegrityError) return 'This item failed an integrity check and was not loaded.'
  if (error instanceof VaultValidationError) return error.message
  if (error instanceof PasswordGeneratorError) return error.message
  if (error instanceof CryptoError) return 'A cryptographic operation failed. Please try again.'
  return 'Something went wrong. Please try again.'
}
