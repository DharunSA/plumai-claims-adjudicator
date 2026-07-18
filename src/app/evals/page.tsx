"use client";

import { useState } from "react";
import { 
  Gauge, 
  CheckCircle2, 
  XCircle, 
  Play, 
  Loader2, 
  TrendingUp, 
  AlertTriangle,
  Beaker,
  Layers
} from "lucide-react";
import type { EvalReport } from "@/lib/evals";

function Metric({ 
  label, 
  value, 
  suffix = "%",
  colorClass,
  borderColor
}: { 
  label: string; 
  value: number; 
  suffix?: string;
  colorClass: string;
  borderColor: string;
}) {
  return (
    <div className={`card border-l-4 ${borderColor} px-5 py-4 bg-white/85 shadow-sm hover:shadow-md transition-all duration-300`}>
      <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`text-3xl font-black tracking-tight mt-1 ${colorClass}`}>
        {value}
        <span className="text-sm font-bold opacity-60 ml-0.5">{suffix}</span>
      </div>
    </div>
  );
}

function Cell({ value }: { value: boolean | null }) {
  if (value === null) return <span className="text-slate-300 font-semibold">—</span>;
  return value ? (
    <span className="inline-flex items-center gap-1 rounded bg-emerald-50 border border-emerald-200/50 px-2 py-0.5 text-xs font-bold text-emerald-700">
      <CheckCircle2 className="h-3 w-3" /> Pass
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded bg-rose-50 border border-rose-200/50 px-2 py-0.5 text-xs font-bold text-rose-700">
      <XCircle className="h-3 w-3" /> Fail
    </span>
  );
}

export default function EvalsPage() {
  const [report, setReport] = useState<EvalReport | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setReport(null);
    setLoading(true);
    try {
      const res = await fetch("/api/evals");
      setReport(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/60 pb-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Gauge className="h-6.5 w-6.5 text-plum-600" />
            Evaluation Harness
          </h1>
          <p className="text-sm text-slate-500 max-w-2xl">
            Score rules engine outputs (decision, coverage amount, RAG justifications) against the target test suite.
          </p>
        </div>
        <div>
          <button 
            onClick={run} 
            disabled={loading} 
            className="btn-primary min-w-[140px] h-11 flex items-center justify-center gap-2 shadow-sm shadow-plum-500/10"
          >
            {loading ? (
              <>
                <Loader2 className="h-4.5 w-4.5 animate-spin" />
                <span>Running Suite…</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-current" />
                <span>Run Evals</span>
              </>
            )}
          </button>
        </div>
      </div>

      {report && (
        <div className="space-y-6 animate-fade-in-up">
          {/* Metrics Dashboard */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Metric 
              label="Decision Accuracy" 
              value={report.decision_accuracy} 
              colorClass="text-plum-700"
              borderColor="border-plum-600"
            />
            <Metric 
              label="Amount Accuracy" 
              value={report.amount_accuracy} 
              colorClass="text-emerald-700"
              borderColor="border-emerald-500"
            />
            <Metric 
              label="Reason Accuracy" 
              value={report.reason_accuracy} 
              colorClass="text-blue-700"
              borderColor="border-blue-500"
            />
            <Metric 
              label="Overall Pass Rate" 
              value={report.overall_pass_rate} 
              colorClass="text-indigo-700"
              borderColor="border-indigo-500"
            />
          </div>

          {/* Test Ledger list */}
          <div className="card overflow-hidden border-slate-200 shadow-sm bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200/50 text-left text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-5 py-3.5">Test Case ID</th>
                    <th className="px-5 py-3.5">Asserted Feature</th>
                    <th className="px-5 py-3.5">Expected Status</th>
                    <th className="px-5 py-3.5">Actual Status</th>
                    <th className="px-5 py-3.5 text-center">Decision Match</th>
                    <th className="px-5 py-3.5 text-center">Amount Match</th>
                    <th className="px-5 py-3.5 text-center">Reason Match</th>
                    <th className="px-5 py-3.5 text-center">Δ Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.cases.map((c) => (
                    <tr 
                      key={c.case_id} 
                      className={`transition-colors hover:bg-slate-50/40 border-l-4 ${
                        c.passed 
                          ? "border-l-transparent" 
                          : "bg-rose-50/40 border-l-rose-500 hover:bg-rose-50/60"
                      }`}
                    >
                      <td className="px-5 py-4 font-mono text-xs font-bold text-slate-500">
                        {c.case_id}
                      </td>
                      <td className="px-5 py-4 font-bold text-slate-700 text-xs">
                        {c.case_name}
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex rounded bg-slate-100 border border-slate-200/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          {c.expected.decision}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex rounded bg-indigo-50 border border-indigo-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-indigo-700">
                          {c.actual.decision}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <Cell value={c.decision_match} />
                      </td>
                      <td className="px-5 py-4 text-center">
                        <Cell value={c.amount_match} />
                      </td>
                      <td className="px-5 py-4 text-center">
                        <Cell value={c.reason_match} />
                      </td>
                      <td className="px-5 py-4 text-center font-mono text-xs text-slate-500 font-semibold">
                        {c.confidence_delta === null ? "—" : c.confidence_delta}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-xs font-semibold text-slate-500 max-w-fit border border-slate-200/50">
            <TrendingUp className="h-4 w-4 text-slate-400" />
            <span>Mean Absolute Confidence Delta vs Expected: <span className="font-extrabold text-slate-800">{report.mean_confidence_delta}</span></span>
          </div>
        </div>
      )}

      {!report && !loading && (
        <div className="card flex flex-col items-center justify-center p-12 border-dashed border-2 border-slate-200 text-center space-y-4 max-w-xl mx-auto py-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 border border-slate-100">
            <Beaker className="h-6 w-6 text-slate-400" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-sm font-bold text-slate-700">Audit Suite Ready</h3>
            <p className="text-xs text-slate-500 leading-relaxed max-w-xs">
              Execute accuracy scores and check confidence deviations against baseline datasets.
            </p>
          </div>
          <button 
            onClick={run} 
            className="btn border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm inline-flex items-center gap-1.5 text-xs"
          >
            <Layers className="h-3.5 w-3.5 text-slate-400" />
            Trigger Test Suite
          </button>
        </div>
      )}
    </div>
  );
}
