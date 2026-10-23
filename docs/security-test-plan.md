# KeyNest AI — Security Test Plan

Maps CLAUDE.md §13 testing requirements to concrete test locations per phase. Updated as each phase lands; this revision covers Phase 1 scope in detail and lists later phases as planned.

## Phase 1 — crypto module & local vault (this milestone)

Location: `packages/shared/src/crypto/__tests__/`

| Test | Verifies |
|---|---|
| Encrypt → decrypt round trip | Correct plaintext recovered for valid key/nonce/AAD |
| Decrypt with wrong Vault Key | Fails closed (throws), no partial plaintext returned |
| Decrypt with wrong master password (KDF→MK mismatch) | Unwrap of VK fails closed |
| Tampered ciphertext (single bit flip) | AEAD authentication fails, decrypt rejected |
| Tampered AAD (record_id swapped) | AEAD authentication fails — proves AAD binding works |
| Nonce uniqueness | Repeated encrypt calls never produce identical nonces (statistical check over N calls) |
| Unsupported `format_version` on decrypt | Fails closed with explicit version error, not silent misparse |
| Argon2id parameter round trip | Stored salt/params reproduce the same MK deterministically |
| Key wrapping/unwrapping (VK under MK) | Wrap→unwrap returns the original VK bytes exactly |
| Key clearing (`memzero`) invoked | Best-effort zeroing call occurs after key use (documented limitation, not a memory-forensics guarantee) |

Run via `npm test` in `packages/shared` (Vitest). Results reported in the Phase 1 completion report with actual pass/fail counts — not asserted without execution.

## Phase 2 — Web application (planned)
Integration tests for vault creation/unlock/CRUD against IndexedDB persistence; accessibility checks on primary screens; offline-mode manual/automated verification (network disabled).

## Phase 3 — Backend (planned)
Cross-user and cross-vault authorization tests (`tests/security/`); rate-limit tests on auth endpoints; input validation/fuzzing on all protected endpoints; verification that no endpoint can return another account's ciphertext or wrapped keys.

## Phase 4 — Mobile (planned)
Biometric enrollment/removal/lockout/fallback per `docs/biometric-unlock-design.md §8`; secure-storage failure simulation; Android/iOS platform-specific key-storage verification.

## Phase 5 — Backup (planned)
Corrupted/truncated/modified/incompatible-version backup handling; clean-install restore; second-device restore; retention-policy enforcement (never deleting the last known-good backup pre-verification).

## Phase 6 — Sync (planned)
Interrupted upload resumption; idempotent retry; concurrent-edit conflict detection (no silent last-write-wins); deletion tombstone propagation to an offline-then-reconnected device.

## Phase 7 — Family sharing (planned)
Unauthorized access by non-members; post-revocation access denial; concurrent membership-change conflict handling; correct re-encryption after key rotation.

## Phase 8 — AI assistant (planned)
Prompt injection; unauthorized tool invocation; cross-user metadata leakage; secret-exfiltration attempts; malformed tool-output handling; verification that disabling `services/ai` does not affect core vault operations.

## Phase 9 — Hardening (planned)
Full suite re-run; dependency vulnerability scan; privacy/data-retention review; documented-limitations review; independent security review before any production-readiness claim (CLAUDE.md §17).

## Engineering rules applied throughout
No test is skipped or disabled to make a build pass without a documented resolution in the relevant phase's completion report. Every fixed bug gets a regression test. All test data is synthetic — no real credentials in any fixture or committed test output.
