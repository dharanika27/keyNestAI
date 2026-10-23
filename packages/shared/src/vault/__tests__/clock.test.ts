import { describe, it, expect } from "vitest";
import { SystemClock } from "../clock.js";

describe("SystemClock", () => {
  it("returns a timestamp close to Date.now()", () => {
    const clock = new SystemClock();
    const before = Date.now();
    const value = clock.now();
    const after = Date.now();
    expect(value).toBeGreaterThanOrEqual(before);
    expect(value).toBeLessThanOrEqual(after);
  });
});
