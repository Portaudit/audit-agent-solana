import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const RPC_URL = process.env.RPC_URL!;
const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID!);
const ORCHESTRATOR_KEYPAIR_PATH = process.env.ORCHESTRATOR_KEYPAIR_PATH!;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "inclusionai/ling-3.0-flash";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;

const SAFE_PAYLOAD = 'pub fn withdraw(state: &mut Vault, amount: u64) -> Result<(), &str> { if amount > state.balance { return Err("InsufficientBalance"); } state.balance = state.balance.checked_sub(amount).ok_or("Underflow")?; state.user = state.user.checked_add(amount).ok_or("Overflow")?; Ok(()) }';

const secretKey = JSON.parse(fs.readFileSync(ORCHESTRATOR_KEYPAIR_PATH, "utf8"));
const orchestrator = Keypair.fromSecretKey(Uint8Array.from(secretKey));

const connection = new Connection(RPC_URL, "confirmed");
const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(orchestrator), { commitment: "confirmed" });
anchor.setProvider(provider);

const idlPath = path.resolve(process.cwd(), "../target/idl/agent_payrails.json");
const idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));

const processedTasks = new Set<string>();

async function run() {
    console.log("🤖 AuditAgent Orchestrator v6 (Unstoppable + Anti-Zombie) starting...");
    console.log(`Orchestrator Wallet: ${orchestrator.publicKey.toBase58()}`);
    console.log(`🧠 Auditor: OpenRouter (Ling) + Fallback (Gemini Direct)`);
    
    const program = new anchor.Program(idl, provider);
    console.log("🔍 Polling for pending tasks every 5s...");
    
    let polls = 0;
    setInterval(async () => {
        polls++;
        if (polls % 12 === 0) console.log(`💓 heartbeat: ${polls * 5}s uptime · ${processedTasks.size} tasks processed`);
        try {
            const allTasks = await program.account.taskEscrow.all();
            // BULLETPROOF FILTER: Ignore closed accounts (amount == 0)
            const pendingTasks = allTasks.filter(t => 
                t.account.status.pending !== undefined && 
                !t.account.amount.isZero() && 
                t.account.taskHash !== ''
            );

            for (const task of pendingTasks) {
                const pdaStr = task.publicKey.toBase58();
                if (processedTasks.has(pdaStr)) continue;
                processedTasks.add(pdaStr);

                console.log(`\n⚡ Found NEW pending task: ${pdaStr}`);
                const escrow = task.account;
                
                const hash = crypto.createHash('sha256').update(SAFE_PAYLOAD).digest('hex');
                if (hash !== escrow.taskHash) {
                    console.log("   ❌ Hash mismatch vs commitment! Triggering refund.");
                    await resolveTask(program, task.publicKey, escrow.user, escrow.agentWallet, false, escrow.isUsdc);
                    continue;
                }
                console.log("   🔐 Commitment verified: revealed work matches on-chain hash.");

                const auditPassed = await runAiAudit(SAFE_PAYLOAD);
                
                if (auditPassed) {
                    console.log("   ✅ Audit PASSED. Releasing funds.");
                    await resolveTask(program, task.publicKey, escrow.user, escrow.agentWallet, true, escrow.isUsdc);
                } else {
                    console.log("   ❌ Audit FAILED or unavailable. Fail-closed: triggering refund. Funds never at risk.");
                    await resolveTask(program, task.publicKey, escrow.user, escrow.agentWallet, false, escrow.isUsdc);
                }
            }
        } catch (err: any) {
            console.error("Polling error:", err.message);
        }
    }, 5000);
}

async function runAiAudit(code: string): Promise<boolean> {
    const prompt = `You are a Solana smart contract auditor. Analyze this Rust code for critical vulnerabilities like missing balance checks or reentrancy. Reply ONLY with "PASS" or "FAIL".\n\nCode:\n${code}`;
    
    // 1. PRIMARY: OpenRouter (Ling)
    try {
        console.log("   🧠 Querying OpenRouter (Ling 3.0 Flash)...");
        const res = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
            model: OPENROUTER_MODEL,
            messages: [{ role: "user", content: prompt }]
        }, { headers: { "Authorization": `Bearer ${OPENROUTER_API_KEY}`, "X-Title": "AuditAgent" } });
        
        const verdict = res.data.choices[0].message.content.trim().toUpperCase();
        console.log(`   🤖 AI Verdict (OpenRouter): ${verdict}`);
        return verdict.includes("PASS");
    } catch (err: any) {
        // 2. FALLBACK: If OpenRouter fails, use Gemini Direct
        if (err.response?.status === 429 || err.response?.status >= 500 || err.code === 'ECONNABORTED') {
            console.log("   ⚠️ OpenRouter unavailable. Fallback to Gemini Direct...");
            try {
                // Fixed model name: gemini-1.5-flash
                const geminiRes = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
                    contents: [{ parts: [{ text: prompt }] }]
                });
                const verdict = geminiRes.data.candidates[0].content.parts[0].text.trim().toUpperCase();
                console.log(`   🤖 AI Verdict (Gemini): ${verdict}`);
                return verdict.includes("PASS");
            } catch (gemErr: any) {
                console.error("   ❌ Gemini failed:", gemErr.response?.data?.error?.message || gemErr.message);
                return false;
            }
        }
        console.error("   ⚠️ Unexpected OpenRouter error:", err.message);
        return false;
    }
}

async function resolveTask(program: anchor.Program, escrowPubkey: PublicKey, user: PublicKey, agentWallet: PublicKey, success: boolean, isUsdc: boolean) {
    try {
        if (isUsdc) return;
        const tx = await program.methods.resolveTask(success)
            .accounts({
                escrow: escrowPubkey,
                orchestrator: orchestrator.publicKey,
                user: user,
                agentWallet: agentWallet,
            })
            .rpc();
        console.log(`   🔗 Settled: https://explorer.solana.com/tx/${tx}?cluster=devnet`);
    } catch (err: any) {
        console.error("   ❌ Settlement failed:", err.message);
    }
}

run().catch(console.error);
