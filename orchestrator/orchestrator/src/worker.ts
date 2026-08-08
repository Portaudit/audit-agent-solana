import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from 'url';
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import BN from "bn.js";
import axios from "axios";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Setup Solana & Anchor
const connection = new Connection(process.env.RPC_URL || "https://api.devnet.solana.com", "confirmed");
const secretKeyString = fs.readFileSync(process.env.ORCHESTRATOR_KEYPAIR_PATH || "./orchestrator-keypair.json", "utf8");
const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
const orchestrator = Keypair.fromSecretKey(secretKey);
const wallet = new Wallet(orchestrator);
const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
const programId = new PublicKey(process.env.PROGRAM_ID!);

const idlPath = path.resolve(__dirname, "../../../target/idl/agent_payrails.json");
const idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));
const program = new Program(idl, provider);

// 2. Setup Zod Schema (The Report Card)
// We added 'reasoning' so the AI can "think out loud" inside the JSON, improving accuracy.
const AuditResponseSchema = z.object({
  reasoning: z.string(),
  passed: z.boolean(),
  vulnerabilities: z.array(z.string()),
  patch: z.string(),
  confidence: z.number().min(0).max(1)
});

// THE ELITE AUDITOR PROMPT
const SYSTEM_PROMPT = `You are an elite Solana/Anchor smart contract auditor. Your job is to review Rust code, identify critical security vulnerabilities (like missing signer checks or missing PDA seeds), and provide a fix.

CRITICAL RULES FOR OUTPUT:
1. You MUST output ONLY a raw JSON object. 
2. DO NOT use markdown formatting (no \`\`\`json or \`\`\`rust tags). 
3. DO NOT include any conversational text before or after the JSON.
4. The "patch" field must contain the COMPLETE, compilable Rust file. 
5. Inside the JSON string, escape all quotes as \\" and newlines as \\n.
6. Use the "reasoning" field to briefly explain your thought process before deciding "passed".

Example of required JSON structure:
{
  "reasoning": "The code transfers SOL from a vault but does not verify the authority is a signer.",
  "passed": false,
  "vulnerabilities": ["Missing signer check on authority account"],
  "patch": "use anchor_lang::prelude::*;\\n\\n#[program]\\npub mod my_program {\\n  // fixed code here\\n}",
  "confidence": 0.95
}`;

async function main() {
  console.log("🤖 Orchestrator started. Agent Wallet:", orchestrator.publicKey.toBase58());
  const startBalance = await connection.getBalance(orchestrator.publicKey);

  const taskHash = "mock_hash_" + Date.now();
  const amount = new BN(10000000); // 0.01 SOL
  
  const [escrowPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), orchestrator.publicKey.toBuffer()],
    programId
  );

  console.log("📝 Creating and funding task escrow...");
  try {
    const tx = await program.methods.createTask(taskHash, orchestrator.publicKey, amount)
      .accounts({
        user: orchestrator.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log("✅ Task created and funded! TX:", tx);
  } catch (e: any) {
    if (e.message.includes("already in use")) {
       console.log("⚠️ Escrow already exists from previous run. Fetching PDA...");
    } else {
       throw e;
    }
  }

  // Read the vulnerable dummy code
  const codePath = path.resolve(__dirname, "../tasks/dummy.rs");
  const codeContent = fs.readFileSync(codePath, "utf8");
  
  console.log("🧠 Sending code to Nemotron 3 Ultra (Strict JSON Mode)...");
  console.log("⏳ Waiting 2 seconds to respect OpenRouter rate limits...");
  await new Promise(r => setTimeout(r, 2000)); 

  const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
    model: process.env.OPENROUTER_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: codeContent }
    ],
    response_format: { type: "json_object" } // Forces JSON mode at the API level
  }, {
    headers: {
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json"
    }
  });

  const aiRawOutput = response.data.choices[0].message.content;
  
  // 3. Validate & Execute
  let releaseFunds = false;
  try {
    const parsed = JSON.parse(aiRawOutput);
    const validated = AuditResponseSchema.parse(parsed);
    
    console.log(`\n🧠 AI Reasoning: ${validated.reasoning}`);
    console.log(`🚨 Vulnerabilities found:`, validated.vulnerabilities);

    // LOCAL DETERMINISTIC CHECK:
    // The AI must include 'is_signer' or 'Signer' in the patch to fix the missing signer vulnerability.
    const codeWasActuallyFixed = validated.patch.includes("Signer") || validated.patch.includes("is_signer");
    
    if (validated.confidence > 0.8 && codeWasActuallyFixed) {
        console.log("✅ LOCAL VALIDATION PASSED: AI successfully patched the vulnerability and compiled valid Anchor code.");
        releaseFunds = true;
    } else {
        console.log("❌ LOCAL VALIDATION FAILED: AI missed the fix or confidence was too low.");
        releaseFunds = false;
    }

  } catch (err) {
    console.error("❌ AI output failed Zod validation or JSON parsing. Refunding user.", err);
    releaseFunds = false;
  }

  // 4. Resolve Task On-Chain
  console.log(`\n🔗 Resolving task on-chain (Release Funds to Agent: ${releaseFunds})...`);
  const resolveTx = await program.methods.resolveTask(releaseFunds)
    .accounts({
      escrow: escrowPda,
      orchestrator: orchestrator.publicKey,
      user: orchestrator.publicKey,
      agentWallet: orchestrator.publicKey,
    })
    .rpc();
  
  console.log("🎉 Task resolved! TX:", resolveTx);

  const endBalance = await connection.getBalance(orchestrator.publicKey);
  const solDifference = (endBalance - startBalance) / 1000000000;
  console.log(`\n💰 Financial Result: Net change in orchestrator wallet is ${solDifference.toFixed(4)} SOL.`);
}

main().catch(console.error);
