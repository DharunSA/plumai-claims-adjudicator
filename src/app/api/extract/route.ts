import { NextRequest, NextResponse } from "next/server";
import { extractClaimFromDocuments, type UploadedDocument } from "@/lib/llm/extract";
import { llmAvailable } from "@/lib/llm/client";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/extract
 * multipart/form-data with one or more `files` — medical document images/PDFs.
 * Returns the extracted RawClaimInput (to be reviewed/edited then adjudicated).
 */
export async function POST(req: NextRequest) {
  if (!llmAvailable()) {
    return NextResponse.json(
      { error: "Document extraction requires GEMINI_API_KEY. Use structured/manual entry instead." },
      { status: 503 },
    );
  }

  try {
    const form = await req.formData();
    const files = form.getAll("files").filter((f): f is File => f instanceof File);

    if (files.length === 0) {
      return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
    }

    const docs: UploadedDocument[] = await Promise.all(
      files.map(async (file) => ({
        media_type: file.type || "image/png",
        data: Buffer.from(await file.arrayBuffer()).toString("base64"),
        filename: file.name,
      })),
    );

    const extracted = await extractClaimFromDocuments(docs);
    if (!extracted) {
      return NextResponse.json({ error: "Could not extract structured data from the documents." }, { status: 422 });
    }

    return NextResponse.json({ extracted });
  } catch (err) {
    console.error("[/api/extract]", err);
    return NextResponse.json(
      { error: "Extraction failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
