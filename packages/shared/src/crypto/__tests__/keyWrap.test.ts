import { describe, it, expect, beforeAll } from "vitest";
import { wrapKey, unwrapKey } from "../keyWrap.js";
import { generateVaultKey } from "../vaultKey.js";
import { CryptoError } from "../errors.js";
import { getSodium } from "../sodium.js";

describe("Key wrapping (Vault Key under Master Key)", () => {
  beforeAll(async () => {
    await getSodium();
  });

  it("wraps and unwraps a vault key, returning the exact original bytes", async () => {
    const vaultKey = await generateVaultKey();
    const masterKey = await generateVaultKey(); // same length/shape as any 32-byte key here

    const wrapped = await wrapKey(vaultKey, masterKey, "vault-key/master");
    const unwrapped = await unwrapKey(wrapped, masterKey, "vault-key/master");

    expect(Buffer.from(unwrapped).toString("hex")).toBe(Buffer.from(vaultKey).toString("hex"));
  });

  it("fails closed when unwrapping with the wrong wrapping key", async () => {
    const vaultKey = await generateVaultKey();
    const masterKey = await generateVaultKey();
    const wrongKey = await generateVaultKey();

    const wrapped = await wrapKey(vaultKey, masterKey, "vault-key/master");

    await expect(unwrapKey(wrapped, wrongKey, "vault-key/master")).rejects.toThrow(CryptoError);
  });

  it("fails closed when the purpose does not match (prevents cross-context reuse)", async () => {
    const vaultKey = await generateVaultKey();
    const masterKey = await generateVaultKey();

    const wrapped = await wrapKey(vaultKey, masterKey, "vault-key/master");

    await expect(unwrapKey(wrapped, masterKey, "vault-key/recovery")).rejects.toThrow(CryptoError);
  });
});
