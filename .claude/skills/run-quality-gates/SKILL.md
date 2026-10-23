---
name: run-quality-gates
description: Run formatting, linting, type checking, and tests applicable to the KeyNest AI code just changed, and report exact commands and outcomes. Use before considering any milestone complete.
---

1. Determine which workspace(s) changed (`apps/web`, `apps/mobile`, `services/api`, `services/ai`, `packages/shared`) from the diff.
2. For each affected TypeScript workspace, run (and report the literal command and output): `npm run lint` (if defined), `npm run typecheck` (or `tsc --noEmit`), `npm test`.
3. For each affected Python workspace, run: the project's configured linter/formatter (e.g., `ruff check`), type checker (e.g., `mypy`) if configured, and `pytest`.
4. Report every command actually executed and its actual result (pass/fail, counts). Never state a check passed without running it in this session.
5. If a check fails, do not skip or disable it to force a green result — report the failure and either fix the underlying issue or flag it for the user/`keynest-security-reviewer` if it's security-relevant.
