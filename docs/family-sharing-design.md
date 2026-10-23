# KeyNest AI — Family Vault Sharing Design

Implemented starting Phase 7, after the individual vault and sync designs are verified. Documented now (per `docs/crypto-design.md §10`) so Phase 1's key/record format needs no breaking change later.

## 1. Principles

- No shared master passwords. Every member authenticates with their own master password/recovery mnemonic and has their own key pair.
- A family vault has its own Vault Key (VK_family), independent of any member's personal vault key.
- The server never receives a plaintext key capable of decrypting VK_family or the family vault's records.

## 2. Key distribution

- Each member has a long-term X25519 key pair; private key wrapped under that member's own Master Key, public key published (non-secret) to the backend.
- Inviting a member to a family vault: the inviter's client encrypts VK_family to the invitee's public key (sealed-box construction) and uploads only that wrapped copy. The invitee's client unwraps it locally using their own MK-protected private key after accepting.
- Membership permissions (e.g., owner, editor, read-only) are enforced both client-side (UI) and backend-side (authorization checks on every family-vault endpoint) — never by hiding UI elements alone.

## 3. Revocation

Removing a member:
1. Generate a new VK_family.
2. Re-wrap the new key for every remaining member's public key.
3. Re-encrypt family-vault records under the new key (background job, resumable, same AEAD/versioning rules as any other record rewrite).
4. Delete the removed member's wrapped-key entry server-side; their authorization to the family vault's sync/backup endpoints is revoked immediately.

**Explicit non-claim:** this prevents the removed member from decrypting *future* family-vault changes. It cannot and does not claim to erase records that member already decrypted, viewed, or copied before removal — disclosed in `docs/threat-model.md §3.7` and surfaced to the user performing the removal ("this removes future access; anything they already saw remains something they saw").

## 4. Device revocation

Independent from member revocation: a member can have a device revoked (e.g., lost phone) without removing them from the family. Revoking a device invalidates that device's session/auth credentials; because the family vault key rotation in §3 is member-scoped, a lost-device event for an otherwise-trusted member triggers the same key-rotation treatment as removing the member, specifically because the device's existing decrypted/cached key material cannot be remotely erased, and rotation is the only way to stop *future* access through that device.

## 5. Concurrent membership changes

Membership changes are versioned the same way vault records are (`docs/offline-sync-design.md §2`): a client proposing a membership change includes the base membership version; a conflicting concurrent change (e.g., two admins acting at once) is detected and surfaced rather than silently applying whichever request the backend happened to process first.

## 6. Audit trail

Every invite, acceptance, permission change, and revocation is written to a sharing audit log (who, what action, when, which vault) — metadata only, no secret content — visible to family vault admins.

## 7. Confirmation requirements

Sending an invite, changing a member's permission level, and any revocation (member or device) require an explicit, distinct confirmation step in the UI — not bundled into a generic "save" action — per CLAUDE.md §9.

## 8. Phase 7 exit gate

Family sharing is not enabled for users until its security and integration tests pass: unauthorized access attempts by non-members, access attempts after revocation, concurrent-membership-change handling, and correct re-encryption after key rotation.
