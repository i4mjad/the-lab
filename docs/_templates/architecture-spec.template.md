# Architecture Spec — <initiative title>

- **Slug:** <slug>
- **Author:** architect
- **Status:** Draft | In review | Approved | Dispatched
- **Gate hash:** <SHA-256 after approval>
- **Source:** docs/product/<slug>-product-spec.md

> "How." Keep it SIMPLE — the simplest design that satisfies v1 (AGENTS.md §6).

## 1. Technical decisions
| Decision | Choice | Rationale |
|---|---|---|
| <area, e.g. data store> | <choice> | <why> |

## 2. Stack (deviations only)
> Defaults per AGENTS.md §5 are assumed. List only where we deviate, with rationale.
| Default | Deviation | Rationale |
|---|---|---|

## 3. Component map
<Components/services and how they connect. A small diagram or list. Note localization/RTL and the
domain's privacy/security implications (AGENTS.md §4) where they affect the design.>

## 4. Assumptions & escalations
- **Low-risk assumptions (recorded):** <…>
- **Escalated to user (need confirmation):** <decision + what was asked / answer>

## 5. Task index
| Task file | Owner | Serves story / AC |
|---|---|---|
| tasks/01-<title>.md | frontend | US-1 / Scenario … |
| tasks/02-<title>.md | backend | US-1 / Scenario … |

> Every must-have AC must be covered by at least one task.
