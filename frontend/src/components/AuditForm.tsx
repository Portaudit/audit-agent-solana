'use client';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
  PublicKey, SystemProgram, Transaction, TransactionInstruction, ComputeBudgetProgram,
} from '@solana/web3.js';
import { useState } from 'react';

const PROGRAM_ID = new PublicKey('QZcT1TGL1jePJumCEhbqpw9QD8F4svxQRPjWSUbhZHh');
const DISCRIMINATOR = [194, 80, 6, 180, 232, 127, 48, 171];

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function buildCreateTaskData(taskHash: string, agentWallet: PublicKey, lamports: bigint): Uint8Array {
  const hashBytes = new TextEncoder().encode(taskHash);
  const data = new Uint8Array(8 + 4 + hashBytes.length + 32 + 8);
  const view = new DataView(data.buffer);
  let o = 0;
  for (const b of DISCRIMINATOR) data[o++] = b;
  view.setUint32(o, hashBytes.length, true); o += 4;
  data.set(hashBytes, o); o += hashBytes.length;
  data.set(agentWallet.toBytes(), o); o += 32;
  view.setBigUint64(o, lamports, true);
  return data;
}

export default function AuditForm() {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const [code, setCode] = useState('');
  const [agentWallet, setAgentWallet] = useState('8mumNvbgDESR1nvsw83XbocqFZPQxwEfzftBkky75xZL');
  const [amount, setAmount] = useState('0.05');
  const [loading, setLoading] = useState(false);
  const [txSig, setTxSig] = useState('');
  const [phase, setPhase] = useState<'idle' | 'confirming' | 'done'>('idle');
  const [lastCode, setLastCode] = useState('');
  const [verdict, setVerdict] = useState<any>(null);
  const [auditing, setAuditing] = useState(false);

  const submit = async () => {
    if (!publicKey) { alert('Connect your wallet first'); return; }
    if (!code.trim()) { alert('Enter some code to audit'); return; }
    setLoading(true);
    setVerdict(null);
    try {
      const [escrowPda] = PublicKey.findProgramAddressSync(
        [new TextEncoder().encode('escrow'), publicKey.toBuffer()],
        PROGRAM_ID
      );
      const taskHash = await sha256Hex(code);
      const lamports = BigInt(Math.round(parseFloat(amount) * 1e9));

      const tx = new Transaction();
      tx.feePayer = publicKey;
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }));
      tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }));
      tx.add(new TransactionInstruction({
        keys: [
          { pubkey: escrowPda, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data: buildCreateTaskData(taskHash, new PublicKey(agentWallet.trim()), lamports) as unknown as Buffer,
      }));

      if (!signTransaction) throw new Error('Wallet does not support signTransaction');
      const signedTx = await signTransaction(tx);
      const signature = await connection.sendRawTransaction(signedTx.serialize(), { maxRetries: 10 });
      setTxSig(signature);
      setPhase('confirming');

      const deadline = Date.now() + 60000;
      let ok = false;
      while (Date.now() < deadline) {
        const st = await connection.getSignatureStatus(signature);
        if (st?.value?.err) throw new Error('On-chain error: ' + JSON.stringify(st.value.err));
        if (st?.value?.confirmationStatus === 'confirmed' || st?.value?.confirmationStatus === 'finalized') { ok = true; break; }
        await new Promise((r) => setTimeout(r, 2000));
      }
      setPhase(ok ? 'done' : 'confirming');
      setLastCode(code);
      setCode('');
    } catch (err: any) {
      console.error(err);
      alert('Transaction failed: ' + (err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  const runAudit = async () => {
    if (!publicKey || !lastCode) return;
    setAuditing(true);
    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: lastCode, user: publicKey.toBase58() }),
      }).then((r) => r.json());
      setVerdict(res);
    } catch (e: any) {
      setVerdict({ error: e?.message || 'audit request failed' });
    } finally {
      setAuditing(false);
    }
  };

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-2xl h-full flex flex-col">
      <h2 className="text-sm font-semibold text-slate-200 mb-2">Submit Code for Audit</h2>

      {!publicKey ? (
        <p className="text-slate-400 text-xs">Connect your wallet to submit an audit.</p>
      ) : (
        <div className="space-y-3 flex-1 flex flex-col">
          <div className="flex-1 flex flex-col">
            <label className="block text-xs text-slate-400 mb-1">
              Code to audit <span className="text-slate-600">(its SHA-256 hash is stored on-chain)</span>
            </label>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={'fn main() {\n    // paste Rust/Anchor code here\n}'}
              className="w-full flex-1 min-h-[80px] bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs font-mono text-slate-300 focus:outline-none focus:border-green-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Agent Wallet</label>
              <input
                value={agentWallet}
                onChange={(e) => setAgentWallet(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs font-mono text-slate-300 focus:outline-none focus:border-green-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Amount (SOL)</label>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                type="number" step="0.01"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs font-mono text-slate-300 focus:outline-none focus:border-green-500"
              />
            </div>
          </div>

          <button onClick={submit} disabled={loading}
            className="w-full py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? 'Escrowing Funds...' : `Lock ${amount} SOL & Start Audit`}
          </button>

          {txSig && (
            <div className="p-2 bg-slate-950 border border-green-500 rounded-lg">
              <p className="text-green-400 text-xs font-semibold mb-1">
                {phase === 'done' ? '✓ Escrow Locked' : '⏳ Submitted — confirming on Devnet…'}
              </p>
              <a href={`https://explorer.solana.com/tx/${txSig}?cluster=devnet`} target="_blank" rel="noopener noreferrer"
                className="text-[10px] text-slate-400 hover:text-green-400 break-all">
                Explorer: {txSig.slice(0, 24)}...
              </a>
              {phase === 'done' && (
                <button onClick={runAudit} disabled={auditing}
                  className="mt-2 w-full py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg disabled:opacity-50">
                  {auditing ? '🤖 Nemotron auditing…' : '🤖 Run AI Audit & Settle'}
                </button>
              )}
            </div>
          )}

          {verdict && (
            <div className={`p-2 rounded-lg border ${verdict.success ? 'bg-green-950/40 border-green-500' : 'bg-red-950/40 border-red-500'}`}>
              <p className={`text-xs font-bold mb-1 ${verdict.success ? 'text-green-400' : 'text-red-400'}`}>
                {verdict.success ? '✓ PASSED — Funds released to agent' : '✗ FAILED — Escrow refunded to user'}
              </p>
              {verdict.result?.reasoning && (
                <p className="text-[10px] text-slate-300 mb-1 whitespace-pre-wrap">{verdict.result.reasoning}</p>
              )}
              {typeof verdict.result?.confidence === 'number' && (
                <p className="text-[10px] text-slate-400 mb-1">Confidence: {(verdict.result.confidence * 100).toFixed(0)}%</p>
              )}
              {verdict.resolveSig && (
                <a href={`https://explorer.solana.com/tx/${verdict.resolveSig}?cluster=devnet`} target="_blank" rel="noopener noreferrer"
                  className="text-[10px] text-slate-400 hover:text-green-400 break-all">
                  Settlement tx: {verdict.resolveSig.slice(0, 24)}...
                </a>
              )}
              {verdict.error && <p className="text-[10px] text-red-300">{verdict.error}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
