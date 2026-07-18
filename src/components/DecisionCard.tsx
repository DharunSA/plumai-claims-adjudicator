"use client";

import type { AdjudicationResult } from "@/lib/types";
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Search, 
  Sparkles,
  ChevronDown,
  Info,
  DollarSign,
  Activity,
  FileCheck
} from "lucide-react";
import { useState } from "react";

const DECISION_STYLES: Record<
  string, 
  { 
    bg: string; 
    border: string;
    text: string; 
    iconBg: string;
    iconColor: string;
    gradient: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  APPROVED: { 
    bg: "bg-emerald-50/70", 
    border: "border-emerald-200/60",
    text: "text-emerald-800", 
    iconBg: "bg-emerald-500",
    iconColor: "text-white",
    gradient: "from-emerald-500 to-teal-600",
    icon: CheckCircle2 
  },
  PARTIAL: { 
    bg: "bg-amber-50/70", 
    border: "border-amber-200/60",
    text: "text-amber-800", 
    iconBg: "bg-amber-500",
    iconColor: "text-white",
    gradient: "from-amber-500 to-orange-600",
    icon: AlertTriangle 
  },
  REJECTED: { 
    bg: "bg-rose-50/70", 
    border: "border-rose-200/60",
    text: "text-rose-800", 
    iconBg: "bg-rose-500",
    iconColor: "text-white",
    gradient: "from-rose-500 to-red-600",
    icon: XCircle 
  },
  MANUAL_REVIEW: { 
    bg: "bg-blue-50/70", 
    border: "border-blue-200/60",
    text: "text-blue-800", 
    iconBg: "bg-blue-500",
    iconColor: "text-white",
    gradient: "from-blue-500 to-indigo-600",
    icon: Search 
  },
};

const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const isHigh = value >= 0.85;
  const isMed = value >= 0.7;
  
  const colorClass = isHigh 
    ? "bg-gradient-to-r from-emerald-400 to-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]" 
    : isMed 
      ? "bg-gradient-to-r from-amber-400 to-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]" 
      : "bg-gradient-to-r from-rose-400 to-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]";

  return (
    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/40">
      <div className="mb-2 flex justify-between items-center text-xs font-bold text-slate-500">
        <span className="flex items-center gap-1.5 uppercase tracking-wider">
          <Activity className="h-3.5 w-3.5 text-slate-400" />
          Adjudication Confidence
        </span>
        <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${
          isHigh ? "text-emerald-700 bg-emerald-100/60" : isMed ? "text-amber-700 bg-amber-100/60" : "text-rose-700 bg-rose-100/60"
        }`}>
          {pct}%
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200/70">
        <div className={`h-full rounded-full transition-all duration-500 ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function DecisionCard({ result }: { result: AdjudicationResult }) {
  const style = DECISION_STYLES[result.decision] ?? DECISION_STYLES.REJECTED;
  const StatusIcon = style.icon;
  const [auditOpen, setAuditOpen] = useState(false);

  return (
    <div className="card overflow-hidden border-slate-200 shadow-md">
      {/* Header Banner */}
      <div className={`px-6 py-5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${style.bg} ${style.border}`}>
        <div className="flex items-center gap-3.5">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${style.gradient} ${style.iconColor} shadow-md`}>
            <StatusIcon className="h-5.5 w-5.5" />
          </div>
          <div>
            <div className={`text-base font-extrabold tracking-tight uppercase ${style.text}`}>
              {result.decision.replace("_", " ")}
            </div>
            <div className="text-[11px] font-bold text-slate-400 font-mono tracking-wider mt-0.5 uppercase">
              ID: {result.claim_id}
            </div>
          </div>
        </div>

        {result.decision !== "REJECTED" && result.decision !== "MANUAL_REVIEW" && (
          <div className="sm:text-right border-t sm:border-t-0 border-slate-200/50 pt-3 sm:pt-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Approved amount</div>
            <div className="text-2.5xl font-black text-slate-900 tracking-tight leading-none mt-1">
              {inr(result.approved_amount)}
            </div>
          </div>
        )}
      </div>

      {/* Main Body */}
      <div className="space-y-5 px-6 py-5 bg-white">
        <ConfidenceBar value={result.confidence_score} />

        {/* Reasoning / notes */}
        {(result.reasoning || result.notes) && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 label text-slate-500">
              {result.llm_used && <Sparkles className="h-3.5 w-3.5 text-plum-500 fill-plum-100" />}
              <span>{result.llm_used ? "Clinical Justification" : "Adjudication Notes"}</span>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed font-medium bg-slate-50/40 border border-slate-100 p-4 rounded-2xl">
              {result.reasoning || result.notes}
            </p>
          </div>
        )}

        {/* Rejection reasons */}
        {result.rejection_reasons.length > 0 && (
          <div className="space-y-2">
            <div className="label">Rejection reasons</div>
            <div className="flex flex-wrap gap-1.5">
              {result.rejection_reasons.map((r) => (
                <span 
                  key={r} 
                  className="rounded-lg bg-rose-50 border border-rose-100/50 px-2.5 py-1 text-xs font-bold text-rose-700 font-mono uppercase tracking-wider"
                >
                  {r}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Rejected items / partial */}
        {result.rejected_items.length > 0 && (
          <div className="space-y-2">
            <div className="label">Non-Payable / Excluded Charges</div>
            <ul className="space-y-1.5">
              {result.rejected_items.map((it, i) => (
                <li key={i} className="flex items-start gap-2 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-100 px-3.5 py-2 rounded-xl">
                  <XCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Flags */}
        {result.flags.length > 0 && (
          <div className="space-y-2">
            <div className="label">Compliance Flags</div>
            <div className="flex flex-wrap gap-1.5">
              {result.flags.map((f, i) => (
                <span 
                  key={i} 
                  className="rounded-lg bg-amber-50 border border-amber-200/50 px-2.5 py-1 text-xs font-bold text-amber-700 uppercase tracking-wider"
                >
                  ⚠️ {f}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Deductions Breakdown */}
        {(result.deductions.copay || result.deductions.network_discount || result.deductions.over_limit) && (
          <div className="space-y-2">
            <div className="label">Adjudication Calculations</div>
            <div className="grid grid-cols-3 gap-3">
              {result.deductions.copay ? (
                <Stat label="Co-pay Share" value={inr(result.deductions.copay)} color="text-amber-600 bg-amber-50/50 border-amber-100/50" />
              ) : null}
              {result.deductions.network_discount ? (
                <Stat label="Network Discount" value={inr(result.deductions.network_discount)} color="text-emerald-600 bg-emerald-50/50 border-emerald-100/50" />
              ) : null}
              {result.deductions.over_limit ? (
                <Stat label="Over Policy Limit" value={inr(result.deductions.over_limit)} color="text-rose-600 bg-rose-50/50 border-rose-100/50" />
              ) : null}
            </div>
          </div>
        )}

        {/* Cashless facility check */}
        {result.cashless_approved !== undefined && (
          <div className="flex items-center gap-2 border-t border-slate-100 pt-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Settlement Route:</span>{" "}
            <span className={`inline-flex items-center gap-1 text-xs font-extrabold px-2.5 py-0.5 rounded-full border ${
              result.cashless_approved 
                ? "bg-emerald-50 border-emerald-100 text-emerald-700" 
                : "bg-slate-100 border-slate-200 text-slate-500"
            }`}>
              <DollarSign className="h-3.5 w-3.5" />
              {result.cashless_approved ? "Direct Network Cashless" : "Reimbursement Claim"}
            </span>
          </div>
        )}

        {/* Next steps */}
        {result.next_steps && (
          <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 space-y-1">
            <div className="flex items-center gap-1.5 label text-slate-500">
              <Info className="h-4 w-4 text-slate-400" />
              <span>Next Steps / Actions</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              {result.next_steps}
            </p>
          </div>
        )}

        {/* Policy basis (RAG) */}
        {result.policy_basis.length > 0 && (
          <div className="space-y-2 border-t border-slate-100 pt-4">
            <div className="label">Retrieved Policy Reference (RAG)</div>
            <div className="flex flex-wrap gap-1.5">
              {result.policy_basis.map((p, i) => (
                <span 
                  key={i} 
                  className="rounded-lg bg-plum-50 border border-plum-100/40 px-2.5 py-1 text-xs font-bold text-plum-700 tracking-tight"
                >
                  📜 {p}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Audit trail accordion */}
        <div className="border border-slate-200/60 rounded-2xl overflow-hidden mt-2 bg-slate-50/30">
          <button
            onClick={() => setAuditOpen(!auditOpen)}
            className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition"
          >
            <span className="flex items-center gap-2 text-xs font-extrabold text-slate-600 uppercase tracking-wider">
              <FileCheck className="h-4 w-4 text-slate-400" />
              Rule Execution Trace ({result.trace.length} checked)
            </span>
            <ChevronDown className={`h-4.5 w-4.5 text-slate-400 transition-transform duration-200 ${
              auditOpen ? "rotate-180" : ""
            }`} />
          </button>
          
          {auditOpen && (
            <div className="divide-y divide-slate-100/80 border-t border-slate-200/50 bg-white max-h-72 overflow-y-auto scrollbar-thin">
              {result.trace.map((t, i) => (
                <div key={i} className="flex items-start gap-3 p-3.5 text-xs">
                  <div className="mt-0.5 shrink-0">
                    {t.passed ? (
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 border border-emerald-200/60 text-emerald-600">
                        ✓
                      </span>
                    ) : (
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-rose-50 border border-rose-200/60 text-rose-600">
                        ✕
                      </span>
                    )}
                  </div>
                  <div className="space-y-0.5 flex-1">
                    <div className="flex flex-wrap gap-x-2 items-center">
                      <span className="font-bold text-slate-700">{t.step}</span>
                      <span className="text-[10px] font-extrabold font-mono text-plum-600 tracking-wide bg-plum-50 px-1.5 py-0.2 rounded border border-plum-100/40">
                        {t.rule}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed font-medium mt-0.5">
                      {t.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className={`rounded-xl border p-2.5 text-center flex flex-col items-center justify-center ${
      color ? color : "bg-slate-50/50 border-slate-100 text-slate-800"
    }`}>
      <div className="text-[9px] font-extrabold uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-sm font-black mt-0.5 tracking-tight">{value}</div>
    </div>
  );
}
