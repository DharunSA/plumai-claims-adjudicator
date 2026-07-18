import { getClient, getModel, parseJsonLoose } from "./client";
import type { RawClaimInput } from "../normalize";

/** A document image/PDF supplied as base64. */
export interface UploadedDocument {
  /** e.g. "image/png", "image/jpeg", "application/pdf" */
  media_type: string;
  /** base64-encoded file contents (no data: prefix) */
  data: string;
  filename?: string;
}

const EXTRACTION_SYSTEM = `You are a medical-claims data extraction engine for an Indian OPD (outpatient) insurance system.
Extract structured data from the uploaded medical documents (prescriptions, bills, pharmacy receipts, diagnostic reports).
Return ONLY a single JSON object, no prose. Use this exact schema:

{
  "member_name": string | null,
  "treatment_date": "YYYY-MM-DD" | null,
  "hospital": string | null,
  "claim_amount": number | null,
  "documents": {
    "prescription": {
      "doctor_name": string | null,
      "doctor_reg": string | null,
      "diagnosis": string | null,
      "medicines_prescribed": string[],
      "procedures": string[],
      "tests_prescribed": string[],
      "treatment": string | null
    },
    "bill": { "<line_item_label>": <amount number>, ... }
  }
}

Rules:
- The BILL is critical. If the document contains a bill / invoice / receipt with charges, you MUST
  extract EVERY line item into "documents.bill" as { snake_case_label: amount }. The bill object must
  NOT be empty when any charges are visible. Example labels: consultation_fee, root_canal,
  teeth_whitening, mri_scan, medicines, diagnostic_tests, therapy_charges.
- Amounts are plain numbers in INR — strip currency symbols, "Rs.", and commas (e.g. "Rs. 1,000" -> 1000).
- Do NOT put the grand total as a line item. Set "claim_amount" to the bill TOTAL if printed, otherwise
  to the sum of the line items.
- If a value is genuinely not present, use null or omit it. Never invent data.
- doctor_reg should be the registration number exactly as printed (e.g. "KA/45678/2015").`;

/**
 * Extract a structured claim from uploaded document images/PDFs using Gemini's
 * multimodal model. Returns null if the LLM is unavailable or extraction fails.
 */
export async function extractClaimFromDocuments(
  docs: UploadedDocument[],
): Promise<RawClaimInput | null> {
  const client = getClient();
  if (!client || docs.length === 0) return null;

  // Gemini accepts images and PDFs alike as inlineData parts.
  const mediaParts = docs.map((d) => ({
    inlineData: { mimeType: d.media_type || "image/png", data: d.data },
  }));

  let attempt = 0;
  const maxRetries = 3;
  let delayMs = 1500;

  while (attempt <= maxRetries) {
    try {
      const res = await client.models.generateContent({
        model: getModel(),
        contents: [
          {
            role: "user",
            parts: [...mediaParts, { text: "Extract the structured claim JSON from the document(s) above." }],
          },
        ],
        config: {
          systemInstruction: EXTRACTION_SYSTEM,
          maxOutputTokens: 1500,
          responseMimeType: "application/json",
          temperature: 0,
        },
      });
      return parseJsonLoose<RawClaimInput>(res.text ?? "");
    } catch (err: any) {
      const isRetryable = err?.status === 503 || err?.status === 429;
      if (attempt >= maxRetries || !isRetryable) {
        console.error("[extract] LLM extraction failed:", err);
        return null;
      }
      console.warn(`[extract] API unavailable (status ${err?.status}). Retrying in ${delayMs}ms... (Attempt ${attempt + 1}/${maxRetries})`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs *= 2;
      attempt++;
    }
  }
  return null;
}
