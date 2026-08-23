'use client';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
  PublicKey, SystemProgram, Transaction, TransactionInstruction, ComputeBudgetProgram,
} from '@solana/web3.js';
import { useState } from 'react';

const PROGRAM_ID = new PublicKey('QZcT1TGL1jePJumCEhbqpw9QD8F4svxQRPjWSUbhZHh');
const ORCHESTRATOR = '4Auzv5FLucUA3qD6Le7qLs3RVXBwatiaWaVBKJpsMXs3';
const DISCRIMINATOR = [194, 80, 6, 180, 232, 127, 48, 171];
const CREATE_TASK_USDC_DISC = [14, 109, 238, 219, 164, 210, 232, 231];
const CANCEL_DISC = [69, 228, 134, 187, 134, 105, 238, 48];
const CANCEL_USDC_DISC = [255, 129, 200, 163, 1, 240, 239, 176];
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
const USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'); // Devnet USDC

const FAIL_SAMPLE = `fn withdraw(amount: u64) {
  // no balance check!
  send_to_user(amount);
}`;

const PASS_SAMPLE = `fn withdraw(amount: u64, balance: &mut u64) {
  if amount > *balance { panic!("insufficient balance"); }
  *balance -= amount;
  send_to_user(amount);
}`;

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function findATA(wallet: PublicKey, mint: PublicKey): PublicKey {
  const [ata] = PublicKey.findProgramAddressSync(
    [wallet.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID
  );
  return ata;
}

function createATAInstruction(payer: PublicKey, ata: PublicKey, owner: PublicKey, mint: PublicKey): TransactionInstruction {
  const data = Buffer.from([1]); // Idempotent create
  const keys = [
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: ata, isSigner: false, isWritable: true },
    { pubkey: owner, isSigner: false, isWritable: false },
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];
  return new TransactionInstruction({ keys, programId: SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID, data });
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

function buildCreateTaskUsdcData(taskHash: string, agentWallet: PublicKey, amount: bigint): Uint8Array {
  const hashBytes = new TextEncoder().encode(taskHash);
  const data = new Uint8Array(8 + 4 + hashBytes.length + 32 + 8);
  const view = new DataView(data.buffer);
  let o = 0;
  for (const b of CREATE_TASK_USDC_DISC) data[o++] = b;
  view.setUint32(o, hashBytes.length, true); o += 4;
  data.set(hashBytes, o); o += hashBytes.length;
  data.set(agentWallet.toBytes(), o); o += 32;
  view.setBigUint64(o, amount, true);
  return data;
}

export default function AuditForm() {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const [code, setCode] = useState('');
  const [agentWallet, setAgentWallet] = useState(ORCHESTRATOR);
  const [amount, setAmount] = useState('0.05');
  const [paymentMethod, setPaymentMethod] = useState<'SOL' | 'USDC'>('SOL');
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [txSig, setTxSig] = useState<string>(() => (typeof window !== 'undefined' ? localStorage.getItem('aa_txSig') || '' : ''));
  const [phase, setPhase] = useState<'idle' | 'confirming' | 'done'>(() => (typeof window !== 'undefined' && localStorage.getItem('aa_txSig') ? 'done' : 'idle'));
  const [lastCode, setLastCode] = useState<string>(() => (typeof window !== 'undefined' ? localStorage.getItem('aa_lastCode') || '' : ''));
  const [verdict, setVerdict] = useState<any>(null);
  const [auditing, setAuditing] = useState(false);

  const submit = async () => {
    if (!publicKey) { alert('Connect your wallet first'); return; }
    if (!code.trim()) { alert('Enter some code to audit'); return; }
    const isUsdc = paymentMethod === 'USDC';
    if (isUsdc && agentWallet.trim() === publicKey.toBase58()) {
      alert('On-chain anti-wash-trade rule: the agent wallet must differ from the payer wallet. The orchestrator wallet is pre-filled as the agent.');
      return;
    }
    setLoading(true);
    setVerdict(null);
    try {
      const [escrowPda] = PublicKey.findProgramAddressSync(
        [new TextEncoder().encode('escrow'), publicKey.toBuffer()],
        PROGRAM_ID
      );
      const taskHash = await sha256Hex(code);
      const decimals = isUsdc ? 6 : 9;
      const amountBigInt = BigInt(Math.round(parseFloat(amount) * Math.pow(10, decimals)));

      const tx = new Transaction();
      tx.feePayer = publicKey;
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }));
      tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }));

      if (isUsdc) {
        const userATA = findATA(publicKey, USDC_MINT);
        const escrowATA = findATA(escrowPda, USDC_MINT);
        const agentKey = new PublicKey(agentWallet.trim());
        const agentATA = findATA(agentKey, USDC_MINT);
        tx.add(createATAInstruction(publicKey, userATA, publicKey, USDC_MINT));
        tx.add(createATAInstruction(publicKey, escrowATA, escrowPda, USDC_MINT));
        tx.add(createATAInstruction(publicKey, agentATA, agentKey, USDC_MINT));
        tx.add(new TransactionInstruction({
          keys: [
            { pubkey: escrowPda, isSigner: false, isWritable: true },
            { pubkey: publicKey, isSigner: true, isWritable: true },
            { pubkey: userATA, isSigner: false, isWritable: true },
            { pubkey: escrowATA, isSigner: false, isWritable: true },
            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          programId: PROGRAM_ID,
          data: buildCreateTaskUsdcData(taskHash, agentKey, amountBigInt) as unknown as Buffer,
        }));
      } else {
        tx.add(new TransactionInstruction({
          keys: [
            { pubkey: escrowPda, isSigner: false, isWritable: true },
            { pubkey: publicKey, isSigner: true, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          programId: PROGRAM_ID,
          data: buildCreateTaskData(taskHash, new PublicKey(agentWallet.trim()), amountBigInt) as unknown as Buffer,
        }));
      }

      if (!signTransaction) throw new Error('Wallet does not support signTransaction');
      const signedTx = await signTransaction(tx);
      const signature = await connection.sendRawTransaction(signedTx.serialize(), { maxRetries: 10 });
      setTxSig(signature);
      setPhase('confirming');
      if (typeof window !== 'undefined') localStorage.setItem('aa_txSig', signature);

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
      if (typeof window !== 'undefined') localStorage.setItem('aa_lastCode', code);
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
      if (res?.resolveSig) {
        setTxSig('');
        setPhase('idle');
        if (typeof window !== 'undefined') {
          localStorage.removeItem('aa_txSig');
          localStorage.removeItem('aa_lastCode');
        }
      }
    } catch (e: any) {
      setVerdict({ error: e?.message || 'audit request failed' });
    } finally {
      setAuditing(false);
    }
  };

  const cancelTask = async () => {
    if (!publicKey) return;
    setCancelling(true);
    try {
      const [escrowPda] = PublicKey.findProgramAddressSync(
        [new TextEncoder().encode('escrow'), publicKey.toBuffer()],
        PROGRAM_ID
      );
      const tx = new Transaction();
      tx.feePayer = publicKey;
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;

      if (paymentMethod === 'USDC') {
        const userATA = findATA(publicKey, USDC_MINT);
        const escrowATA = findATA(escrowPda, USDC_MINT);
        tx.add(new TransactionInstruction({
          keys: [
            { pubkey: escrowPda, isSigner: false, isWritable: true },
            { pubkey: publicKey, isSigner: true, isWritable: true },
            { pubkey: userATA, isSigner: false, isWritable: true },
            { pubkey: escrowATA, isSigner: false, isWritable: true },
            { pubkey: USDC_MINT, isSigner: false, isWritable: false },
            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          ],
          programId: PROGRAM_ID,
          data: new Uint8Array(CANCEL_USDC_DISC) as unknown as Buffer,
        }));
      } else {
        tx.add(new TransactionInstruction({
          keys: [
            { pubkey: escrowPda, isSigner: false, isWritable: true },
            { pubkey: publicKey, isSigner: true, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          programId: PROGRAM_ID,
          data: new Uint8Array(CANCEL_DISC) as unknown as Buffer,
        }));
      }

      if (!signTransaction) throw new Error('Wallet does not support signTransaction');
      const signedTx = await signTransaction(tx);
      const signature = await connection.sendRawTransaction(signedTx.serialize(), { maxRetries: 10 });

      const deadline = Date.now() + 60000;
      let ok = false;
      while (Date.now() < deadline) {
        const st = await connection.getSignatureStatus(signature);
        if (st?.value?.err) throw new Error('On-chain error: ' + JSON.stringify(st.value.err));
        if (st?.value?.confirmationStatus === 'confirmed' || st?.value?.confirmationStatus === 'finalized') { ok = true; break; }
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!ok) throw new Error('Cancel tx not confirmed in time');

      setVerdict({ cancelled: true, resolveSig: signature });
      setTxSig('');
      setPhase('idle');
      if (typeof window !== 'undefined') {
        localStorage.removeItem('aa_txSig');
        localStorage.removeItem('aa_lastCode');
      }
    } catch (err: any) {
      console.error(err);
      alert('Cancel failed: ' + (err?.message || err));
    } finally {
      setCancelling(false);
    }
  };

  const settleFailed = verdict && verdict.error && !verdict.resolveSig && !verdict.cancelled;

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-2xl h-full flex flex-col">
      <h2 className="text-sm font-semibold text-slate-200 mb-2">Submit Code for Audit</h2>
      {!publicKey ? (
        <p className="text-slate-400 text-xs">Connect your wallet to submit an audit.</p>
      ) : (
        <div className="space-y-2 flex-1 flex flex-col">
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between gap-2 mb-1">
              <label className="text-xs text-slate-400">
                Code to audit <span className="text-slate-600">(SHA-256 hash stored on-chain)</span>
              </label>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => setCode(PASS_SAMPLE)} className="px-2 py-0.5 text-[10px] bg-green-500/10 text-green-400 border border-green-500/30 rounded hover:bg-green-500/20">▶ PASS sample</button>
                <button onClick={() => setCode(FAIL_SAMPLE)} className="px-2 py-0.5 text-[10px] bg-red-500/10 text-red-400 border border-red-500/30 rounded hover:bg-red-500/20">▶ FAIL sample</button>
              </div>
            </div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={'fn main() {\n  // paste Rust/Anchor code here\n}'}
              className="w-full flex-1 min-h-[60px] bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs font-mono text-slate-300 focus:outline-none focus:border-green-500 resize-none"
            />
          </div>

          <div className="flex gap-2 mb-2">
            <button
              onClick={() => setPaymentMethod('SOL')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border ${paymentMethod === 'SOL' ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-slate-950 border-slate-800 text-slate-400'}`}
            >
              SOL
            </button>
            <button
              onClick={() => setPaymentMethod('USDC')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border ${paymentMethod === 'USDC' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-slate-950 border-slate-800 text-slate-400'}`}
            >
              USDC
            </button>
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
              <label className="block text-xs text-slate-400 mb-1">Amount ({paymentMethod})</label>
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
            {loading ? 'Escrowing Funds...' : `Lock ${amount} ${paymentMethod} & Start Audit`}
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
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button onClick={runAudit} disabled={auditing}
                    className="w-full py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg disabled:opacity-50">
                    {auditing ? '🤖 Auditing…' : '🤖 Run AI Audit & Settle'}
                  </button>
                  <button onClick={cancelTask} disabled={cancelling}
                    className="w-full py-1.5 bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold rounded-lg disabled:opacity-50">
                    {cancelling ? '🚨 Cancelling…' : '🚨 Cancel & Refund'}
                  </button>
                </div>
              )}
            </div>
          )}

          {verdict && (
            <div className={`p-2 rounded-lg border ${verdict.cancelled || settleFailed ? 'bg-orange-950/40 border-orange-500' : verdict.success ? 'bg-green-950/40 border-green-500' : 'bg-red-950/40 border-red-500'}`}>
              <p className={`text-xs font-bold mb-1 ${verdict.cancelled || settleFailed ? 'text-orange-400' : verdict.success ? 'text-green-400' : 'text-red-400'}`}>
                {verdict.cancelled
                  ? '🚨 CANCELLED — escrow closed, funds returned via escape hatch'
                  : settleFailed
                    ? '⚠ Settlement tx failed — escrow still OPEN. Use 🚨 Cancel & Refund.'
                    : verdict.success ? '✓ PASSED — Funds released to agent' : '✗ FAILED — Escrow refunded to user'}
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
