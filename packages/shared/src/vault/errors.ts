/**
 * Base for all vault-layer errors. Messages must never interpolate secret
 * field values (passwords, notes) — only identifiers, counts, and reasons.
 */
export class VaultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class VaultNotFoundError extends VaultError {}

/** Thrown when master-password unlock fails. Deliberately does not reveal
 * whether the vault, salt, or password was the specific problem. */
export class VaultUnlockError extends VaultError {}

/** Thrown by any secret-reading or secret-modifying operation attempted on
 * a locked (explicitly locked, or inactivity-expired) vault session. */
export class VaultLockedError extends VaultError {}

export class RecordNotFoundError extends VaultError {}

/** Thrown when a write loses an optimistic-concurrency race: the record was
 * modified or deleted by another operation between this caller's read and
 * its write. Callers must not retry blindly with the same base version —
 * they must re-read and decide how to reconcile. */
export class RecordConflictError extends VaultError {}

/** Thrown when a stored record fails authentication, fails schema
 * validation after decryption, or does not belong to the unlocking vault —
 * covers "tampered", "malformed", "unsupported version", and "unauthorized"
 * record rejection in one error type. */
export class RecordIntegrityError extends VaultError {}

/** Thrown when caller-supplied record input fails basic shape validation
 * before it is ever encrypted. */
export class VaultValidationError extends VaultError {}
