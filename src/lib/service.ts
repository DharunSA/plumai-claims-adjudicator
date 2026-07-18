import { adjudicate } from "./engine/adjudicate";
import { normalizeClaim, type RawClaimInput } from "./normalize";
import { getPolicy } from "./policy";
import { claimQuery, retrieve } from "./rag/retriever";
import { llmAvailable } from "./llm/client";
import { generateReasoning } from "./llm/reasoning";
import { ytdForMember } from "./db/store";
import type { AdjudicationResult, NormalizedClaim } from "./types";

/** Generate a claim id like CLM_4F9A2. */
function newClaimId(): string {
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `CLM_${rand}`;
}

export interface AdjudicateRequestOptions {
  claimId?: string;
  /** Skip the LLM reasoning step (used by the deterministic eval harness). */
  skipLlm?: boolean;
  /** Override the member YTD lookup (used in tests). */
  priorYtd?: number;
}

/**
 * End-to-end adjudication: normalize -> retrieve policy basis (RAG) ->
 * deterministic engine -> optional LLM reasoning/guardrail -> result.
 *
 * The deterministic engine owns the decision. The LLM only adds explanation,
 * calibration, and a medical-necessity guardrail that can escalate (never
 * silently approve) a claim to MANUAL_REVIEW.
 */
export async function adjudicateClaim(
  raw: RawClaimInput,
  opts: AdjudicateRequestOptions = {},
): Promise<{ input: NormalizedClaim; result: AdjudicationResult }> {
  const policy = getPolicy();
  const input = normalizeClaim(raw);
  const claimId = opts.claimId ?? newClaimId();

  // RAG: retrieve the policy clauses most relevant to this claim.
  const clauses = retrieve(claimQuery(input), 4);

  const priorYtd = opts.priorYtd ?? ytdForMember(input.member_id, input.treatment_date);

  // Deterministic decision.
  let result = adjudicate(input, policy, { claimId, priorYtd });
  result.policy_basis = clauses.map((c) => c.title);

  // LLM enrichment + guardrail (optional).
  if (!opts.skipLlm && llmAvailable()) {
    const reasoning = await generateReasoning(input, result, clauses);
    if (reasoning) {
      result.reasoning = reasoning.reasoning;
      result.llm_used = true;
      // Calibrate confidence by blending engine + LLM signals.
      result.confidence_score =
        Math.round((result.confidence_score * 0.7 + reasoning.confidence * 0.3) * 100) / 100;

      // Guardrail: a medical-necessity concern escalates an approval to review.
      if (
        reasoning.medical_necessity_concern &&
        (result.decision === "APPROVED" || result.decision === "PARTIAL")
      ) {
        result.flags.push(`Medical necessity: ${reasoning.medical_necessity_concern}`);
        result.decision = "MANUAL_REVIEW";
        result.confidence_score = Math.min(result.confidence_score, 0.7);
        result.next_steps = "Flagged for clinician review of medical necessity before settlement.";
      }
    }
  }

  // Guardrail: any decision below the confidence threshold goes to manual review.
  const CONFIDENCE_THRESHOLD = 0.7;
  if (result.confidence_score < CONFIDENCE_THRESHOLD && result.decision !== "MANUAL_REVIEW") {
    result.flags.push(`Low confidence (${result.confidence_score}) — routed to manual review.`);
    result.decision = "MANUAL_REVIEW";
  }

  return { input, result };
}
