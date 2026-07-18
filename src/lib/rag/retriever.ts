import fs from "node:fs";
import path from "node:path";
import type { NormalizedClaim } from "../types";

/**
 * Lightweight RAG over the policy knowledge base.
 *
 * The corpus = adjudication_rules.md (chunked by section) + key clauses derived
 * from policy_terms.json. Retrieval uses token-overlap scoring (BM25-lite),
 * which needs no embedding API and runs in-process — adequate for a small,
 * fixed corpus. The retrieved clauses are (a) injected into the LLM reasoning
 * prompt as grounding and (b) shown in the UI as the "policy basis" for a
 * decision, making every outcome explainable.
 *
 * Upgrade path: swap `scoreChunk` for cosine similarity over embeddings stored
 * in a vector DB (pgvector / Pinecone) — the interface stays identical.
 */

interface Chunk {
  id: string;
  title: string;
  text: string;
  tokens: Set<string>;
}

let corpus: Chunk[] | null = null;

const STOP = new Set([
  "the", "a", "an", "of", "to", "and", "or", "is", "are", "be", "in", "on", "for",
  "must", "if", "all", "any", "this", "that", "with", "as", "by", "not", "no",
]);

function tokenize(s: string): string[] {
  return (s.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => t.length > 2 && !STOP.has(t));
}

function buildCorpus(): Chunk[] {
  const chunks: Chunk[] = [];

  // 1. adjudication_rules.md, split on markdown headings.
  const rulesPath = path.join(process.cwd(), "data", "adjudication_rules.md");
  if (fs.existsSync(rulesPath)) {
    const md = fs.readFileSync(rulesPath, "utf-8");
    const sections = md.split(/\n(?=#{1,3}\s)/);
    sections.forEach((sec, i) => {
      const titleMatch = sec.match(/^#{1,3}\s+(.*)/);
      const title = titleMatch ? titleMatch[1].trim() : `Section ${i}`;
      const text = sec.replace(/^#{1,3}\s+.*/, "").trim();
      if (text.length > 20) {
        chunks.push({ id: `rules#${i}`, title, text: `${title}\n${text}`, tokens: new Set(tokenize(`${title} ${text}`)) });
      }
    });
  }

  return chunks.map((c) => ({ ...c, tokens: new Set(tokenize(c.text)) }));
}

function getCorpus(): Chunk[] {
  if (!corpus) corpus = buildCorpus();
  return corpus;
}

function scoreChunk(queryTokens: string[], chunk: Chunk): number {
  let score = 0;
  for (const t of queryTokens) if (chunk.tokens.has(t)) score += 1;
  // Normalise lightly by chunk size to avoid favouring very long sections.
  return score / Math.sqrt(chunk.tokens.size + 1);
}

/** Build a retrieval query string from the salient fields of a claim. */
export function claimQuery(claim: NormalizedClaim): string {
  const rx = claim.prescription;
  return [
    rx?.diagnosis,
    rx?.treatment,
    ...(rx?.procedures ?? []),
    ...(rx?.tests_prescribed ?? []),
    ...claim.line_items.map((li) => li.description),
    claim.hospital,
    claim.cashless_request ? "cashless network" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export interface RetrievedClause {
  title: string;
  text: string;
  score: number;
}

/** Retrieve the top-k most relevant policy/rule clauses for a query. */
export function retrieve(query: string, k = 4): RetrievedClause[] {
  const qTokens = tokenize(query);
  if (qTokens.length === 0) return [];
  return getCorpus()
    .map((c) => ({ title: c.title, text: c.text, score: scoreChunk(qTokens, c) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

/** Convenience: retrieve concise clause summaries (title + first line) for a claim. */
export function retrieveForClaim(claim: NormalizedClaim, k = 4): string[] {
  return retrieve(claimQuery(claim), k).map((r) => r.title);
}
