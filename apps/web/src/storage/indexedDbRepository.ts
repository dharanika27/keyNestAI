import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { EncryptedRecordEnvelope, VaultMetadataRecord, VaultRepository } from '@keynest/shared'

const DB_NAME = 'keynest-vault'
const DB_VERSION = 1
const METADATA_STORE = 'vaultMetadata'
const RECORDS_STORE = 'records'
const RECORDS_BY_VAULT_INDEX = 'byVaultId'

interface KeyNestDbSchema extends DBSchema {
  [METADATA_STORE]: {
    key: string // vaultId
    value: VaultMetadataRecord
  }
  [RECORDS_STORE]: {
    key: [string, string] // [vaultId, id]
    value: EncryptedRecordEnvelope
    indexes: { [RECORDS_BY_VAULT_INDEX]: string }
  }
}

/**
 * IndexedDB's storage/retrieval is implemented via the structured clone
 * algorithm, which is a host/native operation rather than ordinary JS —
 * reconstructed typed arrays can come back tied to a different realm's
 * Uint8Array than the one the rest of the app uses (observed in jsdom
 * test environments; a real browser has only one realm, so this is a
 * no-op copy there). `encryptBlob`/`decryptBlob` in packages/shared
 * perform a strict `instanceof Uint8Array` check, so every byte array
 * read back from storage is normalized here before use.
 */
function normalizeBytes(value: Uint8Array): Uint8Array {
  return new Uint8Array(value)
}

function normalizeEnvelope(envelope: EncryptedRecordEnvelope): EncryptedRecordEnvelope {
  return { ...envelope, ciphertext: normalizeBytes(envelope.ciphertext) }
}

function normalizeMetadata(metadata: VaultMetadataRecord): VaultMetadataRecord {
  return {
    ...metadata,
    kdfSalt: normalizeBytes(metadata.kdfSalt),
    wrappedVaultKey: normalizeBytes(metadata.wrappedVaultKey),
  }
}

function openVaultDatabase(): Promise<IDBPDatabase<KeyNestDbSchema>> {
  return openDB<KeyNestDbSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore(METADATA_STORE, { keyPath: 'vaultId' })
      const recordsStore = db.createObjectStore(RECORDS_STORE, { keyPath: ['vaultId', 'id'] })
      recordsStore.createIndex(RECORDS_BY_VAULT_INDEX, 'vaultId')
    },
  })
}

/**
 * Web implementation of packages/shared's VaultRepository, backed by
 * IndexedDB (docs/architecture.md §1). Stores only ciphertext and the
 * metadata docs/crypto-design.md already treats as visible to storage —
 * never a plaintext secret. See docs/crypto-design.md §7 for this
 * platform's documented key-protection limitations (no OS secure enclave).
 *
 * saveRecordIfVersionMatches performs its read-check and conditional write
 * inside a single IndexedDB transaction, satisfying the atomicity contract
 * required by packages/shared/src/vault/repository.ts — this holds across
 * browser tabs sharing the same origin/database, not just within one
 * connection, because IndexedDB serializes overlapping readwrite
 * transactions on the same object store at the database level.
 */
export class IndexedDbVaultRepository implements VaultRepository {
  private dbPromise: Promise<IDBPDatabase<KeyNestDbSchema>> | null = null

  private db(): Promise<IDBPDatabase<KeyNestDbSchema>> {
    if (!this.dbPromise) {
      this.dbPromise = openVaultDatabase()
    }
    return this.dbPromise
  }

  async saveVaultMetadata(metadata: VaultMetadataRecord): Promise<void> {
    const db = await this.db()
    await db.put(METADATA_STORE, metadata)
  }

  async getVaultMetadata(vaultId: string): Promise<VaultMetadataRecord | null> {
    const db = await this.db()
    const result = await db.get(METADATA_STORE, vaultId)
    return result ? normalizeMetadata(result) : null
  }

  async saveRecord(envelope: EncryptedRecordEnvelope): Promise<void> {
    const db = await this.db()
    await db.put(RECORDS_STORE, envelope)
  }

  async saveRecordIfVersionMatches(
    envelope: EncryptedRecordEnvelope,
    expectedCurrentVersion: number | null,
  ): Promise<boolean> {
    const db = await this.db()
    const tx = db.transaction(RECORDS_STORE, 'readwrite')
    const store = tx.objectStore(RECORDS_STORE)
    const current = await store.get([envelope.vaultId, envelope.id])
    const currentVersion = current ? current.version : null
    if (currentVersion !== expectedCurrentVersion) {
      await tx.done
      return false
    }
    await store.put(envelope)
    await tx.done
    return true
  }

  async getRecord(vaultId: string, recordId: string): Promise<EncryptedRecordEnvelope | null> {
    const db = await this.db()
    const result = await db.get(RECORDS_STORE, [vaultId, recordId])
    return result ? normalizeEnvelope(result) : null
  }

  async listRecords(vaultId: string): Promise<EncryptedRecordEnvelope[]> {
    const db = await this.db()
    const results = await db.getAllFromIndex(RECORDS_STORE, RECORDS_BY_VAULT_INDEX, vaultId)
    return results.map(normalizeEnvelope)
  }

  async deleteRecord(vaultId: string, recordId: string): Promise<void> {
    const db = await this.db()
    await db.delete(RECORDS_STORE, [vaultId, recordId])
  }
}
