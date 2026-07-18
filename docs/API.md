# API Reference

Base URL (local): `http://localhost:3000`

All endpoints return JSON. Errors use the shape `{ "error": string, "detail"?: string }` with an
appropriate HTTP status.

---

## `POST /api/adjudicate`

Adjudicate a single claim.

**Request body** (`RawClaimInput` — the `input_data` shape from `test_cases.json`):

```jsonc
{
  "member_id": "EMP001",                // optional
  "member_name": "Rajesh Kumar",        // optional
  "member_join_date": "2024-09-01",     // optional — enables waiting-period checks
  "treatment_date": "2024-11-01",       // required
  "submission_date": "2024-11-10",      // optional — enables late-submission check
  "claim_amount": 1500,                 // optional — derived from bill if omitted
  "hospital": "Apollo Hospitals",       // optional — enables network discount/cashless
  "cashless_request": true,             // optional
  "previous_claims_same_day": 0,        // optional — fraud signal
  "pre_authorization": false,           // optional — for MRI/CT
  "documents": {
    "prescription": {
      "doctor_name": "Dr. Sharma",
      "doctor_reg": "KA/45678/2015",
      "diagnosis": "Viral fever",
      "medicines_prescribed": ["Paracetamol 650mg"],
      "procedures": [],
      "tests_prescribed": [],
      "treatment": null
    },
    "bill": {                            // map of line_item -> amount (₹)
      "consultation_fee": 1000,
      "diagnostic_tests": 500
    }
  },
  "persist": true                        // optional (default true) — store the claim
}
```

**Response** `200`:

```jsonc
{
  "input":  { /* NormalizedClaim */ },
  "result": {
    "claim_id": "CLM_4F9A2",
    "decision": "APPROVED",              // APPROVED | REJECTED | PARTIAL | MANUAL_REVIEW
    "approved_amount": 1350,
    "rejection_reasons": [],
    "rejected_items": [],
    "deductions": { "copay": 150 },
    "flags": [],
    "confidence_score": 0.95,
    "notes": "Claim approved as per policy terms.",
    "next_steps": "The approved amount will be reimbursed ...",
    "trace": [ { "step": "Documents", "rule": "Prescription present", "passed": true, "detail": "..." } ],
    "policy_basis": ["Approval Conditions", "Limit Validation"],
    "reasoning": "…",                    // present only when the LLM layer is enabled
    "llm_used": false,
    "is_network": false,
    "cashless_approved": null,
    "created_at": "2024-11-10T08:00:00.000Z"
  }
}
```

---

## `POST /api/extract`

Extract a structured claim from uploaded document images/PDFs using Gemini vision.
**Requires `GEMINI_API_KEY`** (returns `503` otherwise).

**Request:** `multipart/form-data` with one or more `files` fields (image/* or application/pdf).

**Response** `200`: `{ "extracted": RawClaimInput }` — review/edit, then send to `/api/adjudicate`.

---

## `GET /api/claims`

List all stored claims (newest first).

**Response** `200`: `{ "claims": ClaimRecord[] }`.

---

## `GET /api/evals`

Run all provided test cases through the deterministic engine and score them.

**Response** `200`:

```jsonc
{
  "total": 10,
  "decision_accuracy": 100,     // %
  "amount_accuracy": 100,
  "reason_accuracy": 100,
  "mean_confidence_delta": 0,
  "overall_pass_rate": 100,
  "cases": [ { "case_id": "TC001", "decision_match": true, "amount_match": true, /* ... */ } ]
}
```
