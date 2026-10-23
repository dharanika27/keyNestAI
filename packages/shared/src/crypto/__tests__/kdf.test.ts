import { describe, it, expect, beforeAll } from "vitest";
import { generateSalt, deriveKeyFromPassword } from "../kdf.js";
import { CryptoError } from "../errors.js";
import { getSodium } from "../sodium.js";

describe("Argon2id key derivation", () => {
  beforeAll(async () => {
    await getSodium();
  });

  it("derives the same key from the same password, salt, and tier", async () => {
    const salt = await generateSalt();
    const a = await deriveKeyFromPassword("correct-horse-battery-staple-synthetic", salt, "desktop_moderate");
    const b = await deriveKeyFromPassword("correct-horse-battery-staple-synthetic", salt, "desktop_moderate");

    expect(Buffer.from(a.key).toString("hex")).toBe(Buffer.from(b.key).toString("hex"));
  });

  it("derives a different key for a different password (same salt)", async () => {
    const salt = await generateSalt();
    const a = await deriveKeyFromPassword("synthetic-password-one", salt, "desktop_moderate");
    const b = await deriveKeyFromPassword("synthetic-password-two", salt, "desktop_moderate");

    expect(Buffer.from(a.key).toString("hex")).not.toBe(Buffer.from(b.key).toString("hex"));
  });

  it("derives a different key for a different salt (same password)", async () => {
    const saltA = await generateSalt();
    const saltB = await generateSalt();
    const a = await deriveKeyFromPassword("synthetic-password-shared", saltA, "desktop_moderate");
    const b = await deriveKeyFromPassword("synthetic-password-shared", saltB, "desktop_moderate");

    expect(Buffer.from(a.key).toString("hex")).not.toBe(Buffer.from(b.key).toString("hex"));
  });

  it("rejects an empty password", async () => {
    const salt = await generateSalt();
    await expect(deriveKeyFromPassword("", salt, "desktop_moderate")).rejects.toThrow(CryptoError);
  });

  it("rejects an invalid salt length", async () => {
    const badSalt = new Uint8Array(4);
    await expect(
      deriveKeyFromPassword("synthetic-password", badSalt, "desktop_moderate"),
    ).rejects.toThrow(CryptoError);
  });

  it("generates non-deterministic salts", async () => {
    const saltA = await generateSalt();
    const saltB = await generateSalt();
    expect(Buffer.from(saltA).toString("hex")).not.toBe(Buffer.from(saltB).toString("hex"));
  });
}, 30_000);
