import { GoogleGenAI } from "@google/genai";

const DEFAULT_MODEL = "gemini-2.5-flash";

let client: GoogleGenAI | null = null;

/** Whether an API key is configured (i.e. the LLM layer is available). */
export function llmAvailable(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function getModel(): string {
  return process.env.GEMINI_MODEL || DEFAULT_MODEL;
}

/** Lazily construct the Gemini client. Returns null if no key is set. */
export function getClient(): GoogleGenAI | null {
  if (!llmAvailable()) return null;
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
  return client;
}

/** Best-effort JSON extraction from a model response (handles ```json fences). */
export function parseJsonLoose<T>(text: string): T | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
