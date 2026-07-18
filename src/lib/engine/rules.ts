import type { NormalizedClaim, PolicyTerms, RejectionCode } from "../types";

/** Result of a single rule evaluation. */
export interface RuleOutcome {
  step: string;
  rule: string;
  passed: boolean;
  detail: string;
  /** Rejection code to raise if this rule fails as a hard stop. */
  code?: RejectionCode;
}

const DOCTOR_REG_RE = /^[A-Za-z]{2,6}(\/[A-Za-z]{1,3})?\/\d{3,6}\/\d{4}$/;

/** Whole days between two ISO dates (b - a). */
export function daysBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.round(ms / 86_400_000);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Curated keyword matchers for policy exclusions. The raw exclusion phrases in
 * policy_terms.json don't always appear verbatim in a diagnosis (e.g. "Weight
 * loss treatments" vs a diagnosis of "Obesity / Bariatric"), so each exclusion
 * is mapped to a robust set of clinical synonyms.
 */
const EXCLUSION_MATCHERS: Array<{ exclusion: string; test: RegExp }> = [
  // NOTE: cosmetic procedures are handled as *partial* line-item removals
  // (findRejectableItems), not whole-claim exclusions, so they are intentionally
  // not listed here — a claim with a legitimate diagnosis plus one cosmetic line
  // should be partially approved, not rejected outright.
  { exclusion: "Weight loss treatments", test: /weight.?loss|bariatric|obesit|slimming|diet.?plan/i },
  { exclusion: "Infertility treatments", test: /infertil|ivf|fertility|iui/i },
  { exclusion: "Experimental treatments", test: /experimental|unproven|investigational|trial drug/i },
  { exclusion: "Self-inflicted injuries", test: /self.?inflict|suicide/i },
  { exclusion: "Adventure sports injuries", test: /adventure sport|bungee|skydiv|paraglid/i },
  { exclusion: "HIV/AIDS treatment", test: /\bhiv\b|aids/i },
  { exclusion: "Alcoholism/drug abuse treatment", test: /alcoholis|drug abuse|de.?addiction|rehab/i },
];

/** Diagnosis -> specific-ailment key for waiting-period lookups. */
const AILMENT_MATCHERS: Array<{ key: string; test: RegExp }> = [
  { key: "diabetes", test: /diabet/i },
  { key: "hypertension", test: /hypertens|high blood pressure/i },
  { key: "joint_replacement", test: /joint replacement|knee replacement|hip replacement/i },
];

function claimText(claim: NormalizedClaim): string {
  const rx = claim.prescription;
  return [
    rx?.diagnosis,
    rx?.treatment,
    ...(rx?.procedures ?? []),
    ...(rx?.tests_prescribed ?? []),
    ...claim.line_items.map((li) => li.description),
  ]
    .filter(Boolean)
    .join(" ");
}

// ── Step 1: Eligibility ────────────────────────────────────────────────────

export function checkWaitingPeriod(claim: NormalizedClaim, policy: PolicyTerms): RuleOutcome {
  const step = "Eligibility";
  if (!claim.member_join_date) {
    return { step, rule: "Waiting period", passed: true, detail: "No join date supplied; assumed satisfied." };
  }
  const diagnosis = claim.prescription?.diagnosis ?? "";
  const ailment = AILMENT_MATCHERS.find((a) => a.test.test(diagnosis));
  const waitDays = ailment
    ? policy.waiting_periods.specific_ailments[ailment.key] ?? policy.waiting_periods.initial_waiting
    : policy.waiting_periods.initial_waiting;

  const elapsed = daysBetween(claim.member_join_date, claim.treatment_date);
  if (elapsed < waitDays) {
    const eligibleFrom = addDays(claim.member_join_date, waitDays);
    return {
      step,
      rule: "Waiting period",
      passed: false,
      code: "WAITING_PERIOD",
      detail: `${ailment ? ailment.key : "Initial"} waiting period is ${waitDays} days. Eligible from ${eligibleFrom}.`,
    };
  }
  return { step, rule: "Waiting period", passed: true, detail: `${elapsed} days since join ≥ ${waitDays} day waiting period.` };
}

// ── Step 2: Document validation ────────────────────────────────────────────

export function checkDocuments(claim: NormalizedClaim): RuleOutcome[] {
  const step = "Documents";
  const outcomes: RuleOutcome[] = [];
  const rx = claim.prescription;

  if (!rx || (!rx.diagnosis && !rx.treatment && !rx.doctor_reg)) {
    outcomes.push({
      step,
      rule: "Prescription present",
      passed: false,
      code: "MISSING_DOCUMENTS",
      detail: "Prescription from a registered doctor is required but was not submitted.",
    });
    return outcomes; // no point validating a missing prescription further
  }
  outcomes.push({ step, rule: "Prescription present", passed: true, detail: "Prescription submitted." });

  if (!rx.doctor_reg) {
    outcomes.push({
      step,
      rule: "Doctor registration",
      passed: false,
      code: "DOCTOR_REG_INVALID",
      detail: "Doctor registration number is missing.",
    });
  } else if (!DOCTOR_REG_RE.test(rx.doctor_reg)) {
    outcomes.push({
      step,
      rule: "Doctor registration",
      passed: false,
      code: "DOCTOR_REG_INVALID",
      detail: `Doctor registration "${rx.doctor_reg}" is not in a valid [State]/[Number]/[Year] format.`,
    });
  } else {
    outcomes.push({ step, rule: "Doctor registration", passed: true, detail: `Valid registration ${rx.doctor_reg}.` });
  }

  return outcomes;
}

// ── Step 3: Coverage ───────────────────────────────────────────────────────

export function checkExclusions(claim: NormalizedClaim): RuleOutcome {
  const step = "Coverage";
  const text = claimText(claim);
  const hit = EXCLUSION_MATCHERS.find((m) => m.test.test(text));
  if (hit) {
    return {
      step,
      rule: "Policy exclusions",
      passed: false,
      code: "SERVICE_NOT_COVERED",
      detail: `Matches excluded category "${hit.exclusion}".`,
    };
  }
  return { step, rule: "Policy exclusions", passed: true, detail: "No excluded condition detected." };
}

export function checkPreAuth(claim: NormalizedClaim): RuleOutcome {
  const step = "Coverage";
  const PRE_AUTH_THRESHOLD = 10_000;
  // MRI / CT scans require pre-authorization (policy lists them as "with pre-auth").
  const preAuthLine = claim.line_items.find(
    (li) => /mri|ct.?scan|cat scan/i.test(li.label) || /mri|ct.?scan/i.test(li.description),
  );
  const textNeedsPreAuth = /\bmri\b|ct.?scan/i.test(claimText(claim));

  if (preAuthLine || textNeedsPreAuth) {
    const amount = preAuthLine?.amount ?? claim.claim_amount;
    if (amount > PRE_AUTH_THRESHOLD && !claim.pre_authorization) {
      return {
        step,
        rule: "Pre-authorization",
        passed: false,
        code: "PRE_AUTH_MISSING",
        detail: `MRI/CT scan above ₹${PRE_AUTH_THRESHOLD.toLocaleString("en-IN")} requires pre-authorization, which was not obtained.`,
      };
    }
  }
  return { step, rule: "Pre-authorization", passed: true, detail: "No pre-authorization required or already obtained." };
}

/** Detect cosmetic/excluded line items to strip during partial approval. */
export function findRejectableItems(claim: NormalizedClaim): Array<{ label: string; reason: string }> {
  const rejectable: Array<{ label: string; reason: string }> = [];
  for (const li of claim.line_items) {
    if (/whiten|cosmetic|aesthetic|veneer|bleach/i.test(li.label + " " + li.description)) {
      rejectable.push({ label: li.description, reason: "cosmetic procedure" });
    } else if (/lasik/i.test(li.label + " " + li.description)) {
      rejectable.push({ label: li.description, reason: "LASIK not covered" });
    }
  }
  return rejectable;
}

// ── Step 6: Process ────────────────────────────────────────────────────────

export function checkMinimumAmount(claim: NormalizedClaim, policy: PolicyTerms): RuleOutcome {
  const step = "Process";
  const min = policy.claim_requirements.minimum_claim_amount;
  if (claim.claim_amount < min) {
    return {
      step,
      rule: "Minimum amount",
      passed: false,
      code: "BELOW_MIN_AMOUNT",
      detail: `Claim ₹${claim.claim_amount} is below the ₹${min} minimum.`,
    };
  }
  return { step, rule: "Minimum amount", passed: true, detail: `Claim ₹${claim.claim_amount} ≥ ₹${min} minimum.` };
}

export function checkLateSubmission(claim: NormalizedClaim, policy: PolicyTerms): RuleOutcome {
  const step = "Process";
  const limit = policy.claim_requirements.submission_timeline_days;
  if (!claim.submission_date) {
    return { step, rule: "Submission timeline", passed: true, detail: "No submission date supplied; assumed on time." };
  }
  const gap = daysBetween(claim.treatment_date, claim.submission_date);
  if (gap > limit) {
    return {
      step,
      rule: "Submission timeline",
      passed: false,
      code: "LATE_SUBMISSION",
      detail: `Submitted ${gap} days after treatment, exceeding the ${limit}-day window.`,
    };
  }
  return { step, rule: "Submission timeline", passed: true, detail: `Submitted ${gap} days after treatment (≤ ${limit}).` };
}

// ── Fraud / manual review ──────────────────────────────────────────────────

export function detectFraud(claim: NormalizedClaim): { flags: string[] } {
  const flags: string[] = [];
  if ((claim.previous_claims_same_day ?? 0) >= 2) {
    flags.push("Multiple claims same day");
    flags.push("Unusual pattern detected");
  }
  if (claim.claim_amount > 25_000) {
    flags.push("High-value claim (>₹25,000)");
  }
  return { flags };
}
