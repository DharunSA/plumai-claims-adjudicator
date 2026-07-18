"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HeartPulse, ClipboardCheck, History, BarChart3, ShieldCheck } from "lucide-react";

const NAV = [
  { href: "/", label: "Adjudicate", icon: ClipboardCheck },
  { href: "/claims", label: "Claims History", icon: History },
  { href: "/evals", label: "Eval Harness", icon: BarChart3 },
  { href: "/policy", label: "Policy Terms", icon: ShieldCheck },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/60 bg-white/80 backdrop-blur-md transition-all duration-300">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-plum-600 to-plum-500 shadow-md shadow-plum-500/20 text-white transition-transform group-hover:scale-105 duration-300">
            <HeartPulse className="h-5.5 w-5.5 animate-pulse-glow" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-slate-900 leading-tight tracking-tight text-lg">
              Plum <span className="bg-gradient-to-r from-plum-600 to-plum-500 bg-clip-text text-transparent">OPD</span>
            </span>
            <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase -mt-0.5">
              Claim Adjudicator
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="flex items-center gap-1.5 bg-slate-100/60 p-1 rounded-xl border border-slate-200/40">
          {NAV.map((n) => {
            const Icon = n.icon;
            const isActive = pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`relative flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? "bg-white text-plum-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                }`}
              >
                <Icon className={`h-4.5 w-4.5 ${isActive ? "text-plum-600" : "text-slate-400"}`} />
                <span>{n.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right Section: Badge / CTA */}
        <div className="hidden sm:flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-full bg-plum-50/50 border border-plum-100/60 px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-plum-500 animate-pulse" />
            <span className="text-xs font-semibold text-plum-700">v1.0.0 Stable</span>
          </div>
        </div>
      </div>
    </header>
  );
}
