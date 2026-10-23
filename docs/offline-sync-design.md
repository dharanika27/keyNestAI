# KeyNest AI — Offline & Synchronization Design

## 1. Offline-first guarantee

After a vault has been created/unlocked once on a device, the following require no network access: unlock, list, search/filter, add, edit, delete, local password generation, secure-note access, viewing last-backup/pending-change status, and queuing sync/backup work. None of these depend on `services/ai`, `services/api`, or Google Drive being reachable.

## 2. Record versioning

Every record carries:
- `record_id` (stable UUID, assigned at creation, never reused).
- `version` (monotonically increasing integer, incremented on every edit).
- `device_id` of the device that produced that version.
- `updated_at` (client clock; not trusted as a sole ordering source — see §4).
- `tombstone: boolean` for deletions (see §5).

This is a **per-record version counter**, not a single last-write-wins timestamp, so a sync pass can detect divergence rather than assume the most recent timestamp is correct (clocks across devices are not trusted for correctness, only for display).

## 3. Pending-change queue

Offline edits append to a local, persisted outbox keyed by `record_id`. The queue is idempotent: replaying an already-applied change (e.g., after a retried upload) is a no-op because the backend compares incoming `version` against its stored `version` for that `record_id` rather than blindly overwriting.

## 4. Conflict detection

A conflict is detected when a device attempts to push a change whose `base_version` (the version it edited from) does not match the backend's current `version` for that record — i.e., another device changed the record first.

- If the two versions' plaintext diverges in a way the client can safely auto-merge (currently: none are treated as auto-mergeable in v1 — field-level merge is a documented future enhancement, not implemented in Phase 1), the client does **not** guess. It surfaces both versions to the user: "This login was changed on two devices — keep version A, keep version B, or keep both as separate entries."
- The system never silently picks "last device to sync wins." This is an explicit requirement (CLAUDE.md §6) and a direct response to the data-loss risk of naive LWW.

## 5. Deletions

Deletes are tombstones (`tombstone: true`, record payload cleared) rather than hard removal from the sync log, so a device that was offline during a deletion still receives and applies it instead of resurrecting the record on its next sync. Tombstones are retained for a documented grace period (aligned with backup retention, `docs/backup-recovery-design.md §4`) before permanent purge, long enough to cover realistic offline durations.

## 6. Interrupted sync

Uploads are chunked per record (not as one large transactional blob), and each record push is idempotent via the version check in §4. An interrupted sync simply resumes from the outbox on next connectivity; partially-applied syncs cannot corrupt the vault because each record's AEAD integrity check independently validates that specific record regardless of how many siblings did or didn't make it through.

## 7. What this design does not yet cover

Sync is specified at the data-model level now so Phase 1's record schema is forward-compatible. The actual network protocol, backend endpoints, and device-enrollment/authorization flow are implemented in Phase 3 (backend) and Phase 6 (sync), per `docs/architecture.md`. Field-level auto-merge beyond "surface both versions" is an explicitly deferred enhancement, not a Phase 1–6 commitment.
