# KeyNest AI — AI Assistant Security Design

Implemented in Phase 8. Documented now to keep the boundary explicit as earlier phases are built.

## 1. Boundary

`services/ai` is a separate deployable service from `services/api` (`docs/architecture.md §1`). It never holds vault decryption keys and never receives a raw secret field. Core vault operations (unlock, CRUD, generate, backup, sync) have zero runtime dependency on this service or on any LLM provider being reachable.

## 2. Data the assistant may receive

Non-secret metadata only: account labels/titles, website/domain, user-assigned categories, locally-computed password-hygiene flags (e.g., "reused," "weak," "old" — booleans/enums computed entirely client-side, never the password or its hash), and counts/summaries derived from the above.

## 3. Data the assistant must never receive

Passwords, master password, secure-note plaintext, recovery codes/mnemonic, vault keys in any form (wrapped or unwrapped), backup decryption material, and any API response that has not passed the output-validation step in §5.

## 4. LangGraph workflow

```
1. Classify request            (what is the user asking for?)
2. Policy check                (is this an allowed capability? §6)
3. Select allowlisted tool     (narrow schema, see §7)
4. Retrieve minimum metadata   (tool enforces field allowlist server-side, not just by convention)
5. Validate returned fields    (reject anything outside the tool's declared non-secret schema)
6. Reject disallowed/secret-bearing data (hard fail, not a warning, if a secret field is ever present)
7. Generate response           (model sees only validated, minimal context)
8. Validate response            (output scanned for anything resembling a credential/secret pattern before display)
9. Log operational event        (classification, tool used, success/failure — never field content)
```

LangChain provides model integration and tool-calling structure; LangGraph provides the explicit state machine above so each transition (especially steps 2, 5, 6, 8) is a separate, testable, enforced gate rather than implicit prompt behavior.

## 5. Output validation

Before any model-generated text reaches the user, it is scanned against the same secret-classification list as input (CLAUDE.md §5.1 patterns) and against the categories of data excluded in §3. A match blocks display and logs a policy-violation event rather than silently stripping and showing the rest — a tool or model that produced a secret-shaped output indicates a bug/attack worth surfacing, not something to paper over.

## 6. Permitted capabilities (allowlist, closed by default)

Finding accounts by non-secret metadata; organizing accounts into categories; explaining locally-computed hygiene findings; summarizing missing/incomplete metadata; guiding backup/recovery steps; drafting a family-sharing request for explicit user confirmation (the assistant prepares the request, it never executes the share itself — confirmation and execution stay in the normal UI flow per CLAUDE.md §9).

No capability outside this list is added without updating this document and the corresponding tool allowlist together.

## 7. Tool schema constraints

Every tool exposed to the model has a narrow, explicit input/output schema reviewed for secret leakage, e.g.: `search_accounts(category?: string, label_query?: string) -> { account_id: string, label: string }[]`. No tool accepts a free-form query that could be used to request a secret field name, and no tool's return type includes a password, note body, or key field — enforced by the backend tool implementation's own response shape, not only by prompt instructions to the model.

## 8. Testing requirements (Phase 8)

Prompt injection (malicious account titles/notes attempting to instruct the model to exfiltrate data or call unauthorized tools), unauthorized tool invocation attempts, cross-user data leakage (one user's assistant session returning another user's metadata), secret-exfiltration attempts via crafted requests, and malicious/malformed tool outputs. The assistant must never be able to override an authorization check or a user's explicit decision (e.g., it cannot itself revoke a device or complete a share — only a human-confirmed UI action can).
