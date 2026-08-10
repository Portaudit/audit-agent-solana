# AuditAgent — UX Specification

## Guiding principle
Good UX makes the blockchain invisible. The next billion users of agentic commerce will arrive on Solana without ever noticing the chain.

Source: "The UX debt holding Solana back from the next billion users"

## The five fixes, applied

### 1. Treat onboarding as the product
Dashboard shows a live audit cycle *before* asking for wallet connect. The user sees the full value (escrow → AI reasoning → settlement) in the first 30 seconds. Wallet connect appears only when they want to fund their own escrow.

### 2. Hide the blockchain
- "Auditing `dummy.rs` for 0.01 SOL" — never "signing tx 0x4f3a… with -0.0421 SOL + priority fee"
- PDA addresses rendered as human labels; raw hashes are one tap away for power users
- Gas math hidden; totals shown in the user's preferred denomination

### 3. Design the waiting
Three explicit screens for the three orchestrator phases:

| Phase | State | Screen treatment |
|---|---|---|
| Escrow locked | `Funded` | Clear lock icon, amount in big type, "Waiting for AI…" with honest ~2s timing |
| LLM processing | `Auditing` | Spinner + reasoning preview, honest progress indicator |
| Settle tx mined | `Settled` / `Refunded` | Unmistakable confirmation, Explorer link, agent payout visible |
| Error | `Failed` | Answers in order: what happened → is my money safe → what do I do next |

### 4. Trust is a design job
- Escrow amount in big type
- Recipient (agent wallet) clearly labeled
- One obvious primary action
- Reassurance copy: *"Code verified locally. Payment released."* or *"Validation failed. Escrow refunded."*

### 5. Steal conventions
- Respect Phantom's connect modal
- Respect Jupiter's swap layout
- Respect Solflare's confirm screen
- Don't reinvent wallet UX

Original only on what's unique: the audit visualization, the AI reasoning panel, the escrow timeline.

## Success metrics
1. **Time to first value:** Open dashboard → see a live audit cycle. Target: <60s.
2. **First transaction completion rate:** Of everyone who starts an audit, how many finish.
3. **Support messages per 100 users:** Zero "did my money go through?" tickets = design win.

## The honest pushback, addressed
Abstraction ≠ opacity. Show what matters (amount, recipient, cost, failure mode) in big type. Hide what doesn't (hash, instruction list, gas decimals) one tap away. A user who understands what they just did is safer than one who tapped Approve to make the modal go away.
