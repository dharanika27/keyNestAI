/**
 * Seam for platform-specific protection of locally-held key material (iOS
 * Keychain / Android Keystore gated by biometrics — docs/biometric-unlock-design.md).
 *
 * NOT wired into VaultSession in this milestone — biometric unlock is out
 * of scope for Phase 1. This interface exists now so Phase 4 can implement
 * it against real OS secure storage without changing the vault engine's
 * public API. A conforming implementation's `retrieve()` must be gated by
 * the platform's own authentication prompt; this interface only defines
 * the storage contract, not the authentication mechanism.
 */
export interface KeyProtector {
  store(id: string, keyMaterial: Uint8Array): Promise<void>;
  retrieve(id: string): Promise<Uint8Array | null>;
  remove(id: string): Promise<void>;
}

/**
 * Reference implementation with NO platform protection whatsoever — keys
 * are held in a plain in-memory map. Suitable only for tests and as a
 * placeholder. A real Keychain/Keystore-backed implementation is required
 * before biometric unlock can be enabled for any user.
 */
export class InMemoryKeyProtector implements KeyProtector {
  private readonly entries = new Map<string, Uint8Array>();

  async store(id: string, keyMaterial: Uint8Array): Promise<void> {
    this.entries.set(id, keyMaterial);
  }

  async retrieve(id: string): Promise<Uint8Array | null> {
    return this.entries.get(id) ?? null;
  }

  async remove(id: string): Promise<void> {
    this.entries.delete(id);
  }
}
