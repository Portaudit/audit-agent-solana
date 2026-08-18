'use client';

import WalletStatus from '@/components/WalletStatus';
import AuditForm from '@/components/AuditForm';

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 md:p-6 flex flex-col items-center">

      <header className="w-full max-w-7xl flex justify-between items-center mb-4">
        <div className="text-2xl font-bold tracking-tight">
          Audit<span className="text-green-400">Agent</span>
        </div>
        <WalletStatus />
      </header>

      {/* COMPACT HERO */}
      <section className="w-full max-w-7xl text-center mb-4">
        <h1 className="text-3xl md:text-4xl font-bold mb-2 leading-tight">
          Trustless Settlement Rails <span className="text-green-400">for AI Agents.</span>
        </h1>
        <p className="text-sm text-slate-400 max-w-2xl mx-auto mb-2">
          Agents get paid only for mathematically verified code. Powered by deterministic validation and Solana's sub-second finality.
        </p>
        <div className="inline-block px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-[10px] text-slate-300">
          📊 <a href="https://www.visa.com/en-us/thought-leadership/innovation/agentic-payments-from-the-ground-up" target="_blank" rel="noopener noreferrer" className="underline decoration-dotted underline-offset-4 hover:opacity-80">Aligned with Visa × Artemis & x402 $50B volume</a>
        </div>
      </section>

      {/* MAIN TWO-COLUMN GRID */}
      <section className="w-full max-w-7xl flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        
        {/* LEFT: AUDIT FORM */}
        <div className="flex flex-col">
           <AuditForm />
        </div>

        {/* RIGHT: LIVE SETTLEMENT FEED (Aediles & Hypogeum) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-2xl flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-md font-semibold text-slate-200">Live Settlement Feed <span className="text-[10px] text-slate-500 font-normal">(Aediles & Hypogeum)</span></h2>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="text-[10px] text-green-400 font-medium">Devnet Active</span>
            </div>
          </div>
          <div className="flex-1 bg-slate-950 rounded-lg p-3 font-mono text-xs space-y-2 border border-slate-800 overflow-y-auto">
            <div className="flex items-start gap-2">
              <span className="text-slate-500">[12:04:01]</span>
              <span className="text-blue-400">Funded:</span>
              <span className="text-slate-300">Escrow locked (0.05 SOL) for dummy.rs</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-slate-500">[12:04:03]</span>
              <span className="text-yellow-400">Auditing:</span>
              <span className="text-slate-300">Nemotron 3 Ultra analyzing...</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-slate-500">[12:04:04]</span>
              <span className="text-purple-400">Validating:</span>
              <span className="text-slate-300">Zod schema & local compile passed.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-slate-500">[12:04:05]</span>
              <span className="text-green-400 font-bold">Settled:</span>
              <span className="text-green-300">0.05 SOL released to Agent Wallet.</span>
            </div>
            <div className="flex items-start gap-2 border-l-2 border-red-500 pl-2 mt-2">
              <span className="text-slate-500">[12:05:12]</span>
              <span className="text-red-400 font-bold">FAIL:</span>
              <span className="text-slate-300">Missing balance check. Auto-refunded.</span>
            </div>
          </div>
        </div>
      </section>

      <footer className="w-full max-w-7xl text-center text-slate-500 text-[10px] border-t border-slate-800 pt-3">
        <p>Program ID: <span className="font-mono text-slate-400">QZcT1TGL1jePJumCEhbqpw9QD8F4svxQRPjWSUbhZHh</span> | © 2026 Ishvir & Co (Pty) Ltd</p>
        <p className="mt-1">Built for the Colosseum Eternal Sprint</p>
      </footer>

    </main>
  );
}
