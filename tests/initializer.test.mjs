import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const initializer = resolve(root, "scripts/initialize.mjs");
const answers = {
  projectName: "Fixture App",
  purpose: "a fixture used to validate deterministic initialization",
  repositoryState: "greenfield",
  market: "Oman",
  audience: "testers",
  constraints: "no production data",
  localization: "English and Arabic RTL",
  activePlatforms: ["web"],
  stack: { web: "TypeScript", mobile: "inactive", backend: "inactive", automation: "none" },
  designOptIns: [],
  quality: {
    web: {
      testCommand: "npm test", lintCommand: "npm run lint", coverageCommand: "npm run coverage",
      coverageMinimum: "80", complexityCommand: "npm run complexity", sourceDirectory: "src",
      sourceGlob: "*.ts *.tsx", maxModuleLines: "300", dependencyCommand: "npm run deps",
      mutationCommand: "npm run mutation", mutationMinimum: "60"
    }
  }
};

const run = (target, extra = []) => spawnSync("node", [initializer, "--target", target, ...extra], {
  cwd: root,
  encoding: "utf8"
});
const runnerBlock = (content) => content.match(/^# the-lab:managed:quality-runner:start$[\s\S]*?^# the-lab:managed:quality-runner:end$/m)?.[0];
const sha256 = (content) => createHash("sha256").update(content).digest("hex");

test("fresh initialization creates both host configurations and all Codex roles", async () => {
  const target = await mkdtemp(resolve(tmpdir(), "the-lab-init-"));
  const result = run(target, ["--answers-json", JSON.stringify(answers)]);
  assert.equal(result.status, 0, result.stderr);
  for (const path of ["AGENTS.md", "CLAUDE.md", "quality-gate.sh", ".codex/config.toml",
    ".codex/hooks.json", ".codex/guard-writes.sh", ".the-lab/state.json"]) {
    await access(resolve(target, path));
  }
  const agents = await readFile(resolve(target, "AGENTS.md"), "utf8");
  const quality = await readFile(resolve(target, "quality-gate.sh"), "utf8");
  assert.match(agents, /Fixture App is a fixture/);
  assert.match(agents, /Active platforms: web/);
  assert.match(quality, /ACTIVE_PLATFORMS='web'/);
  assert.match(quality, /WEB_COVERAGE_MIN='80'/);
  for (const id of ["discovery", "mobile-qa", "peer-reviewer"]) await access(resolve(target, `.codex/agents/${id}.toml`));
});

test("sync preserves hand-edited generated files and project-owned blocks", async () => {
  const target = await mkdtemp(resolve(tmpdir(), "the-lab-sync-"));
  assert.equal(run(target, ["--answers-json", JSON.stringify(answers)]).status, 0);
  const claudePath = resolve(target, "CLAUDE.md");
  const agentsPath = resolve(target, "AGENTS.md");
  const adapterPath = resolve(target, ".codex/agents/discovery.toml");
  await writeFile(claudePath, `${await readFile(claudePath, "utf8")}\n# local Claude note\n`);
  await writeFile(adapterPath, `${await readFile(adapterPath, "utf8")}\n# local adapter note\n`);
  await writeFile(agentsPath, (await readFile(agentsPath, "utf8")).replace("Oman", "Oman and GCC"));

  const result = run(target, ["--sync"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /REPORT-ONLY CLAUDE\.md was hand-edited/);
  assert.match(result.stdout, /REPORT-ONLY \.codex\/agents\/discovery\.toml was hand-edited/);
  assert.match(await readFile(claudePath, "utf8"), /local Claude note/);
  assert.match(await readFile(adapterPath, "utf8"), /local adapter note/);
  assert.match(await readFile(agentsPath, "utf8"), /Oman and GCC/);
});

test("dry-run and legacy migration are non-destructive and deterministic", async () => {
  const dryTarget = await mkdtemp(resolve(tmpdir(), "the-lab-dry-"));
  const dry = run(dryTarget, ["--answers-json", JSON.stringify(answers), "--dry-run"]);
  assert.equal(dry.status, 0, dry.stderr);
  await assert.rejects(access(resolve(dryTarget, "AGENTS.md")));

  const legacyTarget = await mkdtemp(resolve(tmpdir(), "the-lab-legacy-"));
  await writeFile(resolve(legacyTarget, "CLAUDE.md"), `# Old\n\nThis project uses the cc-setup plugin.\n\n## 1. Purpose\n\nLegacy purpose.\n\n## 5. Stack\n\n- Active platforms: backend\n`);
  const migrated = run(legacyTarget, ["--sync"]);
  assert.equal(migrated.status, 0, migrated.stderr);
  assert.match(migrated.stdout, /MIGRATE CLAUDE\.md/);
  assert.match(await readFile(resolve(legacyTarget, "AGENTS.md"), "utf8"), /Legacy purpose/);
  assert.match(await readFile(resolve(legacyTarget, "CLAUDE.md"), "utf8"), /@AGENTS\.md/);
});

test("sync does not trust or overwrite managed blocks without a state record", async () => {
  const target = await mkdtemp(resolve(tmpdir(), "the-lab-untracked-agents-"));
  const template = await readFile(resolve(root, "templates/AGENTS.md"), "utf8");
  const edited = template.replace("14 specialists follow", "Locally customized specialists follow");
  await writeFile(resolve(target, "AGENTS.md"), edited);
  const result = run(target, ["--sync"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /has no trusted generation record/);
  assert.match(await readFile(resolve(target, "AGENTS.md"), "utf8"), /Locally customized specialists follow/);
});

test("sync upgrades an untouched quality runner but preserves configuration and hand edits", async () => {
  const target = await mkdtemp(resolve(tmpdir(), "the-lab-quality-sync-"));
  assert.equal(run(target, ["--answers-json", JSON.stringify(answers)]).status, 0);
  const qualityPath = resolve(target, "quality-gate.sh");
  const statePath = resolve(target, ".the-lab/state.json");
  let quality = (await readFile(qualityPath, "utf8"))
    .replace("WEB_COVERAGE_MIN='80'", "WEB_COVERAGE_MIN='85'")
    .replace("# ── runner (no config below this line)", "# legacy generated runner");
  await writeFile(qualityPath, quality);
  const state = JSON.parse(await readFile(statePath, "utf8"));
  state.qualityRunner.generatedHash = sha256(runnerBlock(quality));
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`);

  const upgraded = run(target, ["--sync"]);
  assert.equal(upgraded.status, 0, upgraded.stderr);
  assert.match(upgraded.stdout, /UPDATE quality-gate\.sh#quality-runner/);
  quality = await readFile(qualityPath, "utf8");
  assert.match(quality, /WEB_COVERAGE_MIN='85'/);
  assert.doesNotMatch(quality, /legacy generated runner/);

  await writeFile(qualityPath, quality.replace("overall=0", "overall=7 # local runner edit"));
  const preserved = run(target, ["--sync"]);
  assert.equal(preserved.status, 0, preserved.stderr);
  assert.match(preserved.stdout, /REPORT-ONLY quality-gate\.sh runner was hand-edited/);
  assert.match(await readFile(qualityPath, "utf8"), /local runner edit/);
});
