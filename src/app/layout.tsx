import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import Navbar from "@/components/Navbar";
import MouseGlow from "@/components/MouseGlow";
import "./globals.css";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Plum OPD Claim Adjudicator",
  description: "AI-powered OPD insurance claim adjudication tool",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} font-sans`}>
      <body className="flex flex-col min-h-screen bg-slate-50 text-slate-800">
        <MouseGlow />
        <Navbar />
        <main className="flex-1 mx-auto w-full max-w-6xl px-6 py-10 animate-fade-in-up">
          {children}
        </main>
        <footer className="border-t border-slate-200/50 bg-white/40 backdrop-blur-sm py-8 text-center text-xs text-slate-400">
          <div className="mx-auto max-w-6xl px-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <p>© 2026 Plum AI Automation. Built for speed, precision, and compliance.</p>
            <div className="flex gap-4 items-center">
              <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 font-mono text-[10px] text-slate-500 border border-slate-200">
                TypeScript Rule Engine
              </span>
              <span className="inline-flex items-center gap-1 rounded bg-plum-50 px-2 py-1 font-mono text-[10px] text-plum-600 border border-plum-100">
                Gemini LLM + RAG
              </span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
