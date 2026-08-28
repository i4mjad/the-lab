# Gate log — <initiative title>

- **Slug:** <slug>
- **Written by:** orchestrator (`$feature` or `/the-lab:feature`), the only writer
- **Leader host:** Claude Code | Codex
- **What this is:** immutable audit trail for five cross-model artifact gates

> Append one section per round. Never rewrite a closed round. The JSONL companion is the
> machine-readable source for reviewer metadata and schema-valid findings. A rebuttal closes only
> when its `adjudicated-final` event records surviving findings, disputes, replies, and final verdict.

## Gate: <discovery | requirements | product | architecture | design> · round <n>

- **Artifact:** `<path>`
- **Artifact SHA-256:** `<hash>`
- **Reviewer:** `<host>` / `<model>` / `<effort>` / session `<id>`
- **Attempts:** `<preflight/retry/fallback status>`
- **Fallback reason:** `<none or exact error>`
- **Verdict:** APPROVE | NEEDS_ATTENTION | HUMAN_GATE
- **Outcome:** advanced | returned to `<owner>` | escalated to user
- **Summary:** <reviewer summary>

| ID | Severity | Finding | Evidence | Adjudication | Result |
|---|---|---|---|---|---|
| X1 | blocker/major/minor | <title> | <artifact quote/section> | agreed / conceded / revised / unresolved | routed / dropped / human gate |

### Full findings

**X1 — <title>** · <severity>

- **Body:** <verbatim structured finding>
- **Recommendation:** <verbatim structured recommendation>
- **Confidence:** <0–1>

### One rebuttal round

**X1 — <title>**

- **Peer dispute:** <objection with artifact line or path:line>
- **Reviewer reply in session `<id>`:** concede | hold | revise — <reasoning>
- **Result:** dropped | stands at <severity> | unresolved → human gate

## Gate summary

| Gate | Rounds | Artifact hash | Reviewer | Final verdict |
|---|---:|---|---|---|
| discovery | <n> | <hash> | <host/model> | <verdict> |
| requirements | <n> | <hash> | <host/model> | <verdict> |
| product | <n> | <hash> | <host/model> | <verdict> |
| architecture | <n> | <hash> | <host/model> | <verdict> |
| design | <n or n/a> | <hash or n/a> | <host/model or n/a> | <verdict or n/a> |
