import { getClient, getModel, parseJsonLoose } from "./client";
import type { AdjudicationResult, NormalizedClaim } from "../types";
import type { RetrievedClause } from "../rag/retriever";

export interface ReasoningOutput {
  /** Member-friendly natural-language explanation of the decision. */
  reasoning: string;
  /** LLM's independent confidence in the decision (0-1), used to calibrate. */
  confidence: number;
  /** Optional medical-necessity concern; if set with high severity, the caller
   *  may downgrade an approval to MANUAL_REVIEW. */
  medical_necessity_concern?: string;
}

const SYSTEM = `You are a senior OPD insurance claims adjudicator at Plum.
A deterministic rule engine has already produced a decision. Your job is to:
1. Write a concise, member-friendly explanation (2-4 sentences) of WHY the decision was made, grounded ONLY in the provided policy clauses and claim facts.
2. Assess medical necessity: does the diagnosis justify the prescribed treatment/tests? Flag only clear mismatches.
3. Give your own confidence (0-1) that the decision is correct.

Return ONLY JSON: {"reasoning": string, "confidence": number, "medical_necessity_concern": string | null}
Do not contradict or override the engine's decision; explain it.`;

/**
 * Generate natural-language reasoning + a calibration confidence for a decision
 * using Gemini. Returns null if the LLM is unavailable (caller falls back to
 * the engine's deterministic notes).
 */
export async function generateReasoning(
  claim: NormalizedClaim,
  result: AdjudicationResult,
  clauses: RetrievedClause[],
): Promise<ReasoningOutput | null> {
  const client = getClient();
  if (!client) return null;

  const policyContext = clauses.map((c, i) => `[Clause ${i + 1}] ${c.title}\n${c.text}`).join("\n\n");

  const claimSummary = {
    member: claim.member_name,
    treatment_date: claim.treatment_date,
    diagnosis: claim.prescription?.diagnosis,
    treatment: claim.prescription?.treatment,
    procedures: claim.prescription?.procedures,
    tests: claim.prescription?.tests_prescribed,
    line_items: claim.line_items.map((li) => ({ item: li.description, amount: li.amount, category: li.category })),
    hospital: claim.hospital,
    claim_amount: claim.claim_amount,
  };

  const engineSummary = {
    decision: result.decision,
    approved_amount: result.approved_amount,
    rejection_reasons: result.rejection_reasons,
    rejected_items: result.rejected_items,
    deductions: result.deductions,
    flags: result.flags,
    trace: result.trace.map((t) => `${t.rule}: ${t.passed ? "PASS" : "FAIL"} — ${t.detail}`),
  };

  const prompt = `RELEVANT POLICY CLAUSES (retrieved):\n${policyContext}\n\nCLAIM:\n${JSON.stringify(
    claimSummary,
    null,
    2,
  )}\n\nENGINE DECISION:\n${JSON.stringify(engineSummary, null, 2)}\n\nProduce the JSON.`;

  try {
    const res = await client.models.generateContent({
      model: getModel(),
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction: SYSTEM,
        maxOutputTokens: 600,
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });
    const parsed = parseJsonLoose<ReasoningOutput>(res.text ?? "");
    if (!parsed) return null;
    return {
      reasoning: parsed.reasoning ?? "",
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : result.confidence_score,
      medical_necessity_concern: parsed.medical_necessity_concern || undefined,
    };
  } catch (err) {
    console.error("[reasoning] LLM reasoning failed:", err);
    return null;
  }
}
