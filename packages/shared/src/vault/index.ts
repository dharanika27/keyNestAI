export { SystemClock, type Clock } from "./clock.js";
export { toLogSafeSummary, type VaultRecord, type VaultRecordInput, type VaultRecordLogSafeSummary } from "./types.js";
export {
  InMemoryVaultRepository,
  type EncryptedRecordEnvelope,
  type VaultMetadataRecord,
  type VaultRepository,
} from "./repository.js";
export { InMemoryKeyProtector, type KeyProtector } from "./keyProtector.js";
export {
  RecordConflictError,
  RecordIntegrityError,
  RecordNotFoundError,
  VaultError,
  VaultLockedError,
  VaultNotFoundError,
  VaultUnlockError,
  VaultValidationError,
} from "./errors.js";
export { VaultSession, type VaultSessionOptions } from "./vaultSession.js";
