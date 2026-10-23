/**
 * Caller-supplied fields for a login record. `password` and `notes` are
 * secret — never log, persist in plaintext, or send to the AI service
 * (docs/ai-security-design.md §3).
 */
export interface VaultRecordInput {
  title: string;
  username?: string | undefined;
  password: string;
  url?: string | undefined;
  notes?: string | undefined;
  category?: string | undefined;
}

export interface VaultRecord extends VaultRecordInput {
  id: string;
  vaultId: string;
  version: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Non-secret projection of a VaultRecord, safe for logs, analytics, or the
 * future AI assistant's allowlisted metadata tools. Callers must use this
 * (never the full VaultRecord) anywhere a record needs to be logged or
 * displayed outside the unlocked vault UI itself.
 */
export interface VaultRecordLogSafeSummary {
  id: string;
  vaultId: string;
  title: string;
  category?: string | undefined;
  version: number;
  updatedAt: number;
}

export function toLogSafeSummary(record: VaultRecord): VaultRecordLogSafeSummary {
  return {
    id: record.id,
    vaultId: record.vaultId,
    title: record.title,
    category: record.category,
    version: record.version,
    updatedAt: record.updatedAt,
  };
}
