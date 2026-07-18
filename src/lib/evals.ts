import fs from "node:fs";
import path from "node:path";
import { adjudicateClaim } from "./service";
import type { RawClaimInput } from "./normalize";
import type { AdjudicationResult, Decision } from "./types";

interface ExpectedOutput {
  decision: Decision;
  approved_amount?: number;
  rejection_reasons?: string[];
  rejected_items?: string[];
  confidence_score?: number;
  flags?: string[];
  network_discount?: number;
  cashless_approved?: boolean;
  deductions?: { copay?: number };
}

interface TestCase {
  case_id: string;
  case_name: string;
  description: string;
  input_data: RawClaimInput;
  expected_output: ExpectedOutput;
}

export interface CaseResult {
  case_id: string;
  case_name: string;
  expected: ExpectedOutput;
  actual: AdjudicationResult;
  decision_match: boolean;
  amount_match: boolean | null; // null when expected amount not specified
  reason_match: boolean | null; // null when no expected reason
  confidence_delta: number | null;
  passed: boolean;
}

export interface EvalReport {
  total: number;
  decision_accuracy: number;
  amount_accuracy: number;
  reason_accuracy: number;
  mean_confidence_delta: number;
  overall_pass_rate: number;
  cases: CaseResult[];
}

const AMOUNT_TOLERANCE = 1; // ₹ rounding tolerance

export function loadTestCases(): TestCase[] {
  const file = path.join(process.cwd(), "data", "test_cases.json");
  const parsed = JSON.parse(fs.readFileSync(file, "utf-8")) as { test_cases: TestCase[] };
  return parsed.test_cases;
}

function approvedAmountMatches(expected: ExpectedOutput, actual: AdjudicationResult): boolean | null {
  if (typeof expected.approved_amount !== "number") return null;
  return Math.abs(expected.approved_amount - actual.approved_amount) <= AMOUNT_TOLERANCE;
}

function reasonMatches(expected: ExpectedOutput, actual: AdjudicationResult): boolean | null {
  if (!expected.rejection_reasons || expected.rejection_reasons.length === 0) return null;
  return expected.rejection_reasons.every((r) => actual.rejection_reasons.includes(r as any));
}

/** Run every provided test case through the deterministic engine and score it. */
export async function runEvals(): Promise<EvalReport> {
  const cases = loadTestCases();
  const results: CaseResult[] = [];

  for (const tc of cases) {
    // skipLlm + priorYtd:0 => fully deterministic, reproducible scoring.
    const { result } = await adjudicateClaim(tc.input_data, {
      claimId: tc.case_id,
      skipLlm: true,
      priorYtd: 0,
    });

    const decision_match = result.decision === tc.expected_output.decision;
    const amount_match = approvedAmountMatches(tc.expected_output, result);
    const reason_match = reasonMatches(tc.expected_output, result);
    const confidence_delta =
      typeof tc.expected_output.confidence_score === "number"
        ? Math.round((result.confidence_score - tc.expected_output.confidence_score) * 100) / 100
        : null;

    // A case "passes" if the decision matches AND (amount matches or isn't specified)
    // AND (reason matches or isn't specified).
    const passed = decision_match && amount_match !== false && reason_match !== false;

    results.push({
      case_id: tc.case_id,
      case_name: tc.case_name,
      expected: tc.expected_output,
      actual: result,
      decision_match,
      amount_match,
      reason_match,
      confidence_delta,
      passed,
    });
  }

  const pct = (n: number, d: number) => (d === 0 ? 1 : Math.round((n / d) * 1000) / 10);
  const amountScored = results.filter((r) => r.amount_match !== null);
  const reasonScored = results.filter((r) => r.reason_match !== null);
  const confScored = results.filter((r) => r.confidence_delta !== null);

  return {
    total: results.length,
    decision_accuracy: pct(results.filter((r) => r.decision_match).length, results.length),
    amount_accuracy: pct(amountScored.filter((r) => r.amount_match).length, amountScored.length),
    reason_accuracy: pct(reasonScored.filter((r) => r.reason_match).length, reasonScored.length),
    mean_confidence_delta:
      confScored.length === 0
        ? 0
        : Math.round(
            (confScored.reduce((s, r) => s + Math.abs(r.confidence_delta!), 0) / confScored.length) * 1000,
          ) / 1000,
    overall_pass_rate: pct(results.filter((r) => r.passed).length, results.length),
    cases: results,
  };
}
