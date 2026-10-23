// @vitest-environment node
//
// This repository talks only to IndexedDB (polyfilled via fake-indexeddb),
// never the DOM. Running it under jsdom would run this test file in a
// separate vm realm from the externalized idb/fake-indexeddb node_modules
// packages, so a round-tripped Uint8Array would come back as a different
// realm's Uint8Array and fail `toEqual`/`instanceof` despite being
// byte-identical — a jsdom/Vitest test-environment artifact, not a defect
// in the repository. The `node` environment avoids the dual-realm split.
import { describe, it, expect } from 'vitest'
import { IndexedDbVaultRepository } from '../indexedDbRepository'

// Each test uses a fresh, unique vaultId so tests don't interfere with each
// other inside the same shared fake-indexeddb instance.
let vaultCounter = 0
function uniqueVaultId(): string {
  vaultCounter += 1
  return `test-vault-${vaultCounter}`
}

describe('IndexedDbVaultRepository', () => {
  it('returns null for metadata and records that were never saved', async () => {
    const repo = new IndexedDbVaultRepository()
    const vaultId = uniqueVaultId()
    expect(await repo.getVaultMetadata(vaultId)).toBeNull()
    expect(await repo.getRecord(vaultId, 'missing-record')).toBeNull()
    expect(await repo.listRecords(vaultId)).toEqual([])
  })

  it('round-trips vault metadata', async () => {
    const repo = new IndexedDbVaultRepository()
    const vaultId = uniqueVaultId()
    const metadata = {
      vaultId,
      formatVersion: 1,
      kdfSalt: new Uint8Array([1, 2, 3]),
      kdfTier: 'desktop_moderate' as const,
      wrappedVaultKey: new Uint8Array([4, 5, 6]),
      createdAt: 1000,
    }
    await repo.saveVaultMetadata(metadata)
    expect(await repo.getVaultMetadata(vaultId)).toEqual(metadata)
  })

  it('round-trips, lists, and deletes records scoped per vault', async () => {
    const repo = new IndexedDbVaultRepository()
    const vaultId = uniqueVaultId()
    const otherVaultId = uniqueVaultId()
    const envelope = {
      id: 'rec-1',
      vaultId,
      version: 1,
      createdAt: 1,
      updatedAt: 1,
      ciphertext: new Uint8Array([9, 9, 9]),
    }
    const otherEnvelope = { ...envelope, vaultId: otherVaultId, ciphertext: new Uint8Array([8, 8, 8]) }

    await repo.saveRecord(envelope)
    await repo.saveRecord(otherEnvelope)

    expect(await repo.getRecord(vaultId, 'rec-1')).toEqual(envelope)
    expect(await repo.listRecords(vaultId)).toEqual([envelope])

    await repo.deleteRecord(vaultId, 'rec-1')
    expect(await repo.getRecord(vaultId, 'rec-1')).toBeNull()
    expect(await repo.getRecord(otherVaultId, 'rec-1')).toEqual(otherEnvelope)
  })

  it('saveRecordIfVersionMatches writes only when the expected version matches', async () => {
    const repo = new IndexedDbVaultRepository()
    const vaultId = uniqueVaultId()
    const envelopeV1 = {
      id: 'rec-1',
      vaultId,
      version: 1,
      createdAt: 1,
      updatedAt: 1,
      ciphertext: new Uint8Array([1]),
    }

    expect(await repo.saveRecordIfVersionMatches(envelopeV1, null)).toBe(true)
    expect(await repo.getRecord(vaultId, 'rec-1')).toEqual(envelopeV1)

    // A second "creation" attempt for the same id is rejected.
    expect(await repo.saveRecordIfVersionMatches(envelopeV1, null)).toBe(false)

    const envelopeV2 = { ...envelopeV1, version: 2, ciphertext: new Uint8Array([2]) }
    expect(await repo.saveRecordIfVersionMatches(envelopeV2, 99)).toBe(false)
    expect(await repo.getRecord(vaultId, 'rec-1')).toEqual(envelopeV1)

    expect(await repo.saveRecordIfVersionMatches(envelopeV2, 1)).toBe(true)
    expect(await repo.getRecord(vaultId, 'rec-1')).toEqual(envelopeV2)
  })

  it('serializes concurrent compare-and-swap writes from two separate connections (simulating two browser tabs) so exactly one wins', async () => {
    const vaultId = uniqueVaultId()
    // Two independent repository instances, each with its own IndexedDB
    // connection to the same underlying database — the same situation as
    // two tabs open on the same origin.
    const tabA = new IndexedDbVaultRepository()
    const tabB = new IndexedDbVaultRepository()

    const base = {
      id: 'rec-1',
      vaultId,
      version: 1,
      createdAt: 1,
      updatedAt: 1,
      ciphertext: new Uint8Array([0]),
    }
    await tabA.saveRecordIfVersionMatches(base, null)

    const envelopeFromA = { ...base, version: 2, ciphertext: new Uint8Array([1]) }
    const envelopeFromB = { ...base, version: 2, ciphertext: new Uint8Array([2]) }

    const [resultA, resultB] = await Promise.all([
      tabA.saveRecordIfVersionMatches(envelopeFromA, 1),
      tabB.saveRecordIfVersionMatches(envelopeFromB, 1),
    ])

    // Exactly one of the two concurrent writers must win.
    expect([resultA, resultB].filter(Boolean)).toHaveLength(1)

    const final = await tabA.getRecord(vaultId, 'rec-1')
    expect(final?.version).toBe(2)
    // The stored ciphertext must match whichever writer actually won, not
    // some corrupted mix of the two.
    const winningCiphertext = resultA ? envelopeFromA.ciphertext : envelopeFromB.ciphertext
    expect(final?.ciphertext).toEqual(winningCiphertext)
  })
})
