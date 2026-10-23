---
name: threat-model-update
description: Update docs/threat-model.md when a KeyNest AI change introduces a new feature, trust boundary, asset, or external integration. Use before or alongside implementing such a change, not after the fact.
---

1. Identify what's new: a new asset (data worth protecting), a new actor/attacker capability, a new trust boundary (new service, new external integration, new storage location), or a change to an existing boundary's guarantees.
2. Add or update the relevant section of `docs/threat-model.md`: asset table entry if needed, actor if new, and a threat/mitigation/residual-risk entry following the existing format in that file.
3. Cross-check against `docs/architecture.md §2` (trust boundaries) and update it too if the boundary list itself changed.
4. Flag in your report any residual risk that is new and not yet mitigated, so it can be tracked rather than silently accepted.
5. Do not remove an existing documented limitation or risk unless the change actually eliminates it — explain why if you do.
