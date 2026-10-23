# KeyNest AI — Architecture Overview

## 1. System components

- **apps/web** — React + TypeScript + Vite single-page app. Encrypted vault stored in IndexedDB. Runs fully offline after first load.
- **apps/mobile** — React Native + Expo (TypeScript). Encrypted vault stored in SQLite; key material in iOS Keychain / Android Keystore.
- **services/api** — FastAPI backend. Stores only ciphertext, wrapped keys, and metadata needed for sync/auth. Never holds a key capable of decrypting vault content.
- **services/ai** — Isolated FastAPI + LangChain/LangGraph service. Receives only non-secret metadata (account labels, categories, locally computed hygiene flags). Optional; core vault features function with this service disabled or unreachable.
- **packages/shared** — Platform-agnostic TypeScript: cryptographic primitives, record schemas, conflict-resolution logic, validation. Consumed by both apps/web and apps/mobile.
- **Google Drive** — User-authorized backup storage (`drive.appdata` scope preferred). Holds only encrypted, versioned backup blobs.

## 2. Trust boundaries

1. **Device boundary** — master password, derived keys, and decrypted records exist only in device memory (and, on mobile, in OS-protected secure storage for wrapped keys). Nothing in this boundary crosses to the backend in plaintext.
2. **Backend boundary** — `services/api` is trusted for availability, authorization, and ciphertext integrity bookkeeping, never for confidentiality of vault contents. It is assumed to be queryable by an attacker who compromises it; the design must survive full backend compromise without exposing vault plaintext.
3. **AI service boundary** — `services/ai` is a distinct trust boundary from `services/api`. It receives a strict allowlisted subset of metadata, never secrets. A compromised or malicious AI provider must not be able to obtain passwords, notes, or keys.
4. **Cloud backup boundary** — Google Drive is an untrusted storage provider from a confidentiality standpoint (encrypted blobs only) but a trusted-for-availability channel the user explicitly authorizes via OAuth.
5. **Family sharing boundary** — each family member is a separate trust principal. Sharing must not require disclosing a personal master password or create a single shared secret that collapses per-user trust boundaries.

## 3. Data flow (high level)

```
User → Master Password → Argon2id → Master Key (device-only)
                                      │
                                      ▼
                         unwraps Vault Key (random DEK)
                                      │
                   ┌──────────────────┼───────────────────┐
                   ▼                                       ▼
        Encrypt/decrypt vault records              Wrap Vault Key for:
        (AEAD, local storage)                       - Recovery Key
                                                      - Each family member's public key
                                                      - Backup envelope
                                      │
                                      ▼
            Ciphertext + wrapped keys + metadata → services/api (sync)
            Encrypted backup envelope            → Google Drive (appdata)
```

No arrow in this diagram carries plaintext secrets across a trust boundary.

## 4. Why this structure

- `packages/shared` centralizes the highest-risk code (crypto, record schemas, conflict resolution) so web and mobile cannot drift into inconsistent, independently-reviewed implementations.
- `services/ai` is physically separate from `services/api` so a bug or prompt-injection in the AI layer cannot escalate into direct vault/database access; it only ever talks to the backend through the same allowlisted, non-secret metadata tools exposed to the assistant.
- Backup (Google Drive) and sync (future `services/api` sync queues, Phase 6) are kept conceptually and operationally separate — see `docs/offline-sync-design.md` and `docs/backup-recovery-design.md`.

## 5. Open architectural questions (tracked, not blocking Phase 1)

- Final choice of sync transport/protocol for Phase 6 (REST polling vs. WebSocket) — deferred until Phase 3 backend contracts exist.
- Whether `services/ai` runs as a separate deployable service from day one or as an isolated module within the same deployment initially — deferred until Phase 8; does not affect client-side crypto or offline design.
