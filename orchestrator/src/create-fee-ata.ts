import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, SystemProgram } from "@solana/web3.js";
import * as fs from "fs";
import dotenv from "dotenv";
dotenv.config();

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ATA_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const USDC_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
const FEE_WALLET = new PublicKey("6qz9eLcCJgeMHraij2Dtkqoz2EZQaDvE4Jfh5sSjokaB");
const FEE_ATA = new PublicKey("9FQzaKqtPccfgnj8GJi5DMuWn1Zezz37PAQfgP9JxaRZ");

async function main() {
  const payer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(process.env.ORCHESTRATOR_KEYPAIR_PATH!, "utf8"))));
  const conn = new Connection(process.env.RPC_URL!, "confirmed");
  const ix = new TransactionInstruction({
    keys: [
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: FEE_ATA, isSigner: false, isWritable: true },
      { pubkey: FEE_WALLET, isSigner: false, isWritable: false },
      { pubkey: USDC_MINT, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    programId: ATA_PROGRAM,
    data: Buffer.from([1]), // idempotent create
  });
  const tx = new Transaction().add(ix);
  tx.feePayer = payer.publicKey;
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
  tx.sign(payer);
  const sig = await conn.sendRawTransaction(tx.serialize(), { maxRetries: 10 });
  await conn.confirmTransaction(sig, "confirmed");
  console.log("✅ Fee ATA funded:", `https://explorer.solana.com/tx/${sig}?cluster=devnet`);
}
main().catch(e => { console.error("❌", e.message); process.exit(1); });
