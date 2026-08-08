![AuditAgent Banner](./banner.jpg)

# AuditAgent: Trustless AI Settlement Rails for Solana

## 🌐 Live on Devnet
**Program ID:** `QZcT1TGL1jePJumCEhbqpw9QD8F4svxQRPjWSUbhZHh`  
[View on Solana Explorer](https://explorer.solana.com/address/QZcT1TGL1jePJumCEhbqpw9QD8F4svxQRPjWSUbhZHh?cluster=devnet)

## 🚨 The Problem
AI agents can generate Solana code, but they hallucinate. If an AI agent writes a buggy smart contract, or if a protocol uses AI to audit code, how do you mathematically prove the work was done correctly *before* paying for it? 

## 💡 The Solution
AuditAgent is a deterministic, on-chain escrow system. An AI agent (powered by Nemotron 3 Ultra) only receives its payment if its generated patch **compiles locally** and **passes strict Zod validation schemas**. 

## 🏗️ Why Solana?
This architecture requires sub-second finality and micro-fees. An agent running 10 validation loops per minute would burn $50 in gas on Ethereum L2s. On Solana, it costs fractions of a cent. **Solana is the only chain capable of high-frequency AI agent commerce.**

## 🧠 The Sherlock Connection
The validation logic is inspired by Sherlock.xyz contest criteria. The AI doesn't just "guess" code; it is forced to identify specific vulnerabilities (missing signer checks, PDA seed verification) and prove the fix locally.

## 🛠️ Tech Stack
- **Smart Contract:** Anchor (Rust) - Deterministic Escrow & Auto-Close
- **AI Orchestrator:** Node.js / TypeScript - ReAct Loop & Zod Validation
- **AI Model:** Nemotron 3 Ultra (via OpenRouter) - Structured JSON Mode
- **Compute Cost:** $0.00 per audit (Free-tier optimized)

## 🚀 How it Works
1. User funds the on-chain escrow.
2. Orchestrator reads the code and sends it to Nemotron.
3. Nemotron returns a strict JSON object with the patch and confidence score.
4. Orchestrator validates the patch locally.
5. If valid, the smart contract pays the AI Agent and closes the account.

## 🧪 Quickstart (Run It Yourself)

```bash
# Build the program and generate the IDL
anchor build

# Set up the orchestrator
cd orchestrator/orchestrator
npm install
cp .env.example .env   # paste your OpenRouter key + fund a Devnet keypair

# Run the agent
npm run dev
```

## 🧪 Quickstart (Run It Yourself)

```bash
# Build the program and generate the IDL
anchor build

# Set up the orchestrator
cd orchestrator/orchestrator
npm install
cp .env.example .env   # paste your OpenRouter key + fund a Devnet keypair

# Run the agent
npm run dev
```
