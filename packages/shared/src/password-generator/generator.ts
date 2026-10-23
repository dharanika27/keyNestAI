import { getSodium } from "../crypto/index.js";

export class PasswordGeneratorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PasswordGeneratorError";
  }
}

export interface PasswordGeneratorOptions {
  length: number;
  includeUppercase?: boolean;
  includeLowercase?: boolean;
  includeDigits?: boolean;
  includeSymbols?: boolean;
  /** Excludes visually ambiguous characters (0/O, 1/l/I, |) from every
   * selected class. */
  excludeAmbiguous?: boolean;
}

const MIN_LENGTH = 8;
const MAX_LENGTH = 128;
const MAX_REJECTION_ATTEMPTS = 50;

const UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWERCASE = "abcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";
const SYMBOLS = "!@#$%^&*()-_=+[]{};:,.?";
const AMBIGUOUS = new Set(["0", "O", "1", "l", "I", "|"]);

function buildCharsetGroups(options: PasswordGeneratorOptions): string[] {
  const strip = (charset: string): string =>
    options.excludeAmbiguous ? [...charset].filter((c) => !AMBIGUOUS.has(c)).join("") : charset;

  const groups: string[] = [];
  if (options.includeUppercase) groups.push(strip(UPPERCASE));
  if (options.includeLowercase) groups.push(strip(LOWERCASE));
  if (options.includeDigits) groups.push(strip(DIGITS));
  if (options.includeSymbols) groups.push(strip(SYMBOLS));
  return groups.filter((g) => g.length > 0);
}

/**
 * Generates a password using libsodium's CSPRNG (`randombytes_uniform`),
 * which performs unbiased rejection sampling internally, rather than a
 * second RNG path (e.g. `Math.random` or naive `% charset.length`, both of
 * which would be a weaker and inconsistent source alongside the rest of
 * this package's crypto module — docs/crypto-design.md).
 *
 * To guarantee every selected character class actually appears, a full
 * candidate password is generated and re-drawn (not reconstructed
 * character-by-character) if it fails that check — this keeps the output
 * a uniformly random string conditioned on the constraint, rather than a
 * biased construction.
 */
export async function generatePassword(options: PasswordGeneratorOptions): Promise<string> {
  if (!Number.isInteger(options.length) || options.length < MIN_LENGTH || options.length > MAX_LENGTH) {
    throw new PasswordGeneratorError(`Length must be an integer between ${MIN_LENGTH} and ${MAX_LENGTH}.`);
  }

  const groups = buildCharsetGroups(options);
  if (groups.length === 0) {
    throw new PasswordGeneratorError("At least one character class must be selected.");
  }
  if (groups.length > options.length) {
    throw new PasswordGeneratorError("Length is too short to include one character from every selected class.");
  }

  const sodium = await getSodium();
  const fullCharset = groups.join("");

  for (let attempt = 0; attempt < MAX_REJECTION_ATTEMPTS; attempt++) {
    const chars: string[] = [];
    for (let i = 0; i < options.length; i++) {
      const index = sodium.randombytes_uniform(fullCharset.length);
      chars.push(fullCharset[index] as string);
    }
    const candidate = chars.join("");
    if (groups.every((group) => [...candidate].some((c) => group.includes(c)))) {
      return candidate;
    }
  }

  throw new PasswordGeneratorError(
    "Failed to generate a password satisfying all selected character classes after multiple attempts.",
  );
}
