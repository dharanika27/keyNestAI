# KeyNest AI — Cryptographic Design (v1)

Status: resolved for Phase 1 implementation. Changes to this document require re-review before the affected code changes.

## 1. Library choice

**libsodium**, via `libsodium-wrappers-sumo` (web/Node, WASM) and `react-native-libsodium` (mobile, native bindings to the same libsodium C library). One library, one set of primitives, on both platforms, instead of mixing Web Crypto API (AES-GCM) with a separate mobile-only primitive set.

Note: the standard `libsodium-wrappers` build omits `crypto_pwhash` (Argon2id) to reduce bundle size; the "sumo" build includes the full API and is required here since Argon2id is this project's KDF. The non-sumo package's ESM entry point is also broken for versions `<0.8.0` (it references a sibling file that is not actually published) — pin `^0.8.4` or later for either package.

Rationale:
- Provides both the KDF (`crypto_pwhash`, Argon2id) and the AEAD cipher (`crypto_aead_xchacha20poly1305_ietf`) needed here from a single, widely-audited library, avoiding inconsistent crypto stacks between web and mobile.
- XChaCha20-Poly1305's 192-bit nonce makes random nonce generation safe for the lifetime of a long-lived key (a vault key may encrypt thousands of records over years). AES-256-GCM's 96-bit nonce carries meaningful collision risk under random nonces at that volume and would require a managed nonce counter — additional state to persist correctly and additional failure mode (nonce reuse on counter desync) that XChaCha20 avoids by construction.
- Web Crypto API is retained only where it is the right tool: CSPRNG (`crypto.getRandomValues`, which libsodium's web build also wraps) and any future use of native AES-GCM for interop needs. It is not used for the vault's primary AEAD cipher, for the reasons above.

## 2. Key hierarchy

```
Master Password ──Argon2id──▶ Master Key (MK)              [device-only, never stored, never transmitted]
Recovery Mnemonic (24 words) ──Argon2id──▶ Recovery Key (RK) [device-only, derived only during recovery]

Vault Key (VK) = crypto_secretbox_keygen()  [random, CSPRNG, generated once per vault]

Wrapped forms of VK (all AEAD-encrypted, stored; none reveal VK without the corresponding unwrap key):
  VK_wrapped_by_MK   — normal unlock path
  VK_wrapped_by_RK   — master-password-reset / recovery path
  VK_wrapped_by_Member_i_pubkey  — one per family member, for shared vaults (sealed-box / X25519)
  VK_wrapped_for_backup — included in each backup envelope, wrapped by MK (or RK) the same way; see §6

Each vault record:
  record_plaintext ──AEAD(VK, random 24-byte nonce, AAD)──▶ record_ciphertext
```

Master Key and Vault Key are never derived from, or convertible to, each other in a way that collapses the hierarchy: compromising a wrapped VK without the unwrap key reveals nothing.

## 3. Password-based key derivation

- Algorithm: **Argon2id** (`crypto_pwhash`, `crypto_pwhash_ALG_ARGON2ID13`).
- Parameters (v1 default, stored alongside the salt so they can be upgraded later): `opslimit = crypto_pwhash_OPSLIMIT_MODERATE` (equivalent to libsodium's "moderate" preset, tuned up from "interactive" because vault unlock is infrequent relative to the value of resisting offline guessing), `memlimit = crypto_pwhash_MEMLIMIT_MODERATE`. Mobile devices with constrained RAM get a documented, explicitly-labeled lower memlimit tier rather than silently reusing the desktop tier and risking OOM — the KDF parameter tier used is stored with the wrapped key so correctness does not depend on guessing which tier was used.
- Salt: random 16 bytes (`crypto_pwhash_SALTBYTES`), generated once per vault, stored (non-secret).
- If Argon2id cannot run (e.g., WASM module failed to load), the operation fails closed with an explicit error. There is no silent fallback to a weaker KDF.

## 4. Authenticated encryption

- Algorithm: **XChaCha20-Poly1305-IETF** (`crypto_aead_xchacha20poly1305_ietf_encrypt/decrypt`).
- Nonce: random 24 bytes per encryption operation (`crypto_aead_xchacha20poly1305_ietf_NPUBBYTES`), generated via CSPRNG, never reused by construction, never derived from a counter.
- Associated data (AAD, authenticated but not encrypted): `format_version || vault_id || record_id || field_purpose`. Binding these into the AEAD tag prevents ciphertext from one record/vault/field being swapped into another without detection, even though the backend could otherwise copy ciphertext blobs around.
- Every encrypted blob is stored as `format_version || nonce || ciphertext_with_tag`, so a blob is self-describing for decryption without trusting external metadata.

## 5. Zero-knowledge boundary

The backend (`services/api`) and Google Drive store only: ciphertext, nonces, AAD values (vault/record identifiers, not content), wrapped keys, Argon2id salt and parameter tier, format version, and operational metadata (timestamps, device IDs, account IDs). None of this allows decryption without MK, RK, a member's private key, or VK itself.

What the server/Drive can still observe (documented, not eliminated — see `docs/threat-model.md §3.1`):
- That an account/vault exists and its approximate record count and ciphertext size.
- Timestamps of writes/syncs/backups and the requesting device/IP.
- Family vault membership size (number of wrapped-VK entries).

## 6. Backup encryption

A backup envelope contains: format version, the encrypted vault records (same per-record ciphertext used locally — no re-encryption under a weaker scheme), and the wrapped-VK forms needed to restore (`VK_wrapped_by_MK` using the same Argon2id salt/params, and `VK_wrapped_by_RK`). This satisfies "a backup must not depend on a key stored only inside the backup itself" — restoring still requires the user's master password or recovery mnemonic, exactly as unlocking the live vault does; nothing inside the backup alone can decrypt it.

The whole envelope is additionally wrapped in an outer AEAD layer keyed by a per-backup random key, itself wrapped by MK/RK identically to VK, so envelope-level metadata (which records exist, counts) is not distinguishable from vault internals to anyone without MK/RK — detailed further in `docs/backup-recovery-design.md`.

## 7. Platform differences (documented limitation)

- **Web:** No OS-equivalent secure enclave. MK/VK exist only in JS heap memory for the unlocked session; wrapped keys and ciphertext persist in IndexedDB. This is disclosed to users as a lower key-protection tier than native mobile apps — it is not labeled as hardware-backed security.
- **Mobile:** Wrapped VK (post-MK-unwrap, i.e., the already-usable key) is additionally held in iOS Keychain / Android Keystore, gated by biometric/device-credential prompts per `docs/biometric-unlock-design.md`. This is a real OS-enforced access gate, not merely a UI callback.

## 8. Memory handling (best effort, explicitly limited)

Key buffers are zeroed (`sodium.memzero`) immediately after use where the runtime allows it. This is **best effort**: JavaScript garbage-collected engines do not guarantee the underlying memory is overwritten or that no copy exists elsewhere (e.g., due to string interning, JIT temporaries, or swap). This limitation is disclosed rather than hidden behind a security claim.

## 9. Versioning and migration

Every wrapped key and every encrypted record carries a `format_version` byte. A future crypto change (e.g., new KDF tier, new AEAD) ships as `format_version + 1`; decrypt logic dispatches on the stored version, and re-encryption to a newer version happens as an explicit, user-visible migration step — never a silent, irreversible rewrite without a verified-good re-encryption.

## 10. Family sharing keys (used starting Phase 7, designed now to avoid later rework)

- Each user has a long-term X25519 key pair (`crypto_box_keypair`), public key published to the backend, private key wrapped under that user's own MK (never under anyone else's key, never in plaintext server-side).
- Sharing VK with a family member = sealed-box-style encryption of VK to the member's public key; only that member's MK-protected private key can open it.
- Revocation = generate a new VK, re-wrap for remaining members, re-encrypt affected records in the background; the removed member's existing wrapped-VK entry is deleted server-side. Already-decrypted data on the removed member's device is explicitly out of scope (see threat model §3.7).

## 11. Decisions requiring no further sign-off before Phase 1 coding

All of the above are resolved for Phase 1 (local vault crypto module: KDF, AEAD, key wrapping, record encryption). Family sharing (§10) and backup envelope (§6) are documented now but implemented in their respective later phases; they are written here so Phase 1's record/key format does not need a breaking change when those phases begin.
