import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, ComputeBudgetProgram } from "@solana/web3.js";
import { BN } from "bn.js";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

// MUST MATCH THE BOT'S SAFE_PAYLOAD EXACTLY
const SAFE_PAYLOAD = 'pub fn withdraw(state: &mut Vault, amount: u64) -> Result<(), &str> { if amount > state.balance { return Err("InsufficientBalance"); } state.balance = state.balance.checked_sub(amount).ok_or("Underflow")?; state.user = state.user.checked_add(amount).ok_or("Overflow")?; Ok(()) }';

const RPC_URL = process.env.RPC_URL!;
const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID!);

const user = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(os.homedir() + "/.config/solana/id.json", "utf8"))));
const agentWallet = new PublicKey("5kydHp11SzmqyHMawUJPVma9WRCh7YLzJSLLJGuWPbrH");

const connection = new Connection(RPC_URL, "confirmed");
const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(user), { commitment: "confirmed" });
anchor.setProvider(provider);

const idl = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "../target/idl/agent_payrails.json"), "utf8"));
const program = new anchor.Program(idl, provider);

async function main() {
  const hash = crypto.createHash("sha256").update(SAFE_PAYLOAD).digest("hex");
  console.log("📝 Committing hash:", hash);

  const tx = await program.methods
    .createTask(hash, agentWallet, new BN(50000000))
    .preInstructions([ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 200000 })])
    .rpc();

  console.log("🔗 Task created:", `https://explorer.solana.com/tx/${tx}?cluster=devnet`);
}

main().catch(e => { console.error("❌", e.message); process.exit(1); });
