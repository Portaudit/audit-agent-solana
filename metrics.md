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

## W2 Recording Session — Live Production (auditor: Ling 3.0 Flash via OpenRouter)
| Event | Rail | Verdict | Settlement Tx |
|---|---|---|---|
| PASS — funds released to agent | USDC | 95% conf | 4tDgDPAguCEsoYVr2Cu3uin2... |
| PASS — funds released to agent | USDC | 95% conf | 3bK2c6GRZALK7DDz3iHiLZhS... |
| FAIL — vulnerable code auto-refunded | USDC | 95% conf | 3Z3pFtAQP7L2MD9z3AzHK6Bw... |
| FAIL-CLOSED — provider 429, user refunded | USDC | safe default | VgK4FPcBRYTj65bNDXLkLLYT... |
| CANCEL — escape hatch refund | USDC | user-initiated | 518WtzZ2p44i4pNEcqwYwtev... |

## W3 — Autonomous ClawPump Settlement Loop (Sept 3, 00:01 SAST)
- FIRST FULL AUTONOMOUS PASS: hash-commit → commitment verify → AI audit → settle-on-pass
  - AI audit: Ling 3.0 Flash via OpenRouter/NovitaAI — HTTP 200, 849ms, verdict PASS
  - Bot-signed settlement (release): ce3XmM8aCAafcgALJtiCX397betgojr5gLVe7XEhLcJz2uXXcBEvF4MyvypPTsG8ZUgysjiYU6HeFUihXcpQaZx
  - Live pending escrow kept as marketplace demo prop: 2GW76hDM6cYJ1RU6SfqRoVckw12k2zQoXvdvrr5DrLwfm6MxsyfhcUXeAjJsCdG5vgx4n3urZkY2zfXGdVjBrXhw
- Fail-closed security receipts (audit unavailable → autonomous refund, funds never at risk):
  - 6NG7RnRvpjW8pFj7fEqZdTYiJkVGp4GNRqrx6bbbuDPPYW3QCguWiSLApNXw5pj8fdKVAf5XkjMqr7WjrB278su
  - 4fNxuHap8Xe9y2kFa86RGSyxggR3ojU5pWPcHVagA17TQBtqedmWteebk8BksEYJ23maBApQTfyxYMX3tg6bJjqQ
  - NqHXQ7V4V7z9dYkxKVdyx4DbgdPfFnvLz2nRF2cQzPjwsnkRK6jK2rDhV1QXwC2Pos5UY3hqzDRBQXD1pgfLh9b
  - 27fccDUDxNEjKh2awR1E6zK25srNk3EifiM6NxznXHAZVao8Yi2wfM2K5NV8hLY5t2CVSTX9ZLtTt96Ry2GLcGCe
  - FtNWUQYF9nx71rcurgxAaSUEA1uwpT5ohLap6Byd3QtNLUMeLpQhtSWhNeKPcdD12SV1VQHiseEGNwDrPYxwamf
  - 5BrD6CkRRZLVCYKnqgmzBk15ZdgcNx3vFBavKk6K2h2g1hbUuMyjvND3dV1qrNcSwD4hbJC3VkNWwe7bmURNVFae
- Resilience: OpenRouter (Ling) primary + Google Gemini 2.5 Flash direct fallback, exponential backoff
- Orchestrator wallet: 5kydHp11SzmqyHMawUJPVma9WRCh7YLzJSLLJGuWPbrH
