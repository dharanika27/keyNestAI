import type { KdfParamsTier } from "../crypto/index.js";

export interface VaultMetadataRecord {
  vaultId: string;
  formatVersion: number;
  kdfSalt: Uint8Array;
  kdfTier: KdfParamsTier;
  wrappedVaultKey: Uint8Array;
  createdAt: number;
}

/** Opaque, persisted shape of a record. `ciphertext` is the only field that
 * ever contains secret-derived bytes; everything else here is metadata the
 * design already treats as visible to storage (docs/threat-model.md §3.1). */
export interface EncryptedRecordEnvelope {
  id: string;
  vaultId: string;
  version: number;
  createdAt: number;
  updatedAt: number;
  ciphertext: Uint8Array;
}

/**
 * Persistence seam. Implementations must be pure storage — they must not
 * make authorization, lock-state, or integrity decisions; that logic lives
 * entirely in VaultSession. Real platforms back this with IndexedDB (web,
 * Phase 2) or SQLite (mobile, Phase 4) per docs/architecture.md. This
 * package ships only the in-memory reference implementation below, for
 * tests and for composition by callers that haven't wired real storage yet.
 */
export interface VaultRepository {
  saveVaultMetadata(metadata: VaultMetadataRecord): Promise<void>;
  getVaultMetadata(vaultId: string): Promise<VaultMetadataRecord | null>;
  /** Unconditional overwrite. VaultSession itself never calls this for
   * add/update (see saveRecordIfVersionMatches) — it exists for direct,
   * low-level repository access (e.g. test setup simulating storage
   * corruption or an attacker-controlled write). */
  saveRecord(envelope: EncryptedRecordEnvelope): Promise<void>;
  /**
   * Atomic compare-and-swap write: persists `envelope` only if the
   * currently stored record's version equals `expectedCurrentVersion`, or,
   * when `expectedCurrentVersion` is `null`, only if no record currently
   * exists for `envelope.id`. Returns `false` without writing if that
   * precondition doesn't hold. VaultSession relies on this — not
   * `saveRecord` — for add/update, so a concurrent update or delete that
   * lands between a caller's read and write is detected as a conflict
   * instead of silently lost or resurrecting a deleted record (see
   * docs/threat-model.md §3.10 on intra-session concurrency).
   *
   * Implementations MUST make the version check and the write atomic — no
   * other write to the same `(vaultId, id)` pair may be observed or applied
   * between them. Concretely:
   * - A real backing store (IndexedDB/SQLite) must perform the read-check
   *   and the write inside the *same* transaction. Performing the read in
   *   one transaction and the write in a separate one reopens exactly the
   *   race this method exists to close, even if each individual call looks
   *   correct in isolation.
   * - For IndexedDB specifically, this must hold across browser tabs/
   *   documents sharing the same origin and therefore the same database —
   *   same-process, same-instance concurrency is not the only case that
   *   matters; two tabs with their own unlocked `VaultSession` over the
   *   same vault are a realistic way this race occurs in the web app.
   * - The in-memory implementation below satisfies this because its
   *   check and write are both synchronous and never yield to the event
   *   loop between them, so no interleaving is possible; it is not an
   *   example of transaction usage, only of one way to achieve the same
   *   atomicity guarantee.
   */
  saveRecordIfVersionMatches(
    envelope: EncryptedRecordEnvelope,
    expectedCurrentVersion: number | null,
  ): Promise<boolean>;
  getRecord(vaultId: string, recordId: string): Promise<EncryptedRecordEnvelope | null>;
  listRecords(vaultId: string): Promise<EncryptedRecordEnvelope[]>;
  deleteRecord(vaultId: string, recordId: string): Promise<void>;
}

export class InMemoryVaultRepository implements VaultRepository {
  private readonly metadata = new Map<string, VaultMetadataRecord>();
  private readonly records = new Map<string, Map<string, EncryptedRecordEnvelope>>();

  async saveVaultMetadata(metadata: VaultMetadataRecord): Promise<void> {
    this.metadata.set(metadata.vaultId, metadata);
  }

  async getVaultMetadata(vaultId: string): Promise<VaultMetadataRecord | null> {
    return this.metadata.get(vaultId) ?? null;
  }

  async saveRecord(envelope: EncryptedRecordEnvelope): Promise<void> {
    const vaultRecords = this.records.get(envelope.vaultId) ?? new Map<string, EncryptedRecordEnvelope>();
    vaultRecords.set(envelope.id, envelope);
    this.records.set(envelope.vaultId, vaultRecords);
  }

  async saveRecordIfVersionMatches(
    envelope: EncryptedRecordEnvelope,
    expectedCurrentVersion: number | null,
  ): Promise<boolean> {
    // No `await` between the read and the write below: this method body
    // runs to completion in a single microtask, so it is genuinely atomic
    // with respect to any other call on this repository.
    const vaultRecords = this.records.get(envelope.vaultId) ?? new Map<string, EncryptedRecordEnvelope>();
    const current = vaultRecords.get(envelope.id) ?? null;
    const currentVersion = current ? current.version : null;
    if (currentVersion !== expectedCurrentVersion) {
      return false;
    }
    vaultRecords.set(envelope.id, envelope);
    this.records.set(envelope.vaultId, vaultRecords);
    return true;
  }

  async getRecord(vaultId: string, recordId: string): Promise<EncryptedRecordEnvelope | null> {
    return this.records.get(vaultId)?.get(recordId) ?? null;
  }

  async listRecords(vaultId: string): Promise<EncryptedRecordEnvelope[]> {
    return Array.from(this.records.get(vaultId)?.values() ?? []);
  }

  async deleteRecord(vaultId: string, recordId: string): Promise<void> {
    this.records.get(vaultId)?.delete(recordId);
  }
}
