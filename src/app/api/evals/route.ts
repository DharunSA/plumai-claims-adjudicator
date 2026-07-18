import { NextResponse } from "next/server";
import { runEvals } from "@/lib/evals";

export const runtime = "nodejs";
export const maxDuration = 60;

/** GET /api/evals — run the test-case suite through the engine and return metrics. */
export async function GET() {
  try {
    const report = await runEvals();
    return NextResponse.json(report);
  } catch (err) {
    console.error("[/api/evals]", err);
    return NextResponse.json(
      { error: "Eval run failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
