---
name: security-review
description: Inspect changed files and data flows in KeyNest AI for unsafe secret handling and authorization gaps. Use before merging any change touching crypto, storage, auth, logging, or the AI service boundary.
---

1. List changed files (`git diff --name-only` against the relevant base) and categorize each against CLAUDE.md §5.1's secret-data list and the trust boundaries in `docs/threat-model.md §2`.
2. For each file touching secret data or crypto: confirm it follows `docs/crypto-design.md` (correct primitives, fail-closed behavior, no silent downgrade) and never writes secret values to logs, analytics, error messages, URLs, or AI-service calls.
3. For each file touching backend endpoints: confirm authorization is enforced and fails closed, per `docs/threat-model.md §3.8`.
4. For each file touching `services/ai`: confirm only the allowlisted non-secret metadata in `docs/ai-security-design.md §2/§6` is reachable.
5. Report findings with severity and file/line evidence. Do not approve by omission — an empty findings list must state explicitly what was checked and found clean, not just "looks fine."
