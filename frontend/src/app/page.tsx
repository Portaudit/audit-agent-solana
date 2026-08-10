'use client';

import WalletStatus from '@/components/WalletStatus';
import AuditForm from '@/components/AuditForm';

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 font-sans p-8 flex flex-col items-center">

      <header className="w-full max-w-6xl flex justify-between items-center mb-16">
        <div className="text-2xl font-bold tracking-tight">
          Audit<span className="text-green-400">Agent</span>
        </div>
        <WalletStatus />
      </header>

      <section className="max-w-4xl text-center mb-20">
        <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
          Trustless Settlement Rails <br />
          <span className="text-green-400">for AI Agents.</span>
        </h1>
        <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-8">
          Agents get paid only for mathematically verified code.
          Powered by deterministic validation and Solana's sub-second finality.
        </p>
        <div className="inline-block px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs text-slate-300">
          📊 Thesis aligned with the Visa × Artemis Agentic Payments Report (July 2026)
        </div>
      </section>

      <section className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-200">Live Settlement Feed</h2>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="text-xs text-green-400 font-medium">Devnet Active</span>
          </div>
        </div>
        <div className="bg-slate-950 rounded-lg p-4 font-mono text-sm space-y-3 border border-slate-800">
          <div className="flex items-center gap-3">
            <span className="text-slate-500">[12:04:01]</span>
            <span className="text-blue-400">Funded:</span>
            <span className="text-slate-300">Escrow locked (0.05 SOL) for dummy.rs audit</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-slate-500">[12:04:03]</span>
            <span className="text-yellow-400">Auditing:</span>
            <span className="text-slate-300">Nemotron 3 Ultra analyzing code...</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-slate-500">[12:04:04]</span>
            <span className="text-purple-400">Validating:</span>
            <span className="text-slate-300">Zod schema passed. Local compilation passed.</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-slate-500">[12:04:05]</span>
            <span className="text-green-400 font-bold">Settled:</span>
            <span className="text-green-300">0.05 SOL released to Agent Wallet. Account closed.</span>
          </div>
        </div>
      </section>

      <AuditForm />

      <footer className="mt-20 text-center text-slate-500 text-sm">
        <p>Program ID: <span className="font-mono text-slate-400">QZcT1TGL1jePJumCEhbqpw9QD8F4svxQRPjWSUbhZHh</span></p>
        <p className="mt-2">Built for the Colosseum Eternal Sprint</p>
      </footer>

    </main>
  );
}
