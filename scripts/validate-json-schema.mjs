#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";

const root = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const valueAfter = (flag) => {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
};

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function matchesType(value, type) {
  if (type === "null") return value === null;
  if (type === "array") return Array.isArray(value);
  if (type === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  if (type === "integer") return Number.isInteger(value);
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  return typeof value === type;
}

function validate(value, schema, path = "$") {
  const errors = [];
  const types = schema.type === undefined ? [] : Array.isArray(schema.type) ? schema.type : [schema.type];
  if (types.length > 0 && !types.some((type) => matchesType(value, type))) {
    return [`${path}: expected ${types.join(" or ")}`];
  }
  if ("const" in schema && !same(value, schema.const)) errors.push(`${path}: expected constant ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.some((candidate) => same(value, candidate))) errors.push(`${path}: value is outside enum`);

  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${path}: shorter than minLength ${schema.minLength}`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${path}: does not match ${schema.pattern}`);
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${path}: fewer than ${schema.minItems} items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${path}: more than ${schema.maxItems} items`);
    if (schema.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) errors.push(`${path}: items are not unique`);
    if (schema.items) value.forEach((item, index) => errors.push(...validate(item, schema.items, `${path}[${index}]`)));
  }

  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    for (const key of schema.required ?? []) if (!(key in value)) errors.push(`${path}: missing required property ${key}`);
    const properties = schema.properties ?? {};
    for (const [key, child] of Object.entries(value)) {
      if (properties[key]) errors.push(...validate(child, properties[key], `${path}.${key}`));
      else if (schema.additionalProperties === false) errors.push(`${path}: unexpected property ${key}`);
    }
  }
  return errors;
}

async function validatePair(documentPath, schemaPath) {
  const document = JSON.parse(await readFile(documentPath, "utf8"));
  const schema = JSON.parse(await readFile(schemaPath, "utf8"));
  const errors = validate(document, schema);
  if (errors.length > 0) throw new Error(`${documentPath.slice(root.length + 1)} failed ${schemaPath.slice(root.length + 1)}:\n${errors.join("\n")}`);
  process.stdout.write(`validated ${documentPath.slice(root.length + 1)}\n`);
}

const documentArg = valueAfter("--document");
const schemaArg = valueAfter("--schema");
if (Boolean(documentArg) !== Boolean(schemaArg)) throw new Error("--document and --schema must be supplied together");
if (documentArg) {
  await validatePair(resolve(documentArg), resolve(schemaArg));
} else {
  await validatePair(resolve(root, "roles/catalog.json"), resolve(root, "schemas/role-catalog.schema.json"));
  await validatePair(resolve(root, "skills.manifest.json"), resolve(root, "schemas/skills-manifest.schema.json"));
}
