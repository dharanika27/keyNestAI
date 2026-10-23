import {
  CURRENT_FORMAT_VERSION,
  CryptoError,
  DEFAULT_KDF_TIER,
  buildAad,
  decryptBlob,
  deriveKeyFromPassword,
  encryptBlob,
  generateId,
  generateSalt,
  generateVaultKey,
  unwrapKey,
  wipe,
  wrapKey,
  type KdfParamsTier,
} from "../crypto/index.js";
import { SystemClock, type Clock } from "./clock.js";
import {
  RecordConflictError,
  RecordIntegrityError,
  RecordNotFoundError,
  VaultLockedError,
  VaultNotFoundError,
  VaultUnlockError,
} from "./errors.js";
import type { EncryptedRecordEnvelope, VaultMetadataRecord, VaultRepository } from "./repository.js";
import type { VaultRecord, VaultRecordInput } from "./types.js";
import { assertValidRecordInput, isValidRecordInput } from "./validation.js";

const DEFAULT_INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;
const VAULT_KEY_WRAP_PURPOSE = "vault-key/master";
const RECORD_FIELD_PURPOSE = "login-record";

export interface VaultSessionOptions {
  repository: VaultRepository;
  clock?: Clock;
  /** Session locks itself after this many ms with no gated operation. */
  inactivityTimeoutMs?: number;
  /** Only consulted by `create()` — `unlock()` always uses the tier stored
   * in the vault's own metadata, since that is what the salt/params were
   * actually derived with. */
  kdfTier?: KdfParamsTier;
}

type SessionState = "unlocked" | "locked";

/**
 * Platform-agnostic vault engine: creation/unlock via the key hierarchy in
 * docs/crypto-design.md, encrypted record CRUD, and clock-driven inactivity
 * locking. Holds no UI, storage, or platform key-protection code directly —
 * those are injected via VaultRepository / Clock / (future) KeyProtector.
 */
export class VaultSession {
  readonly vaultId: string;
  private readonly repository: VaultRepository;
  private readonly clock: Clock;
  private readonly inactivityTimeoutMs: number;
  private state: SessionState;
  private vaultKey: Uint8Array | null;
  private lastActivityAt: number | null;

  private constructor(params: {
    vaultId: string;
    repository: VaultRepository;
    clock: Clock;
    inactivityTimeoutMs: number;
    vaultKey: Uint8Array;
  }) {
    this.vaultId = params.vaultId;
    this.repository = params.repository;
    this.clock = params.clock;
    this.inactivityTimeoutMs = params.inactivityTimeoutMs;
    this.state = "unlocked";
    this.vaultKey = params.vaultKey;
    this.lastActivityAt = this.clock.now();
  }

  /** Creates a brand-new vault: random Vault Key, wrapped under a freshly
   * Argon2id-derived Master Key, persisted via the given repository. */
  static async create(password: string, options: VaultSessionOptions): Promise<VaultSession> {
    const clock = options.clock ?? new SystemClock();
    const tier = options.kdfTier ?? DEFAULT_KDF_TIER;
    const vaultId = await generateId();

    const salt = await generateSalt();
    const derived = await deriveKeyFromPassword(password, salt, tier);
    const vaultKey = await generateVaultKey();
    let wrappedVaultKey: Uint8Array;
    try {
      wrappedVaultKey = await wrapKey(vaultKey, derived.key, VAULT_KEY_WRAP_PURPOSE);
    } finally {
      await wipe(derived.key);
    }

    const metadata: VaultMetadataRecord = {
      vaultId,
      formatVersion: CURRENT_FORMAT_VERSION,
      kdfSalt: salt,
      kdfTier: tier,
      wrappedVaultKey,
      createdAt: clock.now(),
    };
    await options.repository.saveVaultMetadata(metadata);

    return new VaultSession({
      vaultId,
      repository: options.repository,
      clock,
      inactivityTimeoutMs: options.inactivityTimeoutMs ?? DEFAULT_INACTIVITY_TIMEOUT_MS,
      vaultKey,
    });
  }

  /** Unlocks an existing vault. Fails closed with VaultUnlockError for any
   * cryptographic failure (wrong password, corrupted wrapped key) — never
   * reveals which specific check failed. */
  static async unlock(vaultId: string, password: string, options: VaultSessionOptions): Promise<VaultSession> {
    const clock = options.clock ?? new SystemClock();
    const metadata = await options.repository.getVaultMetadata(vaultId);
    if (!metadata) {
      throw new VaultNotFoundError(`No vault found for id ${vaultId}.`);
    }

    let vaultKey: Uint8Array;
    let derivedKey: Uint8Array | null = null;
    try {
      const derived = await deriveKeyFromPassword(password, metadata.kdfSalt, metadata.kdfTier);
      derivedKey = derived.key;
      vaultKey = await unwrapKey(metadata.wrappedVaultKey, derived.key, VAULT_KEY_WRAP_PURPOSE);
    } catch (err) {
      if (err instanceof CryptoError) {
        throw new VaultUnlockError("Incorrect master password.");
      }
      throw err;
    } finally {
      if (derivedKey) {
        await wipe(derivedKey);
      }
    }

    return new VaultSession({
      vaultId,
      repository: options.repository,
      clock,
      inactivityTimeoutMs: options.inactivityTimeoutMs ?? DEFAULT_INACTIVITY_TIMEOUT_MS,
      vaultKey,
    });
  }

  /** Pure status check — never mutates state. */
  isLocked(): boolean {
    return this.state === "locked" || this.isInactivityExpired();
  }

  /** Call when the host wants to proactively apply inactivity locking
   * without attempting an operation (e.g. on app foreground resume).
   * Returns true if this call is what caused the lock. */
  checkInactivity(): boolean {
    if (this.state === "unlocked" && this.isInactivityExpired()) {
      this.lock();
      return true;
    }
    return false;
  }

  /** Explicit lock. Synchronous state transition — secret-reading and
   * secret-modifying operations are rejected immediately, even though the
   * underlying key bytes are only best-effort zeroed asynchronously
   * afterward (docs/crypto-design.md §8; never guaranteed). */
  lock(): void {
    this.state = "locked";
    const key = this.vaultKey;
    this.vaultKey = null;
    this.lastActivityAt = null;
    if (key) {
      void wipe(key).catch(() => undefined);
    }
  }

  async addRecord(input: VaultRecordInput): Promise<VaultRecord> {
    assertValidRecordInput(input);
    const vaultKey = this.assertActiveAndGetKey();
    try {
      const id = await generateId();
      const now = this.clock.now();
      const record: VaultRecord = {
        ...input,
        id,
        vaultId: this.vaultId,
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
      const envelope = await this.encryptRecord(record, vaultKey);
      // Re-check right before the write: `lock()` may have run (state is a
      // synchronous flag) during any of the awaits above.
      this.assertStillUnlocked();
      const written = await this.repository.saveRecordIfVersionMatches(envelope, null);
      if (!written) {
        // Only reachable via an astronomically unlikely UUID collision —
        // fail closed rather than silently overwriting an unrelated record.
        throw new RecordConflictError(`Record id ${id} already exists.`);
      }
      return record;
    } finally {
      await wipe(vaultKey);
    }
  }

  async updateRecord(id: string, patch: Partial<VaultRecordInput>): Promise<VaultRecord> {
    const existing = await this.getRecord(id);
    const merged: VaultRecordInput = {
      title: patch.title ?? existing.title,
      username: patch.username ?? existing.username,
      password: patch.password ?? existing.password,
      url: patch.url ?? existing.url,
      notes: patch.notes ?? existing.notes,
      category: patch.category ?? existing.category,
    };
    assertValidRecordInput(merged);

    const vaultKey = this.assertActiveAndGetKey();
    try {
      const now = this.clock.now();
      const updated: VaultRecord = {
        ...merged,
        id: existing.id,
        vaultId: existing.vaultId,
        version: existing.version + 1,
        createdAt: existing.createdAt,
        updatedAt: now,
      };
      const envelope = await this.encryptRecord(updated, vaultKey);
      this.assertStillUnlocked();
      // Compare-and-swap on `existing.version`: if another update or a
      // delete landed between our read of `existing` and this write, the
      // repository rejects it instead of silently losing that change or
      // resurrecting a deleted record.
      const written = await this.repository.saveRecordIfVersionMatches(envelope, existing.version);
      if (!written) {
        throw new RecordConflictError(
          `Record ${id} was modified or deleted by a concurrent operation; refusing to overwrite.`,
        );
      }
      return updated;
    } finally {
      await wipe(vaultKey);
    }
  }

  async getRecord(id: string): Promise<VaultRecord> {
    const vaultKey = this.assertActiveAndGetKey();
    try {
      const envelope = await this.repository.getRecord(this.vaultId, id);
      if (!envelope) {
        throw new RecordNotFoundError(`No record found for id ${id}.`);
      }
      const record = await this.decryptRecord(envelope, vaultKey);
      this.assertStillUnlocked();
      return record;
    } finally {
      await wipe(vaultKey);
    }
  }

  async listRecords(): Promise<VaultRecord[]> {
    const vaultKey = this.assertActiveAndGetKey();
    try {
      const envelopes = await this.repository.listRecords(this.vaultId);
      const records: VaultRecord[] = [];
      const failedIds: string[] = [];
      for (const envelope of envelopes) {
        try {
          records.push(await this.decryptRecord(envelope, vaultKey));
        } catch {
          failedIds.push(envelope.id);
        }
      }
      if (failedIds.length > 0) {
        // Intentionally checked before assertStillUnlocked() below: if a
        // concurrent lock() also occurred during this scan, the caller
        // sees RecordIntegrityError rather than VaultLockedError. Neither
        // error exposes plaintext or any secret field either way, and a
        // corrupted record is itself worth surfacing regardless of lock
        // state, so this ordering is not considered a defect.
        throw new RecordIntegrityError(
          `Rejected ${failedIds.length} record(s) that failed integrity verification: ${failedIds.join(", ")}.`,
        );
      }
      this.assertStillUnlocked();
      return records;
    } finally {
      await wipe(vaultKey);
    }
  }

  async deleteRecord(id: string): Promise<void> {
    this.assertActive();
    const envelope = await this.repository.getRecord(this.vaultId, id);
    if (!envelope) {
      throw new RecordNotFoundError(`No record found for id ${id}.`);
    }
    this.assertStillUnlocked();
    await this.repository.deleteRecord(this.vaultId, id);
  }

  /** Case-insensitive search over non-secret-adjacent fields already
   * decrypted in memory for this call; does not add a separate unencrypted
   * search index. */
  async searchRecords(query: string): Promise<VaultRecord[]> {
    const all = await this.listRecords();
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) return all;
    return all.filter(
      (r) =>
        r.title.toLowerCase().includes(needle) ||
        (r.username?.toLowerCase().includes(needle) ?? false) ||
        (r.url?.toLowerCase().includes(needle) ?? false) ||
        (r.category?.toLowerCase().includes(needle) ?? false),
    );
  }

  private isInactivityExpired(): boolean {
    if (this.state !== "unlocked" || this.lastActivityAt === null) return false;
    return this.clock.now() - this.lastActivityAt >= this.inactivityTimeoutMs;
  }

  private assertActive(): void {
    this.checkInactivity();
    if (this.state !== "unlocked" || this.vaultKey === null) {
      throw new VaultLockedError("Vault is locked.");
    }
    this.lastActivityAt = this.clock.now();
  }

  /** Re-checks lock state with no side effects. Gated operations call this
   * immediately before their final secret-touching effect (a repository
   * write, or returning decrypted plaintext to the caller) so a `lock()`
   * that landed on one of the operation's earlier `await` points stops the
   * effect from completing, rather than only being observable afterward
   * via `isLocked()`. Does not replace the entry check in `assertActive()`/
   * `assertActiveAndGetKey()` — it narrows the window further. */
  private assertStillUnlocked(): void {
    if (this.state !== "unlocked") {
      throw new VaultLockedError("Vault was locked while this operation was in progress.");
    }
  }

  /** Returns a defensive copy of the vault key, not the live buffer.
   * Operations here are async and span multiple `await` points; a
   * concurrent `lock()` zeroes `this.vaultKey` in place, which must not be
   * able to corrupt an in-flight encrypt/decrypt sharing the same buffer. */
  private assertActiveAndGetKey(): Uint8Array {
    this.assertActive();
    if (this.vaultKey === null) {
      throw new VaultLockedError("Vault is locked.");
    }
    return new Uint8Array(this.vaultKey);
  }

  private async encryptRecord(record: VaultRecord, vaultKey: Uint8Array): Promise<EncryptedRecordEnvelope> {
    const aad = buildAad(CURRENT_FORMAT_VERSION, {
      vaultId: record.vaultId,
      recordId: record.id,
      fieldPurpose: RECORD_FIELD_PURPOSE,
    });
    const fields: VaultRecordInput = {
      title: record.title,
      username: record.username,
      password: record.password,
      url: record.url,
      notes: record.notes,
      category: record.category,
    };
    const plaintext = new TextEncoder().encode(JSON.stringify(fields));
    const ciphertext = await encryptBlob(vaultKey, plaintext, aad);
    return {
      id: record.id,
      vaultId: record.vaultId,
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      ciphertext,
    };
  }

  private async decryptRecord(envelope: EncryptedRecordEnvelope, vaultKey: Uint8Array): Promise<VaultRecord> {
    if (envelope.vaultId !== this.vaultId) {
      // Defense in depth: AAD binding below would also fail authentication
      // for a record swapped in from another vault, but reject explicitly
      // rather than even attempting to decrypt data addressed elsewhere.
      throw new RecordIntegrityError(`Record ${envelope.id} does not belong to this vault.`);
    }

    const aad = buildAad(CURRENT_FORMAT_VERSION, {
      vaultId: envelope.vaultId,
      recordId: envelope.id,
      fieldPurpose: RECORD_FIELD_PURPOSE,
    });

    let plaintext: Uint8Array;
    try {
      plaintext = await decryptBlob(vaultKey, envelope.ciphertext, aad);
    } catch (err) {
      if (err instanceof CryptoError) {
        throw new RecordIntegrityError(`Record ${envelope.id} failed integrity verification.`);
      }
      throw err;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(new TextDecoder().decode(plaintext));
    } catch {
      throw new RecordIntegrityError(`Record ${envelope.id} contains malformed data.`);
    }

    if (!isValidRecordInput(parsed)) {
      throw new RecordIntegrityError(`Record ${envelope.id} has an invalid schema.`);
    }

    return {
      ...parsed,
      id: envelope.id,
      vaultId: envelope.vaultId,
      version: envelope.version,
      createdAt: envelope.createdAt,
      updatedAt: envelope.updatedAt,
    };
  }
}
