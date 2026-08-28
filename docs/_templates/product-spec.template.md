# Product Spec — <initiative title>

- **Slug:** <slug>
- **Author:** product-manager
- **Status:** Draft | Approved
- **Source:** docs/requirements/<slug>-business-requirements.md

> "What," never "how." Every story traces to a business outcome (BO-n).

## 1. Scope — MoSCoW
| Priority | Story IDs | Notes |
|---|---|---|
| Must | US-1, … | v1 |
| Should | … | v1 if time |
| Could | … | deferred candidate |
| Won't (now) | … | explicitly out |

## 2. v1 vs deferred
- **v1:** <story IDs>
- **Deferred:** <story IDs + why>

## 3. Non-goals
- <thing we are explicitly NOT doing in this initiative>

## 4. User stories with acceptance criteria

### US-1 — <short title>
- **Serves outcome:** BO-<n>
- **As a** <role> **I want** <capability> **so that** <value>.
- **Acceptance criteria (Gherkin):**

```gherkin
Scenario: <main path>
  Given <precondition>
  When <action>
  Then <observable result>

Scenario: <edge / failure path>
  Given <precondition>
  When <action>
  Then <observable result>
```

<Repeat per story. Each AC must name its applicable verifier: qa-tester (browser), api-tester
(endpoints), and/or attach-only mobile-qa (iOS/Flutter).>

## 5. Traceability
| Story | Serves outcome | Verified by |
|---|---|---|
| US-1 | BO-1 | qa / api / mobile-qa |
