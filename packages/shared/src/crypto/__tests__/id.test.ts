import { describe, it, expect, beforeAll } from "vitest";
import { generateId } from "../id.js";
import { getSodium } from "../sodium.js";

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("generateId", () => {
  beforeAll(async () => {
    await getSodium();
  });

  it("produces a valid, version-4 UUID string", async () => {
    const id = await generateId();
    expect(id).toMatch(UUID_V4_PATTERN);
  });

  it("produces unique ids across repeated calls", async () => {
    const ids = await Promise.all(Array.from({ length: 50 }, () => generateId()));
    expect(new Set(ids).size).toBe(50);
  });
});
