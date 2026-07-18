/**
 * Shared domain types for the OPD claim adjudication system.
 *
 * The `NormalizedClaim` is the single internal representation that BOTH input
 * paths converge to:
 *   1. Structured JSON (test cases / manual form)  -> used directly
 *   2. Uploaded document images/PDFs               -> Gemini vision -> NormalizedClaim
 *
 * The rule engine only ever sees a NormalizedClaim, which keeps the decision
 * logic deterministic, fast, and testable independent of the LLM layer.
 */

/** A single charge line on a bill, after categorisation. */
export interface BillLineItem {
  /** Raw label as it appeared on the bill, e.g. "teeth_whitening". */
  label: string;
  /** Human label, e.g. "Teeth whitening". */
  description: string;
  amount: number;
  /** Which policy coverage bucket this line maps to. */
  category: CoverageCategory;
}

export type CoverageCategory =
  | "consultation"
  | "diagnostic_tests"
  | "pharmacy"
  | "dental"
  | "vision"
  | "alternative_medicine"
  | "other";

export interface Prescription {
  doctor_name?: string;
  doctor_reg?: string;
  diagnosis?: string;
  medicines_prescribed?: string[];
  procedures?: string[];
  tests_prescribed?: string[];
  treatment?: string;
}

/** The canonical claim representation consumed by the rule engine. */
export interface NormalizedClaim {
  member_id?: string;
  member_name?: string;
  /** ISO date the member joined the policy (for waiting-period checks). */
  member_join_date?: string;
  /** ISO date of treatment. */
  treatment_date: string;
  /** ISO date the claim was submitted (optional; used for late-submission). */
  submission_date?: string;
  /** Total amount claimed (₹). */
  claim_amount: number;
  /** Provider/hospital name, used for network detection. */
  hospital?: string;
  cashless_request?: boolean;
  /** Number of other claims by this member on the same day (fraud signal). */
  previous_claims_same_day?: number;
  /** Whether pre-authorization was obtained (for MRI/CT etc.). */
  pre_authorization?: boolean;

  prescription?: Prescription;
  /** Categorised bill lines. */
  line_items: BillLineItem[];
}

export type Decision = "APPROVED" | "REJECTED" | "PARTIAL" | "MANUAL_REVIEW";

/** A single fired rule, kept for an auditable decision trail. */
export interface RuleTrace {
  step: string;
  rule: string;
  passed: boolean;
  detail: string;
}

export interface DeductionBreakdown {
  copay?: number;
  network_discount?: number;
  over_limit?: number;
}

/**
 * Final adjudication result. Mirrors the output format required by
 * adjudication_rules.md, with extra fields for auditability and UX.
 */
export interface AdjudicationResult {
  claim_id: string;
  decision: Decision;
  approved_amount: number;
  rejection_reasons: RejectionCode[];
  rejected_items: string[];
  deductions: DeductionBreakdown;
  flags: string[];
  confidence_score: number;
  notes: string;
  next_steps: string;
  /** Full ordered audit trail of every rule evaluated. */
  trace: RuleTrace[];
  /** Policy clauses retrieved as the basis for this decision (RAG). */
  policy_basis: string[];
  /** Natural-language reasoning (LLM-generated when available). */
  reasoning?: string;
  /** Whether the LLM layer was used for this decision. */
  llm_used: boolean;
  is_network: boolean;
  cashless_approved?: boolean;
  created_at: string;
}

export type RejectionCode =
  // Eligibility
  | "POLICY_INACTIVE"
  | "WAITING_PERIOD"
  | "MEMBER_NOT_COVERED"
  // Documentation
  | "MISSING_DOCUMENTS"
  | "ILLEGIBLE_DOCUMENTS"
  | "INVALID_PRESCRIPTION"
  | "DOCTOR_REG_INVALID"
  | "DATE_MISMATCH"
  | "PATIENT_MISMATCH"
  // Coverage
  | "SERVICE_NOT_COVERED"
  | "EXCLUDED_CONDITION"
  | "PRE_AUTH_MISSING"
  // Limits
  | "ANNUAL_LIMIT_EXCEEDED"
  | "SUB_LIMIT_EXCEEDED"
  | "PER_CLAIM_EXCEEDED"
  // Medical
  | "NOT_MEDICALLY_NECESSARY"
  | "EXPERIMENTAL_TREATMENT"
  | "COSMETIC_PROCEDURE"
  // Process
  | "LATE_SUBMISSION"
  | "DUPLICATE_CLAIM"
  | "BELOW_MIN_AMOUNT";

/** Stored claim record (claim input + result). */
export interface ClaimRecord {
  id: string;
  input: NormalizedClaim;
  result: AdjudicationResult;
  created_at: string;
}

/** Shape of policy_terms.json (subset we rely on, typed for safety). */
export interface PolicyTerms {
  policy_id: string;
  policy_name: string;
  effective_date: string;
  coverage_details: {
    annual_limit: number;
    per_claim_limit: number;
    family_floater_limit: number;
    consultation_fees: { covered: boolean; sub_limit: number; copay_percentage: number; network_discount: number };
    diagnostic_tests: { covered: boolean; sub_limit: number; pre_authorization_required: boolean; covered_tests: string[] };
    pharmacy: { covered: boolean; sub_limit: number; generic_drugs_mandatory: boolean; branded_drugs_copay: number };
    dental: { covered: boolean; sub_limit: number; routine_checkup_limit: number; procedures_covered: string[]; cosmetic_procedures: boolean };
    vision: { covered: boolean; sub_limit: number; eye_test_covered: boolean; glasses_contact_lenses: boolean; lasik_surgery: boolean };
    alternative_medicine: { covered: boolean; sub_limit: number; covered_treatments: string[]; therapy_sessions_limit: number };
  };
  waiting_periods: {
    initial_waiting: number;
    pre_existing_diseases: number;
    maternity: number;
    specific_ailments: Record<string, number>;
  };
  exclusions: string[];
  claim_requirements: {
    documents_required: string[];
    submission_timeline_days: number;
    minimum_claim_amount: number;
  };
  network_hospitals: string[];
  cashless_facilities: {
    available: boolean;
    network_only: boolean;
    pre_approval_required: boolean;
    instant_approval_limit: number;
  };
}
