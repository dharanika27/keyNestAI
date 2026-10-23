import type { EncryptedRecordEnvelope, VaultMetadataRecord, VaultRepository } from "../repository.js";

/**
 * Test-only repository decorator that deterministically forces a specific
 * interleaving: the first *update-style* call to `saveRecordIfVersionMatches`
 * (i.e. one with a non-null `expectedCurrentVersion` — `addRecord`'s
 * create-style calls always pass `null` and are left untouched) first runs
 * `onBeforeFirstWrite` to completion, then performs the real write. This
 * lets a test simulate "a concurrent operation finished between this
 * caller's read and its write" without depending on incidental microtask
 * ordering between two independently-fired async chains, which would be
 * fragile and implementation-timing-dependent rather than a deterministic
 * reproduction of the race.
 */
export class RaceInjectingRepository implements VaultRepository {
  private injected = false;

  constructor(
    private readonly inner: VaultRepository,
    private readonly onBeforeFirstWrite: () => Promise<void>,
  ) {}

  saveVaultMetadata(metadata: VaultMetadataRecord): Promise<void> {
    return this.inner.saveVaultMetadata(metadata);
  }

  getVaultMetadata(vaultId: string): Promise<VaultMetadataRecord | null> {
    return this.inner.getVaultMetadata(vaultId);
  }

  saveRecord(envelope: EncryptedRecordEnvelope): Promise<void> {
    return this.inner.saveRecord(envelope);
  }

  async saveRecordIfVersionMatches(
    envelope: EncryptedRecordEnvelope,
    expectedCurrentVersion: number | null,
  ): Promise<boolean> {
    if (!this.injected && expectedCurrentVersion !== null) {
      this.injected = true;
      await this.onBeforeFirstWrite();
    }
    return this.inner.saveRecordIfVersionMatches(envelope, expectedCurrentVersion);
  }

  getRecord(vaultId: string, recordId: string): Promise<EncryptedRecordEnvelope | null> {
    return this.inner.getRecord(vaultId, recordId);
  }

  listRecords(vaultId: string): Promise<EncryptedRecordEnvelope[]> {
    return this.inner.listRecords(vaultId);
  }

  deleteRecord(vaultId: string, recordId: string): Promise<void> {
    return this.inner.deleteRecord(vaultId, recordId);
  }
}
