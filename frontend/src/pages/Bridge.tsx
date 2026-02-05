import { useState } from 'react';
import { ArrowDown, Info, Clock } from 'lucide-react';

const chains = [
  { id: 'ARBITRUM', name: 'Arbitrum', icon: '🔵' },
  { id: 'BASE', name: 'Base', icon: '🔵' },
  { id: 'POLYGON', name: 'Polygon', icon: '🟣' },
  { id: 'OPTIMISM', name: 'Optimism', icon: '🔴' },
  { id: 'ETHEREUM', name: 'Ethereum', icon: '⚪' },
];

const steps = [
  { title: 'Burn USDC', description: 'Burn on source chain' },
  { title: 'Attestation', description: 'Wait for Circle (~15 min)' },
  { title: 'Mint USDC', description: 'Mint on destination' },
];

export default function Bridge() {
  const [fromChain, setFromChain] = useState('ARBITRUM');
  const [toChain, setToChain] = useState('BASE');
  const [amount, setAmount] = useState('');

  return (
    <div className="py-8 px-4">
      <div className="mx-auto max-w-lg">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Bridge USDC</h1>
          <p className="text-gray-400 text-sm">Bridge native USDC across chains via Circle CCTP</p>
        </div>

        {/* Bridge Card */}
        <div className="card">
          {/* From Chain */}
          <div className="mb-2">
            <label className="label">From Chain</label>
            <select
              value={fromChain}
              onChange={(e) => setFromChain(e.target.value)}
              className="input w-full"
            >
              {chains.map((chain) => (
                <option key={chain.id} value={chain.id}>
                  {chain.icon} {chain.name}
                </option>
              ))}
            </select>
          </div>

          {/* Amount */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-gray-400">Amount</label>
              <span className="text-sm text-gray-400">Balance: 2,450.00 USDC</span>
            </div>
            <div className="relative">
              <input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input w-full pr-24 text-xl"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <button
                  onClick={() => setAmount('2450')}
                  className="text-xs text-accent-blue hover:underline"
                >
                  MAX
                </button>
                <span className="text-gray-400 font-medium">USDC</span>
              </div>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center my-4">
            <div className="p-2 rounded-full bg-background border border-border">
              <ArrowDown className="h-5 w-5 text-gray-400" />
            </div>
          </div>

          {/* To Chain */}
          <div className="mb-6">
            <label className="label">To Chain</label>
            <select
              value={toChain}
              onChange={(e) => setToChain(e.target.value)}
              className="input w-full"
            >
              {chains.filter((c) => c.id !== fromChain).map((chain) => (
                <option key={chain.id} value={chain.id}>
                  {chain.icon} {chain.name}
                </option>
              ))}
            </select>
          </div>

          {/* You Will Receive */}
          <div className="p-4 rounded-lg bg-background mb-6">
            <p className="text-sm text-gray-400 mb-1">You will receive</p>
            <p className="text-2xl font-bold">
              {amount || '0.00'} <span className="text-gray-400">USDC</span>
            </p>
            <p className="text-sm text-accent-green mt-1">Native USDC (not bridged)</p>
          </div>

          {/* Bridge Info */}
          <div className="flex items-center justify-between text-sm mb-6 px-1">
            <div className="flex items-center gap-2 text-gray-400">
              <Clock className="h-4 w-4" />
              <span>~15-20 minutes</span>
            </div>
            <div className="text-gray-400">
              Bridge fee: <span className="text-white">$0</span> (gas only)
            </div>
          </div>

          {/* Bridge Button */}
          <button
            disabled={!amount}
            className="btn-primary w-full py-3 text-lg"
          >
            {amount ? 'Bridge USDC' : 'Enter Amount'}
          </button>
        </div>

        {/* How CCTP Works */}
        <div className="card mt-6">
          <h3 className="font-semibold mb-4">How Circle CCTP Works</h3>
          <div className="space-y-4">
            {steps.map((step, index) => (
              <div key={step.title} className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-accent-blue/20 flex items-center justify-center">
                  <span className="text-xs text-accent-blue font-medium">{index + 1}</span>
                </div>
                <div>
                  <p className="font-medium">{step.title}</p>
                  <p className="text-sm text-gray-400">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="mt-6 p-4 rounded-lg bg-accent-purple/10 border border-accent-purple/20">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-accent-purple flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="text-accent-purple font-medium mb-1">Powered by Arc & Circle CCTP</p>
              <p className="text-gray-400">
                CCTP burns USDC on the source chain and mints native USDC on the destination.
                No wrapped tokens, no liquidity pools.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
