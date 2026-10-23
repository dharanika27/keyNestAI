import { describe, it, expect, beforeAll } from "vitest";
import { getSodium } from "../../crypto/index.js";
import { InMemoryVaultRepository } from "../repository.js";
import { VaultSession } from "../vaultSession.js";
import {
  RecordConflictError,
  RecordIntegrityError,
  RecordNotFoundError,
  VaultLockedError,
  VaultNotFoundError,
  VaultUnlockError,
  VaultValidationError,
} from "../errors.js";
import { FakeClock, InstrumentedClock } from "./testClock.js";
import { RaceInjectingRepository } from "./racingRepository.js";

const SYNTHETIC_PASSWORD = "synthetic-master-password-for-tests";

describe("VaultSession — creation and unlock", () => {
  beforeAll(async () => {
    await getSodium();
  });

  it("creates a vault and allows immediate use while unlocked", async () => {
    const repo = new InMemoryVaultRepository();
    const session = await VaultSession.create(SYNTHETIC_PASSWORD, { repository: repo });

    expect(session.isLocked()).toBe(false);
    expect(await session.listRecords()).toEqual([]);
  });

  it("unlocks a previously created vault with the correct password", async () => {
    const repo = new InMemoryVaultRepository();
    const created = await VaultSession.create(SYNTHETIC_PASSWORD, { repository: repo });
    await created.addRecord({ title: "Synthetic Example", password: "synthetic-login-secret" });

    const reopened = await VaultSession.unlock(created.vaultId, SYNTHETIC_PASSWORD, { repository: repo });
    const records = await reopened.listRecords();

    expect(records).toHaveLength(1);
    expect(records[0]?.title).toBe("Synthetic Example");
    expect(records[0]?.password).toBe("synthetic-login-secret");
  });

  it("fails closed when unlocking with the wrong password", async () => {
    const repo = new InMemoryVaultRepository();
    const created = await VaultSession.create(SYNTHETIC_PASSWORD, { repository: repo });

    await expect(
      VaultSession.unlock(created.vaultId, "definitely-the-wrong-password", { repository: repo }),
    ).rejects.toThrow(VaultUnlockError);
  });

  it("throws VaultNotFoundError when unlocking a vault id that does not exist", async () => {
    const repo = new InMemoryVaultRepository();
    await expect(
      VaultSession.unlock("nonexistent-vault-id", SYNTHETIC_PASSWORD, { repository: repo }),
    ).rejects.toThrow(VaultNotFoundError);
  });

  it("fails closed with the same generic error when the wrapped vault key is corrupted, even with the correct password", async () => {
    const repo = new InMemoryVaultRepository();
    const created = await VaultSession.create(SYNTHETIC_PASSWORD, { repository: repo });

    const metadata = await repo.getVaultMetadata(created.vaultId);
    if (!metadata) throw new Error("test setup failed: metadata missing");
    const tamperedKey = new Uint8Array(metadata.wrappedVaultKey);
    tamperedKey[tamperedKey.length - 1] = tamperedKey[tamperedKey.length - 1]! ^ 0x01;
    await repo.saveVaultMetadata({ ...metadata, wrappedVaultKey: tamperedKey });

    // Same error type as the wrong-password case above — unlock() must not
    // give an attacker (or a buggy caller) a way to distinguish "wrong
    // password" from "corrupted/tampered wrapped key" via the error raised.
    await expect(
      VaultSession.unlock(created.vaultId, SYNTHETIC_PASSWORD, { repository: repo }),
    ).rejects.toThrow(VaultUnlockError);
  });

  it(
    "creates and unlocks a vault using the mobile_constrained KDF tier",
    async () => {
      const repo = new InMemoryVaultRepository();
      const created = await VaultSession.create(SYNTHETIC_PASSWORD, {
        repository: repo,
        kdfTier: "mobile_constrained",
      });
      await created.addRecord({ title: "Synthetic Mobile Tier", password: "synthetic-pw" });

      const reopened = await VaultSession.unlock(created.vaultId, SYNTHETIC_PASSWORD, { repository: repo });
      const records = await reopened.listRecords();

      expect(records).toHaveLength(1);
      expect(records[0]?.title).toBe("Synthetic Mobile Tier");
    },
    30_000, // mobile_constrained trades a higher Argon2id time cost for lower memory use
  );
});

describe("VaultSession — record CRUD", () => {
  it("adds and retrieves a record with matching plaintext fields", async () => {
    const repo = new InMemoryVaultRepository();
    const session = await VaultSession.create(SYNTHETIC_PASSWORD, { repository: repo });

    const added = await session.addRecord({
      title: "Synthetic Bank",
      username: "synthetic-user",
      password: "synthetic-password-123",
      url: "https://example.test",
      notes: "synthetic note",
      category: "finance",
    });

    const fetched = await session.getRecord(added.id);
    expect(fetched).toEqual(added);
    expect(fetched.version).toBe(1);
  });

  it("updates a record, incrementing its version and updatedAt", async () => {
    const repo = new InMemoryVaultRepository();
    const clock = new FakeClock(1000);
    const session = await VaultSession.create(SYNTHETIC_PASSWORD, { repository: repo, clock });

    const added = await session.addRecord({ title: "Synthetic Email", password: "synthetic-pw-1" });
    clock.advanceBy(500);
    const updated = await session.updateRecord(added.id, { password: "synthetic-pw-2" });

    expect(updated.id).toBe(added.id);
    expect(updated.version).toBe(2);
    expect(updated.password).toBe("synthetic-pw-2");
    expect(updated.title).toBe("Synthetic Email");
    expect(updated.updatedAt).toBe(1500);
    expect(updated.createdAt).toBe(added.createdAt);
  });

  it("deletes a record so it can no longer be fetched", async () => {
    const repo = new InMemoryVaultRepository();
    const session = await VaultSession.create(SYNTHETIC_PASSWORD, { repository: repo });

    const added = await session.addRecord({ title: "Synthetic To Delete", password: "synthetic-pw" });
    await session.deleteRecord(added.id);

    await expect(session.getRecord(added.id)).rejects.toThrow(RecordNotFoundError);
  });

  it("lists all records in a vault", async () => {
    const repo = new InMemoryVaultRepository();
    const session = await VaultSession.create(SYNTHETIC_PASSWORD, { repository: repo });

    await session.addRecord({ title: "Synthetic One", password: "pw-1" });
    await session.addRecord({ title: "Synthetic Two", password: "pw-2" });

    const records = await session.listRecords();
    expect(records.map((r) => r.title).sort()).toEqual(["Synthetic One", "Synthetic Two"]);
  });

  it("searches records by title, username, url, and category (case-insensitive)", async () => {
    const repo = new InMemoryVaultRepository();
    const session = await VaultSession.create(SYNTHETIC_PASSWORD, { repository: repo });

    await session.addRecord({ title: "Synthetic Shop", username: "shopper@example.test", password: "pw-1", category: "retail" });
    await session.addRecord({ title: "Synthetic Bank", password: "pw-2", url: "https://bank.example.test" });

    expect((await session.searchRecords("shop")).map((r) => r.title)).toEqual(["Synthetic Shop"]);
    expect((await session.searchRecords("BANK.EXAMPLE")).map((r) => r.title)).toEqual(["Synthetic Bank"]);
    expect((await session.searchRecords("retail")).map((r) => r.title)).toEqual(["Synthetic Shop"]);
  });

  it("rejects adding a record with an empty title", async () => {
    const repo = new InMemoryVaultRepository();
    const session = await VaultSession.create(SYNTHETIC_PASSWORD, { repository: repo });

    await expect(session.addRecord({ title: "   ", password: "pw" })).rejects.toThrow(VaultValidationError);
  });

  it("rejects adding a record with a non-string password", async () => {
    const repo = new InMemoryVaultRepository();
    const session = await VaultSession.create(SYNTHETIC_PASSWORD, { repository: repo });

    await expect(
      // @ts-expect-error intentionally malformed input for the test
      session.addRecord({ title: "Synthetic", password: 12345 }),
    ).rejects.toThrow(VaultValidationError);
  });
});

describe("VaultSession — tampered and unauthorized records", () => {
  it("rejects a record whose ciphertext has been tampered with", async () => {
    const repo = new InMemoryVaultRepository();
    const session = await VaultSession.create(SYNTHETIC_PASSWORD, { repository: repo });
    const added = await session.addRecord({ title: "Synthetic Tamper Target", password: "pw" });

    const stored = await repo.getRecord(session.vaultId, added.id);
    if (!stored) throw new Error("test setup failed: stored record missing");
    const tamperedCiphertext = new Uint8Array(stored.ciphertext);
    tamperedCiphertext[tamperedCiphertext.length - 1] = tamperedCiphertext[tamperedCiphertext.length - 1]! ^ 0x01;
    await repo.saveRecord({ ...stored, ciphertext: tamperedCiphertext });

    await expect(session.getRecord(added.id)).rejects.toThrow(RecordIntegrityError);
    await expect(session.listRecords()).rejects.toThrow(RecordIntegrityError);
  });

  it("rejects a record injected from a different vault even if its vaultId field is rewritten", async () => {
    const repo = new InMemoryVaultRepository();
    const sessionA = await VaultSession.create(SYNTHETIC_PASSWORD, { repository: repo });
    const sessionB = await VaultSession.create(SYNTHETIC_PASSWORD, { repository: repo });

    const recordB = await sessionB.addRecord({ title: "Synthetic Vault B Secret", password: "pw-b" });
    const envelopeB = await repo.getRecord(sessionB.vaultId, recordB.id);
    if (!envelopeB) throw new Error("test setup failed: envelope missing");

    // Attacker (or a storage bug) copies vault B's ciphertext into vault A's
    // record set and relabels it as belonging to vault A.
    const forgedEnvelope = { ...envelopeB, vaultId: sessionA.vaultId };
    await repo.saveRecord(forgedEnvelope);

    await expect(sessionA.getRecord(recordB.id)).rejects.toThrow(RecordIntegrityError);
  });

  it("rejects an unsupported format version byte", async () => {
    const repo = new InMemoryVaultRepository();
    const session = await VaultSession.create(SYNTHETIC_PASSWORD, { repository: repo });
    const added = await session.addRecord({ title: "Synthetic Version Target", password: "pw" });

    const stored = await repo.getRecord(session.vaultId, added.id);
    if (!stored) throw new Error("test setup failed: stored record missing");
    const futureVersionCiphertext = new Uint8Array(stored.ciphertext);
    futureVersionCiphertext[0] = 255;
    await repo.saveRecord({ ...stored, ciphertext: futureVersionCiphertext });

    await expect(session.getRecord(added.id)).rejects.toThrow(RecordIntegrityError);
  });
});

describe("VaultSession — locking", () => {
  it("rejects all secret-reading and secret-modifying operations after an explicit lock", async () => {
    const repo = new InMemoryVaultRepository();
    const session = await VaultSession.create(SYNTHETIC_PASSWORD, { repository: repo });
    const added = await session.addRecord({ title: "Synthetic Pre-Lock", password: "pw" });

    session.lock();
    expect(session.isLocked()).toBe(true);

    await expect(session.listRecords()).rejects.toThrow(VaultLockedError);
    await expect(session.getRecord(added.id)).rejects.toThrow(VaultLockedError);
    await expect(session.addRecord({ title: "Should Fail", password: "pw" })).rejects.toThrow(VaultLockedError);
    await expect(session.updateRecord(added.id, { password: "new-pw" })).rejects.toThrow(VaultLockedError);
    await expect(session.deleteRecord(added.id)).rejects.toThrow(VaultLockedError);
    await expect(session.searchRecords("Synthetic")).rejects.toThrow(VaultLockedError);
  });

  it("auto-locks after the configured inactivity timeout, driven entirely by the injected clock", async () => {
    const repo = new InMemoryVaultRepository();
    const clock = new FakeClock(0);
    const session = await VaultSession.create(SYNTHETIC_PASSWORD, {
      repository: repo,
      clock,
      inactivityTimeoutMs: 1000,
    });

    expect(session.isLocked()).toBe(false);

    clock.advanceBy(999);
    expect(session.isLocked()).toBe(false);
    await session.listRecords(); // activity resets the timer

    clock.advanceBy(999);
    expect(session.isLocked()).toBe(false); // still within timeout since last activity

    clock.advanceBy(1000);
    expect(session.isLocked()).toBe(true);
    await expect(session.listRecords()).rejects.toThrow(VaultLockedError);
  });

  it("checkInactivity() proactively locks without requiring an operation attempt", async () => {
    const repo = new InMemoryVaultRepository();
    const clock = new FakeClock(0);
    const session = await VaultSession.create(SYNTHETIC_PASSWORD, {
      repository: repo,
      clock,
      inactivityTimeoutMs: 500,
    });

    clock.advanceBy(500);
    expect(session.checkInactivity()).toBe(true);
    expect(session.isLocked()).toBe(true);

    // Calling it again once already locked should not report "just locked".
    expect(session.checkInactivity()).toBe(false);
  });

  it("does not lock an active session before its inactivity timeout elapses", async () => {
    const repo = new InMemoryVaultRepository();
    const clock = new FakeClock(0);
    const session = await VaultSession.create(SYNTHETIC_PASSWORD, {
      repository: repo,
      clock,
      inactivityTimeoutMs: 10_000,
    });

    clock.advanceBy(9_999);
    await expect(session.listRecords()).resolves.toEqual([]);
    expect(session.isLocked()).toBe(false);
  });

  it("touch() extends the session on general activity without performing a vault operation", async () => {
    const repo = new InMemoryVaultRepository();
    const clock = new FakeClock(0);
    const session = await VaultSession.create(SYNTHETIC_PASSWORD, {
      repository: repo,
      clock,
      inactivityTimeoutMs: 1000,
    });

    clock.advanceBy(999);
    session.touch(); // resets the timer purely from "activity", no CRUD call
    expect(session.isLocked()).toBe(false);

    clock.advanceBy(999);
    expect(session.isLocked()).toBe(false); // still within the window touch() extended
  });

  it("touch() applies the lock instead of reviving an already-expired session", async () => {
    const repo = new InMemoryVaultRepository();
    const clock = new FakeClock(0);
    const session = await VaultSession.create(SYNTHETIC_PASSWORD, {
      repository: repo,
      clock,
      inactivityTimeoutMs: 500,
    });

    clock.advanceBy(500);
    session.touch();

    expect(session.isLocked()).toBe(true);
    await expect(session.listRecords()).rejects.toThrow(VaultLockedError);
  });

  it("touch() is a no-op once the vault is already locked", async () => {
    const repo = new InMemoryVaultRepository();
    const session = await VaultSession.create(SYNTHETIC_PASSWORD, { repository: repo });

    session.lock();
    session.touch(); // must not unlock or otherwise change state

    expect(session.isLocked()).toBe(true);
    await expect(session.listRecords()).rejects.toThrow(VaultLockedError);
  });

  it("rejects a record write if the vault is locked while the write is still in flight", async () => {
    const repo = new InMemoryVaultRepository();
    const session = await VaultSession.create(SYNTHETIC_PASSWORD, { repository: repo });

    // addRecord() runs synchronously up to its first `await` (inside
    // generateId()) before this line returns, meaning the gate check has
    // already passed by the time we call lock() here — exactly the window
    // the fix for the lock-during-in-flight-operation gap is meant to close.
    const addPromise = session.addRecord({ title: "Synthetic Racing Add", password: "pw" });
    session.lock();

    await expect(addPromise).rejects.toThrow(VaultLockedError);
    expect(await repo.listRecords(session.vaultId)).toEqual([]);
  });

  it("rejects an update if the vault is locked strictly between its own final read and its compare-and-swap write", async () => {
    // updateRecord() internally calls this.getRecord(id) first, which has
    // its own assertStillUnlocked() check — simply firing lock() right
    // after invoking updateRecord() (as in the addRecord/getRecord races
    // above) lands inside that nested call and trips ITS check first,
    // never actually exercising updateRecord's OWN check immediately
    // before its compare-and-swap write. To isolate that specific check,
    // an InstrumentedClock counts its own now() calls from a reset point
    // and fires lock() as a side effect of the LAST such call made during
    // a successful updateRecord() — `const now = this.clock.now()` on the
    // line immediately before the target check is structurally the final
    // clock.now() call on that path. A dry run below (no side effect)
    // determines exactly which call index that is empirically, rather
    // than hardcoding a number tied to an internal implementation detail
    // (how many times assertActive() calls the clock) that could drift.
    const dryRunRepo = new InMemoryVaultRepository();
    const dryRunClock = new InstrumentedClock();
    const dryRunSession = await VaultSession.create(SYNTHETIC_PASSWORD, {
      repository: dryRunRepo,
      clock: dryRunClock,
    });
    const dryRunRecord = await dryRunSession.addRecord({ title: "Synthetic Dry Run", password: "pw" });
    dryRunClock.reset();
    await dryRunSession.updateRecord(dryRunRecord.id, { password: "new-pw" });
    const callsPerSuccessfulUpdate = dryRunClock.callsSinceReset;
    expect(callsPerSuccessfulUpdate).toBeGreaterThan(0); // sanity: the dry run actually used the clock

    const repo = new InMemoryVaultRepository();
    let session!: VaultSession;
    const lockingClock = new InstrumentedClock();
    session = await VaultSession.create(SYNTHETIC_PASSWORD, { repository: repo, clock: lockingClock });
    const added = await session.addRecord({ title: "Synthetic Deep Race", password: "pw" });
    lockingClock.reset();
    lockingClock.triggerAfter(callsPerSuccessfulUpdate, () => session.lock());

    await expect(session.updateRecord(added.id, { password: "new-pw" })).rejects.toThrow(VaultLockedError);
    const stillStored = await repo.getRecord(session.vaultId, added.id);
    expect(stillStored?.version).toBe(1); // the in-flight update never landed
  });

  it("rejects a read if the vault is locked while the read is still in flight", async () => {
    const repo = new InMemoryVaultRepository();
    const session = await VaultSession.create(SYNTHETIC_PASSWORD, { repository: repo });
    const added = await session.addRecord({ title: "Synthetic Read Race", password: "pw" });

    const getPromise = session.getRecord(added.id);
    session.lock();

    await expect(getPromise).rejects.toThrow(VaultLockedError);
  });
});

describe("VaultSession — concurrent write conflicts", () => {
  it("rejects an update whose record was deleted by a concurrent operation between its read and its write", async () => {
    const inner = new InMemoryVaultRepository();

    // Deterministically force the exact interleaving the fix targets —
    // by the time updateRecord() reaches its compare-and-swap write, a
    // concurrent deleteRecord() has already fully completed — instead of
    // relying on incidental microtask ordering between two independently
    // fired async chains of different shapes, which would make the test's
    // outcome depend on implementation timing rather than the invariant
    // being tested.
    let deleteOnce: () => Promise<void> = async () => {};
    const repo = new RaceInjectingRepository(inner, () => deleteOnce());

    const session = await VaultSession.create(SYNTHETIC_PASSWORD, { repository: repo });
    const added = await session.addRecord({ title: "Synthetic Delete Race", password: "pw-1" });
    deleteOnce = () => session.deleteRecord(added.id);

    await expect(session.updateRecord(added.id, { password: "pw-2" })).rejects.toThrow(RecordConflictError);
    expect(await inner.getRecord(session.vaultId, added.id)).toBeNull();
  });

  it("rejects the losing side of two concurrent updates to the same record", async () => {
    const repo = new InMemoryVaultRepository();
    const session = await VaultSession.create(SYNTHETIC_PASSWORD, { repository: repo });
    const added = await session.addRecord({ title: "Synthetic Update Race", password: "pw-1" });

    const updateA = session.updateRecord(added.id, { password: "pw-a" });
    const updateB = session.updateRecord(added.id, { password: "pw-b" });

    const results = await Promise.allSettled([updateA, updateB]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    // Exactly one writer should win; the other must see a conflict rather
    // than silently losing its own change or clobbering the winner's.
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(RecordConflictError);

    const finalRecord = await session.getRecord(added.id);
    expect(finalRecord.version).toBe(2);
    expect(["pw-a", "pw-b"]).toContain(finalRecord.password);
  });
});
