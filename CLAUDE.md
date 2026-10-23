# KeyNest AI — Project Instructions for Claude Code

## 1. Project Identity

**Project name:** KeyNest AI  
**Product type:** Offline-first, encrypted password manager with AI-assisted security and organization  
**Target platforms:** Web, Android, and iOS  
**Primary cloud backup:** User-authorized Google Drive account  
**Additional capabilities:** Family vault sharing, biometric unlock, scheduled encrypted backups, optional AI assistant, and cross-device synchronization.

### Mission

Build a practical, secure password manager that allows users to store, organize, access, back up, and restore their login credentials across devices.

The application must work offline for core vault operations. Internet access is required only for cloud-dependent operations such as Google Drive backup, authentication where applicable, and cross-device synchronization.

KeyNest AI must remain useful when all AI services are unavailable.

### Core principles

1. Security before features.
2. Offline-first operation.
3. Client-side encryption of all secret vault content.
4. No plaintext secrets sent to AI services.
5. Explicit authorization for every user, device, vault, and sharing operation.
6. Reliable backup, restore, and synchronization.
7. Incremental implementation with automated verification.
8. Reusable AI-native engineering workflows using Claude Code, custom agents, and custom skills.
9. Honest reporting of completed work, tests, security findings, and limitations.
10. Never claim production readiness without sufficient verification and independent security review.

---

## 2. How Claude Code Must Begin

Before writing application code:

1. Inspect the existing repository, current files, Git status, installed tooling, and existing instructions.
2. Preserve useful existing work. Do not overwrite or delete files without understanding their purpose.
3. Identify the operating system, available runtimes, package managers, and development constraints.
4. Create a short implementation plan with milestones and acceptance criteria.
5. Identify architectural decisions that affect encryption, recovery, key management, offline behavior, and family sharing.
6. Document unresolved security decisions before implementing affected functionality.
7. Create the initial project documentation and repository structure.
8. Begin the first independently testable milestone after documenting the security-critical design decisions.

Do not stop after producing a proposal or a list of future tasks. Continue implementing the next safe, well-defined milestone.

Do not implement cryptographic mechanisms based on guesses. If a critical design decision is unresolved, investigate established approaches, document the options, and request clarification when the choice materially affects security or recovery.

After each milestone, report:
- What was implemented.
- Files created or modified.
- Commands and tests executed.
- Actual test results.
- Known limitations and unresolved security issues.
- The next recommended milestone.

Never claim a feature works unless its implementation and relevant verification support that claim.

---

## 3. Technology Stack

Use the following stack unless repository constraints or a documented technical decision justify a change.

### Web application

- React
- TypeScript
- Vite
- A maintained, accessible component library where appropriate
- Responsive layouts for desktop, tablet, and mobile browsers
- IndexedDB for encrypted local vault data
- Web Crypto API or a vetted cryptographic library where appropriate

### Mobile application

- React Native
- Expo and TypeScript
- Platform-supported secure storage and biometric authentication
- iOS Keychain and Android Keystore integrations through maintained, compatible libraries
- SQLite or another suitable local database for encrypted vault records
- Secure local key management independent of ordinary application preferences

Verify library compatibility with the selected Expo SDK and native build configuration before adopting dependencies.

Do not assume browser storage, AsyncStorage, or ordinary SQLite storage is secure for plaintext secrets.

### Backend

- Python
- FastAPI
- Pydantic
- PostgreSQL
- SQLAlchemy
- Alembic
- pytest
- A maintained authentication and authorization implementation

The backend must store encrypted vault content and enforce account, device, and vault permissions.

The backend must not possess the keys needed to decrypt users' vaults.

### AI layer

- LangChain
- LangGraph
- A provider-independent model integration where practical
- Strictly allowlisted tools
- Explicit input and output validation
- A separate AI service boundary

AI functionality is optional. Core vault operations must never depend on an LLM.

### Development tooling

- Claude Code
- Git
- TypeScript and Python static checks
- Automated unit, integration, and security tests
- Dependency vulnerability checks
- Custom Claude Code agents and skills for repeatable engineering tasks

Use maintained, compatible dependency versions. Pin dependencies appropriately and document upgrades.

---

## 4. Repository Structure

Establish a maintainable monorepo.

    keynest-ai/
    ├── CLAUDE.md
    ├── README.md
    ├── .gitignore
    ├── .claude/
    │   ├── agents/
    │   │   ├── keynest-architect.md
    │   │   ├── keynest-security-reviewer.md
    │   │   ├── keynest-test-engineer.md
    │   │   └── keynest-code-reviewer.md
    │   └── skills/
    │       ├── security-review/
    │       │   └── SKILL.md
    │       ├── run-quality-gates/
    │       │   └── SKILL.md
    │       ├── threat-model-update/
    │       │   └── SKILL.md
    │       └── release-readiness/
    │           └── SKILL.md
    ├── apps/
    │   ├── web/
    │   └── mobile/
    ├── services/
    │   ├── api/
    │   └── ai/
    ├── packages/
    │   └── shared/
    ├── docs/
    │   ├── architecture.md
    │   ├── threat-model.md
    │   ├── crypto-design.md
    │   ├── offline-sync-design.md
    │   ├── backup-recovery-design.md
    │   ├── biometric-unlock-design.md
    │   ├── family-sharing-design.md
    │   ├── ai-security-design.md
    │   └── security-test-plan.md
    └── tests/
        ├── integration/
        ├── security/
        └── fixtures/

Adapt this structure if an existing repository already has a sound organization.

Do not create empty placeholder implementations merely to match the tree. Create each component when its milestone begins.

Keep platform-specific cryptography, storage, and authentication code separate from shared UI and business logic.

Never commit real credentials, production data, encryption keys, OAuth tokens, or populated vault backups.

---

## 5. Security Requirements — Non-Negotiable

Treat KeyNest AI as a security-sensitive application.

### 5.1 Secret data classification

The following are secrets:

- Passwords.
- Master passwords.
- Recovery codes.
- Secure-note contents.
- Authentication tokens.
- Vault encryption keys.
- Key-encryption keys.
- Private keys used for sharing.
- Decrypted backup contents.

Secrets must not appear in:
- AI prompts or model context.
- Embeddings or vector databases.
- Application logs.
- Analytics and telemetry.
- Crash reports.
- URLs or query parameters.
- Error messages.
- Test output or committed fixtures.
- Plaintext persistent storage.
- Backend-readable database fields.
- Cloud backups.

Use synthetic credentials for testing.

### 5.2 Encryption architecture

Design client-side encryption before implementing vault persistence or synchronization.

The design must address:

- Cryptographically secure key generation.
- Password-based key derivation using an appropriate, configurable algorithm such as Argon2id.
- Random vault keys.
- Authenticated encryption using a vetted library and a suitable algorithm such as AES-256-GCM or XChaCha20-Poly1305.
- Unique nonces as required by the selected algorithm.
- Authenticated metadata and ciphertext integrity.
- Key wrapping and versioning.
- Secure key sharing between authorized family members.
- Key rotation and membership revocation.
- Backup encryption and restoration.
- Migration between cryptographic format versions.
- Memory exposure and best-effort key clearing.
- Platform-specific differences.

Use established cryptographic libraries. Never invent an encryption algorithm, weaken cryptographic parameters for convenience, or reuse nonces where prohibited.

Do not assume that encrypting a database file alone constitutes a complete secure-vault design.

Document key derivation, key wrapping, trust boundaries, failure behavior, and recovery limitations in `docs/crypto-design.md`.

### 5.3 Zero-knowledge design

The intended architecture must prevent the backend and Google Drive from decrypting vault contents.

This is a design goal that must be verified, not a label to apply automatically.

Document what the server can still observe, including account identifiers, ciphertext sizes, timestamps, access patterns, and other necessary metadata.

Never send the master password or plaintext vault keys to the backend.

### 5.4 Authentication and authorization

- Use a maintained authentication implementation.
- Enforce authorization on every protected backend operation.
- Separate authentication credentials from vault encryption keys.
- Support secure session expiration and revocation.
- Rate-limit sensitive authentication operations.
- Validate all untrusted input.
- Protect state-changing requests against relevant web security threats.
- Use secure cookie and session practices where applicable.
- Never rely on hiding UI elements as authorization.
- Fail closed when permissions cannot be verified.

Do not build custom authentication or cryptographic protocols unnecessarily.

### 5.5 Biometric unlock

Biometrics must authorize access to locally protected cryptographic key material.

A successful UI-level biometric callback alone is not sufficient.

Design and test:
- Biometric enrollment and removal.
- Device lock and unlock.
- Failed biometric attempts.
- Device credential fallback where supported.
- App backgrounding and inactivity.
- Device loss and revocation.
- Master-password fallback.
- Secure storage failure.
- Re-enrollment after biometric changes.

Use platform-supported security mechanisms. Do not store a plaintext master password or vault key in ordinary preferences.

Biometrics are device-local authorization, not a replacement for vault encryption or recovery design.

### 5.6 Secret display and clipboard

- Hide passwords by default.
- Reveal passwords only after an explicit user action.
- Minimize the duration of plaintext exposure.
- Provide clipboard clearing where supported and appropriate.
- Never claim that clipboard contents can always be securely cleared on every platform.
- Avoid secret-bearing notifications, screenshots, previews, and application-switcher snapshots where platform controls allow.
- Apply inactivity locking and explicit lock controls.
- Do not include secrets in accessibility labels or analytics events.

---

## 6. Offline-First Vault

Core vault operations must work without an internet connection after the vault has been initialized and the necessary local keys are available.

Required offline operations:

- Unlock the local vault using an authorized method.
- List saved accounts.
- Search and filter locally available records.
- Add and edit logins.
- Delete records.
- Generate passwords locally.
- Access authorized local secure notes.
- Queue synchronization and backup work.
- Display the last successful backup and pending changes.

### Local storage rules

Persist encrypted records rather than plaintext secrets.

Keep necessary key material in platform-appropriate secure storage. Where browser limitations prevent equivalent native key protection, document the limitations and choose an appropriate web security design.

Offline operation must not depend on an LLM, a live API call, or a cloud database connection.

### Offline changes

Track pending changes safely.

Use versioned records or another documented conflict-management strategy. Handle updates, deletions, and concurrent changes across devices without silently losing data.

Do not assume that the last device to synchronize should always win.

Resolve conflicting edits safely and clearly. If an automatic merge cannot be trusted, preserve recoverable versions and ask the user to choose.

---

## 7. Google Drive Backup

Google Drive backup is a core product feature.

### Backup behavior

Support the following user-configurable modes:

- Automatic backup when online and due.
- Sync changes when online.
- Daily backup.
- Weekly backup.
- Manual backup only.
- A manual **Back Up Now** action.

Sync and backup are separate operations. Sync propagates changes between authorized devices; backup preserves a recoverable snapshot.

### Google integration

- Use Google's supported OAuth flow.
- Request only the permissions needed for the selected backup design.
- Prefer the app-specific Drive data scope when suitable.
- Explain the limitations of hidden application data and user-managed exports.
- Store OAuth tokens in platform-appropriate secure storage.
- Never treat Google account authentication as vault decryption.
- Do not request or store the user's Google password.
- Do not upload plaintext records or keys needed to decrypt them.
- Handle token expiration, consent revocation, network failures, and quota limits.

### Backup file design

A backup must be:

- Encrypted before upload.
- Versioned.
- Integrity-protected.
- Associated with a documented format version.
- Restorable without trusting arbitrary metadata from the backup.
- Protected against accidental overwrite.
- Tested against truncated, corrupted, modified, and incompatible files.

Use authenticated encryption and an appropriate backup-key design.

A backup must not depend on a key stored only inside the backup itself.

### Scheduling

Respect the user's chosen schedule and network preference.

Support Wi-Fi-only backup where the platform and connectivity APIs allow it.

Background execution is best-effort on mobile. The operating system may delay work because of battery settings, permissions, network availability, or scheduling restrictions.

When the application opens or connectivity returns, check for overdue work and retry safely.

Never display a successful backup status until the upload and necessary integrity checks have actually succeeded.

Display:
- Last successful backup.
- Next eligible scheduled attempt, when determinable.
- Pending changes.
- Backup in progress.
- Backup failure and an understandable reason.
- Restore verification status.

### Retention and restore

Define a configurable, documented retention policy for older backups.

Do not delete the only known-good backup before a replacement is safely stored and verified.

Test restoration on a clean installation and a second device.

Document what happens when a user loses the master password, loses a recovery key, deletes Drive application data, revokes OAuth consent, or has an unavailable backup.

Never promise recoverability if the cryptographic design makes recovery impossible.

---

## 8. Cross-Device Synchronization

Design synchronization for web, Android, and iOS.

Requirements:

- Each device has a recognized identity and authorization.
- Vault content remains encrypted end-to-end.
- Changes are versioned and tracked.
- Retries are idempotent where possible.
- Interrupted uploads do not corrupt the vault.
- Deletions use a safe synchronization strategy.
- Concurrent updates are detected.
- Device revocation prevents future authorized access.
- A new device follows a secure enrollment and key-transfer process.

Do not use Google Drive backup as an undocumented replacement for synchronization.

Google Drive provides backup storage; a separate sync service may be needed for reliable, near-real-time updates between devices.

Do not claim that a revoked device can lose information it has already decrypted or copied.

---

## 9. Family Vaults

Implement family sharing only after the individual encrypted vault and synchronization design are verified.

Required concepts:

- Individual user identities.
- Personal vaults.
- Shared family vaults.
- Invitations and membership management.
- Explicit permissions.
- Secure sharing-key distribution.
- Membership revocation.
- Device revocation.
- Sharing event audit records.
- Safe handling of concurrent membership changes.

Never share a single master password across family members.

Use a documented cryptographic design for sharing keys and vault keys. Define how authorized members receive keys without exposing them to the server.

Define the consequences of removing a family member, including key rotation, offline devices, and previously disclosed secrets.

Require explicit confirmation for sensitive sharing and revocation actions.

Do not enable family sharing until its security and authorization tests pass.

---

## 10. AI Assistant — LangChain and LangGraph

AI is a separate, optional feature.

The AI assistant must never receive:
- Raw passwords.
- Master passwords.
- Secure-note plaintext.
- Recovery codes.
- Vault encryption keys.
- Backup decryption keys.
- Secret-bearing API responses.

Do not build an agent with unrestricted database access or a generic tool that returns entire vault records.

### Permitted capabilities

The assistant may help with:
- Finding accounts using approved, non-secret metadata.
- Organizing accounts into categories.
- Explaining locally computed password-hygiene findings.
- Producing summaries of missing or incomplete metadata.
- Guiding users through backup and recovery instructions.
- Preparing a family-sharing request for user confirmation.

### Recommended LangGraph workflow

1. Classify the user's request.
2. Apply a strict policy check.
3. Select an allowlisted tool.
4. Retrieve only the minimum permitted metadata.
5. Validate the returned fields.
6. Reject disallowed or secret-bearing data.
7. Generate a response.
8. Validate the response before displaying it.
9. Log operational events without recording sensitive content.

Use LangChain for model integration and structured tool definitions. Use LangGraph for explicit workflow state, validation, and controlled transitions.

### Tool permissions

Tools must have narrow, explicit schemas.

For example, a safe account-search tool may accept a category or account label and return a minimal account identifier and label.

It must not return passwords or entire decrypted vault objects.

Perform password strength and reuse checks locally whenever practical. Do not send passwords or password hashes to the AI provider.

Treat account names, website titles, notes, imported data, and all user-controlled content as untrusted input.

Test prompt injection, unauthorized tool use, cross-user leakage, secret exfiltration attempts, and malicious tool outputs.

AI must never override authorization, security checks, or a user's explicit decision.

---

## 11. Claude Code Custom Agents and Skills

Use development-time agents and skills to improve quality without creating an unnecessarily complex runtime agent system.

### Agents

**keynest-architect**
- Reviews architectural consistency.
- Identifies trust-boundary changes.
- Checks compatibility with existing decisions.
- Documents unresolved design risks.

**keynest-security-reviewer**
- Reviews secret storage and data flow.
- Checks cryptographic API usage.
- Inspects authentication and authorization.
- Looks for secrets in logs, prompts, analytics, and backups.
- Reports findings with severity and evidence.
- Must not waive a failing test without a documented resolution.

**keynest-test-engineer**
- Designs unit and integration tests.
- Tests offline operations, sync, backup and restore.
- Tests cross-user access and failure scenarios.
- Uses synthetic test data only.

**keynest-code-reviewer**
- Reviews code quality, error handling, maintainability, and regression risk.
- Checks whether tests cover changed behavior.
- Flags incomplete or misleading implementations.

### Skills

**security-review**
- Inspect changed files and data flows.
- Identify unsafe secret handling.
- Review authorization boundaries.
- Report findings and required remediation.

**run-quality-gates**
- Run applicable formatting, linting, type checking, and tests.
- Report exact commands and outcomes.
- Never silently skip failed checks.

**threat-model-update**
- Update the threat model when a new feature or trust boundary is introduced.
- Identify new assets, attackers, threats, mitigations, and residual risks.

**release-readiness**
- Verify test status, dependency checks, security findings, migrations, backup compatibility, and documented limitations.
- Do not approve a release with unresolved critical or high-severity security findings.

Use supported Claude Code agent and skill formats. Keep each agent's scope and tool permissions as narrow as practical.

Agents are assistants, not security authorities. Human review remains necessary for cryptographic and security-critical decisions.

---

## 12. Implementation Phases

Implement in the following order. Each phase must have acceptance criteria, tests, and a completion report.

### Phase 0 — Repository and design

- Inspect the repository and development environment.
- Create the project documentation.
- Define the threat model and trust boundaries.
- Resolve the initial cryptographic design.
- Define offline, biometric, backup, recovery, and synchronization behavior.
- Record assumptions and open questions.

**Exit criteria:** The architecture and security-critical decisions are documented and ready for implementation.

### Phase 1 — Encrypted local vault

- Implement the cryptographic module.
- Implement vault creation and unlock.
- Add, edit, search, and delete records.
- Implement a local password generator.
- Add inactivity locking and safe clipboard behavior.
- Test encryption, decryption, integrity, and failure handling.

**Exit criteria:** Local vault operations work without network access, and the tests demonstrate that persistent vault records are encrypted.

### Phase 2 — Web application

- Build the React interface.
- Implement account and vault workflows.
- Add responsive layouts.
- Implement secure local persistence.
- Add accessible error states and loading states.
- Test the complete local vault workflow.

**Exit criteria:** The web vault is usable offline within its documented browser security limitations.

### Phase 3 — Backend and account infrastructure

- Build the FastAPI service.
- Implement account authentication and authorization.
- Add database migrations.
- Implement encrypted-record synchronization endpoints.
- Add rate limits and safe error handling.
- Test isolation between users and vaults.

**Exit criteria:** The backend cannot decrypt vault content and enforces authorization for every protected operation.

### Phase 4 — Mobile applications

- Build the React Native application.
- Implement platform-secure key storage.
- Implement biometric authorization.
- Implement offline vault operations.
- Add session and device handling.
- Test Android and iOS behavior.

**Exit criteria:** Core mobile vault operations work offline, and biometric protection is backed by actual protected key access.

### Phase 5 — Google Drive backup

- Implement OAuth authorization.
- Add encrypted backup generation.
- Add manual backup and restore.
- Add backup scheduling preferences.
- Add connectivity-aware retries.
- Add status and error reporting.
- Test corrupted backups and clean-device restore.

**Exit criteria:** A valid encrypted backup can be restored, and failed or pending backups are never reported as successful.

### Phase 6 — Cross-device sync

- Implement device enrollment.
- Add synchronization queues and versioning.
- Handle conflicts and deletions.
- Implement device revocation.
- Test interrupted and repeated synchronization.

**Exit criteria:** Authorized devices can synchronize encrypted records without silently losing conflicting changes.

### Phase 7 — Family sharing

- Implement invitations and memberships.
- Implement personal and shared vaults.
- Implement key distribution and revocation.
- Test unauthorized access and membership changes.

**Exit criteria:** Sharing and revocation pass the documented security and integration tests.

### Phase 8 — AI assistant

- Implement the isolated AI service.
- Add the LangGraph workflow.
- Implement allowlisted metadata tools.
- Add output validation and privacy safeguards.
- Test prompt injection and secret-leakage attempts.

**Exit criteria:** The AI assistant operates without access to secret-bearing fields, and core vault operations continue working when the AI service is disabled.

### Phase 9 — Hardening and release preparation

- Run complete test suites.
- Review dependencies and platform permissions.
- Run security analysis.
- Test backup recovery and device loss scenarios.
- Review privacy disclosures and data retention.
- Document limitations and deployment procedures.
- Arrange independent security review.

**Exit criteria:** No unresolved critical or high-severity security findings remain, all release gates are satisfied, and remaining risks are documented.

---

## 13. Testing and Quality Gates

Every feature must include tests appropriate to its risk.

### Unit tests

Test:
- Encryption and decryption.
- Wrong keys and wrong passwords.
- Ciphertext tampering.
- Nonce handling.
- Record validation.
- Password generation.
- Scheduling decisions.
- Version and migration handling.

### Integration tests

Test:
- Local vault workflows.
- Backend authorization.
- Backup upload and download.
- Backup integrity verification.
- Restoration on a clean installation.
- Offline changes and later synchronization.
- Concurrent updates.
- Family sharing and revocation.

### Security tests

Test:
- Cross-user access.
- Cross-vault access.
- Unauthorized device access.
- Secret leakage in logs and AI requests.
- Prompt injection and unsafe tool calls.
- Malformed and corrupted backups.
- Token expiration and revocation.
- Failed cryptographic operations.
- Insecure local storage.
- Dependency vulnerabilities.

### Engineering rules

- Add regression tests for every fixed bug.
- Never use real credentials in automated tests.
- Never disable a failing security test merely to make a build pass.
- Do not ignore exceptions silently.
- Do not catch and suppress security errors.
- Never claim tests passed if they were not run.
- Report skipped tests and environmental limitations explicitly.
- Keep changes scoped to the current milestone.

---

## 14. UI and Product Experience

Build a clean, modern, accessible application.

Primary screens:

1. Welcome and account setup.
2. Master-password and vault recovery setup.
3. Biometric unlock.
4. Vault dashboard.
5. Account details and password reveal.
6. Add and edit login.
7. Password generator.
8. Backup and synchronization settings.
9. Restore vault.
10. Device management.
11. Family vaults and membership.
12. AI assistant.
13. Security and privacy settings.

Design requirements:

- Responsive web UI.
- Mobile-first layouts for native applications.
- Passwords hidden by default.
- Clear offline, sync, and backup status.
- Accessible controls and keyboard navigation.
- Consistent loading, success, empty, and error states.
- Explicit confirmation for destructive actions.
- No misleading security badges or unsupported security claims.
- No secret values in notifications or screen previews where they can be avoided.

Keep the visual design consistent between web and mobile while respecting platform conventions.

---

## 15. Documentation and Configuration

Maintain:
- README.md with setup and development instructions.
- Architecture and threat-model documentation.
- Cryptographic and recovery design documentation.
- API documentation.
- Local development configuration.
- Database migration instructions.
- Test instructions.
- Google OAuth setup instructions.
- Mobile build instructions.
- Backup and restore documentation.
- Security incident and vulnerability reporting guidance.

Provide an `.env.example` containing placeholders only.

Never include real credentials in the repository.

Keep development, testing, and production configurations separate.

Use safe defaults. If required security configuration is missing, fail clearly rather than falling back to insecure behavior.

---

## 16. Git and Change Management

- Inspect Git status before modifying files.
- Preserve existing user changes.
- Make small, logically grouped changes.
- Avoid destructive commands unless explicitly authorized.
- Never commit secrets or real vault data.
- Do not automatically push, deploy, or publish the application.
- Do not run destructive migrations against a production database.
- Summarize modifications after each milestone.
- Keep generated files and build artifacts under control.

Do not claim a clean worktree if it was not checked.

---

## 17. Definition of Done

A feature is complete only when:

1. Its implementation exists.
2. Its acceptance criteria are satisfied.
3. Relevant automated tests pass.
4. Security implications have been reviewed.
5. Error and failure cases have been considered.
6. Documentation is updated.
7. No unsupported security claims have been added.
8. Known limitations are reported.
9. The implementation works within the documented platform constraints.

A successful build alone does not prove correctness or security.

The final product must not be described as production-ready until the relevant release gates and independent security review are complete.

---

## 18. Immediate Instruction

Read this entire file before making changes.

Inspect the repository and environment. Determine what already exists, identify missing prerequisites, and create a concise phased execution plan.

Start with Phase 0. Establish the project documentation, threat model, cryptographic design, offline model, backup and recovery design, and biometric unlock design.

After documenting the critical design decisions, begin the first safe, testable implementation milestone. Do not attempt to implement every phase in a single change.

Continue incrementally, running relevant tests and reporting actual results. Ask for clarification only when a decision materially affects security, data loss, recovery, user privacy, or another important product requirement.

**Primary objective:** Build KeyNest AI as a reliable offline-first password manager with protected biometric unlock, encrypted Google Drive backup, configurable backup scheduling, cross-device synchronization, secure family sharing, and an optional LangGraph-based AI assistant that never receives raw secrets.

Security, data integrity, and honest verification take precedence over implementation speed.
