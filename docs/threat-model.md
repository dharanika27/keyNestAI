# KeyNest AI — Threat Model

This document is updated whenever a new feature or trust boundary is introduced (see `.claude/skills/threat-model-update`).

## 1. Assets

| Asset | Sensitivity |
|---|---|
| Master password | Critical — never stored or transmitted in any form |
| Vault key (DEK) | Critical — must never exist in plaintext outside device memory |
| Wrapped vault key (any wrap: master/recovery/sharing/backup) | High — ciphertext, safe to store server-side, but reveals a vault exists |
| Recovery key / mnemonic | Critical — equivalent to the master password for recovery purposes |
| Vault records (passwords, notes, TOTP seeds, etc.) | Critical — plaintext must never leave the device |
| Account/device/session identifiers | Medium — needed for authorization, not secret but privacy-sensitive |
| Metadata (titles, categories, timestamps, ciphertext sizes) | Low/Medium — unavoidably visible to backend and Drive; must be documented, minimized |
| OAuth tokens (Google) | High — scoped credential; compromise allows backup tampering, not vault decryption |
| Sharing key pairs (family vaults) | Critical (private key) / Low (public key) |

## 2. Actors

- **Legitimate user** — one or more authorized devices.
- **Family member** — authorized principal with a distinct identity and key pair.
- **Network attacker** — can observe/intercept traffic between client and backend/Google.
- **Malicious or compromised backend** — full read access to everything `services/api` stores.
- **Malicious or compromised AI provider** — full access to whatever is sent to `services/ai`'s model calls.
- **Attacker with transient device access** — unlocked, in-session device (shoulder surfing, grabbed phone).
- **Attacker with persistent device access** — stolen/compromised device, possibly with disk access while locked.
- **Revoked family member / ex-device** — previously authorized, now removed.
- **Malicious Drive content** — a tampered or replayed backup file.

## 3. Threats and mitigations

### 3.1 Backend compromise
- **Threat:** Backend operator or attacker with DB access reads vault contents.
- **Mitigation:** Zero-knowledge design — backend stores ciphertext and wrapped keys only; master key and vault key never transmitted. See `docs/crypto-design.md §5`.
- **Residual risk:** Backend still observes account existence, approximate vault size, access timestamps, IP address, device count. Documented, not eliminated.

### 3.2 Network interception
- **Mitigation:** TLS for all network calls; additionally, payloads are already ciphertext before transmission (defense in depth — TLS compromise alone does not expose vault contents).

### 3.3 Stolen/compromised device (locked)
- **Mitigation:** Vault key wrapped under OS secure storage (Keychain/Keystore) gated by biometric/device credential on mobile; web relies on browser sandboxing and documented reduced guarantees (no OS-level secure enclave in browsers — see `docs/crypto-design.md §7`).
- **Residual risk:** Browser-based key material is only as safe as the browser profile and OS user account; this is disclosed to users, not hidden behind a false security badge.

### 3.4 Stolen/compromised device (unlocked / in-session)
- **Mitigation:** Inactivity auto-lock, explicit lock control, passwords hidden by default, clipboard-clear best effort, no secrets in app-switcher previews where the OS allows suppression.
- **Residual risk:** An attacker with an unlocked device has the same access the user does; this is a session-boundary problem, not solvable by vault cryptography. Documented as a limitation.
- **Residual risk (lock-during-in-flight-operation):** `VaultSession` re-checks lock state (`assertStillUnlocked`) immediately before each secret-touching repository write or before returning decrypted plaintext, so an explicit `lock()` call landing mid-operation stops that operation's effect from completing in the overwhelming majority of cases. For the in-memory reference repository this check-then-act window is effectively closed because the repository's compare-and-swap write (`saveRecordIfVersionMatches`) never yields to the event loop internally. A real transactional backing store (IndexedDB/SQLite, Phase 2/4) must preserve that same atomicity property for this guarantee to hold; this is a requirement on those implementations, not something the vault engine can enforce on their behalf.

### 3.5 Malicious/compromised AI provider
- **Mitigation:** `services/ai` allowlisted tools return only non-secret metadata; policy-check step in the LangGraph workflow rejects any tool result containing fields classified as secret before it reaches the model. See `docs/ai-security-design.md`.
- **Test requirement:** Prompt-injection and exfiltration attempts (Phase 8) must demonstrate no secret ever reaches the model context.

### 3.6 Malicious backup content
- **Threat:** Tampered, truncated, or replayed backup causes data corruption or downgrade to a weaker crypto version.
- **Mitigation:** Backups are authenticated (AEAD), versioned, and restoration re-validates format version and integrity before touching the live vault; a failed/ambiguous restore never silently overwrites existing local data. See `docs/backup-recovery-design.md`.

### 3.7 Revoked family member or device
- **Mitigation:** Revocation rotates the vault key and re-wraps it only for remaining authorized members/devices; revoked principal cannot decrypt future records.
- **Residual risk / explicit non-claim:** A revoked member cannot be made to "forget" secrets already decrypted or copied before revocation. This is documented, not promised otherwise, per CLAUDE.md §8.

### 3.8 Cross-user / cross-vault access via backend API
- **Mitigation:** Every protected backend endpoint enforces authorization scoped to the authenticated account and vault membership; fail closed when authorization cannot be verified. Tested in Phase 3.

### 3.9 Weak master password
- **Mitigation:** Argon2id with tuned parameters raises the cost of offline guessing but cannot fix a guessable password. Client-side strength feedback at vault creation. Documented as a user-dependent residual risk — zero-knowledge design means the server cannot "rescue" a weak-password vault.

### 3.10 Intra-session write conflicts (same vault, concurrent callers)
- **Threat:** Two concurrent calls into the same unlocked `VaultSession` (e.g. `updateRecord` racing a `deleteRecord`, or two concurrent `updateRecord` calls on the same record) could silently resurrect a deleted record or clobber one update with another, since both read a record's state before either has written it back.
- **Mitigation:** `VaultRepository.saveRecordIfVersionMatches` is an atomic compare-and-swap write keyed on the record's version (or on non-existence, for creation). `addRecord`/`updateRecord` use it instead of an unconditional write; a losing writer gets a `RecordConflictError` instead of silently overwriting, per CLAUDE.md §6's "do not assume the last caller to synchronize should always win."
- **Residual risk:** This resolves *detection* of the conflict, not resolution — the losing caller must re-read and decide how to proceed (retry, prompt the user, or abandon the change). No automatic merge is attempted, consistent with the offline-sync design's stance on genuine conflicts (`docs/offline-sync-design.md §4`).

## 4. Non-goals / explicit limitations

- Protecting against a fully compromised, actively-in-session device (malware with OS-level access while unlocked).
- Guaranteeing clipboard clearing on every OS/platform.
- Preventing a revoked principal from retaining previously-disclosed plaintext.
- Treating Google account authentication as equivalent to vault decryption authorization.

## 5. Open questions

- Exact rate-limiting thresholds for auth endpoints (Phase 3, pending FastAPI auth library selection).
- Whether device-loss revocation needs a server-side "kill" signal distinct from key rotation, for faster perceived response even though it cannot erase already-copied data (Phase 6/7).
