# KeyNest AI — Biometric Unlock Design (Mobile)

## 1. Core requirement

Biometrics authorize **access to locally protected cryptographic key material**, not merely a UI gate. A successful fingerprint/face callback in the app's own code is not sufficient by itself — the key must be inaccessible without that OS-level check passing.

## 2. Mechanism

- **iOS:** Vault Key (post-MK-unwrap) stored in the Keychain with `kSecAttrAccessControl` requiring biometry (`.biometryCurrentSet` or `.userPresence`), accessible only after `LocalAuthentication` succeeds. Keychain item access class restricts availability to when the device is unlocked (`kSecAttrAccessibleWhenUnlockedThisDeviceOnly`), so the key is not extractable via a backup/restore to a different device.
- **Android:** Vault Key stored via Android Keystore with a key that requires user authentication (`setUserAuthenticationRequired(true)`) tied to a `BiometricPrompt` flow (`CryptoObject`), using `StrongBox`/TEE-backed storage where the device provides it.
- Accessed in React Native through maintained bindings (e.g., `expo-secure-store` for the simple wrapped-key case, or a dedicated Keystore/Keychain module where `CryptoObject`-level binding is required) — selected and pinned during Phase 4 implementation, compatibility-checked against the project's Expo SDK version before adoption, per CLAUDE.md §3.

## 3. Enrollment and state-change handling

- **Enrollment:** offered after a successful master-password unlock; requires the OS biometric prompt to succeed before the wrapped key is placed in biometric-gated storage. Master-password unlock remains available at all times as a fallback (§5).
- **Biometric removal/re-enrollment on device (e.g., new fingerprint added):** iOS/Android both invalidate `.biometryCurrentSet`/authentication-bound keys when the enrolled biometric set changes. KeyNest detects the resulting unlock failure and falls back to master-password re-unlock, then re-enrolls biometrics explicitly rather than silently trusting a changed biometric set.
- **Failed biometric attempts:** handled by the OS lockout policy; KeyNest surfaces the OS's own failure/lockout state and offers master-password fallback immediately rather than implementing a separate retry counter that could race with the OS's.
- **Device credential fallback:** where the platform API exposes it (e.g., `BiometryAny` with device passcode fallback), it is enabled only if the user has independently chosen to allow it; a device passcode is not treated as equivalent to the KeyNest master password.

## 4. App backgrounding and inactivity

- Vault auto-locks (clears in-memory MK/VK) on backgrounding beyond a configurable threshold and on explicit lock. Re-entering the foreground past that threshold requires a fresh biometric or master-password unlock, re-deriving/re-unwrapping the key rather than resuming a cached one.

## 5. Master-password fallback (always available)

Biometric unlock is always an alternative *path* to the same Vault Key, never a replacement key or a separate weaker secret. If secure storage is unavailable, corrupted, or the biometric check fails/is unavailable, master-password unlock through the normal Argon2id → MK → unwrap VK path remains available. KeyNest never stores a plaintext master password or an unwrapped Vault Key in ordinary (non-biometric-gated) app preferences as a workaround.

## 6. Secure storage failure

If the Keychain/Keystore entry is missing, corrupted, or the OS reports an unrecoverable secure-storage error, KeyNest treats this as "biometric unlock unavailable" and requires master-password unlock, then offers re-enrollment. It does not attempt to reconstruct or guess key material from a failed secure-storage read.

## 7. Device loss and revocation

Losing a device does not revoke anything on its own — revocation is an explicit account-level action (`docs/family-sharing-design.md`, Phase 6/7 device management) that rotates keys for family/shared vaults. Biometric protection limits what an opportunistic finder of a *locked* device can do; it is not represented as protection against a device the legitimate user's own biometrics can unlock, nor as a substitute for timely revocation.

## 8. Testing requirements (Phase 4)

Enrollment, removal mid-session, failed attempts/lockout, backgrounding past threshold, device-credential fallback (where enabled), secure-storage failure (simulated), and re-enrollment after a biometric change — each verified to require master-password fallback to succeed, not merely that the UI shows an unlock screen.
