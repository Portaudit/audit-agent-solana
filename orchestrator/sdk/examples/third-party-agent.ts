import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { AuditAgentClient } from '../src/client';
import { SAMPLE_SAFE_CODE } from '../src/constants';

async function main() {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const client = new AuditAgentClient(connection);

  console.log('🧪 Third-party agent simulation (AuditAgent SDK v1)');
  const agent = Keypair.generate();
  console.log('   Fresh agent wallet:', agent.publicKey.toBase58());

  console.log('🪂 Airdropping 1 devnet SOL...');
  try {
    const sig = await connection.requestAirdrop(agent.publicKey, LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig, 'confirmed');
  } catch (e) {
    console.error('   Airdrop rate-limited. Use https://faucet.solana.com for', agent.publicKey.toBase58());
    process.exit(1);
  }

  console.log('🔐 Locking 0.01 SOL escrow (hash commitment on-chain)...');
  const { signature } = await client.createTask(agent, {
    code: SAMPLE_SAFE_CODE,
    agent: agent.publicKey,
    lamports: BigInt(10_000_000),
  });
  console.log('   Escrow tx:', `https://explorer.solana.com/tx/${signature}?cluster=devnet`);

  console.log('📡 Revealing work to PUBLIC API (theauditagent.xyz/api/audit)...');
  const verdict = await client.revealAndSettle(agent.publicKey.toBase58(), SAMPLE_SAFE_CODE);
  console.log('   Verdict:', verdict.success ? 'PASS ✅' : 'FAIL ❌', verdict.auditError ? `(${verdict.auditError})` : '');
  if (verdict.resolveSig) console.log('   Settlement tx:', `https://explorer.solana.com/tx/${verdict.resolveSig}?cluster=devnet`);

  const finalState = await client.getEscrow(agent.publicKey);
  console.log('🏁 Final escrow state:', finalState ? finalState.status : 'closed (settled on-chain)');
  console.log('📊 A NEW agent row will now appear on the leaderboard — a stranger got paid for verified work.');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
