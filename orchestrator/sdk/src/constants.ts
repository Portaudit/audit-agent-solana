import { PublicKey } from '@solana/web3.js';

export const PROGRAM_ID = new PublicKey('QZcT1TGL1jePJumCEhbqpw9QD8F4svxQRPjWSUbhZHh');
export const CREATE_TASK_DISC = [194, 80, 6, 180, 232, 127, 48, 171];
export const CANCEL_TASK_DISC = [69, 228, 134, 187, 134, 105, 238, 48];
export const USDC_MINT_DEVNET = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
export const API_BASE = 'https://theauditagent.xyz';

export const SAMPLE_SAFE_CODE = 'pub fn withdraw(amount: u64, balance: &mut u64) -> Result<(), &str> { if amount == 0 || amount > *balance { return Err("InsufficientBalance"); } *balance = balance.checked_sub(amount).ok_or("Underflow")?; Ok(()) }';
