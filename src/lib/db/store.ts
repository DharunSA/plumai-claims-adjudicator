import fs from "node:fs";
import path from "node:path";
import type { ClaimRecord } from "../types";

/**
 * Minimal structured persistence: a JSON document store on disk.
 *
 * Chosen for zero native dependencies and instant local setup. The interface
 * (save / list / get / ytdForMember) is storage-agnostic, so swapping in
 * Postgres/Supabase later is a drop-in change.
 *
 * Note: on ephemeral serverless filesystems (e.g. Vercel) this resets between
 * cold starts — documented in ASSUMPTIONS.md. Use a managed DB for production.
 */

const DB_PATH = path.join(process.cwd(), "data", "claims.json");

function readAll(): ClaimRecord[] {
  try {
    if (!fs.existsSync(DB_PATH)) return [];
    return JSON.parse(fs.readFileSync(DB_PATH, "utf-8")) as ClaimRecord[];
  } catch {
    return [];
  }
}

function writeAll(records: ClaimRecord[]): void {
  fs.writeFileSync(DB_PATH, JSON.stringify(records, null, 2), "utf-8");
}

export function saveClaim(record: ClaimRecord): void {
  const all = readAll();
  all.unshift(record); // newest first
  writeAll(all);
}

export function listClaims(): ClaimRecord[] {
  return readAll();
}

export function getClaim(id: string): ClaimRecord | undefined {
  return readAll().find((r) => r.id === id);
}

/** Sum of approved amounts for a member in the current policy year (for annual-limit checks). */
export function ytdForMember(memberId: string | undefined, treatmentDateIso: string): number {
  if (!memberId) return 0;
  const year = new Date(treatmentDateIso).getFullYear();
  return readAll()
    .filter(
      (r) =>
        r.input.member_id === memberId &&
        new Date(r.input.treatment_date).getFullYear() === year &&
        (r.result.decision === "APPROVED" || r.result.decision === "PARTIAL"),
    )
    .reduce((s, r) => s + r.result.approved_amount, 0);
}
