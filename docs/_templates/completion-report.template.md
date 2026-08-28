# Completion Report — <initiative title>

- **Slug:** <slug>
- **Source spec:** docs/architecture/<slug>/spec.md
- **Design:** docs/design/<slug>/design.md (if UI-bearing)
- **Status:** Web ☐ / iOS ☐ / Flutter ☐ / Backend ☐ complete

> One shared file, **pre-created by the orchestrator before dispatch**. Each build agent edits **only
> its own section** (Web=@frontend, iOS=@ios, Flutter=@flutter, Backend=@backend). Do not touch
> another agent's section. Sections for platforms not in play, or with no tasks this initiative, are
> marked "n/a" by the orchestrator.

## Shared — tasks covered
| Task | Owner | Serves story / AC | Status |
|---|---|---|---|
| 01-… | frontend | US-1 / Scenario … | done |
| 02-… | ios | US-1 / Scenario … | done |
| 03-… | flutter | US-1 / Scenario … | done |
| 04-… | backend | US-1 / Scenario … | done |

---

## Web — owned by @frontend
- **Tasks done:** <ids>
- **What was built:** <summary>
- **AC covered:** <story/scenario → where it's satisfied>
- **Test evidence:** <test results per AC — required>
- **Metrics:** <output of `QUICK=1 ./quality-gate.sh web` — required; missing configuration is FAIL>
- **How to run / preview:** <commands / URL / steps qa-tester will use>
- **Integration notes for backend:** <contracts consumed, expectations>

---

## iOS — owned by @ios
- **Tasks done:** <ids>
- **What was built:** <summary>
- **AC covered:** <story/scenario → where it's satisfied>
- **Test evidence:** <XCTest/XCUITest results per AC — required; qa-tester cannot reach native clients>
- **Metrics:** <output of `QUICK=1 ./quality-gate.sh ios` — required; missing configuration is FAIL>
- **How to run / preview:** <scheme / simulator steps>
- **Integration notes for backend:** <contracts consumed, expectations>

---

## Flutter — owned by @flutter
- **Tasks done:** <ids>
- **What was built:** <summary>
- **AC covered:** <story/scenario → where it's satisfied>
- **Test evidence:** <widget/integration test results per AC — required; qa-tester cannot reach native clients>
- **Metrics:** <output of `QUICK=1 ./quality-gate.sh flutter` — required; missing configuration is FAIL>
- **How to run / preview:** <flavor / device steps>
- **Integration notes for backend:** <contracts consumed, expectations>

---

## Backend — owned by @backend
- **Tasks done:** <ids>
- **Endpoints / contracts:** <method + path + purpose, or schema/rules for BaaS>
- **AC covered:** <story/scenario → endpoint>
- **Test evidence:** <test results per AC — required>
- **Metrics:** <output of `QUICK=1 ./quality-gate.sh backend` — required; missing configuration is FAIL>
- **How to run / test:** <commands / base URL / auth steps api-tester will use>
- **Integration notes for clients:** <request/response shapes, auth>

---

## Integration notes (all)
<Anything spanning clients + backend: shared contracts, env, known gaps.>
