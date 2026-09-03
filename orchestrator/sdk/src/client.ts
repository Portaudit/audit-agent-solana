import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction, ComputeBudgetProgram } from '@solana/web3.js';
import crypto from 'crypto';
import { PROGRAM_ID, CREATE_TASK_DISC, CANCEL_TASK_DISC, API_BASE } from './constants';

export type EscrowState = {
  user: PublicKey; agent: PublicKey; taskHash: string;
  status: 'pending' | 'completed' | 'refunded';
  amount: bigint; isUsdc: boolean;
};

export function deriveEscrow(user: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync([new TextEncoder().encode('escrow'), user.toBuffer()], PROGRAM_ID);
  return pda;
}

export async function sha256Hex(input: string): Promise<string> {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function buildCreateData(taskHash: string, agent: PublicKey, lamports: bigint): Uint8Array {
  const hashBytes = new TextEncoder().encode(taskHash);
  const data = new Uint8Array(8 + 4 + hashBytes.length + 32 + 8);
  const view = new DataView(data.buffer);
  let o = 0;
  for (const b of CREATE_TASK_DISC) data[o++] = b;
  view.setUint32(o, hashBytes.length, true); o += 4;
  data.set(hashBytes, o); o += hashBytes.length;
  data.set(agent.toBytes(), o); o += 32;
  view.setBigUint64(o, lamports, true);
  return data;
}

export function parseEscrow(data: Buffer): EscrowState {
  let o = 8;
  const user = new PublicKey(data.subarray(o, o + 32)); o += 32;
  const agent = new PublicKey(data.subarray(o, o + 32)); o += 32;
  const len = data.readUInt32LE(o); o += 4;
  const hash = data.subarray(o, o + len).toString('utf-8'); o += len;
  const statusByte = data.readUInt8(o); o += 1;
  const amount = data.readBigUInt64LE(o); o += 8;
  const isUsdc = data.readUInt8(o) === 1;
  const status = (['pending', 'completed', 'refunded'] as const)[statusByte] || 'pending';
  return { user, agent, taskHash: hash, status, amount, isUsdc };
}

export class AuditAgentClient {
  constructor(public connection: Connection) {}

  async createTask(payer: Keypair, opts: { code: string; agent: PublicKey; lamports: bigint }) {
    const taskHash = await sha256Hex(opts.code);
    const escrow = deriveEscrow(payer.publicKey);
    const tx = new Transaction();
    const { blockhash } = await this.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = payer.publicKey;
    tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }));
    tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }));
    tx.add(new TransactionInstruction({
      keys: [
        { pubkey: escrow, isSigner: false, isWritable: true },
        { pubkey: payer.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data: Buffer.from(buildCreateData(taskHash, opts.agent, opts.lamports)),
    }));
    tx.sign(payer);
    const signature = await this.connection.sendRawTransaction(tx.serialize(), { maxRetries: 10 });
    await this.connection.confirmTransaction(signature, 'confirmed');
    return { signature, escrow, taskHash };
  }

  async cancelTask(payer: Keypair): Promise<string> {
    const escrow = deriveEscrow(payer.publicKey);
    const tx = new Transaction();
    const { blockhash } = await this.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = payer.publicKey;
    tx.add(new TransactionInstruction({
      keys: [
        { pubkey: escrow, isSigner: false, isWritable: true },
        { pubkey: payer.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data: Buffer.from(CANCEL_TASK_DISC),
    }));
    tx.sign(payer);
    const signature = await this.connection.sendRawTransaction(tx.serialize(), { maxRetries: 10 });
    await this.connection.confirmTransaction(signature, 'confirmed');
    return signature;
  }

  async getEscrow(user: PublicKey): Promise<EscrowState | null> {
    const info = await this.connection.getAccountInfo(deriveEscrow(user));
    if (!info) return null;
    return parseEscrow(info.data);
  }

  // Reveals work to the PUBLIC audit API; the orchestrator settles on-chain.
  async revealAndSettle(user: string, code: string): Promise<any> {
    const res = await fetch(`${API_BASE}/api/audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, user }),
    });
    return res.json();
  }
}
