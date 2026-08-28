# Review — <initiative title>

- **Slug:** <slug>
- **Written by:** orchestrator, consolidating all applicable read-only reviewers
- **Round:** <1 | 2 | 3>
- **Verdict:** GREEN | issues open | NOT SHIPPABLE

Green means zero open blockers/majors, full quality-gate PASS, no unresolved peer dispute, and every
applicable QA result present. Missing required configuration or evidence is never a fallback or skip.

## Full quality gate

```text
<paste ./quality-gate.sh output, with no QUICK>
```

Every FAIL row is an owner-routed blocker. Inactive platforms alone are N/A.

## Code review

| ID | Finding | File / line | Severity | Owner |
|---|---|---|---|---|
| C1 | <correctness or maintainability issue> | <path:line> | blocker/major/minor | frontend/ios/flutter/backend |

## Browser QA — web only

| ID | Story / AC | Result | Evidence | Severity | Owner |
|---|---|---|---|---|---|
| Q1 | US-1 / Scenario | pass/fail | <observation> | <severity> | frontend |

## API QA — backend only

| ID | Endpoint / AC | Validation/auth scenario | Result | Severity | Owner |
|---|---|---|---|---|---|
| A1 | <method path> | <case> | pass/fail | <severity> | backend |

## Mobile QA — iOS or Flutter only

- **Mobile MCP:** pinned 1.0.2 present | missing → blocker
- **Attached device:** <already booted identifier> | missing → blocker
- **App state:** already running and authenticated | missing → blocker
- **Forbidden lifecycle/orientation action attempted:** no (required)

| ID | Story / AC | Result | Screenshot/accessibility evidence | Severity | Owner |
|---|---|---|---|---|---|
| M1 | US-1 / Scenario | pass/fail | <evidence> | <severity> | ios/flutter |

## Cross-host peer review

- **Leader:** <host>
- **Reviewer:** <host/model/effort/session>
- **Artifact hash:** <branch diff SHA-256>
- **Fallback reason:** <none or exact reason>

| ID | Finding | File / line | Severity | Rebuttal result | Owner |
|---|---|---|---|---|---|
| X1 | <finding> | <path:line> | <severity> | agreed/conceded/revised/unresolved | frontend/ios/flutter/backend |

An unavailable independent and fallback reviewer produces `HUMAN_GATE`; it blocks automated shipping.

## Routed fixes

| Fix | Source | Routed to | Maps to AC | Status |
|---|---|---|---|---|
| <description> | C1/Q1/A1/M1/X1/gate row | frontend/ios/flutter/backend | <scenario> | open/fixed |

## Loop status

Round <n> of 3. Next: re-review | green report | NOT SHIPPABLE.
