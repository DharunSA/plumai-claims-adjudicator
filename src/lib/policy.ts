import fs from "node:fs";
import path from "node:path";
import type { PolicyTerms } from "./types";

let cached: PolicyTerms | null = null;

/** Load and cache the active policy terms from data/policy_terms.json. */
export function getPolicy(): PolicyTerms {
  if (cached) return cached;
  const file = path.join(process.cwd(), "data", "policy_terms.json");
  cached = JSON.parse(fs.readFileSync(file, "utf-8")) as PolicyTerms;
  return cached;
}

/** Reset the cache (used by tests / hot reload). */
export function resetPolicyCache() {
  cached = null;
}
