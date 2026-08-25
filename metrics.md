# AuditAgent — W2 Metrics

## Week 1 (SOL Rail)
- **Escrows Created:** 1
- **Audits Run:** 1
- **Settlement Success Rate:** 100%
- **Total Volume:** 0.05 SOL

## Week 2 (USDC Commerce Rail + Escape Hatch)
- **Escrows Created:** 2 (SOL + USDC)
- **Audits Run:** 2
- **Settlement Success Rate:** 100%
- **Total Volume:** 0.05 SOL + 0.05 USDC
- **Cancel Escapes:** 1 (stuck escrow rescued)

## Transaction Receipts
- **Cancel USDC:** `2z4R7AJ73P4upYhWSyc...` (escape hatch demo)
- **Lock USDC:** `4SGCtusAMTGcyc2BCmBAy...` (USDC escrow created)
- **Refund USDC:** `2SmkEQWbJRuHahBuXaX48pSY...` (orchestrator-signed refund)

## Key Features Shipped
- ✅ USDC escrow (`create_task_usdc`)
- ✅ USDC settlement (`resolve_task_usdc`)
- ✅ Cancel escape hatch (`cancel_task`, `cancel_task_usdc`)
- ✅ Dual balance badges (SOL + USDC)
- ✅ Anti-wash-trade guard
- ✅ About page
