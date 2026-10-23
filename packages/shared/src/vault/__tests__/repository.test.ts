import { describe, it, expect } from "vitest";
import { InMemoryVaultRepository } from "../repository.js";

describe("InMemoryVaultRepository", () => {
  it("returns null for metadata and records that were never saved", async () => {
    const repo = new InMemoryVaultRepository();
    expect(await repo.getVaultMetadata("missing-vault")).toBeNull();
    expect(await repo.getRecord("missing-vault", "missing-record")).toBeNull();
    expect(await repo.listRecords("missing-vault")).toEqual([]);
  });

  it("round-trips vault metadata", async () => {
    const repo = new InMemoryVaultRepository();
    const metadata = {
      vaultId: "vault-1",
      formatVersion: 1,
      kdfSalt: new Uint8Array([1, 2, 3]),
      kdfTier: "desktop_moderate" as const,
      wrappedVaultKey: new Uint8Array([4, 5, 6]),
      createdAt: 1000,
    };
    await repo.saveVaultMetadata(metadata);
    expect(await repo.getVaultMetadata("vault-1")).toEqual(metadata);
  });

  it("round-trips, lists, and deletes records scoped per vault", async () => {
    const repo = new InMemoryVaultRepository();
    const envelopeA = {
      id: "rec-1",
      vaultId: "vault-A",
      version: 1,
      createdAt: 1,
      updatedAt: 1,
      ciphertext: new Uint8Array([9, 9, 9]),
    };
    const envelopeB = {
      id: "rec-1",
      vaultId: "vault-B",
      version: 1,
      createdAt: 1,
      updatedAt: 1,
      ciphertext: new Uint8Array([8, 8, 8]),
    };

    await repo.saveRecord(envelopeA);
    await repo.saveRecord(envelopeB);

    expect(await repo.getRecord("vault-A", "rec-1")).toEqual(envelopeA);
    expect(await repo.getRecord("vault-B", "rec-1")).toEqual(envelopeB);
    expect(await repo.listRecords("vault-A")).toEqual([envelopeA]);

    await repo.deleteRecord("vault-A", "rec-1");
    expect(await repo.getRecord("vault-A", "rec-1")).toBeNull();
    expect(await repo.getRecord("vault-B", "rec-1")).toEqual(envelopeB);
  });

  it("saveRecordIfVersionMatches writes only when the expected version matches", async () => {
    const repo = new InMemoryVaultRepository();
    const envelopeV1 = {
      id: "rec-1",
      vaultId: "vault-1",
      version: 1,
      createdAt: 1,
      updatedAt: 1,
      ciphertext: new Uint8Array([1]),
    };

    // Creation semantics: expectedCurrentVersion = null means "must not
    // already exist".
    expect(await repo.saveRecordIfVersionMatches(envelopeV1, null)).toBe(true);
    expect(await repo.getRecord("vault-1", "rec-1")).toEqual(envelopeV1);

    // A second "creation" attempt for the same id is rejected, since the
    // record now exists.
    expect(await repo.saveRecordIfVersionMatches(envelopeV1, null)).toBe(false);

    const envelopeV2 = { ...envelopeV1, version: 2, ciphertext: new Uint8Array([2]) };

    // Update with the wrong expected version is rejected and does not write.
    expect(await repo.saveRecordIfVersionMatches(envelopeV2, 99)).toBe(false);
    expect(await repo.getRecord("vault-1", "rec-1")).toEqual(envelopeV1);

    // Update with the correct expected version succeeds.
    expect(await repo.saveRecordIfVersionMatches(envelopeV2, 1)).toBe(true);
    expect(await repo.getRecord("vault-1", "rec-1")).toEqual(envelopeV2);
  });

  it("saveRecordIfVersionMatches rejects writing over a deleted record using a stale expected version", async () => {
    const repo = new InMemoryVaultRepository();
    const envelopeV1 = {
      id: "rec-1",
      vaultId: "vault-1",
      version: 1,
      createdAt: 1,
      updatedAt: 1,
      ciphertext: new Uint8Array([1]),
    };

    await repo.saveRecordIfVersionMatches(envelopeV1, null);
    await repo.deleteRecord("vault-1", "rec-1");

    const envelopeV2 = { ...envelopeV1, version: 2, ciphertext: new Uint8Array([2]) };
    expect(await repo.saveRecordIfVersionMatches(envelopeV2, 1)).toBe(false);
    expect(await repo.getRecord("vault-1", "rec-1")).toBeNull();
  });
});
