import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const bridge = resolve(root, "scripts/review-bridge.mjs");
const validReview = {
  verdict: "approve",
  summary: "The artifact satisfies its gate.",
  findings: [],
  next_steps: []
};
const validFindingReview = {
  verdict: "needs-attention",
  summary: "One issue needs attention.",
  findings: [{
    id: "X1", severity: "major", title: "Missing evidence", body: "The assertion is unsupported.",
    recommendation: "Add measurable evidence.", confidence: 0.9, quote: "unsupported assertion",
    file: null, line_start: null, line_end: null
  }],
  next_steps: ["Route X1 to the artifact owner."]
};

async function context(fixture) {
  const directory = await mkdtemp(resolve(tmpdir(), "the-lab-review-"));
  const artifact = resolve(directory, "artifact.md");
  const fixturePath = resolve(directory, "fixture.json");
  const log = resolve(directory, "gates.jsonl");
  await writeFile(artifact, "# Fixture artifact\n\nEvidence.\n");
  await writeFile(fixturePath, JSON.stringify(fixture));
  return { directory, artifact, fixturePath, log };
}

function run({ artifact, fixturePath, log }, extra = []) {
  return spawnSync("node", [bridge, "--leader", "claude", "--stage", "discovery", "--artifact", artifact,
    "--fixture", fixturePath, "--log", log, ...extra], { cwd: root, encoding: "utf8" });
}

test("independent reviewer retries once before succeeding", async () => {
  const paths = await context({ codex: [{ error: "preflight failed" }, { result: validFindingReview, session: "codex-retry" }] });
  const result = run(paths);
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.reviewer_host, "codex");
  assert.equal(output.reviewer_model, "gpt-5.6-sol");
  assert.equal(output.reviewer_effort, "xhigh");
  assert.equal(output.attempts.length, 2);
  assert.equal(output.verdict, "NEEDS_ATTENTION");
  assert.equal(JSON.parse((await readFile(paths.log, "utf8")).trim()).artifact_hash, output.artifact_hash);
});

test("schema failures route to the documented same-host fallback", async () => {
  const paths = await context({
    codex: [{ result: { verdict: "approve" } }, { result: { verdict: "approve" } }],
    claude: [{ result: validReview, session: "claude-fallback" }]
  });
  const result = run(paths);
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.reviewer_host, "claude");
  assert.equal(output.reviewer_model, "opus");
  assert.equal(output.attempts.length, 3);
  assert.match(output.fallback_reason, /schema:/);
});

test("both failed routes require a human gate", async () => {
  const paths = await context({ codex: [{ error: "offline" }, { error: "offline" }], claude: [{ error: "also offline" }] });
  const result = run(paths);
  assert.equal(result.status, 3);
  const output = JSON.parse(result.stdout);
  assert.equal(output.verdict, "HUMAN_GATE");
  assert.equal(output.attempts.length, 3);
  assert.match(output.fallback_reason, /fallback: also offline/);
});

test("stale hashes are rejected before reviewer dispatch", async () => {
  const paths = await context({});
  const result = run(paths, ["--expected-hash", "0".repeat(64)]);
  assert.equal(result.status, 3);
  const output = JSON.parse(result.stdout);
  assert.equal(output.verdict, "HUMAN_GATE");
  assert.equal(output.fallback_reason, "stale artifact hash");
  assert.notEqual(output.artifact_hash, "0".repeat(64));
});

test("one same-session rebuttal logs an adjudicated final verdict", async () => {
  const paths = await context({ codex: [{ result: validFindingReview, session: "codex-session" }],
    rebuttal: [{ result: { responses: [{
    id: "X1", position: "concede", reasoning: "The cited line resolves the concern.",
    revised_severity: null, revised_recommendation: null
  }] } }] });
  const initial = run(paths);
  assert.equal(initial.status, 0, initial.stderr);
  assert.equal(JSON.parse(initial.stdout).reviewer_session, "codex-session");
  const disputes = JSON.stringify([{ id: "X1", evidence: "artifact.md:3" }]);
  const result = run(paths, ["--resume-session", "codex-session", "--reviewer-host", "codex",
    "--disputes-json", disputes]);
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.type, "adjudicated-final");
  assert.equal(output.reviewer_session, "codex-session");
  assert.equal(output.verdict, "APPROVE");
  assert.equal(output.findings.length, 0);
  assert.equal(output.disputes[0].response.position, "concede");
  const logged = (await readFile(paths.log, "utf8")).trim().split("\n").map(JSON.parse).at(-1);
  assert.equal(logged.type, "adjudicated-final");

  const second = run(paths, ["--resume-session", "codex-session", "--reviewer-host", "codex",
    "--disputes-json", disputes]);
  assert.notEqual(second.status, 0);
  assert.match(second.stderr, /already used its rebuttal round/);
});

test("rebuttal resume rejects prior metadata that does not match the current gate", async () => {
  const paths = await context({ codex: [{ result: validFindingReview, session: "bound-session" }], rebuttal: [] });
  const initial = run(paths);
  assert.equal(initial.status, 0, initial.stderr);
  const event = JSON.parse((await readFile(paths.log, "utf8")).trim());
  event.stage = "product";
  await writeFile(paths.log, `${JSON.stringify(event)}\n`);
  const result = run(paths, ["--resume-session", "bound-session", "--reviewer-host", "codex",
    "--disputes-json", JSON.stringify([{ id: "X1", evidence: "artifact.md:3" }])]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /resume stage differs from the prior review/);
});

test("all five artifact gates use the bridge and bind the current hash", async () => {
  for (const stage of ["discovery", "requirements", "product", "architecture", "design"]) {
    const paths = await context({ codex: [{ result: validReview, session: `${stage}-session` }] });
    const result = spawnSync("node", [bridge, "--leader", "claude", "--stage", stage,
      "--artifact", paths.artifact, "--fixture", paths.fixturePath], { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0, `${stage}: ${result.stderr}`);
    const output = JSON.parse(result.stdout);
    assert.equal(output.stage, stage);
    assert.equal(output.artifact_hash, createHash("sha256").update(await readFile(paths.artifact)).digest("hex"));
  }
});
