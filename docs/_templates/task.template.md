---
task: NN-<title>
owner: frontend | ios | flutter | backend
slug: <slug>
serves: US-<n> / Scenario <name>   # the story + AC this task satisfies
status: todo | in-progress | done
---

# Task NN — <title>

## Goal
<One sentence: what this task delivers.>

## Acceptance criteria it satisfies
> Copied/linked from the product spec so the spine is explicit.
```gherkin
Scenario: <name>
  Given …
  When …
  Then …
```

## Scope
- In: <what to build>
- Out: <what NOT to build here — keep it SIMPLE>

## Notes
<Contracts, data shapes, RTL/i18n, security/privacy (per AGENTS.md §4), dependencies on the other owner.>

## Definition of done
- [ ] The AC above is satisfiable in the running app
- [ ] No scope creep / no unnecessary complexity
- [ ] Reported in the owner's section of the completion report
