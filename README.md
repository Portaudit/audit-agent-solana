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

## 📊 Market Validation (Visa × Artemis, July 2026)
The Visa/Artemis Agentic Payments Report confirms the thesis AuditAgent is built on:
- **Real machine-native micropayments exist:** x402 has processed ~$19M adjusted volume across ~134M transactions (fraction-of-a-cent average) since May 2025.
- **Trust is the hardest unsolved problem:** the report flags mis-purchase risk, prompt injection, liability ambiguity, and *cascading failures* in agent-to-agent chains — with "no established resolution mechanism."
- **Solana is #2 and the category is still being defined:** the verification/facilitator layer for Solana agentic commerce is unclaimed.

AuditAgent is that layer: a specialized **facilitator** that deterministically verifies an agent's work before on-chain settlement — the missing resolution mechanism for agent-to-agent chains.

**Sources:**
- [Visa × Artemis — Agentic Payments from the Ground Up (July 2026)](https://www.visa.com/en-us/thought-leadership/innovation/agentic-payments-from-the-ground-up)
- [Full Report (PDF)](https://www.visa.com/api/image-proxy?path=%2Fcontent%2Fdam%2Fvisa%2Freimagine-visa%2Fthought-leadership%2Fdocuments%2Fagentic-payments-report.pdf)

**Sources:**
- [Visa × Artemis — Agentic Payments from the Ground Up (July 2026)](https://www.visa.com/en-us/thought-leadership/innovation/agentic-payments-from-the-ground-up)
- [Full Report (PDF)](https://www.visa.com/api/image-proxy?path=%2Fcontent%2Fdam%2Fvisa%2Freimagine-visa%2Fthought-leadership%2Fdocuments%2Fagentic-payments-report.pdf)
