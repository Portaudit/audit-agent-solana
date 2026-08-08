# AuditAgent: Architecture & Decision Log

## Data Flow
User funds escrow -> Orchestrator reads code -> LLM returns strict JSON -> Zod validates -> resolve_task pays or refunds -> escrow auto-closes.

## Key Decisions

### 1. Native invoke over Anchor's transfer wrapper
Anchor 1.0 changed the internal types of its system_program wrapper (CpiContext expected a Pubkey but received an AccountInfo). Rather than fight a moving API, I used anchor_lang::solana_program::program::invoke with system_instruction::transfer. It is version-stable, explicit about account inputs, and is the universal standard for native SOL transfers.

### 2. Two-layer JSON enforcement for the LLM
API layer: response_format json_object constrains the model to valid JSON. Application layer: a Zod schema (reasoning, passed, vulnerabilities, patch, confidence) parses the output; any parse failure triggers a refund. The system prompt forces chain-of-thought INSIDE the reasoning field so no markdown leaks outside the JSON.

### 3. close = user on the escrow PDA
Prevents state bloat and rent lockup. After resolution the account is deleted and rent returns to the user. Combined with the TaskAlreadyResolved status check, this is defense-in-depth against double-resolution.

### 4. Free-tier LLM protection
The orchestrator treats the LLM as an expensive, rate-limited API: a 2s delay between calls, stateless single-shot prompts (no chat memory), semantic caching of audited code, and chunking for large files.

### 5. Native SOL instead of SPL tokens
MVP simplicity. USDC/SPL support is a roadmap item once the escrow primitive is proven.

## Trust Model & Roadmap
Current MVP: the orchestrator is a trusted validator (oracle model). Roadmap: move to decentralized validation (multiple validators or staking) so no single party controls settlement.
