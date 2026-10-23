import { describe, it, expect, beforeAll } from "vitest";
import { getSodium } from "../../crypto/index.js";
import { generatePassword, PasswordGeneratorError } from "../generator.js";

describe("generatePassword", () => {
  beforeAll(async () => {
    await getSodium();
  });

  it("generates a password of exactly the requested length", async () => {
    const password = await generatePassword({ length: 24, includeLowercase: true, includeUppercase: true });
    expect(password).toHaveLength(24);
  });

  it("rejects a length below the minimum", async () => {
    await expect(generatePassword({ length: 4, includeLowercase: true })).rejects.toThrow(PasswordGeneratorError);
  });

  it("rejects a length above the maximum", async () => {
    await expect(generatePassword({ length: 129, includeLowercase: true })).rejects.toThrow(PasswordGeneratorError);
  });

  it("rejects a non-integer length", async () => {
    await expect(generatePassword({ length: 12.5, includeLowercase: true })).rejects.toThrow(PasswordGeneratorError);
  });

  it("rejects when no character class is selected", async () => {
    await expect(generatePassword({ length: 16 })).rejects.toThrow(PasswordGeneratorError);
  });

  it("rejects when the length is too short to fit one of every selected class", async () => {
    await expect(
      generatePassword({
        length: 3,
        includeUppercase: true,
        includeLowercase: true,
        includeDigits: true,
        includeSymbols: true,
      }),
    ).rejects.toThrow(PasswordGeneratorError);
  });

  it("includes at least one character from every selected class, every time", async () => {
    for (let i = 0; i < 15; i++) {
      const password = await generatePassword({
        length: 16,
        includeUppercase: true,
        includeLowercase: true,
        includeDigits: true,
        includeSymbols: true,
      });
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[0-9]/);
      expect(password).toMatch(/[!@#$%^&*()\-_=+[\]{};:,.?]/);
    }
  });

  it("uses only characters from the selected classes", async () => {
    const password = await generatePassword({ length: 32, includeLowercase: true, includeDigits: true });
    expect(password).toMatch(/^[a-z0-9]+$/);
  });

  it("excludes visually ambiguous characters when requested", async () => {
    for (let i = 0; i < 10; i++) {
      const password = await generatePassword({
        length: 40,
        includeUppercase: true,
        includeLowercase: true,
        includeDigits: true,
        excludeAmbiguous: true,
      });
      expect(password).not.toMatch(/[0O1lI|]/);
    }
  });

  it("succeeds at the minimum allowed length with every character class selected and ambiguous characters excluded (the tightest realistic rejection-sampling case — MIN_LENGTH=8 always exceeds the 4-class maximum, so length===classCount can never occur)", async () => {
    for (let i = 0; i < 15; i++) {
      const password = await generatePassword({
        length: 8,
        includeUppercase: true,
        includeLowercase: true,
        includeDigits: true,
        includeSymbols: true,
        excludeAmbiguous: true,
      });
      expect(password).toHaveLength(8);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[0-9]/);
      expect(password).toMatch(/[!@#$%^&*()\-_=+[\]{};:,.?]/);
      expect(password).not.toMatch(/[0O1lI|]/);
    }
  });

  it("does not generate the same password twice in a row", async () => {
    const a = await generatePassword({ length: 20, includeLowercase: true, includeUppercase: true, includeDigits: true });
    const b = await generatePassword({ length: 20, includeLowercase: true, includeUppercase: true, includeDigits: true });
    expect(a).not.toBe(b);
  });
});
