import { NextRequest, NextResponse } from "next/server";
import { adjudicateClaim } from "@/lib/service";
import { saveClaim } from "@/lib/db/store";
import type { RawClaimInput } from "@/lib/normalize";

export const runtime = "nodejs";

/**
 * POST /api/adjudicate
 * Body: RawClaimInput (the `input_data` shape from test_cases.json, or the form).
 * Optional query/body flag `persist=false` to skip storage.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RawClaimInput & { persist?: boolean };

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { input, result } = await adjudicateClaim(body);

    if (body.persist !== false) {
      saveClaim({ id: result.claim_id, input, result, created_at: result.created_at });
    }

    return NextResponse.json({ input, result });
  } catch (err) {
    console.error("[/api/adjudicate]", err);
    return NextResponse.json(
      { error: "Adjudication failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
