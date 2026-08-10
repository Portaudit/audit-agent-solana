'use client';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import { useState } from 'react';

const PROGRAM_ID = new PublicKey('QZcT1TGL1jePJumCEhbqpw9QD8F4svxQRPjWSUbhZHh');
const DISCRIMINATOR = [194, 80, 6, 180, 232, 127, 48, 171];

// SHA-256 hex = exactly 64 chars, matching the on-chain task_hash allocation
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Borsh-encode create_task args: string + pubkey + u64 (no anchor needed)
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
  const { publicKey, sendTransaction, signTransaction } = useWallet();
  const [code, setCode] = useState('');
  const [agentWallet, setAgentWallet] = useState('8mumNvbgDESR1nvsw83XbocqFZPQxwEfzftBkky75xZL');
  const [amount, setAmount] = useState('0.05');
  const [loading, setLoading] = useState(false);
  const [txSig, setTxSig] = useState('');
  const [phase, setPhase] = useState<'idle' | 'confirming' | 'done'>('idle');

  const submit = async () => {
    if (!publicKey) { alert('Connect your wallet first'); return; }
    if (!code.trim()) { alert('Enter some code to audit'); return; }
    setLoading(true);
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

      // Priority fee so Devnet doesn't drop us
      tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }));
      tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }));

      tx.add(
        new TransactionInstruction({
          keys: [
            { pubkey: escrowPda, isSigner: false, isWritable: true },
            { pubkey: publicKey, isSigner: true, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          programId: PROGRAM_ID,
          data: buildCreateTaskData(taskHash, new PublicKey(agentWallet.trim()), lamports) as unknown as Buffer,
        })
      );

      const signedTx = await signTransaction(tx);
      const signature = await connection.sendRawTransaction(signedTx.serialize(), { maxRetries: 10 });
      setTxSig(signature);
      setPhase('confirming');

      // Robust confirmation: poll status for up to 60s
      const deadline = Date.now() + 60000;
      let ok = false;
      while (Date.now() < deadline) {
        const st = await connection.getSignatureStatus(signature);
        if (st?.value?.err) throw new Error('On-chain error: ' + JSON.stringify(st.value.err));
        if (st?.value?.confirmationStatus === 'confirmed' || st?.value?.confirmationStatus === 'finalized') {
          ok = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      setPhase(ok ? 'done' : 'confirming');
      setCode('');
    } catch (err: any) {
      console.error(err);
      alert('Transaction failed: ' + (err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl mt-8">
      <h2 className="text-lg font-semibold text-slate-200 mb-4">Submit Code for Audit</h2>

      {!publicKey ? (
        <p className="text-slate-400 text-sm">Connect your wallet to submit an audit.</p>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">
              Code to audit <span className="text-slate-600">(its SHA-256 hash is stored on-chain)</span>
            </label>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={'fn main() {\n    // paste Rust/Anchor code here\n}'}
              className="w-full h-32 bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm font-mono text-slate-300 focus:outline-none focus:border-green-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Agent Wallet (recipient)</label>
              <input
                value={agentWallet}
                onChange={(e) => setAgentWallet(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm font-mono text-slate-300 focus:outline-none focus:border-green-500"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Amount (SOL)</label>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                type="number"
                step="0.01"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm font-mono text-slate-300 focus:outline-none focus:border-green-500"
              />
            </div>
          </div>

          <button
            onClick={submit}
            disabled={loading}
            className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Escrowing Funds...' : `Lock ${amount} SOL & Start Audit`}
          </button>

          {txSig && (
            <div className="p-3 bg-slate-950 border border-green-500 rounded-lg">
              <p className="text-green-400 text-sm font-semibold mb-1">
                {phase === 'done' ? '✓ Escrow Locked' : '⏳ Submitted — confirming on Devnet…'}
              </p>
              <a
                href={`https://explorer.solana.com/tx/${txSig}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-slate-400 hover:text-green-400 break-all"
              >
                Watch it live on Explorer: {txSig.slice(0, 24)}...
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
