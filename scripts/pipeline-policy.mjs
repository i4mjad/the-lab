#!/usr/bin/env node

import process from "node:process";

const args = process.argv.slice(2);
const valueAfter = (flag) => {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
};
const platforms = new Set(["web", "ios", "flutter", "backend"]);
const builders = { web: "frontend", ios: "ios", flutter: "flutter", backend: "backend" };

export function evaluatePipeline(input) {
  if (!["GO", "PIVOT", "KILL"].includes(input.discoveryVerdict)) throw new Error("discoveryVerdict must be GO, PIVOT, or KILL");
  const active = input.activePlatforms ?? [];
  if (!Array.isArray(active) || active.some((platform) => !platforms.has(platform))) throw new Error("activePlatforms contains an unknown platform");
  const phases = input.phases ?? 1;
  if (!Number.isInteger(phases) || phases < 1) throw new Error("phases must be a positive integer");

  if (input.discoveryVerdict === "KILL") {
    return { state: "STOP", reason: "discovery KILL", gates: [], phases: 0, builders: [], verifiers: [] };
  }

  const gates = ["discovery", "requirements", "product", "architecture"];
  if (input.ui === true) gates.push("design");
  const routedBuilders = active.map((platform) => builders[platform]);
  const verifiers = ["code-reviewer", "peer-reviewer"];
  if (active.includes("web")) verifiers.push("qa-tester");
  if (active.includes("backend")) verifiers.push("api-tester");
  if (active.some((platform) => platform === "ios" || platform === "flutter")) verifiers.push("mobile-qa");

  if (input.artifactNeedsAttention && (input.artifactRound ?? 1) >= 3) {
    return { state: "HUMAN_GATE", reason: "artifact three-round limit", gates, phases, builders: routedBuilders, verifiers };
  }
  if (input.reviewers && input.reviewers.independent === false && input.reviewers.fallback === false) {
    return { state: "HUMAN_GATE", reason: "both reviewer routes unavailable", gates, phases, builders: routedBuilders, verifiers };
  }
  if (verifiers.includes("mobile-qa")) {
    const mobile = input.mobile ?? {};
    const missing = ["mcp", "device", "app", "authenticated"].filter((key) => mobile[key] !== true);
    if (missing.length > 0) {
      return { state: "BLOCKED", reason: `mobile prerequisites: ${missing.join(", ")}`, gates, phases, builders: routedBuilders, verifiers };
    }
  }
  if ((input.openBlockingFindings ?? 0) > 0 && (input.buildRound ?? 1) >= 3) {
    return { state: "NOT_SHIPPABLE", reason: "build/review three-round limit", gates, phases, builders: routedBuilders, verifiers };
  }
  return { state: "READY", reason: null, gates, phases, builders: routedBuilders, verifiers };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const input = valueAfter("--input-json");
  if (!input) throw new Error("--input-json is required");
  process.stdout.write(`${JSON.stringify(evaluatePipeline(JSON.parse(input)), null, 2)}\n`);
}
