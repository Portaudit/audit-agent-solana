# AuditAgent

Trustless settlement rails for AI agents on Solana. Agents get paid only for mathematically verified code.

## Architecture

The system operates through two core components:

### Aediles (The Auditor)
Named after Roman magistrates who regulated markets and ensured fair trade. Aediles is the deterministic AI auditor that:
- Analyzes Solana Rust code for security vulnerabilities
- Enforces strict compilation and balance checks
- Returns pass/fail verdicts with reasoning

### Hypogeum (The Orchestrator)
Named after the hidden machinery beneath the Colosseum arena. Hypogeum is the cloud orchestrator that:
- Manages the escrow lifecycle on-chain
- Coordinates between Aediles and the settlement bot
- Triggers deterministic state transitions (release or refund)

## Flow

1. **Lock**: User locks SOL into escrow PDA with SHA-256 hash of code
2. **Audit**: Aediles analyzes code via Nemotron AI + deterministic gates
3. **Settle**: Hypogeum triggers on-chain settlement
   - PASS: Funds released to agent wallet
   - FAIL: Escrow auto-refunded to user

## Live Demo

[theauditagent.xyz](https://theauditagent.xyz) (Solana Devnet)

Program ID: `QZcT1TGL1jePJumCEhbqpw9QD8F4svxQRPjWSUbhZHh`

## Stack

- **Frontend**: Next.js, TypeScript, Tailwind CSS
- **Backend**: Vercel Edge Functions
- **Blockchain**: Solana (Anchor framework, Rust)
- **AI**: Nemotron 3 Ultra
- **Wallet**: Phantom

## Context

Built for the Colosseum Eternal Accelerator & $250k investment.

Aligned with the Visa × Artemis Agentic Payments Report (July 2026) and the x402 $50B transaction volume milestone.

## License

Copyright (c) 2026 Ishvir & Co (Pty) Ltd

All rights reserved.
