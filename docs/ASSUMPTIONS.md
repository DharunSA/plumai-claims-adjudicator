# Assumptions

Documented per the assignment's instruction to "make reasonable assumptions and document them."
These were derived by reverse-engineering the expected outputs in `test_cases.json` and reading
`adjudication_rules.md` + `policy_terms.json`.

## Settlement / money

1. **Co-pay base.** The 10% consultation co-pay is applied to the **total covered amount** of a
   general medical claim (consultation + diagnostic + pharmacy), not just the consultation line.
   *Basis:* TC001 — ₹1,500 claim → ₹1,350 approved (₹150 = 10% of ₹1,500).
2. **Co-pay exemptions.** **Dental, alternative-medicine, and vision** claims are exempt from the
   consultation co-pay. *Basis:* TC006 (Ayurveda) and TC002 (dental) approve with no co-pay deduction.
3. **Network discount replaces co-pay.** At a network hospital, a 20% network discount is applied
   instead of the co-pay. *Basis:* TC010 — ₹4,500 → ₹3,600 (₹900 = 20%).
4. **Cashless** is available only at a **network** provider when the covered total is within the
   ₹5,000 instant-approval limit. *Basis:* `policy_terms.json → cashless_facilities`.

## Limits

5. **Dental is governed by its sub-limit, not the global per-claim limit.** The global per-claim
   limit is ₹5,000, but dental procedures (e.g. root canal) routinely exceed that and the policy
   provides a ₹10,000 dental sub-limit. So per-claim is enforced for non-dental claims; dental is
   capped by its sub-limit. *Basis:* this is the only interpretation that satisfies **both** TC002
   (dental ₹8,000 → approved) **and** TC003 (general ₹7,500 → `PER_CLAIM_EXCEEDED`). This resolves an
   internal inconsistency in the provided dataset.
6. **Sub-limits are per category.** Each category's spend is checked against its own sub-limit
   (consultation spend vs the consultation limit, pharmacy vs pharmacy, …) — not the dominant
   category's limit applied to the whole bill. *Basis:* TC010 mixes consultation (₹1,500) + pharmacy
   (₹3,000); applying the ₹2,000 consultation sub-limit to the whole ₹4,500 would be wrong.
7. **Sub-limit / annual-limit overflow → partial approval** (approve up to the limit), per the
   "Partial Approval" special scenario, rather than a hard rejection. The **per-claim** limit, by
   contrast, is a hard reject (matches TC003).

## Coverage

8. **Cosmetic items are partial line-item removals, not whole-claim exclusions.** A claim with a
   legitimate diagnosis plus one cosmetic line (e.g. root canal + teeth whitening) is **partially**
   approved. A claim that is *entirely* cosmetic is rejected (`COSMETIC_PROCEDURE`). *Basis:* TC002.
9. **Exclusion matching uses clinical synonyms.** Policy exclusion phrases don't always appear
   verbatim in a diagnosis, so each exclusion maps to a synonym set (e.g. "Weight loss treatments"
   matches *obesity / bariatric / diet plan*). *Basis:* TC009.
10. **Pre-authorization** is required for **MRI/CT scans above ₹10,000**. *Basis:* TC007 note
    ("MRI requires pre-authorization for claims above ₹10000").

## Eligibility / process

11. **Waiting periods** are checked only when `member_join_date` is supplied. Specific ailments
    (diabetes/hypertension = 90 days, joint replacement = 730) take precedence over the 30-day initial
    period; otherwise the initial period applies. *Basis:* TC005.
12. **Late submission is skipped unless `submission_date` is provided.** The test cases have 2024
    treatment dates; using the real "today" would mark every historical case late. So the 30-day
    window is only enforced when an explicit submission date is present.
13. **Doctor registration** is accepted in `[State]/[Number]/[Year]` format, including the 4-segment
    Ayurveda form (e.g. `AYUR/KL/2345/2019`). All provided test registrations are treated as valid.
14. **Member verification** (`MEMBER_NOT_COVERED`) is not enforced — there is no member roster in the
    provided data, so any `member_id` is assumed covered.

## Fraud / review

15. **Fraud → manual review (not rejection).** Anomaly signals (≥2 claims same day, or amount >
    ₹25,000) route to `MANUAL_REVIEW` with confidence 0.65. *Basis:* TC008 + the rules' "safety first"
    priority.
16. **Confidence guardrail.** Any decision with confidence < 0.70 is auto-routed to manual review.

## AI / LLM

17. **The LLM never changes a decision's polarity.** It only adds explanation, calibrates confidence
    (30% weight), and may *escalate* an approval to manual review on a medical-necessity concern. This
    keeps decisions reproducible and eval-able.
18. **The system runs without an API key.** All deterministic logic (and therefore the full eval
    suite) works offline; the LLM layer is additive.

## Infrastructure

19. **Storage is a JSON file** for zero-setup local persistence. On ephemeral serverless filesystems
    (Vercel) it resets on cold start; production should use Postgres/Supabase (the `store.ts` interface
    is drop-in swappable).
20. **RAG is in-process token-overlap retrieval** over the rules corpus — sufficient for a small fixed
    rulebook and dependency-free. For a large/changing rulebook, move to embeddings + a vector DB
    behind the same `retrieve()` interface.
