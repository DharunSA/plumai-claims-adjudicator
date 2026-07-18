import { getPolicy } from "@/lib/policy";
import { 
  ShieldCheck, 
  Coins, 
  Percent, 
  Layers, 
  History, 
  ShieldAlert, 
  Building2,
  BookOpen,
  Info
} from "lucide-react";

export const dynamic = "force-dynamic";

const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

function Section({ 
  title, 
  icon: Icon, 
  children 
}: { 
  title: string; 
  icon: React.ComponentType<{ className?: string }>; 
  children: React.ReactNode 
}) {
  return (
    <div className="card p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 bg-white">
      <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3.5 mb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-plum-50 text-plum-600 border border-plum-100/40">
          <Icon className="h-4.5 w-4.5" />
        </div>
        <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
          {title}
        </h2>
      </div>
      <div className="space-y-1">
        {children}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-2.5 text-xs sm:text-sm border-b border-slate-100 last:border-0 hover:bg-slate-50/30 px-1 rounded-lg transition-colors">
      <span className="text-slate-500 font-semibold">{k}</span>
      <span className="font-extrabold text-slate-800">{v}</span>
    </div>
  );
}

export default function PolicyPage() {
  const p = getPolicy();
  const cd = p.coverage_details;

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/60 pb-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <ShieldCheck className="h-6.5 w-6.5 text-plum-600" />
            {p.policy_name}
          </h1>
          <p className="text-sm text-slate-500 max-w-2xl font-mono text-xs">
            ID: {p.policy_id} · Effective Date: {p.effective_date}
          </p>
        </div>
      </div>

      {/* Grid Content */}
      <div className="grid gap-6 md:grid-cols-2">
        <Section title="Global limits" icon={Coins}>
          <Row k="Annual Policy Limit" v={inr(cd.annual_limit)} />
          <Row k="Per-Claim Limit" v={inr(cd.per_claim_limit)} />
          <Row k="Family Floater Cap" v={inr(cd.family_floater_limit)} />
          <Row k="Minimum Claim Amount" v={inr(p.claim_requirements.minimum_claim_amount)} />
          <Row k="Submission Deadline" v={`${p.claim_requirements.submission_timeline_days} Days`} />
        </Section>

        <Section title="Co-pay & discounts" icon={Percent}>
          <Row k="Consultation Co-pay" v={`${cd.consultation_fees.copay_percentage}%`} />
          <Row k="Preferred Network Discount" v={`${cd.consultation_fees.network_discount}%`} />
          <Row k="Branded Drug Co-pay" v={`${cd.pharmacy.branded_drugs_copay}%`} />
          <Row k="Cashless Instant Auth Limit" v={inr(p.cashless_facilities.instant_approval_limit)} />
        </Section>

        <Section title="Category sub-limits" icon={Layers}>
          <Row k="Doctor Consultation" v={inr(cd.consultation_fees.sub_limit)} />
          <Row k="Diagnostic / Lab Tests" v={inr(cd.diagnostic_tests.sub_limit)} />
          <Row k="Pharmacy Medicines" v={inr(cd.pharmacy.sub_limit)} />
          <Row k="Dental Operations" v={inr(cd.dental.sub_limit)} />
          <Row k="Vision & Eye Care" v={inr(cd.vision.sub_limit)} />
          <Row k="Alternative Medicine" v={inr(cd.alternative_medicine.sub_limit)} />
        </Section>

        <Section title="Waiting periods (days)" icon={History}>
          <Row k="Initial Wait Window" v={`${p.waiting_periods.initial_waiting} Days`} />
          <Row k="Pre-Existing Diseases" v={`${p.waiting_periods.pre_existing_diseases} Days`} />
          <Row k="Maternity & Childbirth" v={`${p.waiting_periods.maternity} Days`} />
          {Object.entries(p.waiting_periods.specific_ailments).map(([k, v]) => (
            <Row key={k} k={k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())} v={`${v} Days`} />
          ))}
        </Section>

        <Section title="Exclusions" icon={ShieldAlert}>
          <div className="flex flex-wrap gap-2 pt-1">
            {p.exclusions.map((e) => (
              <span 
                key={e} 
                className="rounded-lg bg-rose-50 border border-rose-100/60 px-3 py-1.5 text-xs font-bold text-rose-700 tracking-tight"
              >
                🚫 {e}
              </span>
            ))}
          </div>
        </Section>

        <Section title="Network hospitals" icon={Building2}>
          <div className="flex flex-wrap gap-2 pt-1">
            {p.network_hospitals.map((h) => (
              <span 
                key={h} 
                className="rounded-lg bg-emerald-50 border border-emerald-100/60 px-3 py-1.5 text-xs font-bold text-emerald-700 tracking-tight"
              >
                🏥 {h}
              </span>
            ))}
          </div>
        </Section>
      </div>

      {/* Info Tip block */}
      <div className="flex items-start gap-3 rounded-2xl bg-indigo-50 border border-indigo-100/60 p-4 max-w-3xl">
        <Info className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-indigo-800 uppercase tracking-wide">
            Policy Terms Configuration Info
          </h4>
          <p className="text-xs text-indigo-600 leading-relaxed font-semibold">
            This active schema is sourced dynamically from <code className="bg-indigo-100 px-1 rounded font-mono text-[10.5px]">data/policy_terms.json</code>. Modifying the JSON directly updates the rule engine adjudication criteria instantly.
          </p>
        </div>
      </div>
    </div>
  );
}
