import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { evaluatePipeline } from "../scripts/pipeline-policy.mjs";

const root = resolve(import.meta.dirname, "..");

test("feature workflow covers terminal and conditional pipeline scenarios", async () => {
  const skill = await readFile(resolve(root, "skills/feature/SKILL.md"), "utf8");
  for (const evidence of [
    "On `KILL`, stop before any automated review",
    "Otherwise record design as N/A",
    "Maximum three author/review rounds",
    "Read active platforms from `AGENTS.md` §5",
    "already-running",
    "authenticated session blocks mobile shipping",
    "Stop after three build/review rounds",
    "Discovery is not repeated per phase"
  ]) assert.ok(skill.includes(evidence), `missing scenario: ${evidence}`);

  assert.match(skill, /both reviewer routes\s+failing become a human gate/);
  for (const stage of ["discovery", "requirements", "product", "architecture", "design"]) {
    assert.ok(skill.includes(stage), `missing stage ${stage}`);
  }
  assert.match(skill, /Claude leader → Codex `gpt-5\.6-sol`\/`xhigh`/);
  assert.match(skill, /Codex leader → Claude Opus\/`xhigh`/);
});

test("pipeline policy executes terminal, conditional, routing, and limit scenarios", () => {
  assert.equal(evaluatePipeline({ discoveryVerdict: "KILL", activePlatforms: ["web"] }).state, "STOP");

  const nonUi = evaluatePipeline({ discoveryVerdict: "GO", ui: false, phases: 2,
    activePlatforms: ["web", "backend"] });
  assert.equal(nonUi.state, "READY");
  assert.equal(nonUi.phases, 2);
  assert.deepEqual(nonUi.gates, ["discovery", "requirements", "product", "architecture"]);
  assert.deepEqual(nonUi.builders, ["frontend", "backend"]);
  assert.deepEqual(nonUi.verifiers, ["code-reviewer", "peer-reviewer", "qa-tester", "api-tester"]);

  assert.equal(evaluatePipeline({ discoveryVerdict: "PIVOT", ui: true, activePlatforms: ["web"] }).gates.at(-1), "design");
  assert.equal(evaluatePipeline({ discoveryVerdict: "GO", activePlatforms: ["web"], artifactRound: 3,
    artifactNeedsAttention: true }).state, "HUMAN_GATE");
  assert.equal(evaluatePipeline({ discoveryVerdict: "GO", activePlatforms: ["web"], buildRound: 3,
    openBlockingFindings: 1 }).state, "NOT_SHIPPABLE");
  assert.equal(evaluatePipeline({ discoveryVerdict: "GO", activePlatforms: ["web"],
    reviewers: { independent: false, fallback: false } }).state, "HUMAN_GATE");
  assert.equal(evaluatePipeline({ discoveryVerdict: "GO", activePlatforms: ["ios"],
    mobile: { mcp: true, device: true, app: true, authenticated: false } }).state, "BLOCKED");
  assert.equal(evaluatePipeline({ discoveryVerdict: "GO", activePlatforms: ["flutter"],
    mobile: { mcp: true, device: true, app: true, authenticated: true } }).state, "READY");
});

test("bootstrap dry run is pinned and includes mandatory core", () => {
  const result = spawnSync("bash", ["scripts/bootstrap.sh", "web", "--host", "both", "--dry-run"], {
    cwd: root,
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr);
  for (const dependency of ["i-have-adhd", "grilling", "architecture-designer", "tdd", "code-review", "api-testing", "accessibility"]) {
    assert.match(result.stdout, new RegExp(`==> ${dependency.replaceAll("-", "\\-")} \\(`));
  }
  assert.match(result.stdout, /create Claude always-on marker and merge the managed Codex rules block/);
  assert.doesNotMatch(result.stdout, /==> mobile-mcp/);
  assert.doesNotMatch(result.stdout, /==> tailwind-design-system/);
  assert.doesNotMatch(result.stdout, /==> (supabase|firebase|dotnet-clean-arch)/);

  const unlicensed = spawnSync("bash", ["scripts/bootstrap.sh", ".net", "--host", "codex", "--dry-run"], {
    cwd: root,
    encoding: "utf8"
  });
  assert.equal(unlicensed.status, 1);
  assert.match(unlicensed.stderr, /dotnet-clean-arch has no verified license/);

  const accepted = spawnSync("bash", ["scripts/bootstrap.sh", ".net", "--host", "codex", "--dry-run",
    "--accept-unverified-license", "dotnet-clean-arch"], { cwd: root, encoding: "utf8" });
  assert.equal(accepted.status, 0, accepted.stderr);
  assert.match(accepted.stderr, /explicitly accepted unverified license/);
  assert.match(accepted.stdout, /==> dotnet-clean-arch/);
});

test("canonical governance and compatibility shims expose both hosts", async () => {
  const agents = await readFile(resolve(root, "templates/AGENTS.md"), "utf8");
  const claude = await readFile(resolve(root, "templates/CLAUDE.md"), "utf8");
  assert.match(agents, /14 specialists/);
  assert.match(agents, /five artifact gates/);
  assert.match(claude, /^@AGENTS\.md/m);
  for (const name of ["initialize", "bootstrap", "feature", "peer-review"]) {
    const command = await readFile(resolve(root, `commands/${name}.md`), "utf8");
    assert.match(command, new RegExp(`skills/${name}/SKILL\\.md`));
  }
});

test("document pipelines require both exact global writing configurations", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "the-lab-writing-"));
  const codexHome = resolve(directory, "codex");
  const claudeHome = resolve(directory, "claude");
  await mkdir(codexHome);
  await mkdir(claudeHome);
  await writeFile(resolve(claudeHome, ".i-have-adhd-always"), "");
  await writeFile(resolve(codexHome, "AGENTS.md"), `<!-- i-have-adhd:managed:start -->
## Output style

The reader has ADHD. Shape every response so it can be acted on:

1. Lead with the answer or next action: command, path, or snippet first.
2. Number multi-step work; one bounded action per step.
3. End with one next action doable in under two minutes.
4. Finish the current issue before raising a new one.
5. Restate progress each turn ("step 3 of 5 done").
6. Give time estimates in concrete units, never "a bit".
7. After a change, show what now works.
8. Errors: state location, cause, and fix. No drama.
9. Cap lists at 5 items.
10. No preamble, no recaps, no closers.

Exceptions: explain fully when asked to explain. Confirm before destructive actions. After three failed fixes, stop and name the doubtful assumption. If the request is ambiguous, ask one short question.
<!-- i-have-adhd:managed:end -->
`);
  const env = { ...process.env, CODEX_HOME: codexHome, CLAUDE_CONFIG_DIR: claudeHome };
  const valid = spawnSync("bash", ["scripts/bootstrap.sh", "--verify-writing-standard"], { cwd: root, env, encoding: "utf8" });
  assert.equal(valid.status, 0, valid.stderr);

  await writeFile(resolve(codexHome, "AGENTS.md"), "<!-- i-have-adhd:managed:start -->\nstale\n<!-- i-have-adhd:managed:end -->\n");
  const stale = spawnSync("bash", ["scripts/bootstrap.sh", "--verify-writing-standard"], { cwd: root, env, encoding: "utf8" });
  assert.equal(stale.status, 1);
  assert.match(stale.stderr, /missing or stale upstream-managed/);
});
