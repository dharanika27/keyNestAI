const STORAGE_KEY = 'keynest:activeVaultId'

/**
 * The "active vault id" is a non-secret identifier — the same class of
 * metadata docs/threat-model.md §3.1 already treats as visible to storage.
 * It only tells the app which vault to attempt to unlock on the next
 * visit; it reveals nothing about vault contents and is never a
 * substitute for the master password.
 */
export function getActiveVaultId(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function setActiveVaultId(vaultId: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, vaultId)
  } catch {
    // Best effort — if localStorage is unavailable (e.g. private-browsing
    // restrictions), the app still functions for the current session; it
    // just won't remember the vault id across a reload.
  }
}

export function clearActiveVaultId(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // best effort, see above
  }
}
