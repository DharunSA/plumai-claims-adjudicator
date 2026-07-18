import type {
  AdjudicationResult,
  DeductionBreakdown,
  NormalizedClaim,
  PolicyTerms,
  RejectionCode,
  RuleTrace,
} from "../types";
import { primaryCategory } from "../normalize";
import { confidenceFor } from "./confidence";
import {
  checkDocuments,
  checkExclusions,
  checkLateSubmission,
  checkMinimumAmount,
  checkPreAuth,
  checkWaitingPeriod,
  detectFraud,
  findRejectableItems,
  type RuleOutcome,
} from "./rules";

export interface AdjudicateOptions {
  claimId: string;
  /** Amount already claimed by this member in the policy year (for annual limit). */
  priorYtd?: number;
  /** Pre-computed natural-language reasoning + confidence from the LLM layer. */
  reasoning?: string;
  llmConfidence?: number;
  llmUsed?: boolean;
}

function toTrace(o: RuleOutcome): RuleTrace {
  return { step: o.step, rule: o.rule, passed: o.passed, detail: o.detail };
}

function isNetworkProvider(claim: NormalizedClaim, policy: PolicyTerms): boolean {
  if (!claim.hospital) return false;
  return policy.network_hospitals.some((h) => claim.hospital!.toLowerCase().includes(h.toLowerCase()));
}

const SUB_LIMIT_KEY: Record<string, keyof PolicyTerms["coverage_details"] | null> = {
  consultation: "consultation_fees",
  diagnostic_tests: "diagnostic_tests",
  pharmacy: "pharmacy",
  dental: "dental",
  vision: "vision",
  alternative_medicine: "alternative_medicine",
  other: null,
};

/**
 * Core deterministic adjudication. Pure function of (claim, policy, options).
 * Evaluates rules in priority order and returns a complete, auditable result.
 *
 * The LLM layer (if used) only supplies `reasoning`/`llmConfidence`; it never
 * changes the decision — keeping adjudication reproducible and eval-able.
 */
export function adjudicate(
  claim: NormalizedClaim,
  policy: PolicyTerms,
  opts: AdjudicateOptions,
): AdjudicationResult {
  const trace: RuleTrace[] = [];
  const category = primaryCategory(claim);
  const isNetwork = isNetworkProvider(claim, policy);
  const nowIso = new Date().toISOString();

  const base = (overrides: Partial<AdjudicationResult>): AdjudicationResult => ({
    claim_id: opts.claimId,
    decision: "REJECTED",
    approved_amount: 0,
    rejection_reasons: [],
    rejected_items: [],
    deductions: {},
    flags: [],
    confidence_score: 0.9,
    notes: "",
    next_steps: "",
    trace,
    policy_basis: [],
    reasoning: opts.reasoning,
    llm_used: Boolean(opts.llmUsed),
    is_network: isNetwork,
    created_at: nowIso,
    ...overrides,
  });

  const reject = (code: RejectionCode, detail: string): AdjudicationResult =>
    base({
      decision: "REJECTED",
      rejection_reasons: [code],
      confidence_score: confidenceFor({ decision: "REJECTED", primaryReason: code }),
      notes: detail,
      next_steps:
        "Review the rejection reason. You may correct and resubmit, or request a manual review/appeal if you believe this is an error.",
    });

  // ── Safety first: fraud / manual-review overlay ──────────────────────────
  const fraud = detectFraud(claim);
  if (fraud.flags.length > 0) {
    trace.push({ step: "Fraud", rule: "Anomaly detection", passed: false, detail: fraud.flags.join("; ") });
    return base({
      decision: "MANUAL_REVIEW",
      flags: fraud.flags,
      confidence_score: confidenceFor({ decision: "MANUAL_REVIEW" }),
      notes: "Claim flagged for human review due to anomaly indicators.",
      next_steps: "A claims specialist will manually review this claim. No action needed from the member yet.",
    });
  }
  trace.push({ step: "Fraud", rule: "Anomaly detection", passed: true, detail: "No fraud indicators detected." });

  // ── Step 2: Documents ────────────────────────────────────────────────────
  const docOutcomes = checkDocuments(claim);
  docOutcomes.forEach((o) => trace.push(toTrace(o)));
  const docFail = docOutcomes.find((o) => !o.passed);
  if (docFail?.code) return reject(docFail.code, docFail.detail);

  // ── Step 1: Eligibility (waiting period) ─────────────────────────────────
  const waiting = checkWaitingPeriod(claim, policy);
  trace.push(toTrace(waiting));
  if (!waiting.passed && waiting.code) return reject(waiting.code, waiting.detail);

  // ── Step 6: Process (min amount, late submission) ────────────────────────
  const minAmt = checkMinimumAmount(claim, policy);
  trace.push(toTrace(minAmt));
  if (!minAmt.passed && minAmt.code) return reject(minAmt.code, minAmt.detail);

  const late = checkLateSubmission(claim, policy);
  trace.push(toTrace(late));
  if (!late.passed && late.code) return reject(late.code, late.detail);

  // ── Step 3: Coverage (exclusions, pre-auth) ──────────────────────────────
  const excl = checkExclusions(claim);
  trace.push(toTrace(excl));
  if (!excl.passed && excl.code) return reject(excl.code, excl.detail);

  const preAuth = checkPreAuth(claim);
  trace.push(toTrace(preAuth));
  if (!preAuth.passed && preAuth.code) return reject(preAuth.code, preAuth.detail);

  // ── Identify cosmetic/excluded line items (drives partial approval) ───────
  const rejectable = findRejectableItems(claim);
  const rejectedLabels = new Set(rejectable.map((r) => r.label));
  const coveredItems = claim.line_items.filter((li) => !rejectedLabels.has(li.description));
  let coveredTotal = coveredItems.reduce((s, li) => s + li.amount, 0);
  const rejectedItems = rejectable.map((r) => `${r.label} - ${r.reason}`);
  if (rejectable.length) {
    trace.push({
      step: "Coverage",
      rule: "Cosmetic/excluded items",
      passed: false,
      detail: `Removed: ${rejectedItems.join(", ")}.`,
    });
    // If nothing payable remains, the whole claim is cosmetic/excluded — reject.
    if (coveredTotal === 0) {
      return reject("COSMETIC_PROCEDURE", `All claimed items are non-payable: ${rejectedItems.join(", ")}.`);
    }
  }

  // ── Step 4: Limits ───────────────────────────────────────────────────────
  // Per-claim limit. Dental is governed by its sub-limit instead (see ASSUMPTIONS).
  if (category !== "dental" && claim.claim_amount > policy.coverage_details.per_claim_limit) {
    trace.push({
      step: "Limits",
      rule: "Per-claim limit",
      passed: false,
      detail: `Claim ₹${claim.claim_amount} exceeds per-claim limit ₹${policy.coverage_details.per_claim_limit}.`,
    });
    return reject(
      "PER_CLAIM_EXCEEDED",
      `Claim amount exceeds per-claim limit of ₹${policy.coverage_details.per_claim_limit}`,
    );
  }
  trace.push({ step: "Limits", rule: "Per-claim limit", passed: true, detail: "Within per-claim limit." });

  // Category sub-limits: each category's spend is capped against ITS OWN
  // sub-limit (consultation spend vs consultation limit, pharmacy vs pharmacy,
  // etc.) — not the primary category's limit applied to the whole claim. Excess
  // in any category is approved up to the limit (partial) rather than rejected.
  let overLimit = 0;
  const spendByCategory = coveredItems.reduce<Record<string, number>>((acc, li) => {
    acc[li.category] = (acc[li.category] ?? 0) + li.amount;
    return acc;
  }, {});
  for (const [cat, spend] of Object.entries(spendByCategory)) {
    const subKey = SUB_LIMIT_KEY[cat];
    if (!subKey) continue;
    const subLimit = (policy.coverage_details[subKey] as { sub_limit: number }).sub_limit;
    if (spend > subLimit) {
      const excess = spend - subLimit;
      overLimit += excess;
      coveredTotal -= excess;
      rejectedItems.push(`Amount above ${cat.replace(/_/g, " ")} sub-limit of ₹${subLimit}`);
      trace.push({
        step: "Limits",
        rule: `Sub-limit (${cat.replace(/_/g, " ")})`,
        passed: false,
        detail: `${cat.replace(/_/g, " ")} spend ₹${spend} capped at ₹${subLimit} (₹${excess} above sub-limit).`,
      });
    }
  }
  if (overLimit === 0) {
    trace.push({ step: "Limits", rule: "Sub-limits", passed: true, detail: "All categories within sub-limits." });
  }

  // Annual limit (uses YTD if supplied).
  const ytd = opts.priorYtd ?? 0;
  if (ytd + coveredTotal > policy.coverage_details.annual_limit) {
    const remaining = Math.max(0, policy.coverage_details.annual_limit - ytd);
    if (remaining <= 0) {
      trace.push({ step: "Limits", rule: "Annual limit", passed: false, detail: "Annual limit exhausted." });
      return reject("ANNUAL_LIMIT_EXCEEDED", "Annual limit has been exhausted for this member.");
    }
    overLimit += coveredTotal - remaining;
    coveredTotal = remaining;
    rejectedItems.push(`Amount above remaining annual limit (₹${remaining})`);
    trace.push({ step: "Limits", rule: "Annual limit", passed: false, detail: `Capped at remaining annual limit ₹${remaining}.` });
  } else {
    trace.push({ step: "Limits", rule: "Annual limit", passed: true, detail: "Within annual limit." });
  }

  // ── Amount computation: network discount vs co-pay ───────────────────────
  const deductions: DeductionBreakdown = {};
  if (overLimit > 0) deductions.over_limit = overLimit;
  let approved = coveredTotal;

  if (isNetwork) {
    const rate = policy.coverage_details.consultation_fees.network_discount; // 20%
    const discount = Math.round((coveredTotal * rate) / 100);
    deductions.network_discount = discount;
    approved = coveredTotal - discount;
    trace.push({ step: "Settlement", rule: "Network discount", passed: true, detail: `${rate}% network discount = ₹${discount}.` });
  } else {
    // Dental and alternative medicine are exempt from the consultation co-pay.
    const copayExempt = category === "dental" || category === "alternative_medicine" || category === "vision";
    if (!copayExempt) {
      const rate = policy.coverage_details.consultation_fees.copay_percentage; // 10%
      const copay = Math.round((coveredTotal * rate) / 100);
      deductions.copay = copay;
      approved = coveredTotal - copay;
      trace.push({ step: "Settlement", rule: "Co-payment", passed: true, detail: `${rate}% co-pay = ₹${copay}.` });
    } else {
      trace.push({ step: "Settlement", rule: "Co-payment", passed: true, detail: `No co-pay for ${category.replace(/_/g, " ")}.` });
    }
  }

  // ── Cashless (network only, within instant-approval limit) ───────────────
  let cashlessApproved: boolean | undefined;
  if (claim.cashless_request) {
    cashlessApproved =
      isNetwork && coveredTotal <= policy.cashless_facilities.instant_approval_limit;
    trace.push({
      step: "Settlement",
      rule: "Cashless",
      passed: Boolean(cashlessApproved),
      detail: cashlessApproved
        ? "Cashless approved at network provider within instant-approval limit."
        : "Cashless not available (non-network or above instant-approval limit).",
    });
  }

  const isPartial = rejectedItems.length > 0;
  const decision = isPartial ? "PARTIAL" : "APPROVED";

  const notesParts: string[] = [];
  if (category === "alternative_medicine") notesParts.push("Alternative medicine covered under policy.");
  if (isNetwork) notesParts.push("Network provider — network discount applied.");
  if (isPartial) notesParts.push(`Partially approved: ${rejectedItems.join("; ")}.`);

  return base({
    decision,
    approved_amount: approved,
    rejected_items: rejectedItems,
    deductions,
    confidence_score: confidenceFor({ decision, category, isNetwork }),
    cashless_approved: cashlessApproved,
    notes: notesParts.join(" ") || "Claim approved as per policy terms.",
    next_steps: isPartial
      ? "The approved amount will be reimbursed. Rejected items are not payable under the policy."
      : "The approved amount will be reimbursed to the member's registered account.",
  });
}
