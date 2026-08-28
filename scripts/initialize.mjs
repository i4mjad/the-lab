#!/usr/bin/env node

import { createHash } from "node:crypto";
import { chmod, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";

const labRoot = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const valueAfter = (flag) => {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
};
const target = resolve(valueAfter("--target") ?? ".");
const sync = args.includes("--sync");
const dryRun = args.includes("--dry-run");
const answersText = valueAfter("--answers-json");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const statePath = resolve(target, ".the-lab/state.json");
const log = (message) => process.stdout.write(`${message}\n`);

async function read(path) {
  return readFile(path, "utf8");
}

async function readIfExists(path) {
  try {
    return await read(path);
  } catch (error) {
    if (error.code === "ENOENT") return undefined;
    throw error;
  }
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'"'"'`)}'`;
}

function replaceAssignment(script, name, value) {
  const pattern = new RegExp(`^${name}=.*$`, "m");
  if (!pattern.test(script)) throw new Error(`quality template lost ${name}`);
  return script.replace(pattern, `${name}=${shellQuote(value)}`);
}

function requiredString(value, label) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`missing answer: ${label}`);
  return value.trim();
}

function requiredNumber(value, label, { integer = false } = {}) {
  const text = requiredString(String(value ?? ""), label);
  const number = Number(text);
  if (!Number.isFinite(number) || number < 0 || (integer && !Number.isInteger(number))) {
    throw new Error(`${label} must be a non-negative${integer ? " integer" : " number"}`);
  }
}

const qualityFields = [
  { field: "testCommand", suffix: "TEST_CMD" },
  { field: "lintCommand", suffix: "LINT_CMD" },
  { field: "coverageCommand", suffix: "COVERAGE_CMD" },
  { field: "coverageMinimum", suffix: "COVERAGE_MIN", numeric: true },
  { field: "complexityCommand", suffix: "COMPLEXITY_CMD" },
  { field: "sourceDirectory", suffix: "SRC_DIR" },
  { field: "sourceGlob", suffix: "SRC_GLOB" },
  { field: "maxModuleLines", suffix: "MAX_MODULE_LINES", numeric: true, integer: true },
  { field: "dependencyCommand", suffix: "DEPS_CMD" },
  { field: "mutationCommand", suffix: "MUTATION_CMD" },
  { field: "mutationMinimum", suffix: "MUTATION_MIN", numeric: true }
];

function validateAnswers(answers) {
  const active = answers.activePlatforms;
  if (!Array.isArray(active) || active.length === 0) throw new Error("activePlatforms must not be empty");
  if (new Set(active).size !== active.length) throw new Error("activePlatforms must not contain duplicates");
  const allowed = new Set(["web", "ios", "flutter", "backend"]);
  for (const platform of active) if (!allowed.has(platform)) throw new Error(`unknown active platform: ${platform}`);
  for (const key of ["projectName", "purpose", "repositoryState", "market", "audience", "constraints", "localization"]) {
    requiredString(answers[key], key);
  }
  requiredString(answers.stack?.automation, "stack.automation");
  if (active.includes("web")) requiredString(answers.stack?.web, "stack.web");
  if (active.some((platform) => platform === "ios" || platform === "flutter")) requiredString(answers.stack?.mobile, "stack.mobile");
  if (active.includes("backend")) requiredString(answers.stack?.backend, "stack.backend");
  for (const platform of active) {
    const quality = answers.quality?.[platform];
    if (!quality) throw new Error(`missing quality configuration for active platform: ${platform}`);
    for (const descriptor of qualityFields) {
      const label = `${platform}.quality.${descriptor.field}`;
      requiredString(String(quality[descriptor.field] ?? ""), label);
      if (descriptor.numeric) requiredNumber(quality[descriptor.field], label, { integer: descriptor.integer });
    }
  }
}

function renderAgents(template, answers) {
  const replacements = {
    "<PROJECT_NAME>": answers.projectName,
    "<ONE_LINE_PRODUCT_DESCRIPTION>": answers.purpose,
    "<GREENFIELD_OR_EXISTING>": answers.repositoryState,
    "<REGION_AND_MARKET>": answers.market,
    "<AUDIENCE>": answers.audience,
    "<PRIVACY_SAFETY_COMPLIANCE>": answers.constraints,
    "<LOCALIZATION_AND_RTL>": answers.localization,
    "<SPACE_SEPARATED_WEB_IOS_FLUTTER_BACKEND>": answers.activePlatforms.join(" "),
    "<WEB_STACK_OR_INACTIVE>": answers.stack?.web ?? "inactive",
    "<IOS_FLUTTER_BOTH_OR_INACTIVE>": answers.stack?.mobile ?? "inactive",
    "<DOTNET_SUPABASE_FIREBASE_CUSTOM_OR_INACTIVE>": answers.stack?.backend ?? "inactive",
    "<AUTOMATION_DEFAULTS_OR_NONE>": answers.stack?.automation ?? "none",
    "<EXPLICIT_OPT_INS_OR_NONE>": answers.designOptIns?.join(", ") || "none"
  };
  let rendered = template;
  for (const [placeholder, value] of Object.entries(replacements)) rendered = rendered.replaceAll(placeholder, value);
  return rendered;
}

function renderQuality(template, answers) {
  let rendered = replaceAssignment(template, "ACTIVE_PLATFORMS", answers.activePlatforms.join(" "));
  for (const platform of answers.activePlatforms) {
    for (const descriptor of qualityFields) {
      rendered = replaceAssignment(rendered, `${platform.toUpperCase()}_${descriptor.suffix}`, answers.quality[platform][descriptor.field]);
    }
  }
  return rendered;
}

function blocks(content, kind) {
  const map = {};
  const expression = new RegExp(`<!-- the-lab:${kind}:([a-z-]+):start -->([\\s\\S]*?)<!-- the-lab:${kind}:\\1:end -->`, "g");
  for (const match of content.matchAll(expression)) map[match[1]] = match[0];
  return map;
}

function shellManagedBlock(content, name) {
  const expression = new RegExp(`^# the-lab:managed:${name}:start$[\\s\\S]*?^# the-lab:managed:${name}:end$`, "m");
  return content.match(expression)?.[0];
}

function numberedSection(content, number) {
  const expression = new RegExp(`^## ${number}\\.[^\\n]*\\n[\\s\\S]*?(?=^## \\d+\\.|(?![\\s\\S]))`, "m");
  return content.match(expression)?.[0]?.trim();
}

function migrateLegacyAgents(template, legacy) {
  let migrated = template;
  const mapping = { purpose: 1, domain: 4, stack: 5, git: 9 };
  for (const [name, number] of Object.entries(mapping)) {
    const section = numberedSection(legacy, number);
    if (!section) continue;
    const expression = new RegExp(`<!-- the-lab:project:${name}:start -->[\\s\\S]*?<!-- the-lab:project:${name}:end -->`);
    migrated = migrated.replace(expression, `<!-- the-lab:project:${name}:start -->\n${section}\n<!-- the-lab:project:${name}:end -->`);
  }
  return migrated;
}

function diffPreview(current, expected) {
  const left = current.split("\n");
  const right = expected.split("\n");
  const lines = ["--- current", "+++ generated"];
  let shown = 0;
  for (let index = 0; index < Math.max(left.length, right.length) && shown < 12; index += 1) {
    if (left[index] === right[index]) continue;
    lines.push(`@@ line ${index + 1} @@`, `-${left[index] ?? ""}`, `+${right[index] ?? ""}`);
    shown += 1;
  }
  if (shown === 12) lines.push("... diff preview truncated; compare against the installed template before merging.");
  return lines.join("\n");
}

async function buildDesired(answers) {
  const agentsTemplate = await read(resolve(labRoot, "templates/AGENTS.md"));
  const qualityTemplate = await read(resolve(labRoot, "templates/quality-gate.sh"));
  const desired = new Map([
    ["CLAUDE.md", await read(resolve(labRoot, "templates/CLAUDE.md"))],
    [".codex/config.toml", await read(resolve(labRoot, "templates/codex-config.toml"))],
    [".codex/hooks.json", await read(resolve(labRoot, "templates/codex-hooks.json"))],
    [".codex/guard-writes.sh", await read(resolve(labRoot, "hooks/guard-writes.sh"))]
  ]);
  if (answers) {
    desired.set("AGENTS.md", renderAgents(agentsTemplate, answers));
    desired.set("quality-gate.sh", renderQuality(qualityTemplate, answers));
  } else {
    desired.set("AGENTS.md", agentsTemplate);
    desired.set("quality-gate.sh", qualityTemplate);
  }
  const catalog = JSON.parse(await read(resolve(labRoot, "roles/catalog.json")));
  for (const role of catalog.roles) {
    desired.set(`.codex/agents/${role.id}.toml`, await read(resolve(labRoot, `.codex/agents/${role.id}.toml`)));
  }
  return desired;
}

async function write(path, content, executable = false) {
  if (dryRun) return;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
  if (executable) await chmod(path, 0o755);
}

let answers;
if (answersText) {
  answers = JSON.parse(answersText);
  validateAnswers(answers);
}
if (!sync && !answers) throw new Error("new initialization requires --answers-json");

const previousStateText = await readIfExists(statePath);
const previousState = previousStateText ? JSON.parse(previousStateText) : { schemaVersion: 1, files: {}, managedBlocks: {} };
const desired = await buildDesired(answers);
const nextState = structuredClone(previousState);
nextState.schemaVersion = 1;
nextState.pluginVersion = "1.0.0";
nextState.files ??= {};
nextState.managedBlocks ??= {};
nextState.qualityRunner ??= previousState.qualityRunner;

if (sync && !existsSync(resolve(target, "AGENTS.md"))) {
  const legacyPath = resolve(target, "CLAUDE.md");
  const legacy = await readIfExists(legacyPath);
  if (legacy?.includes("cc-setup plugin") && numberedSection(legacy, 1) && numberedSection(legacy, 5)) {
    desired.set("AGENTS.md", migrateLegacyAgents(desired.get("AGENTS.md"), legacy));
    desired.set("CLAUDE.md", await read(resolve(labRoot, "templates/CLAUDE.md")));
    log("MIGRATE CLAUDE.md → canonical AGENTS.md plus the short Claude import shim");
  }
}

for (const [name, expected] of desired) {
  const path = resolve(target, name);
  const current = await readIfExists(path);
  const executable = name === "quality-gate.sh" || name === ".codex/guard-writes.sh";

  if (name === "AGENTS.md" && sync && current) {
    let updated = current;
    const currentManaged = blocks(current, "managed");
    const expectedManaged = blocks(expected, "managed");
    for (const [blockName, expectedBlock] of Object.entries(expectedManaged)) {
      const currentBlock = currentManaged[blockName];
      const previousHash = previousState.managedBlocks[blockName]?.generatedHash;
      if (!currentBlock) {
        log(`REPORT-ONLY AGENTS.md managed block '${blockName}' is missing\n${diffPreview(current, expected)}`);
        continue;
      }
      if (!previousHash && currentBlock !== expectedBlock) {
        log(`REPORT-ONLY AGENTS.md managed block '${blockName}' has no trusted generation record\n${diffPreview(currentBlock, expectedBlock)}`);
        continue;
      }
      if (previousHash && sha256(currentBlock) !== previousHash) {
        log(`REPORT-ONLY AGENTS.md managed block '${blockName}' was hand-edited\n${diffPreview(currentBlock, expectedBlock)}`);
        continue;
      }
      updated = updated.replace(currentBlock, expectedBlock);
      nextState.managedBlocks[blockName] = { generatedHash: sha256(expectedBlock) };
      log(`${currentBlock === expectedBlock ? "KEEP" : "UPDATE"} AGENTS.md#${blockName}`);
    }
    if (updated !== current) await write(path, updated);
    nextState.files[name] = { generatedHash: sha256(updated), policy: "managed-blocks" };
    continue;
  }

  if (name === "quality-gate.sh" && sync && current) {
    const currentRunner = shellManagedBlock(current, "quality-runner");
    const expectedRunner = shellManagedBlock(expected, "quality-runner");
    if (!expectedRunner) throw new Error("quality template lost its managed runner block");
    const previousHash = previousState.qualityRunner?.generatedHash;
    if (!currentRunner) {
      log(`REPORT-ONLY quality-gate.sh has no managed runner markers\n${diffPreview(current, expected)}`);
      continue;
    }
    if (!previousHash && currentRunner !== expectedRunner) {
      log(`REPORT-ONLY quality-gate.sh runner has no trusted generation record\n${diffPreview(currentRunner, expectedRunner)}`);
      continue;
    }
    if (previousHash && sha256(currentRunner) !== previousHash) {
      log(`REPORT-ONLY quality-gate.sh runner was hand-edited\n${diffPreview(currentRunner, expectedRunner)}`);
      continue;
    }
    const updated = current.replace(currentRunner, expectedRunner);
    if (updated !== current) {
      log("UPDATE quality-gate.sh#quality-runner (project configuration preserved)");
      await write(path, updated, executable);
    } else {
      log("KEEP quality-gate.sh (runner current; project configuration preserved)");
    }
    nextState.qualityRunner = { generatedHash: sha256(expectedRunner) };
    nextState.files[name] = { generatedHash: sha256(updated), policy: "project-config-managed-runner" };
    continue;
  }

  if (current === undefined) {
    log(`CREATE ${name}`);
    await write(path, expected, executable);
    nextState.files[name] = { generatedHash: sha256(expected), policy: name === "quality-gate.sh" ? "project-config-managed-runner" : "generated" };
    if (name === "AGENTS.md") {
      for (const [blockName, block] of Object.entries(blocks(expected, "managed"))) {
        nextState.managedBlocks[blockName] = { generatedHash: sha256(block) };
      }
    }
    if (name === "quality-gate.sh") {
      const runner = shellManagedBlock(expected, "quality-runner");
      if (!runner) throw new Error("quality template lost its managed runner block");
      nextState.qualityRunner = { generatedHash: sha256(runner) };
    }
    continue;
  }

  if (!sync) {
    log(`REPORT-ONLY ${name} already exists\n${diffPreview(current, expected)}`);
    continue;
  }

  const previousHash = previousState.files[name]?.generatedHash;
  const recognizedLegacyClaude = name === "CLAUDE.md" && current.includes("cc-setup plugin") && numberedSection(current, 1);
  if ((previousHash && sha256(current) === previousHash) || recognizedLegacyClaude || current === expected) {
    if (current !== expected) {
      log(`UPDATE ${name}`);
      await write(path, expected, executable);
    } else {
      log(`KEEP ${name}`);
    }
    nextState.files[name] = { generatedHash: sha256(expected), policy: "generated" };
  } else {
    log(`REPORT-ONLY ${name} was hand-edited\n${diffPreview(current, expected)}`);
  }
}

if (!dryRun) {
  await mkdir(dirname(statePath), { recursive: true });
  await writeFile(statePath, `${JSON.stringify(nextState, null, 2)}\n`);
  for (const name of desired.keys()) await stat(resolve(target, name));
  for (const name of ["quality-gate.sh", ".codex/guard-writes.sh"]) {
    const mode = (await stat(resolve(target, name))).mode;
    if ((mode & 0o111) === 0) throw new Error(`${name} is not executable after initialization`);
  }
  log(`VERIFY ${desired.size} managed/project files present; executable guards ready; state ledger written`);
} else {
  log(`DRY-RUN ${desired.size} managed/project files evaluated; no files written`);
}
log(`${dryRun ? "DRY RUN" : "DONE"}: ${sync ? "synchronized" : "initialized"} ${target}`);
