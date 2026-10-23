# KeyNest AI

Offline-first, client-side-encrypted password manager for web, Android, and iOS, with user-authorized Google Drive backup, family vault sharing, biometric unlock, and an optional AI assistant that never sees raw secrets.

See `CLAUDE.md` for the full project mandate, phased implementation plan, and non-negotiable security requirements.

## Status

Phase 0 (design) complete for the areas needed to start implementation. Phase 1 (encrypted local vault — crypto module) is in progress. See `docs/` for current design decisions and open questions, and the latest milestone report in conversation/commit history for exact test results.

## Repository structure

```
keynest-ai/
├── CLAUDE.md                 # Project mandate and phased plan
├── docs/                     # Architecture, threat model, crypto/offline/backup/biometric/family/AI design
├── .claude/agents/           # Development-time review agents
├── .claude/skills/           # Repeatable engineering workflows
├── packages/shared/          # Platform-agnostic crypto, schemas, conflict logic (TypeScript)
├── apps/web/                 # React + TS + Vite web app (created at its Phase 2 milestone)
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

`packages/shared` (crypto module, Phase 1):

```
cd packages/shared
npm install
npm test
```

Setup instructions for `apps/web`, `apps/mobile`, `services/api`, and `services/ai` are added as each is created at its respective milestone.

## Security

Do not open a security report as a public GitHub issue. See `docs/threat-model.md` for the current threat model and `CLAUDE.md §17` for the project's definition of done — this project is not described as production-ready until its release gates and an independent security review are complete.
