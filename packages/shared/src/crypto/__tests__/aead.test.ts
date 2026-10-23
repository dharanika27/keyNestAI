import { describe, it, expect, beforeAll } from "vitest";
import { encryptBlob, decryptBlob } from "../aead.js";
import { buildAad } from "../aad.js";
import { generateVaultKey } from "../vaultKey.js";
import { CryptoError } from "../errors.js";
import { getSodium } from "../sodium.js";

describe("AEAD blob encryption (XChaCha20-Poly1305)", () => {
  beforeAll(async () => {
    await getSodium();
  });

  it("round-trips plaintext with a valid key and AAD", async () => {
    const key = await generateVaultKey();
    const plaintext = new TextEncoder().encode("synthetic-test-secret-value");
    const aad = buildAad(1, { vaultId: "vault-1", recordId: "rec-1", fieldPurpose: "password" });

    const blob = await encryptBlob(key, plaintext, aad);
    const decrypted = await decryptBlob(key, blob, aad);

    expect(new TextDecoder().decode(decrypted)).toBe("synthetic-test-secret-value");
  });

  it("fails closed when decrypting with the wrong key", async () => {
    const key = await generateVaultKey();
    const wrongKey = await generateVaultKey();
    const plaintext = new TextEncoder().encode("synthetic-test-secret-value");
    const aad = buildAad(1, { vaultId: "vault-1", recordId: "rec-1", fieldPurpose: "password" });

    const blob = await encryptBlob(key, plaintext, aad);

    await expect(decryptBlob(wrongKey, blob, aad)).rejects.toThrow(CryptoError);
  });

  it("fails closed when ciphertext is tampered (single bit flip)", async () => {
    const key = await generateVaultKey();
    const plaintext = new TextEncoder().encode("synthetic-test-secret-value");
    const aad = buildAad(1, { vaultId: "vault-1", recordId: "rec-1", fieldPurpose: "password" });

    const blob = await encryptBlob(key, plaintext, aad);
    const tampered = new Uint8Array(blob);
    tampered[tampered.length - 1] = tampered[tampered.length - 1]! ^ 0x01;

    await expect(decryptBlob(key, tampered, aad)).rejects.toThrow(CryptoError);
  });

  it("fails closed when AAD is tampered (record_id swapped)", async () => {
    const key = await generateVaultKey();
    const plaintext = new TextEncoder().encode("synthetic-test-secret-value");
    const aad = buildAad(1, { vaultId: "vault-1", recordId: "rec-1", fieldPurpose: "password" });
    const wrongAad = buildAad(1, { vaultId: "vault-1", recordId: "rec-2", fieldPurpose: "password" });

    const blob = await encryptBlob(key, plaintext, aad);

    await expect(decryptBlob(key, blob, wrongAad)).rejects.toThrow(CryptoError);
  });

  it("rejects a blob with an unsupported format version", async () => {
    const key = await generateVaultKey();
    const plaintext = new TextEncoder().encode("synthetic-test-secret-value");
    const aad = buildAad(1, { vaultId: "vault-1", recordId: "rec-1", fieldPurpose: "password" });

    const blob = await encryptBlob(key, plaintext, aad);
    const futureVersionBlob = new Uint8Array(blob);
    futureVersionBlob[0] = 255;

    await expect(decryptBlob(key, futureVersionBlob, aad)).rejects.toThrow(
      /unsupported crypto format version/i,
    );
  });

  it("rejects a truncated blob instead of throwing an unrelated error", async () => {
    const key = await generateVaultKey();
    const tooShort = new Uint8Array([1, 2, 3]);
    const aad = buildAad(1, { vaultId: "v", recordId: "r", fieldPurpose: "password" });

    await expect(decryptBlob(key, tooShort, aad)).rejects.toThrow(CryptoError);
  });

  it("never reuses a nonce across repeated encryptions of the same plaintext", async () => {
    const key = await generateVaultKey();
    const plaintext = new TextEncoder().encode("synthetic-test-secret-value");
    const aad = buildAad(1, { vaultId: "vault-1", recordId: "rec-1", fieldPurpose: "password" });

    const nonces = new Set<string>();
    const sampleSize = 200;

    for (let i = 0; i < sampleSize; i++) {
      const blob = await encryptBlob(key, plaintext, aad);
      const nonce = blob.slice(1, 1 + 24);
      nonces.add(Buffer.from(nonce).toString("hex"));
    }

    expect(nonces.size).toBe(sampleSize);
  });
});
