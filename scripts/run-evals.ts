/**
 * CLI eval harness: `npm run eval`
 *
 * Runs all provided test cases through the deterministic engine and prints a
 * scoreboard (decision / amount / reason accuracy + confidence delta). Exits
 * non-zero if any case fails — usable as a CI gate.
 */
import { runEvals } from "../src/lib/evals";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

function fmt(b: boolean | null): string {
  if (b === null) return `${DIM}  -  ${RESET}`;
  return b ? `${GREEN} PASS${RESET}` : `${RED} FAIL${RESET}`;
}

async function main() {
  const report = await runEvals();

  console.log(`\n${BOLD}OPD Claim Adjudication — Eval Report${RESET}\n`);
  console.log(
    `${"Case".padEnd(8)}${"Name".padEnd(38)}${"Decision".padEnd(10)}${"Amount".padEnd(8)}${"Reason".padEnd(8)}Δconf`,
  );
  console.log("-".repeat(82));

  for (const c of report.cases) {
    const decision = c.decision_match ? `${GREEN}${c.actual.decision}${RESET}` : `${RED}${c.actual.decision}${RESET}`;
    const conf = c.confidence_delta === null ? "  -" : (c.confidence_delta >= 0 ? "+" : "") + c.confidence_delta;
    console.log(
      `${c.case_id.padEnd(8)}${c.case_name.slice(0, 36).padEnd(38)}${decision.padEnd(19)}${fmt(c.amount_match)}  ${fmt(
        c.reason_match,
      )}  ${conf}`,
    );
  }

  console.log("-".repeat(82));
  console.log(`\n${BOLD}Summary${RESET}`);
  console.log(`  Decision accuracy : ${report.decision_accuracy}%`);
  console.log(`  Amount accuracy   : ${report.amount_accuracy}%`);
  console.log(`  Reason accuracy   : ${report.reason_accuracy}%`);
  console.log(`  Mean |Δconfidence|: ${report.mean_confidence_delta}`);
  console.log(`  ${BOLD}Overall pass rate : ${report.overall_pass_rate}%${RESET}\n`);

  const failed = report.cases.filter((c) => !c.passed);
  if (failed.length > 0) {
    console.log(`${RED}${failed.length} case(s) failed: ${failed.map((c) => c.case_id).join(", ")}${RESET}\n`);
    process.exit(1);
  }
  console.log(`${GREEN}All cases passed.${RESET}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
