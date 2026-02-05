import { useState } from 'react';
import { ArrowDownUp, Settings, Info } from 'lucide-react';

const chains = [
  { id: 42161, name: 'Arbitrum', icon: '🔵' },
  { id: 8453, name: 'Base', icon: '🔵' },
  { id: 137, name: 'Polygon', icon: '🟣' },
  { id: 10, name: 'Optimism', icon: '🔴' },
  { id: 1, name: 'Ethereum', icon: '⚪' },
];

const tokens = [
  { symbol: 'USDC', name: 'USD Coin', icon: '💵' },
  { symbol: 'WETH', name: 'Wrapped ETH', icon: '💎' },
  { symbol: 'USDT', name: 'Tether', icon: '💲' },
  { symbol: 'DAI', name: 'Dai', icon: '🟡' },
];

export default function Swap() {
  const [fromChain, setFromChain] = useState(42161);
  const [toChain, setToChain] = useState(8453);
  const [fromToken, setFromToken] = useState('USDC');
  const [toToken, setToToken] = useState('WETH');
  const [amount, setAmount] = useState('');

  const handleSwapChains = () => {
    setFromChain(toChain);
    setToChain(fromChain);
    setFromToken(toToken);
    setToToken(fromToken);
  };

  return (
    <div className="py-8 px-4">
      <div className="mx-auto max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Swap</h1>
            <p className="text-gray-400 text-sm">Swap any token from any chain</p>
          </div>
          <button className="p-2 rounded-lg hover:bg-white/5 transition-colors">
            <Settings className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Swap Card */}
        <div className="card">
          {/* From */}
          <div className="mb-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">From</span>
              <span className="text-sm text-gray-400">Balance: 1,000.00</span>
            </div>
            <div className="flex gap-2">
              <select
                value={fromChain}
                onChange={(e) => setFromChain(Number(e.target.value))}
                className="input w-32"
              >
                {chains.map((chain) => (
                  <option key={chain.id} value={chain.id}>
                    {chain.icon} {chain.name}
                  </option>
                ))}
              </select>
              <select
                value={fromToken}
                onChange={(e) => setFromToken(e.target.value)}
                className="input w-28"
              >
                {tokens.map((token) => (
                  <option key={token.symbol} value={token.symbol}>
                    {token.symbol}
                  </option>
                ))}
              </select>
              <input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input flex-1 text-right text-xl font-medium"
              />
            </div>
          </div>

          {/* Swap Button */}
          <div className="flex justify-center my-4">
            <button
              onClick={handleSwapChains}
              className="p-2 rounded-full bg-background hover:bg-background-tertiary border border-border transition-colors"
            >
              <ArrowDownUp className="h-5 w-5 text-gray-400" />
            </button>
          </div>

          {/* To */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">To</span>
            </div>
            <div className="flex gap-2">
              <select
                value={toChain}
                onChange={(e) => setToChain(Number(e.target.value))}
                className="input w-32"
              >
                {chains.map((chain) => (
                  <option key={chain.id} value={chain.id}>
                    {chain.icon} {chain.name}
                  </option>
                ))}
              </select>
              <select
                value={toToken}
                onChange={(e) => setToToken(e.target.value)}
                className="input w-28"
              >
                {tokens.map((token) => (
                  <option key={token.symbol} value={token.symbol}>
                    {token.symbol}
                  </option>
                ))}
              </select>
              <div className="input flex-1 text-right text-xl font-medium text-gray-400">
                {amount ? '0.476' : '0.00'}
              </div>
            </div>
          </div>

          {/* Route Info */}
          {amount && (
            <div className="p-4 rounded-lg bg-background mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Route</span>
                <span className="text-sm">Stargate → Uniswap</span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Estimated Time</span>
                <span className="text-sm">~5 minutes</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Fee</span>
                <span className="text-sm">~$2.50</span>
              </div>
            </div>
          )}

          {/* Swap Button */}
          <button
            disabled={!amount}
            className="btn-primary w-full py-3 text-lg"
          >
            {amount ? 'Swap' : 'Enter Amount'}
          </button>
        </div>

        {/* Info */}
        <div className="mt-6 p-4 rounded-lg bg-accent-blue/10 border border-accent-blue/20">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-accent-blue flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="text-accent-blue font-medium mb-1">Powered by LI.FI</p>
              <p className="text-gray-400">
                LI.FI finds the best route across 15+ DEXs and bridges to get you the best price.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
