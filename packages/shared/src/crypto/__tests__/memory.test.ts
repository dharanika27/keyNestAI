import { describe, it, expect, beforeAll } from "vitest";
import { wipe } from "../memory.js";
import { generateVaultKey } from "../vaultKey.js";
import { getSodium } from "../sodium.js";

describe("Best-effort key clearing", () => {
  beforeAll(async () => {
    await getSodium();
  });

  it("zeroes the buffer's bytes after wipe() (best effort, documented limitation)", async () => {
    const key = await generateVaultKey();
    expect(key.some((byte) => byte !== 0)).toBe(true); // sanity: key had non-zero bytes

    await wipe(key);

    expect(key.every((byte) => byte === 0)).toBe(true);
  });
});
