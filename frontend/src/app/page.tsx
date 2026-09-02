'use client';
import Link from 'next/link';

import WalletStatus from '@/components/WalletStatus';
import AuditForm from '@/components/AuditForm';
import { useConnection, useAnchorWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { useEffect, useState } from 'react';
import idl from '../../idl.json';

const PROGRAM_ID = new PublicKey('QZcT1TGL1jePJumCEhbqpw9QD8F4svxQRPjWSUbhZHh');

type Row = { time: string; label: string; sub: string; color: string; link?: string };

function fmt(sec?: number | null) {
  return new Date((sec ?? Date.now() / 1000) * 1000).toLocaleTimeString('en-GB', { hour12: false });
}

function seedRows(): Row[] {
  const t = (m: number) => fmt(Date.now() / 1000 - m * 60);
  return [
    { time: t(4), label: 'Funded:', sub: 'Escrow locked (0.05 SOL)', color: 'text-blue-400' },
    { time: t(3), label: 'Auditing:', sub: 'Ling 3.0 Flash / Gemini 2.5 analyzing…', color: 'text-yellow-400' },
    { time: t(2), label: 'Validating:', sub: 'Hash-commitment verified.', color: 'text-purple-400' },
    { time: t(1), label: 'Settled:', sub: 'Funds released to Agent Wallet.', color: 'text-green-400' },
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
            <span className="text-slate-500 shrink-0" suppressHydrationWarning>[{r.time}]</span>
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

function Marketplace() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const [tasks, setTasks] = useState<any[]>([]);

  useEffect(() => {
    if (!connection) return;
    const dummyWallet = {
      publicKey: PublicKey.default,
      signTransaction: async () => ({} as any),
      signAllTransactions: async () => []
    };
    const provider = new AnchorProvider(connection, (wallet as any) ?? dummyWallet, { commitment: 'confirmed' });
    const program = new Program(idl as any, provider);

    const fetchTasks = async () => {
      try {
        const allTasks = await program.account.taskEscrow.all();
        // Anti-zombie filter: only show tasks with amount > 0
        setTasks(allTasks.filter(t => t.account.status.pending !== undefined && !t.account.amount.isZero()));
      } catch (e) {
        console.error("Marketplace fetch error:", e);
      }
    };

    fetchTasks();
    const interval = setInterval(fetchTasks, 5000);
    return () => clearInterval(interval);
  }, [connection, wallet]);

  return (
    <div className="mt-4 bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-2xl">
       <h2 className="text-sm font-semibold text-slate-200 mb-3">Live Escrow Market <span className="text-[10px] text-slate-500 font-normal">(Real On-Chain State)</span></h2>
       <div className="space-y-2 max-h-64 overflow-y-auto">
          {tasks.length === 0 && <p className="text-[11px] text-slate-500 text-center py-4">No pending escrows. Submit an audit to create one.</p>}
          {tasks.map((task, i) => {
             const escrow = task.account;
             const solAmount = (escrow.amount as any).toNumber() / 1e9;
             return (
                <div key={i} className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                   <p className="text-xs font-medium text-slate-300 truncate">Hash: {escrow.taskHash.slice(0, 16)}...</p>
                   <div className="flex justify-between mt-1">
                      <p className="text-[10px] text-slate-500">Agent: <span className="text-slate-400 truncate max-w-[100px] inline-block align-bottom">{escrow.agentWallet.toBase58().slice(0,8)}...</span></p>
                      <p className="text-xs font-bold text-yellow-400">{solAmount} SOL</p>
                   </div>
                   <p className="text-[10px] text-yellow-400 mt-1 font-semibold">⏳ Pending Bot Audit</p>
                </div>
             );
          })}
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
        <Link href="/about" className="text-slate-400 hover:text-green-400 text-sm font-medium transition-colors">About</Link>
        <WalletStatus />
      </header>

      <div className="md:hidden text-center mb-3">
        <h1 className="text-xl font-bold leading-tight">Trustless Settlement Rails <span className="text-green-400">for AI Agents.</span></h1>
        <p className="text-xs text-slate-400">Agents get paid only for mathematically verified code.</p>
      </div>

      <section className="w-full max-w-7xl flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 mb-3">
        <div className="flex flex-col">
          <AuditForm />
          <Marketplace />
        </div>
        <LiveFeed />
      </section>

      <footer className="w-full max-w-7xl text-center text-slate-500 text-[11px] border-t border-slate-800 pt-2">
        <p>Program ID: <span className="font-mono text-slate-400">QZcT1TGL1jePJumCEhbqpw9QD8F4svxQRPjWSUbhZHh</span> | © 2026 Ishvir & Co — a division of Ishvir and Company (Pty) Ltd</p>
        <p className="mt-0.5">Built for the Colosseum Eternal Sprint</p>
      </footer>

    </main>
  );
}
