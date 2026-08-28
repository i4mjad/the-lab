#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";

const root = resolve(import.meta.dirname, "..");
const manifestText = await readFile(resolve(root, "skills.manifest.json"), "utf8");
const manifest = JSON.parse(manifestText);
const lock = {
  schemaVersion: 1,
  manifestSha256: createHash("sha256").update(manifestText).digest("hex"),
  dependencies: manifest.dependencies.map(({ id, license, source, resolved }) => ({ id, license, source, resolved }))
};
const output = `${JSON.stringify(lock, null, 2)}\n`;
const path = resolve(root, "skills-lock.json");
if (process.argv.includes("--check")) {
  const current = await readFile(path, "utf8");
  if (current !== output) throw new Error("skills-lock.json drift; run node scripts/update-lock.mjs and review the dependency diff");
} else {
  await writeFile(path, output);
  process.stdout.write(`locked ${lock.dependencies.length} dependencies\n`);
}
