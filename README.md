# KeyNest AI

Offline-first, client-side-encrypted password manager for web, Android, and iOS, with user-authorized Google Drive backup, family vault sharing, biometric unlock, and an optional AI assistant that never sees raw secrets.

See `CLAUDE.md` for the full project mandate, phased implementation plan, and non-negotiable security requirements.

## Status

Phase 0 (design) and Phase 1 (encrypted local vault engine — crypto module, vault session, CRUD, password generator, inactivity locking, in `packages/shared`) are complete. Phase 2 (web application, `apps/web`) delivers a working offline vault UI: create/unlock, add/edit/delete/search logins, password generator, reveal/copy with best-effort clipboard clearing, inactivity + explicit locking, and an IndexedDB-backed persistence layer with the same atomic compare-and-swap concurrency guarantees as the in-memory reference repository — verified via a real (not mocked) IndexedDB engine across two independent connections, simulating multi-tab use. Recovery-key setup, biometric unlock, backup, sync, family sharing, and the AI assistant are not yet implemented (later phases). See `docs/` for current design decisions and open questions, and the latest milestone report in conversation/commit history for exact test results.

## Repository structure

```
keynest-ai/
├── CLAUDE.md                 # Project mandate and phased plan
├── docs/                     # Architecture, threat model, crypto/offline/backup/biometric/family/AI design
├── .claude/agents/           # Development-time review agents
├── .claude/skills/           # Repeatable engineering workflows
├── packages/shared/          # Platform-agnostic crypto, schemas, conflict logic (TypeScript)
├── apps/web/                 # React + TS + Vite web app (Phase 2 — implemented)
├── apps/mobile/              # React Native + Expo app (created at its Phase 4 milestone)
├── services/api/             # FastAPI backend (created at its Phase 3 milestone)
├── services/ai/              # LangChain/LangGraph AI service (created at its Phase 8 milestone)
└── tests/                    # Integration, security, and fixture tests spanning workspaces
```

Components are created when their implementation milestone begins, not as empty placeholders ahead of time.

## Key design documents

- `docs/architecture.md` — components, trust boundaries, data flow
- `docs/threat-model.md` — assets, actors, threats, mitigations, residual risks
- `docs/crypto-design.md` — key hierarchy, KDF/AEAD choice and rationale, zero-knowledge boundary
- `docs/offline-sync-design.md` — offline guarantees, versioning, conflict handling
- `docs/backup-recovery-design.md` — Google Drive backup format, scheduling, retention, restore
- `docs/biometric-unlock-design.md` — platform-backed key-gating design, fallback behavior
- `docs/family-sharing-design.md` — sharing-key distribution and revocation design
- `docs/ai-security-design.md` — AI service boundary and allowlisted tools
- `docs/security-test-plan.md` — test matrix mapped to phases

## Development setup

Prerequisites verified in this environment: Node v24.21.0 / npm 12.2.0, Python 3.13.5, Git 2.54.0, Docker 29.5.3.

This is an npm workspaces monorepo. Install once from the repo root:

```
npm install
```

`packages/shared` (crypto module + vault engine, Phase 1):

```
npm test --workspace packages/shared
npm run typecheck --workspace packages/shared
```

`apps/web` (web vault, Phase 2):

```
npm run dev --workspace apps/web        # local dev server
npm test --workspace apps/web           # Vitest + jsdom, real IndexedDB engine
npm run typecheck --workspace apps/web
npm run build --workspace apps/web
```

Setup instructions for `apps/mobile`, `services/api`, and `services/ai` are added as each is created at its respective milestone.

## Security

Do not open a security report as a public GitHub issue. See `docs/threat-model.md` for the current threat model and `CLAUDE.md §17` for the project's definition of done — this project is not described as production-ready until its release gates and an independent security review are complete.
