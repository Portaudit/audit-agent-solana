import { NextResponse } from 'next/server';
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { z } from 'zod';
import crypto from 'crypto';

const PROGRAM_ID = new PublicKey('QZcT1TGL1jePJumCEhbqpw9QD8F4svxQRPjWSUbhZHh');
const RESOLVE_DISC = [116, 245, 180, 251, 30, 233, 101, 33];
const RESOLVE_USDC_DISC = [135, 5, 200, 120, 68, 243, 252, 42];
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
const USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'); // Devnet USDC

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

const AuditSchema = z.object({
  reasoning: z.string(), passed: z.boolean(),
  vulnerabilities: z.array(z.object({ severity: z.string(), description: z.string() })),
  patch: z.string(), confidence: z.number(),
});

function loadOrchestrator(): Keypair {
  const secret = process.env.ORCHESTRATOR_SECRET;
  if (!secret) throw new Error('ORCHESTRATOR_SECRET not set');
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret)));
}

function deriveEscrow(user: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync([new TextEncoder().encode('escrow'), user.toBuffer()], PROGRAM_ID);
  return pda;
}

function findATA(wallet: PublicKey, mint: PublicKey): PublicKey {
  const [ata] = PublicKey.findProgramAddressSync(
    [wallet.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID
  );
  return ata;
}

function parseEscrow(data: Buffer) {
  let o = 8;
  const user = new PublicKey(data.subarray(o, o + 32)); o += 32;
  const agent = new PublicKey(data.subarray(o, o + 32)); o += 32;
  const len = data.readUInt32LE(o); o += 4;
  const hash = data.subarray(o, o + len).toString('utf-8'); o += len;
  const status = data.readUInt8(o); o += 1;
  const amount = data.readBigUInt64LE(o); o += 8;
  const is_usdc = data.readUInt8(o) === 1;
  return { user, agent, hash, status, amount, is_usdc };
}

async function pollConfirmed(sig: string, ms = 30000): Promise<boolean> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const st = await connection.getSignatureStatus(sig);
    if (st?.value?.err) throw new Error('resolve failed on-chain: ' + JSON.stringify(st.value.err));
    if (st?.value?.confirmationStatus === 'confirmed' || st?.value?.confirmationStatus === 'finalized') return true;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

export async function POST(req: Request) {
  try {
    const { code, user } = await req.json();
    if (!code || !user) return NextResponse.json({ error: 'code and user required' }, { status: 400 });

    const userKey = new PublicKey(user);
    const expected = crypto.createHash('sha256').update(code).digest('hex');
    const escrow = deriveEscrow(userKey);

    const info = await connection.getAccountInfo(escrow);
    if (!info) return NextResponse.json({ error: 'No escrow found.' }, { status: 400 });
    const state = parseEscrow(info.data);
    if (state.status !== 0) return NextResponse.json({ error: 'Escrow already resolved.' }, { status: 400 });
    if (state.hash !== expected) return NextResponse.json({ error: 'task_hash mismatch: code does not match on-chain commitment.' }, { status: 400 });

    let success = false;
    let result: z.infer<typeof AuditSchema> | null = null;
    let auditError: string | null = null;
    try {
      const llm = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b:free',
          temperature: 0.2,
          temperature: 0.2,
          messages: [
            { role: 'system', content: 'You are a smart-contract security auditor auditing a SHORT CODE SNIPPET that gates an on-chain settlement. Judge ONLY the logic visible in the snippet. passed=true when the visible logic contains no exploitable vulnerability (missing balance or overflow checks, unsafe ordering that enables reentrancy, unchecked arithmetic, logic that can drain or lock funds). Do NOT fail for: undefined helper functions, missing access control or event emission in a snippet, naming/style/API-design preferences, or hypothetical compile errors in unseen code; mention such nits in reasoning while keeping passed=true if the shown logic is safe. Respond ONLY with valid JSON: {"reasoning": string, "passed": boolean, "vulnerabilities": [{"severity": string, "description": string}], "patch": string, "confidence": number}.' },
            { role: 'user', content: code },
          ],
        }),
      }).then((r) => r.json());
      if (llm?.error) auditError = 'OpenRouter error: ' + (llm.error?.message || JSON.stringify(llm.error));
      const rawText = llm.choices?.[0]?.message?.content ?? '';
      const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const si = cleaned.indexOf('{');
      const ei = cleaned.lastIndexOf('}');
      const text = si >= 0 && ei > si ? cleaned.slice(si, ei + 1) : cleaned;
      const parsed = AuditSchema.safeParse(JSON.parse(text));
      if (parsed.success) {
        result = parsed.data;
        success = parsed.data.passed && parsed.data.confidence >= 0.7;
      } else {
        auditError = auditError || ('Schema mismatch: ' + JSON.stringify(parsed.error?.issues?.slice(0, 2)));
      }
    } catch (err: any) {
      success = false;
      auditError = auditError || ('Audit exception: ' + (err?.message || String(err)));
    }

    const orch = loadOrchestrator();
    const tx = new Transaction();
    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = orch.publicKey;
    
    const data = new Uint8Array(9);
    let keys: any[] = [];

    if (state.is_usdc) {
      RESOLVE_USDC_DISC.forEach((b, i) => (data[i] = b));
      data[8] = success ? 1 : 0;
      
      const userATA = findATA(state.user, USDC_MINT);
      const agentATA = findATA(state.agent, USDC_MINT);
      const escrowATA = findATA(escrow, USDC_MINT);

      keys = [
        { pubkey: escrow, isSigner: false, isWritable: true },
        { pubkey: orch.publicKey, isSigner: true, isWritable: true },
        { pubkey: state.user, isSigner: false, isWritable: true },
        { pubkey: state.agent, isSigner: false, isWritable: true },
        { pubkey: userATA, isSigner: false, isWritable: true },
        { pubkey: agentATA, isSigner: false, isWritable: true },
        { pubkey: escrowATA, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ];
    } else {
      RESOLVE_DISC.forEach((b, i) => (data[i] = b));
      data[8] = success ? 1 : 0;
      keys = [
        { pubkey: escrow, isSigner: false, isWritable: true },
        { pubkey: orch.publicKey, isSigner: true, isWritable: true },
        { pubkey: state.user, isSigner: false, isWritable: true },
        { pubkey: state.agent, isSigner: false, isWritable: true },
      ];
    }

    tx.add(new TransactionInstruction({
      keys,
      programId: PROGRAM_ID,
      data: data as unknown as Buffer,
    }));
    let sig: string | null = null;
    for (let attempt = 0; attempt < 3 && !sig; attempt++) {
      try {
        const bh = await connection.getLatestBlockhash();
        tx.recentBlockhash = bh.blockhash;
        sig = await connection.sendTransaction(tx, [orch], { maxRetries: 10, preflightCommitment: 'confirmed' });
      } catch (e: any) {
        if (attempt === 2 || !/blockhash/i.test(e?.message || '')) throw e;
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    await pollConfirmed(sig as string);

    return NextResponse.json({ success, result, resolveSig: sig, auditError });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'audit failed' }, { status: 500 });
  }
}
