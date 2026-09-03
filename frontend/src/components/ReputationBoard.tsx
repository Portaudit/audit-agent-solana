'use client';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useEffect, useState } from 'react';

const PROGRAM_ID = new PublicKey('QZcT1TGL1jePJumCEhbqpw9QD8F4svxQRPjWSUbhZHh');

const DISC_CREATE = [194, 80, 6, 180, 232, 127, 48, 171];
const DISC_CREATE_USDC = [14, 109, 238, 219, 164, 210, 232, 231];
const DISC_RESOLVE = [116, 245, 180, 251, 30, 233, 101, 33];
const DISC_RESOLVE_USDC = [135, 5, 200, 120, 68, 243, 252, 42];
const DISC_CANCEL = [69, 228, 134, 187, 134, 105, 238, 48];
const DISC_CANCEL_USDC = [255, 129, 200, 163, 1, 240, 239, 176];

function matchDisc(data: Uint8Array, disc: number[]) {
  for (let i = 0; i < 8; i++) if (data[i] !== disc[i]) return false;
  return true;
}

function readBigUInt64LE(buf: Uint8Array, offset: number) {
  let val = 0;
  for (let i = 0; i < 8; i++) val += buf[offset + i] * Math.pow(256, i);
  return val;
}

type AgentStats = {
  passes: number;
  fails: number;
  volSOL: number;
  volUSDC: number;
};

export default function ReputationBoard() {
  const { connection } = useConnection();
  const [stats, setStats] = useState<Record<string, AgentStats>>({});
  const [globalStats, setGlobalStats] = useState({ created: 0, cancelled: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!connection) return;
    let alive = true;

    const build = async () => {
      try {
        const sigs = await connection.getSignaturesForAddress(PROGRAM_ID, { limit: 50 });
        const cacheRaw = typeof window !== 'undefined' ? localStorage.getItem('aa_lb_cache') : null;
        const cache: Record<string, any> = cacheRaw ? JSON.parse(cacheRaw) : {};
        
        const uncached = sigs.filter(s => !cache[s.signature] && !s.err);
        
        const newTxs = await Promise.allSettled(
          uncached.map(s => connection.getTransaction(s.signature, { maxSupportedTransactionVersion: 0 }))
        );

        newTxs.forEach((res, i) => {
          if (res.status === 'fulfilled' && res.value) {
            const tx = res.value;
            const ix = tx.transaction.message.compiledInstructions.find(
              (ix) => tx.transaction.message.staticAccountKeys[ix.programIdIndex].equals(PROGRAM_ID)
            );
            if (!ix) return;
            
            const data = ix.data;
            const accounts = ix.accountKeyIndexes.map(idx => tx.transaction.message.staticAccountKeys[idx].toBase58());

            if (matchDisc(data, DISC_CREATE) || matchDisc(data, DISC_CREATE_USDC)) {
              let o = 8;
              const len = data[o] | (data[o+1]<<8) | (data[o+2]<<16) | (data[o+3]<<24); o += 4;
              o += len;
              const agent = new PublicKey(data.slice(o, o + 32)).toBase58(); o += 32;
              const amount = Number(readBigUInt64LE(data, o));
              const isUsdc = matchDisc(data, DISC_CREATE_USDC);
              cache[uncached[i].signature] = { type: 'create', agent, amount, isUsdc, escrow: accounts[0] };
            } else if (matchDisc(data, DISC_RESOLVE) || matchDisc(data, DISC_RESOLVE_USDC)) {
              const success = data[8] === 1;
              const agent = accounts[3]; // escrow, orch, user, agent
              cache[uncached[i].signature] = { type: 'resolve', agent, success, escrow: accounts[0] };
            } else if (matchDisc(data, DISC_CANCEL) || matchDisc(data, DISC_CANCEL_USDC)) {
              cache[uncached[i].signature] = { type: 'cancel', escrow: accounts[0] };
            }
          }
        });

        if (typeof window !== 'undefined') {
          localStorage.setItem('aa_lb_cache', JSON.stringify(cache));
        }

        // Aggregate
        const agentStats: Record<string, AgentStats> = {};
        const escrowMap: Record<string, any> = {};
        let created = 0, cancelled = 0;

        const sortedSigs = sigs.map(s => s.signature).reverse();
        for (const sig of sortedSigs) {
          const info = cache[sig];
          if (!info) continue;
          
          if (info.type === 'create') {
            escrowMap[info.escrow] = info;
            created++;
          } else if (info.type === 'resolve') {
            const createInfo = escrowMap[info.escrow];
            if (!info.agent) continue;
            
            if (!agentStats[info.agent]) {
              agentStats[info.agent] = { passes: 0, fails: 0, volSOL: 0, volUSDC: 0 };
            }
            
            if (info.success) {
              agentStats[info.agent].passes++;
              if (createInfo) {
                if (createInfo.isUsdc) agentStats[info.agent].volUSDC += createInfo.amount / 1e6;
                else agentStats[info.agent].volSOL += createInfo.amount / 1e9;
              }
            } else {
              agentStats[info.agent].fails++;
            }
          } else if (info.type === 'cancel') {
            cancelled++;
          }
        }

        if (alive) {
          setStats(agentStats);
          setGlobalStats({ created, cancelled });
          setLoading(false);
        }
      } catch (e) {
        console.error("ReputationBoard fetch error:", e);
        if (alive) setLoading(false);
      }
    };
    build();
    const t = setInterval(build, 60000);
    return () => { alive = false; clearInterval(t); };
  }, [connection]);

  const sortedAgents = Object.entries(stats).sort((a, b) => 
    (b[1].volSOL + b[1].volUSDC) - (a[1].volSOL + a[1].volUSDC)
  );

  return (
    <div className="mt-4 bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-2xl">
       <h2 className="text-sm font-semibold text-slate-200 mb-3">Reputation Leaderboard <span className="text-[10px] text-slate-500 font-normal">(Computed live from on-chain receipts)</span></h2>
       
       <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-center">
             <p className="text-[10px] text-slate-500">Tasks Created</p>
             <p className="text-sm font-bold text-blue-400">{globalStats.created}</p>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-center">
             <p className="text-[10px] text-slate-500">Settled</p>
             <p className="text-sm font-bold text-green-400">{Object.values(stats).reduce((acc, s) => acc + s.passes, 0)}</p>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-center">
             <p className="text-[10px] text-slate-500">User Escapes</p>
             <p className="text-sm font-bold text-orange-400">{globalStats.cancelled}</p>
          </div>
       </div>

       <div className="max-h-64 overflow-y-auto border border-slate-800 rounded-lg">
          <table className="w-full text-xs text-left">
             <thead className="bg-slate-950 text-slate-500 sticky top-0">
                <tr>
                   <th className="px-3 py-2 font-medium">Agent</th>
                   <th className="px-3 py-2 font-medium text-right">Settle Rate (pass/refund)</th>
                   <th className="px-3 py-2 font-medium text-right">Volume</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-slate-800">
                {loading && (
                   <tr><td colSpan={3} className="px-3 py-4 text-center text-slate-500">Parsing on-chain receipts...</td></tr>
                )}
                {!loading && sortedAgents.length === 0 && (
                   <tr><td colSpan={3} className="px-3 py-4 text-center text-slate-500">No verified agents yet.</td></tr>
                )}
                {sortedAgents.map(([agent, s]) => {
                   const total = s.passes + s.fails;
                   const rate = total > 0 ? ((s.passes / total) * 100).toFixed(0) : '0';
                   return (
                      <tr key={agent} className="hover:bg-slate-950/50">
                         <td className="px-3 py-2 font-mono text-slate-300">{agent.slice(0, 4)}...{agent.slice(-4)}</td>
                         <td className="px-3 py-2 text-right text-green-400 font-semibold">{rate}% <span className="text-slate-500 font-normal">({s.passes}/{total})</span></td>
                         <td className="px-3 py-2 text-right">
                            {s.volSOL > 0 && <span className="text-yellow-400 font-semibold">{s.volSOL.toFixed(2)} SOL</span>}
                            {s.volUSDC > 0 && <span className="text-blue-400 font-semibold ml-2">{s.volUSDC.toFixed(2)} USDC</span>}
                            {s.volSOL === 0 && s.volUSDC === 0 && <span className="text-slate-500">-</span>}
                         </td>
                      </tr>
                   );
                })}
             </tbody>
          </table>
       </div>
    </div>
  );
}
