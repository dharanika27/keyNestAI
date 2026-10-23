# KeyNest AI — Backup & Recovery Design

## 1. Backup vs. sync

Backup produces a recoverable, point-in-time, standalone snapshot a user can restore from even if every device and the backend are unavailable. Sync (Phase 6, `docs/offline-sync-design.md`) propagates individual changes between a user's own authorized devices in near-real time. Google Drive backup is never used as a substitute for sync (CLAUDE.md §8) — it is not designed for low-latency, partial, per-record propagation.

## 2. Google integration

- OAuth via Google's standard authorization-code flow, requesting the **`drive.appdata`** scope (the application-specific hidden folder) rather than general Drive access, so KeyNest cannot see or touch the user's other Drive files, and other apps cannot see KeyNest's backups.
- Limitation to disclose to users: because `drive.appdata` is hidden from the normal Drive UI, a user cannot browse or manually manage backup files in Drive's web/app interface; recovery must go through KeyNest itself. Users who want a manually inspectable export are offered a separate, explicit "export encrypted backup file" action (user-managed export) outside the appdata flow.
- OAuth tokens stored in platform-appropriate secure storage (mobile: Keychain/Keystore; web: documented reduced-guarantee storage, never in plaintext `localStorage`).
- KeyNest never requests or stores the user's Google account password. Google authentication authorizes Drive access only — it never unlocks the vault, which requires the master password/recovery mnemonic independently (CLAUDE.md §7).

## 3. Backup file format

Per `docs/crypto-design.md §6`: `format_version || outer_nonce || AEAD(outer_backup_key, { records_ciphertext[], VK_wrapped_by_MK, VK_wrapped_by_RK, argon2_salt, argon2_params_tier, created_at, device_id })`. The outer `backup_key` is itself wrapped by MK and by RK, using the same wrap primitive as VK.

Properties satisfied:
- **Encrypted before upload** — entirely, including metadata beyond what's needed to pick the right backup (timestamp, format version are left visible outside the AEAD only to allow listing/selecting backups without decrypting each one; no content or key material is visible outside it).
- **Versioned** — `format_version` plus a backup sequence number.
- **Integrity-protected** — AEAD tag over the whole envelope; any bit-flip or truncation fails authentication rather than producing corrupted plaintext.
- **Restorable without trusting arbitrary backup metadata** — the restore flow re-derives/re-verifies everything needed (salt, params, version) from the envelope's authenticated contents, not from filename or Drive-provided metadata.
- **Protected against accidental overwrite** — each backup is written as a new, uniquely-named object; the previous backup is not deleted until the new one is confirmed uploaded and its integrity re-verified by a round-trip download-and-decrypt-check (§5).

## 4. Scheduling and retention

User-configurable modes: automatic-when-due, sync-when-online, daily, weekly, manual-only, plus an always-available manual "Back Up Now." Wi-Fi-only is honored where the platform's connectivity APIs expose network type.

Retention (v1 default, documented and user-configurable later): keep the latest 10 backups or 30 days of daily backups, whichever is fewer objects, with at least 1 backup always retained. **The only known-good backup is never deleted before its replacement is uploaded and verified** (§5) — retention pruning runs strictly after a new backup passes verification.

Background execution on mobile is best-effort; the OS may delay or skip scheduled runs. On app open or connectivity return, KeyNest checks for overdue backups and retries. Status shown to the user: last successful backup, next eligible attempt (when determinable), pending local changes not yet backed up, in-progress state, and failure with a human-readable reason. A backup is only ever displayed as "successful" after upload **and** the integrity re-check in §5 both complete — never on upload completion alone.

## 5. Restore and verification

Restore flow: download envelope → verify AEAD tag → verify `format_version` is supported → prompt for master password or recovery mnemonic → unwrap VK → decrypt records → stage into a new local vault state → only replace the live vault after staging succeeds completely. A partially-decryptable or version-mismatched backup aborts before touching existing local data.

Immediately after every new backup upload, KeyNest downloads it back and performs the same verify-and-decrypt check before treating the backup as successful (catches silent upload corruption or quota-related truncation that an upload-success HTTP status alone would miss).

Tested scenarios (Phase 5): truncated file, bit-flipped/corrupted ciphertext, modified AAD/metadata, backup from an unsupported future format version, backup from a known older format version (migration path), restore on a clean install, restore on a second device.

## 6. Recovery limitations (must be disclosed, never promised away)

- **Master password lost, no recovery mnemonic saved:** vault is unrecoverable by design. This is the direct cost of zero-knowledge encryption; KeyNest has no backdoor and will not claim otherwise.
- **Recovery mnemonic lost too:** same outcome — unrecoverable.
- **User deletes Drive app data:** all cloud backups for that account are gone; any device that still holds a synced/local copy remains unaffected, but no further cloud restore is possible until a new backup is taken.
- **OAuth consent revoked:** scheduled/manual cloud backup stops until re-authorized; local vault and local backups/export files are unaffected.
- **Backup temporarily unavailable (network/quota):** local vault operation is unaffected (offline-first); the UI shows pending/failed backup status rather than silently retrying forever without surfacing it.
