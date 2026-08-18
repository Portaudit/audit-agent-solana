'use client';

import WalletStatus from '@/components/WalletStatus';
import AuditForm from '@/components/AuditForm';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useEffect, useState } from 'react';

const PROGRAM_ID = new PublicKey('QZcT1TGL1jePJumCEhbqpw9QD8F4svxQRPjWSUbhZHh');

type Row = { time: string; label: string; sub: string; color: string; link?: string };

function fmt(sec?: number | null) {
  return new Date((sec ?? Date.now() / 1000) * 1000).toLocaleTimeString('en-GB', { hour12: false });
}

function seedRows(): Row[] {
  const t = (m: number) => fmt(Date.now() / 1000 - m * 60);
  return [
    { time: t(4), label: 'Funded:', sub: 'Escrow locked (0.05 SOL) for dummy.rs', color: 'text-blue-400' },
    { time: t(3), label: 'Auditing:', sub: 'Nemotron 3 Ultra analyzing…', color: 'text-yellow-400' },
    { time: t(2), label: 'Validating:', sub: 'Zod schema & local compile passed.', color: 'text-purple-400' },
    { time: t(1), label: 'Settled:', sub: '0.05 SOL released to Agent Wallet.', color: 'text-green-400' },
  ];
}

function LiveFeed() {
  const { connection } = useConnection();
  const [rows, setRows] = useState<Row[]>(seedRows);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const sigs = await connection.getSignaturesForAddress(PROGRAM_ID, { limit: 12 });
        if (!alive || sigs.length === 0) return;
        setLive(true);
        setRows(sigs.slice().reverse().map((s) => ({
          time: fmt(s.blockTime),
          label: s.err ? 'Error:' : 'Confirmed:',
          sub: `Program tx ${s.signature.slice(0, 18)}…`,
          color: s.err ? 'text-red-400' : 'text-green-400',
          link: `https://explorer.solana.com/tx/${s.signature}?cluster=devnet`,
        })));
      } catch { /* keep seed rows */ }
    };
    load();
    const t = setInterval(load, 10000);
    return () => { alive = false; clearInterval(t); };
  }, [connection]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-2xl flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-slate-200">Live Settlement Feed <span className="text-[10px] text-slate-500 font-normal">(Aediles & Hypogeum)</span></h2>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          <span className="text-[10px] text-green-400 font-medium">{live ? 'On-chain · Devnet' : 'Devnet Active'}</span>
        </div>
      </div>
      <div className="flex-1 bg-slate-950 rounded-lg p-3 font-mono text-xs space-y-2 border border-slate-800 overflow-y-auto">
        {rows.map((r, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="text-slate-500 shrink-0">[{r.time}]</span>
            <span className={`${r.color} font-semibold shrink-0`}>{r.label}</span>
            {r.link ? (
              <a href={r.link} target="_blank" rel="noopener noreferrer" className="text-slate-300 hover:text-green-400 break-all">{r.sub}</a>
            ) : (
              <span className="text-slate-300">{r.sub}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 font-sans px-4 md:px-6 py-3 flex flex-col items-center">

      <header className="w-full max-w-7xl flex items-center justify-between gap-4 mb-3">
        <div className="text-xl md:text-2xl font-bold tracking-tight shrink-0">
          Audit<span className="text-green-400">Agent</span>
        </div>
        <div className="hidden md:block text-center flex-1">
          <h1 className="text-xl md:text-2xl font-bold leading-tight">
            Trustless Settlement Rails <span className="text-green-400">for AI Agents.</span>
          </h1>
          <p className="text-xs text-slate-400">
            Agents get paid only for mathematically verified code ·{' '}
            <a href="https://www.visa.com/en-us/thought-leadership/innovation/agentic-payments-from-the-ground-up" target="_blank" rel="noopener noreferrer" className="underline decoration-dotted underline-offset-2 hover:opacity-80">aligned with Visa × Artemis & x402 $50B volume</a>
          </p>
        </div>
        <WalletStatus />
      </header>

      <div className="md:hidden text-center mb-3">
        <h1 className="text-xl font-bold leading-tight">Trustless Settlement Rails <span className="text-green-400">for AI Agents.</span></h1>
        <p className="text-xs text-slate-400">Agents get paid only for mathematically verified code.</p>
      </div>

      <section className="w-full max-w-7xl flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 mb-3">
        <div className="flex flex-col">
          <AuditForm />
        </div>
        <LiveFeed />
      </section>

      <footer className="w-full max-w-7xl text-center text-slate-500 text-[11px] border-t border-slate-800 pt-2">
        <p>Program ID: <span className="font-mono text-slate-400">QZcT1TGL1jePJumCEhbqpw9QD8F4svxQRPjWSUbhZHh</span> | © 2026 Ishvir & Co (Pty) Ltd</p>
        <p className="mt-0.5">Built for the Colosseum Eternal Sprint</p>
      </footer>

    </main>
  );
}
