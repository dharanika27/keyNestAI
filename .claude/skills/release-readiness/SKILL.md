---
name: release-readiness
description: Verify KeyNest AI release gates — test status, dependency checks, security findings, migrations, backup compatibility, documented limitations. Use before any release or production-readiness claim; never approve with unresolved critical/high findings.
---

1. Confirm current test status for every affected workspace by actually running the suites (see `run-quality-gates`) — do not rely on a prior report's claim.
2. Run dependency vulnerability checks (`npm audit` for TS workspaces; `pip-audit` or equivalent for Python workspaces) and report actual findings.
3. Confirm all `keynest-security-reviewer` findings from the current cycle are resolved or explicitly accepted-with-documentation by the user — unresolved critical/high findings block release, no exceptions.
4. Confirm database migrations (Alembic) are forward-applying cleanly against a test database and that backup format compatibility (`docs/backup-recovery-design.md §3`) holds across the versions being released.
5. Confirm `docs/*.md` reflects the current state of implemented features and that known limitations are stated plainly, not omitted.
6. Report a clear go/no-go with the specific blocking items if no-go. Never describe the product as production-ready without the independent security review required by CLAUDE.md §17.
