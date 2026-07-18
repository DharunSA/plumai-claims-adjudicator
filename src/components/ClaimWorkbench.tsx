"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Database, 
  FileCode, 
  UploadCloud, 
  Play, 
  Loader2, 
  AlertCircle, 
  FileText,
  AlignLeft,
  Terminal,
  Activity
} from "lucide-react";
import DecisionCard from "./DecisionCard";
import type { AdjudicationResult } from "@/lib/types";

export interface SampleCase {
  case_id: string;
  case_name: string;
  description: string;
  input_data: unknown;
}

type Mode = "samples" | "json" | "upload";

const EMPTY_CLAIM = `{
  "member_id": "EMP001",
  "member_name": "Rajesh Kumar",
  "treatment_date": "2024-11-01",
  "claim_amount": 1500,
  "documents": {
    "prescription": {
      "doctor_name": "Dr. Sharma",
      "doctor_reg": "KA/45678/2015",
      "diagnosis": "Viral fever",
      "medicines_prescribed": ["Paracetamol 650mg"]
    },
    "bill": { "consultation_fee": 1000, "diagnostic_tests": 500 }
  }
}`;

export default function ClaimWorkbench({ samples }: { samples: SampleCase[] }) {
  const [mode, setMode] = useState<Mode>("samples");
  const [json, setJson] = useState<string>(EMPTY_CLAIM);
  const [result, setResult] = useState<AdjudicationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCase, setActiveCase] = useState<string | null>(null);

  function loadSample(s: SampleCase) {
    setJson(JSON.stringify(s.input_data, null, 2));
    setActiveCase(s.case_id);
    setResult(null);
    setError(null);
    setMode("json");
  }

  async function adjudicate() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const body = JSON.parse(json);
      const res = await fetch("/api/adjudicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Adjudication failed");
      setResult(data.result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid input");
    } finally {
      setLoading(false);
    }
  }

  function handleFormatJson() {
    try {
      const parsed = JSON.parse(json);
      setJson(JSON.stringify(parsed, null, 2));
      setError(null);
    } catch (e) {
      setError("Cannot format: Invalid JSON structure");
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      Array.from(files).forEach((f) => form.append("files", f));
      const res = await fetch("/api/extract", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Extraction failed");
      setJson(JSON.stringify(data.extracted, null, 2));
      setMode("json");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Extraction failed");
    } finally {
      setLoading(false);
    }
  }

  const tabItems = [
    { id: "samples", label: "Sample cases", icon: Database },
    { id: "json", label: "Claim data", icon: FileCode },
    { id: "upload", label: "Upload docs", icon: UploadCloud },
  ] as const;

  return (
    <div className="grid gap-8 lg:grid-cols-12 items-start">
      {/* Left Input Section (Col span 7) */}
      <div className="lg:col-span-7 space-y-5">
        {/* Segmented Tab Control */}
        <div className="flex p-1 rounded-xl bg-slate-200/60 border border-slate-200/40 relative">
          {tabItems.map((tab) => {
            const Icon = tab.icon;
            const isSelected = mode === tab.id;
            return (
              <motion.button
                key={tab.id}
                onClick={() => setMode(tab.id)}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className={`flex-1 relative flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs sm:text-sm font-semibold transition-all duration-300 z-10 ${
                  isSelected ? "text-plum-700 font-bold" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {isSelected && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-white rounded-lg shadow-sm border border-slate-200/30"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <Icon className={`relative z-10 h-4.5 w-4.5 transition-colors duration-200 ${
                  isSelected ? "text-plum-600" : "text-slate-400"
                }`} />
                <span className="relative z-10">{tab.label}</span>
              </motion.button>
            );
          })}
        </div>

        {/* Dynamic Tab Body */}
        <div className="min-h-[400px]">
          <AnimatePresence mode="wait">
            {mode === "samples" && (
              <motion.div
                key="samples"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
                className="card border-slate-200/50 overflow-hidden divide-y divide-slate-100/80"
              >
                {samples.map((s) => {
                  const isSelected = activeCase === s.case_id;
                  return (
                    <motion.button
                      key={s.case_id}
                      onClick={() => loadSample(s)}
                      whileHover={{ scale: 1.005, x: 2 }}
                      whileTap={{ scale: 0.995 }}
                      className={`flex w-full items-start gap-4 px-5 py-4 text-left transition-all duration-200 hover:bg-slate-50/80 group border-l-4 ${
                        isSelected 
                          ? "border-l-plum-600 bg-plum-50/40" 
                          : "border-l-transparent hover:border-slate-300"
                      }`}
                    >
                      <span className={`mt-0.5 rounded px-2.5 py-1 text-[10px] font-bold font-mono tracking-wider transition ${
                        isSelected 
                          ? "bg-plum-100 text-plum-700" 
                          : "bg-slate-100 text-slate-500 group-hover:bg-slate-200/70"
                      }`}>
                        {s.case_id}
                      </span>
                      <div className="space-y-0.5 flex-1">
                        <span className="block text-sm font-bold text-slate-800 transition group-hover:text-slate-900">
                          {s.case_name}
                        </span>
                        <span className="block text-xs text-slate-500 line-clamp-2 leading-relaxed">
                          {s.description}
                        </span>
                      </div>
                    </motion.button>
                  );
                })}
              </motion.div>
            )}

            {mode === "json" && (
              <motion.div
                key="json"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
                className="space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <Terminal className="h-4 w-4 text-slate-400" />
                    <span>Claim Payload (JSON)</span>
                  </div>
                  <button
                    onClick={handleFormatJson}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-plum-600 hover:text-plum-700 transition"
                  >
                    <AlignLeft className="h-3.5 w-3.5" />
                    Format JSON
                  </button>
                </div>

                <div className="relative rounded-2xl overflow-hidden border border-slate-700/80 bg-slate-900 shadow-lg group">
                  <div className="absolute top-0 left-0 right-0 h-9 bg-slate-950/80 border-b border-slate-800 px-4 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                    </div>
                    <span className="text-[10px] font-semibold text-slate-500 font-mono">
                      adjudication_request.json
                    </span>
                  </div>
                  <textarea
                    value={json}
                    onChange={(e) => setJson(e.target.value)}
                    spellCheck={false}
                    className="w-full h-[360px] pt-12 pb-4 px-5 bg-transparent font-mono text-xs leading-relaxed text-indigo-200/90 focus:outline-none overflow-y-auto scrollbar-thin resize-none"
                    style={{ colorScheme: "dark" }}
                  />
                </div>
              </motion.div>
            )}

            {mode === "upload" && (
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
                className="card p-8 border-dashed border-2 border-slate-300 hover:border-plum-400/80 hover:bg-plum-50/5 text-center transition-all duration-300 relative group"
              >
                <div className="flex flex-col items-center justify-center space-y-4">
                  <motion.div 
                    whileHover={{ scale: 1.05, rotate: 2 }}
                    className="flex h-14 w-14 items-center justify-center rounded-2xl bg-plum-50 text-plum-600 transition-transform duration-300 border border-plum-100/40 cursor-pointer"
                  >
                    <UploadCloud className="h-7 w-7 text-plum-500" />
                  </motion.div>
                  <div className="space-y-1.5 max-w-sm">
                    <p className="text-sm font-bold text-slate-800">
                      Drag and drop medical documents here
                    </p>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Upload prescription or bill images/PDFs. Structured parameters are extracted automatically.
                    </p>
                  </div>

                  <div className="relative pt-2">
                    <motion.label 
                      whileHover={{ scale: 1.02, y: -1 }}
                      whileTap={{ scale: 0.98 }}
                      className="btn border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300 cursor-pointer"
                    >
                      <span>Choose Files</span>
                      <input
                        type="file"
                        multiple
                        accept="image/*,application/pdf"
                        onChange={handleUpload}
                        className="hidden"
                      />
                    </motion.label>
                  </div>

                  <div className="pt-4 border-t border-slate-100 w-full flex items-center justify-center gap-1.5 text-[10px] font-semibold text-slate-400">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>Requires GEMINI_API_KEY. Document extracts route directly to JSON editor.</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Submit Action Block */}
        {mode !== "upload" && (
          <motion.button
            onClick={adjudicate}
            disabled={loading}
            whileHover={{ scale: 1.01, y: -1 }}
            whileTap={{ scale: 0.995 }}
            className="w-full btn-primary h-12 flex items-center justify-center gap-2 group relative overflow-hidden"
          >
            {loading ? (
              <>
                <Loader2 className="h-4.5 w-4.5 animate-spin" />
                <span>Processing Adjudication Rules…</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-current group-hover:scale-110 transition-transform" />
                <span>Adjudicate Claim</span>
              </>
            )}
          </motion.button>
        )}

        {/* Error Messaging banner */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-sm text-rose-700 flex items-start gap-2.5"
          >
            <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
            <span className="font-semibold">{error}</span>
          </motion.div>
        )}
      </div>

      {/* Right Output Section (Col span 5) */}
      <div className="lg:col-span-5 h-full">
        <AnimatePresence mode="wait">
          {result ? (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.25 }}
            >
              <DecisionCard result={result} />
            </motion.div>
          ) : (
            <motion.div
              key="placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="card flex flex-col items-center justify-center p-8 text-center border-dashed border-2 border-slate-200/80 bg-slate-50/50 min-h-[460px] space-y-5 justify-center"
            >
              <div className="relative w-44 h-44 flex items-center justify-center">
                <div className="absolute w-36 h-36 rounded-full bg-gradient-to-tr from-plum-600/10 to-blue-500/5 blur-xl animate-pulse-glow" />
                <img
                  src="/images/images-removebg-preview.png"
                  alt="Claim Pending Verification Illustration"
                  className="relative z-10 w-full h-full object-contain animate-float"
                />
              </div>
              <div className="max-w-xs space-y-1.5">
                <h3 className="text-sm font-bold text-slate-700">Waiting for Adjudication</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Select a test case or upload a claims request, then run the engine. The decision result, coverage calculations, and rule trace will render here.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
