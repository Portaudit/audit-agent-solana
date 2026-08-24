import Link from 'next/link';

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 p-8 max-w-4xl mx-auto">
      <Link href="/" className="text-green-400 hover:text-green-300 text-sm mb-8 inline-block">
        ← Back to Terminal
      </Link>

      <h1 className="text-4xl font-bold mb-2 text-white">About the Founder</h1>
      <p className="text-slate-400 mb-8 text-lg">Building the trust layer for the Agentic Economy.</p>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-8 shadow-xl">
        <h2 className="text-xl font-semibold text-green-400 mb-4">// The Mission</h2>
        <p className="text-slate-300 leading-relaxed mb-4">
          As AI agents begin executing complex tasks and writing code autonomously, the payment infrastructure 
          has not kept up. Agents cannot open bank accounts, and humans shouldn't have to manually verify 
          every line of code an agent writes before releasing payment.
        </p>
        <p className="text-slate-300 leading-relaxed">
          <span className="text-white font-semibold">AuditAgent</span> solves this by creating trustless, 
          hash-committed settlement rails on Solana. If the code is good, the agent gets paid instantly. 
          If the code is flawed, the funds auto-refund. No escrow agents, no disputes, just cryptography and code.
        </p>
        <p className="text-slate-300 leading-relaxed mt-4">
          <span className="text-white font-semibold">The Founder:</span> Ishvir — founder of AuditAgent. Building trustless settlement rails so AI agents get paid only for verified work. Colosseum Eternal Sprint.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-blue-400 mb-4">// The Tech Stack</h2>
          <ul className="space-y-2 text-slate-300 text-sm">
            <li className="flex gap-2"><span className="text-slate-500">▸</span> <span><strong>On-Chain:</strong> Solana, Anchor 1.0.2, Rust</span></li>
            <li className="flex gap-2"><span className="text-slate-500">▸</span> <span><strong>Rails:</strong> Native SOL + SPL USDC</span></li>
            <li className="flex gap-2"><span className="text-slate-500">▸</span> <span><strong>AI Gate:</strong> Nvidia Nemotron via OpenRouter</span></li>
            <li className="flex gap-2"><span className="text-slate-500">▸</span> <span><strong>Frontend:</strong> Next.js 16, Phantom Wallet</span></li>
          </ul>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-purple-400 mb-4">// Connect</h2>
          <ul className="space-y-3 text-slate-300 text-sm">
            <li>
              <span className="text-slate-500 block text-xs uppercase tracking-wider mb-1">GitHub</span>
              <a href="https://github.com/Portaudit" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline break-all">github.com/Portaudit</a>
            </li>
            <li>
              <span className="text-slate-500 block text-xs uppercase tracking-wider mb-1">X (Twitter)</span>
              {/* ADD YOUR X HANDLE HERE */}
              <a href="https://x.com/your_x_handle" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline break-all">@your_x_handle</a>
            </li>
            <li>
              <span className="text-slate-500 block text-xs uppercase tracking-wider mb-1">Live App</span>
              <a href="https://www.theauditagent.xyz" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline break-all">theauditagent.xyz</a>
            </li>
            <li>
              <span className="text-slate-500 block text-xs uppercase tracking-wider mb-1">Email</span>
              <a href="mailto:you@example.com" className="text-blue-400 hover:underline break-all">you@example.com</a>
            </li>
          </ul>
        </div>
      </div>

      <div className="bg-slate-900 border border-green-500/30 rounded-xl p-6 text-center">
        <h2 className="text-xl font-semibold text-green-400 mb-2">Ready to audit?</h2>
        <p className="text-slate-400 text-sm mb-4">Lock your funds and let the rails do the rest.</p>
        <Link href="/" className="inline-block px-6 py-2 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg transition-colors">
          Launch App
        </Link>
      </div>
    </main>
  );
}
