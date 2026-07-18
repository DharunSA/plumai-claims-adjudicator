import { NextResponse } from "next/server";
import { listClaims } from "@/lib/db/store";

export const runtime = "nodejs";

/** GET /api/claims — list all adjudicated claims (newest first). */
export async function GET() {
  return NextResponse.json({ claims: listClaims() });
}
