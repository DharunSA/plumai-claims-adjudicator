import type { BillLineItem, CoverageCategory, NormalizedClaim, Prescription } from "./types";

/**
 * Loose shape of incoming claim data. Matches the `input_data` block of the
 * provided test_cases.json as well as the manual-entry form payload. Anything
 * unknown is tolerated and best-effort categorised.
 */
export interface RawClaimInput {
  member_id?: string;
  member_name?: string;
  member_join_date?: string;
  treatment_date?: string;
  submission_date?: string;
  claim_amount?: number;
  hospital?: string;
  cashless_request?: boolean;
  previous_claims_same_day?: number;
  pre_authorization?: boolean;
  documents?: {
    prescription?: Prescription;
    bill?: Record<string, unknown>;
  };
  /** Allow pre-categorised line items to be supplied directly. */
  line_items?: BillLineItem[];
}

const HUMANIZE = (label: string) =>
  label
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

/** Keyword -> category mapping, evaluated in order (first match wins). */
const CATEGORY_RULES: Array<{ test: RegExp; category: CoverageCategory }> = [
  { test: /whiten|cosmetic|veneer|bleach/i, category: "dental" }, // cosmetic dental, flagged later
  { test: /root.?canal|tooth|teeth|dental|filling|extraction|crown|denture|cavit/i, category: "dental" },
  { test: /panchakarma|ayurved|homeopath|unani|therapy|naturopath/i, category: "alternative_medicine" },
  { test: /mri|ct.?scan|x.?ray|ultrasound|ecg|echo|scan|blood|urine|lab|diagnostic|test|pathology|report/i, category: "diagnostic_tests" },
  { test: /glass|lens|spectacle|vision|optical|lasik|eye/i, category: "vision" },
  { test: /medicine|pharmacy|drug|tablet|syrup|capsule|injection/i, category: "pharmacy" },
  { test: /consult|opd|visit|doctor.?fee|registration/i, category: "consultation" },
  { test: /diet|weight|nutrition|bariatric/i, category: "other" },
];

function categorize(label: string): CoverageCategory {
  for (const rule of CATEGORY_RULES) {
    if (rule.test.test(label)) return rule.category;
  }
  return "other";
}

/** Convert a bill record (key -> amount, plus non-amount metadata) to line items. */
function billToLineItems(bill: Record<string, unknown> | undefined): BillLineItem[] {
  if (!bill) return [];
  const items: BillLineItem[] = [];
  for (const [key, value] of Object.entries(bill)) {
    // Skip non-monetary metadata fields like `test_names: [...]`.
    if (typeof value !== "number") continue;
    items.push({
      label: key,
      description: HUMANIZE(key),
      amount: value,
      category: categorize(key),
    });
  }
  return items;
}

/**
 * Normalise raw claim input into the engine's canonical representation.
 * Derives total amount from line items when not explicitly provided.
 */
export function normalizeClaim(raw: RawClaimInput): NormalizedClaim {
  const line_items = raw.line_items?.length
    ? raw.line_items
    : billToLineItems(raw.documents?.bill);

  const derivedTotal = line_items.reduce((s, li) => s + li.amount, 0);

  return {
    member_id: raw.member_id,
    member_name: raw.member_name,
    member_join_date: raw.member_join_date,
    treatment_date: raw.treatment_date ?? "",
    submission_date: raw.submission_date,
    claim_amount: typeof raw.claim_amount === "number" ? raw.claim_amount : derivedTotal,
    hospital: raw.hospital,
    cashless_request: raw.cashless_request,
    previous_claims_same_day: raw.previous_claims_same_day,
    pre_authorization: raw.pre_authorization,
    prescription: raw.documents?.prescription,
    line_items,
  };
}

/**
 * Determine the dominant coverage category for copay / sub-limit selection.
 * Treatment text and an Ayurveda registration number can override the line-item
 * categories (e.g. an alternative-medicine claim that lists a consultation fee).
 */
export function primaryCategory(claim: NormalizedClaim): CoverageCategory {
  const rx = claim.prescription;
  const text = [rx?.diagnosis, rx?.treatment, rx?.doctor_reg, ...(rx?.procedures ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/ayur|panchakarma|homeopath|unani|naturopath/.test(text)) return "alternative_medicine";

  const cats = new Set(claim.line_items.map((li) => li.category));
  if (cats.has("alternative_medicine")) return "alternative_medicine";
  if (cats.has("dental")) return "dental";
  if (cats.has("vision")) return "vision";
  // Otherwise treat as general medical (consultation/diagnostic/pharmacy).
  return "consultation";
}
