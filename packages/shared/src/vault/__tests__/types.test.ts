import { describe, it, expect } from "vitest";
import { toLogSafeSummary, type VaultRecord } from "../types.js";

describe("toLogSafeSummary", () => {
  it("excludes every secret field (password, notes, username, url) from the projection", () => {
    const record: VaultRecord = {
      id: "rec-1",
      vaultId: "vault-1",
      title: "Synthetic Title",
      username: "synthetic-user",
      password: "synthetic-super-secret-password",
      url: "https://example.test",
      notes: "synthetic secret note",
      category: "finance",
      version: 3,
      createdAt: 1000,
      updatedAt: 2000,
    };

    const summary = toLogSafeSummary(record);

    expect(summary).toEqual({
      id: "rec-1",
      vaultId: "vault-1",
      title: "Synthetic Title",
      category: "finance",
      version: 3,
      updatedAt: 2000,
    });
    expect(summary).not.toHaveProperty("password");
    expect(summary).not.toHaveProperty("notes");
    expect(summary).not.toHaveProperty("username");
    expect(summary).not.toHaveProperty("url");
    expect(summary).not.toHaveProperty("createdAt");
  });

  it("omits the optional category field when the record has none", () => {
    const record: VaultRecord = {
      id: "rec-2",
      vaultId: "vault-1",
      title: "Synthetic No Category",
      password: "synthetic-password",
      version: 1,
      createdAt: 500,
      updatedAt: 500,
    };

    const summary = toLogSafeSummary(record);

    expect(summary.category).toBeUndefined();
    expect(summary).not.toHaveProperty("password");
  });
});
