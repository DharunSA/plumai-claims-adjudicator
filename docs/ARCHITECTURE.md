# Architecture

## Overview

A single **Next.js 14 (App Router)** application provides both the React UI and the serverless API.
The core principle is a **hybrid engine**: a deterministic rule engine owns every decision, while the
LLM is a bounded assistant (extraction, explanation, calibration, escalation) that can never silently
flip an outcome. This makes the system fast, reproducible, eval-able, and trustworthy.

## Component diagram

```
                        ┌───────────────────────────────────────────────┐
                        │                Browser (React)                 │
                        │  Adjudicate · Claims · Evals · Policy           │
                        └───────────────┬───────────────────────────────┘
                                        │  fetch (JSON / multipart)
              ┌─────────────────────────┼───────────────────────────────┐
              │             Next.js serverless API routes                │
              │  /api/adjudicate   /api/extract   /api/claims  /api/evals │
              └───────┬───────────────┬───────────────┬──────────┬───────┘
                      │               │               │          │
                      ▼               ▼               ▼          ▼
              ┌──────────────┐ ┌─────────────┐ ┌───────────┐ ┌────────────┐
              │  service.ts  │ │ llm/extract │ │ db/store  │ │  evals.ts  │
              │ (orchestrate)│ │ (Gemini     │ │ (JSON     │ │ (score vs  │
              │              │ │  vision)    │ │  store)   │ │  expected) │
              └──────┬───────┘ └─────────────┘ └───────────┘ └────────────┘
                     │
   ┌─────────────────┼───────────────────────────────┐
   ▼                 ▼                ▼                ▼
┌──────────┐  ┌──────────────┐  ┌────────────┐  ┌──────────────┐
│normalize │  │ rag/retriever│  │engine/     │  │ llm/reasoning│
│(raw →     │  │(policy clause│  │adjudicate  │  │(grounded     │
│ canonical)│  │ retrieval)   │  │+ rules +   │  │ explanation, │
│          │  │              │  │ confidence │  │ guardrail)   │
└──────────┘  └──────────────┘  └────────────┘  └──────────────┘
                     ▲                ▲
                     │                │
              ┌──────┴──────┐  ┌──────┴───────┐
              │adjudication_│  │ policy_terms │
              │  rules.md   │  │   .json      │
              └─────────────┘  └──────────────┘
```

## Request flow (`POST /api/adjudicate`)

1. **Normalize** (`lib/normalize.ts`) — raw input (test-case shape or form) → `NormalizedClaim`.
   Bill lines are categorised (consultation / diagnostic / pharmacy / dental / vision / alt-medicine).
2. **Retrieve** (`lib/rag/retriever.ts`) — top-k policy/rule clauses relevant to the claim → "policy basis".
3. **Adjudicate** (`lib/engine/adjudicate.ts`) — deterministic rules in priority order produce the
   decision, approved amount, deductions, confidence, and an audit trail.
4. **Reason + guardrail** (`lib/llm/reasoning.ts`, optional) — Gemini writes a grounded explanation,
   returns a calibration confidence, and may raise a medical-necessity concern that escalates to
   `MANUAL_REVIEW`. A global confidence-threshold guardrail also routes sub-0.70 decisions to review.
5. **Persist** (`lib/db/store.ts`) and return.

## Layered design

| Layer | Files | Responsibility |
|-------|-------|----------------|
| **UI** | `src/app/**`, `src/components/**` | Pages + presentational components. |
| **API** | `src/app/api/**` | Thin HTTP handlers; no business logic. |
| **Service** | `src/lib/service.ts` | Orchestrates normalize → RAG → engine → LLM → store. |
| **Engine** | `src/lib/engine/**` | Pure deterministic decision logic + confidence model. |
| **AI** | `src/lib/llm/**` | Gemini client, vision extraction, reasoning. Fully optional. |
| **Knowledge** | `src/lib/rag/**`, `data/*` | Policy + rules corpus and retrieval. |
| **Storage** | `src/lib/db/**` | Structured claim persistence (swappable). |

## Why a deterministic engine owns the decision

- **Reproducibility & evals** — the same claim always yields the same decision, so the eval harness is meaningful and CI-gateable.
- **Latency** — decisions complete in milliseconds (well under the 5-second test budget) even with no LLM.
- **Auditability & trust** — every rule that fired is recorded in `result.trace`; regulators/claims teams can see exactly why.
- **Safety** — the LLM can only *escalate to human review*, never approve something the rules would reject.

## Scalability notes

- **Stateless API routes** scale horizontally on serverless (Vercel functions).
- **Storage** is the only stateful piece; swap the JSON store for Postgres/Supabase (interface is identical) for durability + concurrency.
- **RAG** uses an in-process corpus; for a large/changing rulebook, move embeddings to a vector DB (pgvector/Pinecone) behind the same `retrieve()` interface.
