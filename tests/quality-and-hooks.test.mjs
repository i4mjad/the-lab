import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const gate = resolve(root, "templates/quality-gate.sh");
const guard = resolve(root, "hooks/guard-writes.sh");

async function qualityEnv() {
  const cwd = await mkdtemp(resolve(tmpdir(), "the-lab-quality-"));
  await mkdir(resolve(cwd, "src"));
  await writeFile(resolve(cwd, "src/index.ts"), "one\ntwo\n");
  return {
    cwd,
    env: {
      ...process.env,
      ACTIVE_PLATFORMS: "web",
      WEB_TEST_CMD: "true",
      WEB_LINT_CMD: "true",
      WEB_COVERAGE_CMD: "printf '80\\n'",
      WEB_COVERAGE_MIN: "80",
      WEB_COMPLEXITY_CMD: "true",
      WEB_DEPS_CMD: "true",
      WEB_MUTATION_CMD: "printf '70\\n'",
      WEB_MUTATION_MIN: "60",
      WEB_SRC_DIR: "src",
      WEB_SRC_GLOB: "*.ts",
      WEB_MAX_MODULE_LINES: "3"
    }
  };
}

test("active quality metrics are mandatory and thresholds are enforced", async () => {
  const { cwd, env } = await qualityEnv();
  const pass = spawnSync("bash", [gate, "web"], { cwd, env, encoding: "utf8" });
  assert.equal(pass.status, 0, pass.stdout + pass.stderr);
  assert.match(pass.stdout, /QUALITY GATE: PASS/);

  const missing = spawnSync("bash", [gate, "web"], {
    cwd,
    env: { ...process.env, ACTIVE_PLATFORMS: "web" },
    encoding: "utf8"
  });
  assert.equal(missing.status, 1);
  assert.match(missing.stdout, /FAIL \(not configured\)/);

  const below = spawnSync("bash", [gate, "web"], {
    cwd,
    env: { ...env, WEB_COVERAGE_MIN: "81" },
    encoding: "utf8"
  });
  assert.equal(below.status, 1);
  assert.match(below.stdout, /80\s+\| >= 81\s+\| FAIL/);

  const invalid = spawnSync("bash", [gate, "web"], {
    cwd,
    env: { ...env, WEB_COVERAGE_MIN: "eighty", WEB_MAX_MODULE_LINES: "many" },
    encoding: "utf8"
  });
  assert.equal(invalid.status, 1);
  assert.match(invalid.stdout, /FAIL \(threshold\)/);
});

test("quick loops skip only mutation execution; final verification runs it", async () => {
  const { cwd, env } = await qualityEnv();
  const quick = spawnSync("bash", [gate, "web"], {
    cwd, env: { ...env, QUICK: "1", WEB_MUTATION_CMD: "false" }, encoding: "utf8"
  });
  assert.equal(quick.status, 0, quick.stdout + quick.stderr);
  assert.match(quick.stdout, /SKIP \(QUICK=1\)/);

  const final = spawnSync("bash", [gate, "web"], {
    cwd, env: { ...env, WEB_MUTATION_CMD: "false" }, encoding: "utf8"
  });
  assert.equal(final.status, 1);
  assert.match(final.stdout, /QUALITY GATE: FAIL/);

  const inactive = spawnSync("bash", [gate, "ios"], { cwd, env, encoding: "utf8" });
  assert.equal(inactive.status, 0);
  assert.match(inactive.stdout, /N\/A \(inactive\)/);
});

function guarded(role, payload) {
  return spawnSync("bash", [guard], {
    cwd: root,
    env: { ...process.env, THE_LAB_ROLE: role },
    input: JSON.stringify(payload),
    encoding: "utf8"
  });
}

test("write guard understands Claude and Codex payloads", () => {
  const claude = guarded("peer-reviewer", {
    tool_name: "Write",
    tool_input: { file_path: "docs/reports/fixture/review.md", content: "changed" }
  });
  assert.equal(claude.status, 2);
  assert.match(claude.stderr, /orchestrator-owned/);

  const codex = guarded("architect", {
    tool_name: "apply_patch",
    tool_input: { command: "*** Begin Patch\n*** Update File: apps/web/index.ts\n@@\n-old\n+new\n*** End Patch" }
  });
  assert.equal(codex.status, 2);
  assert.match(codex.stderr, /authors documents/);

  const builder = guarded("frontend", {
    tool_name: "apply_patch",
    tool_input: { command: "*** Begin Patch\n*** Update File: apps/web/index.ts\n*** End Patch" }
  });
  assert.equal(builder.status, 0, builder.stderr);

  const movedBar = guarded("frontend", {
    tool_name: "Edit",
    tool_input: { file_path: "quality-gate.sh" }
  });
  assert.equal(movedBar.status, 2);
});
