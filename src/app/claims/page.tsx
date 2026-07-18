"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  FileClock, 
  User, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Search, 
  ArrowRight,
  Inbox,
  Calendar,
  Loader2
} from "lucide-react";
import DecisionCard from "@/components/DecisionCard";
import type { ClaimRecord } from "@/lib/types";

const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

const STATUS_CONFIG: Record<
  string, 
  { bg: string; text: string; border: string; icon: React.ComponentType<{ className?: string }> }
> = {
  APPROVED: { 
    bg: "bg-emerald-50/80", 
    text: "text-emerald-700", 
    border: "border-emerald-200/50",
    icon: CheckCircle2 
  },
  PARTIAL: { 
    bg: "bg-amber-50/80", 
    text: "text-amber-700", 
    border: "border-amber-200/50",
    icon: AlertTriangle 
  },
  REJECTED: { 
    bg: "bg-rose-50/80", 
    text: "text-rose-700", 
    border: "border-rose-200/50",
    icon: XCircle 
  },
  MANUAL_REVIEW: { 
    bg: "bg-blue-50/80", 
    text: "text-blue-700", 
    border: "border-blue-200/50",
    icon: Search 
  },
};

export default function ClaimsPage() {
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [selected, setSelected] = useState<ClaimRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/claims")
      .then((r) => r.json())
      .then((d) => setClaims(d.claims ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/60 pb-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <FileClock className="h-6.5 w-6.5 text-plum-600" />
            Claims Audit History
          </h1>
          <p className="text-sm text-slate-500 max-w-2xl">
            Audit history of all adjudicated outpatient claims stored within the local sandbox environment.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <Loader2 className="h-8 w-8 text-plum-500 animate-spin" />
          <p className="text-sm font-semibold text-slate-500">Retrieving claims registry…</p>
        </div>
      ) : claims.length === 0 ? (
        <div className="card flex flex-col items-center justify-center p-12 border-dashed border-2 border-slate-200 text-center space-y-4 max-w-xl mx-auto">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 border border-slate-100">
            <Inbox className="h-6 w-6 text-slate-400" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-sm font-bold text-slate-700">No Claims Logged Yet</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Before you can view past claims, you need to execute an adjudication audit cycle from the workspace.
            </p>
          </div>
          <Link href="/" className="btn-primary inline-flex items-center gap-1.5 text-xs">
            Adjudicate Now
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-12 items-start">
          {/* Table Area (Col span 7) */}
          <div className="lg:col-span-7 card overflow-hidden border-slate-200 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/80 border-b border-slate-200/50 text-left text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-5 py-3.5">Claim Ref</th>
                    <th className="px-5 py-3.5">Member Name</th>
                    <th className="px-5 py-3.5">Audit Decision</th>
                    <th className="px-5 py-3.5 text-right">Settled Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {claims.map((c) => {
                    const isSelected = selected?.id === c.id;
                    const status = STATUS_CONFIG[c.result.decision] ?? STATUS_CONFIG.REJECTED;
                    const Icon = status.icon;
                    return (
                      <tr
                        key={c.id}
                        onClick={() => setSelected(c)}
                        className={`cursor-pointer transition hover:bg-slate-50/60 border-l-4 ${
                          isSelected 
                            ? "bg-plum-50/40 border-l-plum-600 font-medium" 
                            : "border-l-transparent"
                        }`}
                      >
                        <td className="px-5 py-4 font-mono text-xs text-slate-500">
                          {c.id}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                              <User className="h-3.5 w-3.5 text-slate-500" />
                            </div>
                            <span className="text-slate-800 font-semibold text-xs leading-none">
                              {c.input.member_name ?? "Unknown"}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-bold border uppercase tracking-wider ${status.bg} ${status.text} ${status.border}`}>
                            <Icon className="h-3 w-3 shrink-0" />
                            {c.result.decision.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right font-black text-xs text-slate-900">
                          {inr(c.result.approved_amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Details Area (Col span 5) */}
          <div className="lg:col-span-5">
            {selected ? (
              <DecisionCard result={selected.result} />
            ) : (
              <div className="card flex flex-col items-center justify-center p-8 text-center border-dashed border-2 border-slate-200 bg-slate-50/50 min-h-[380px] space-y-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm border border-slate-100 text-slate-400">
                  <Calendar className="h-6 w-6 text-slate-300" />
                </div>
                <div className="max-w-xs space-y-1.5">
                  <h3 className="text-sm font-bold text-slate-700">Audit Detailed View</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Select a claim row from the left history ledger to drill down into the policy rules executed, cashless status, and clinical justifications.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
