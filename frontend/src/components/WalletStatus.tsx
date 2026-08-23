'use client';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// Circle USDC on Solana Devnet (the commerce rail asset)
const USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

// Render the wallet button client-only to avoid hydration mismatch
const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then((m) => m.WalletMultiButton),
  { ssr: false }
);

export default function WalletStatus() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [balance, setBalance] = useState<number | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null);
  const [airdropping, setAirdropping] = useState(false);

  const refresh = useCallback(async () => {
    if (!publicKey) { setBalance(null); setUsdcBalance(null); return; }
    const lamports = await connection.getBalance(publicKey);
    setBalance(lamports / LAMPORTS_PER_SOL);
    try {
      const resp = await connection.getParsedTokenAccountsByOwner(publicKey, { mint: USDC_MINT });
      const total = resp.value.reduce((sum: number, ta: any) => {
        const ui = ta?.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
        return sum + (ui || 0);
      }, 0);
      setUsdcBalance(total);
    } catch {
      setUsdcBalance(0);
    }
  }, [publicKey, connection]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [refresh]);

  const airdrop = async () => {
    if (!publicKey) return;
    setAirdropping(true);
    try {
      const sig = await connection.requestAirdrop(publicKey, 1);
      await connection.confirmTransaction(sig);
      await refresh();
    } catch (e) {
      console.warn('Airdrop failed (faucet rate-limited). Use CLI transfer instead.');
    } finally {
      setAirdropping(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {publicKey && (
        <>
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm">
            <span className="text-green-400 font-semibold">
              {balance === null ? '…' : balance.toFixed(2)} SOL
            </span>
            <span className="text-slate-500 text-xs">Devnet</span>
            {balance !== null && balance < 0.05 && (
              <button
                onClick={airdrop}
                disabled={airdropping}
                className="ml-1 text-xs px-2 py-1 rounded bg-green-600 hover:bg-green-500 text-white font-medium disabled:opacity-50"
              >
                {airdropping ? 'Airdropping…' : '+1 SOL'}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm">
            <span className="text-blue-400 font-semibold">
              {usdcBalance === null ? '…' : usdcBalance.toFixed(2)} USDC
            </span>
            <span className="text-slate-500 text-xs">Devnet</span>
          </div>
        </>
      )}
      <WalletMultiButton className="!bg-slate-800 hover:!bg-slate-700 !border !border-slate-700 !rounded-lg !text-sm !font-medium !h-10" />
    </div>
  );
}
