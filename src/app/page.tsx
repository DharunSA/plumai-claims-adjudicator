import fs from "node:fs";
import path from "node:path";
import ClaimWorkbench, { type SampleCase } from "@/components/ClaimWorkbench";
import { llmAvailable } from "@/lib/llm/client";
import { Sparkles, Activity, ShieldCheck, Cpu } from "lucide-react";

export const dynamic = "force-dynamic";

function loadSamples(): SampleCase[] {
  const file = path.join(process.cwd(), "data", "test_cases.json");
  const parsed = JSON.parse(fs.readFileSync(file, "utf-8")) as {
    test_cases: SampleCase[];
  };
  return parsed.test_cases.map((t) => ({
    case_id: t.case_id,
    case_name: t.case_name,
    description: t.description,
    input_data: t.input_data,
  }));
}

export default function HomePage() {
  const samples = loadSamples();
  const ai = llmAvailable();

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-plum-950 px-8 py-12 md:px-12 md:py-16 text-white shadow-xl">
        {/* Glow effects */}
        <div className="absolute top-1/2 left-1/4 -translate-y-1/2 -translate-x-1/2 w-80 h-80 bg-plum-500/20 rounded-full blur-[80px] -z-10" />
        <div className="absolute top-1/3 right-1/4 -translate-y-1/2 w-60 h-60 bg-blue-500/10 rounded-full blur-[60px] -z-10" />

        <div className="grid gap-8 md:grid-cols-12 items-center">
          {/* Hero Content */}
          <div className="md:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1 text-xs font-semibold backdrop-blur-md border border-white/10">
              <Sparkles className="h-3.5 w-3.5 text-plum-300 animate-pulse" />
              <span className="text-plum-100 tracking-wide font-bold uppercase">Automated Claim Adjudication</span>
            </div>

            <h1 className="text-3.5xl md:text-5xl font-extrabold tracking-tight leading-[1.15]">
              Instant Medical Claim <br />
              <span className="bg-gradient-to-r from-plum-300 via-plum-100 to-indigo-200 bg-clip-text text-transparent">
                Verification Engine
              </span>
            </h1>

            <p className="text-sm md:text-base text-slate-300 leading-relaxed max-w-xl">
              Upload medical bills or select a sample case to instantly evaluate, validate, and settle outpatient claims against policy guidelines.
            </p>

            {/* Meta stats / Info bar */}
            <div className="pt-4 flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-xl px-4 py-2">
                <Cpu className="h-5 w-5 text-plum-300" />
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Engine Status</div>
                  <div className="text-xs font-semibold text-slate-100">
                    {ai ? "Hybrid Verification Active" : "Rules Engine Standalone"}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-xl px-4 py-2">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Compliance</div>
                  <div className="text-xs font-semibold text-slate-100">100% Policy Grounded</div>
                </div>
              </div>
            </div>
          </div>

          {/* Hero Illustration */}
          <div className="hidden md:block md:col-span-5 relative">
            <div className="relative mx-auto w-full max-w-[280px] h-[280px] flex items-center justify-center">
              {/* Backing glow circle */}
              <div className="absolute w-56 h-56 rounded-full bg-gradient-to-tr from-plum-600/30 to-blue-500/20 blur-xl animate-pulse-glow" />
              {/* Image itself */}
              <img
                src="/images/depositphotos_411608716-stock-illustration-doctor-various-poses-character-design-removebg-preview.png"
                alt="Healthcare Professional Illustration"
                className="relative z-10 w-full h-full object-contain animate-float"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Main Claim Workbench section */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/60 pb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Activity className="h-5 w-5 text-plum-600" />
              Adjudication Workbench
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Submit a medical claim file or structured JSON to run validation rules.
            </p>
          </div>
          <div className="flex items-center">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-bold border transition ${
                ai
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : "bg-slate-100 border-slate-200 text-slate-500"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${ai ? "bg-emerald-500" : "bg-slate-400"}`} />
              {ai ? "Verification Active" : "Standard Rules Active"}
            </span>
          </div>
        </div>

        <ClaimWorkbench samples={samples} />
      </section>
    </div>
  );
}
