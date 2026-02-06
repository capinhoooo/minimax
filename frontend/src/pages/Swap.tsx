import { useState, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { ArrowDown, Settings, ChevronDown } from 'lucide-react';

const tokens = [
  { symbol: 'ETH', name: 'Ethereum', icon: '/eth.svg', color: '#627EEA' },
  { symbol: 'USDC', name: 'USD Coin', icon: '/usdc.svg', color: '#2775CA' },
  { symbol: 'USDT', name: 'Tether', icon: '/usdt.svg', color: '#26A17B' },
  { symbol: 'DAI', name: 'Dai', icon: '/dai.svg', color: '#F5AC37' },
  { symbol: 'WETH', name: 'Wrapped ETH', icon: '/weth.svg', color: '#EC4899' },
];

const chains = [
  { id: 'ARB', name: 'Arbitrum', icon: '🔵' },
  { id: 'BASE', name: 'Base', icon: '🔵' },
  { id: 'ETH', name: 'Ethereum', icon: '⚪' },
  { id: 'OP', name: 'Optimism', icon: '🔴' },
  { id: 'POLY', name: 'Polygon', icon: '🟣' },
];

type TabType = 'swap' | 'bridge';

export default function Swap() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const isBridgeRoute = location.pathname === '/bridge';
  const initialTab = isBridgeRoute || searchParams.get('tab') === 'bridge' ? 'bridge' : 'swap';
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  // Update active tab when URL changes
  useEffect(() => {
    if (location.pathname === '/bridge') {
      setActiveTab('bridge');
    } else if (searchParams.get('tab') === 'bridge') {
      setActiveTab('bridge');
    } else {
      setActiveTab('swap');
    }
  }, [searchParams, location.pathname]);

  const [sellToken, setSellToken] = useState('ETH');
  const [buyToken, setBuyToken] = useState('USDC');
  const [sellAmount, setSellAmount] = useState('0.5');
  const [fromChain] = useState('ARB');
  const [toChain] = useState('BASE');
  const [bridgeAmount, setBridgeAmount] = useState('');

  const handleSwapTokens = () => {
    const temp = sellToken;
    setSellToken(buyToken);
    setBuyToken(temp);
  };

  const sellTokenData = tokens.find(t => t.symbol === sellToken);
  const buyTokenData = tokens.find(t => t.symbol === buyToken);

  // Mock calculations
  const ethPrice = 2488.24;
  const buyAmount = sellAmount ? (parseFloat(sellAmount) * ethPrice).toFixed(2) : '0.00';
  const usdValue = sellAmount ? (parseFloat(sellAmount) * ethPrice).toFixed(2) : '0.00';
  const priceImpact = '-0.08%';
  const networkCost = '~$4.20';

  return (
    <div className="min-h-screen grid-bg py-12 px-4">
      <div className="mx-auto max-w-md">
        {/* Main Card */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(10, 10, 10, 0.98), rgba(1, 1, 1, 0.99))',
            border: '1px solid rgba(237, 127, 47, 0.4)',
            boxShadow: '0 0 40px rgba(237, 127, 47, 0.15), 0 0 80px rgba(237, 127, 47, 0.1)'
          }}
        >
          {/* Tabs */}
          <div className="flex p-2 gap-2 bg-black/30">
            <button
              onClick={() => setActiveTab('swap')}
              className={`flex-1 py-3 px-6 rounded-lg font-medium text-sm tracking-wider transition-all ${
                activeTab === 'swap'
                  ? 'text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
              style={{
                background: activeTab === 'swap'
                  ? 'linear-gradient(135deg, rgba(237, 127, 47, 0.3), rgba(138, 56, 21, 0.3))'
                  : 'transparent',
                border: activeTab === 'swap' ? '1px solid rgba(237, 127, 47, 0.5)' : '1px solid transparent'
              }}
            >
              SWAP
            </button>
            <button
              onClick={() => setActiveTab('bridge')}
              className={`flex-1 py-3 px-6 rounded-lg font-medium text-sm tracking-wider transition-all ${
                activeTab === 'bridge'
                  ? 'text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
              style={{
                background: activeTab === 'bridge'
                  ? 'linear-gradient(135deg, rgba(237, 127, 47, 0.3), rgba(138, 56, 21, 0.3))'
                  : 'transparent',
                border: activeTab === 'bridge' ? '1px solid rgba(237, 127, 47, 0.5)' : '1px solid transparent'
              }}
            >
              BRIDGE
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {activeTab === 'swap' ? (
              <>
                {/* Swap Header */}
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-white tracking-wide">ARENA SWAP</h2>
                  <button className="p-2 rounded-lg hover:bg-white/5 transition-colors">
                    <Settings className="h-5 w-5 text-gray-400" />
                  </button>
                </div>

                {/* Sell Section */}
                <div
                  className="rounded-xl p-4 mb-2"
                  style={{
                    background: 'rgba(20, 20, 20, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-400">Sell</span>
                    <span className="text-sm text-gray-400">Balance: 1.42 ETH</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <input
                      type="text"
                      value={sellAmount}
                      onChange={(e) => setSellAmount(e.target.value)}
                      className="bg-transparent text-4xl font-light text-white outline-none w-1/2"
                      placeholder="0"
                    />
                    <button
                      className="flex items-center gap-2 px-4 py-2 rounded-full transition-colors"
                      style={{
                        background: 'rgba(237, 127, 47, 0.2)',
                        border: '1px solid rgba(237, 127, 47, 0.5)'
                      }}
                    >
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ backgroundColor: sellTokenData?.color }}
                      >
                        {sellToken.charAt(0)}
                      </div>
                      <span className="text-white font-medium">{sellToken}</span>
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    </button>
                  </div>
                  <div className="mt-2 text-sm text-gray-500">${usdValue}</div>
                </div>

                {/* Swap Button */}
                <div className="relative flex justify-center -my-3 z-10">
                  <button
                    onClick={handleSwapTokens}
                    className="p-3 rounded-xl transition-colors"
                    style={{
                      background: 'rgba(20, 20, 20, 0.9)',
                      border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}
                  >
                    <ArrowDown className="h-4 w-4" style={{ color: '#42c7e6' }} />
                  </button>
                </div>

                {/* Buy Section */}
                <div
                  className="rounded-xl p-4 mt-2"
                  style={{
                    background: 'rgba(20, 20, 20, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-400">Buy</span>
                    <span className="text-sm text-gray-400">Balance: 0.00 USDC</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-4xl font-light text-white">
                      {buyAmount ? Number(buyAmount).toLocaleString() : '0'}
                    </div>
                    <button
                      className="flex items-center gap-2 px-4 py-2 rounded-full transition-colors"
                      style={{
                        background: 'rgba(66, 199, 230, 0.2)',
                        border: '1px solid rgba(66, 199, 230, 0.5)'
                      }}
                    >
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ backgroundColor: buyTokenData?.color }}
                      >
                        $
                      </div>
                      <span className="text-white font-medium">{buyToken}</span>
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-sm text-gray-500">${buyAmount}</span>
                    <span className="text-sm" style={{ color: '#ed7f2f' }}>({priceImpact})</span>
                  </div>
                </div>

                {/* Price Info */}
                <div
                  className="rounded-xl p-4 mt-4"
                  style={{
                    background: 'rgba(20, 20, 20, 0.4)',
                    border: '1px dashed rgba(255, 255, 255, 0.1)'
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-500">Price</span>
                    <span className="text-sm text-white">1 ETH = 2,488.24 USDC</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Network Cost</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm" style={{ color: '#42c7e6' }}>{networkCost}</span>
                      <span
                        className="text-xs px-2 py-0.5 rounded"
                        style={{ background: 'rgba(255, 255, 255, 0.1)' }}
                      >
                        ARB
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <button
                  className="w-full mt-6 py-4 rounded-xl font-semibold text-lg tracking-wide transition-all hover:opacity-90"
                  style={{
                    background: 'linear-gradient(135deg, #ed7f2f, #d946ef)',
                    color: 'white'
                  }}
                >
                  ENTER THE ARENA
                </button>
              </>
            ) : (
              <>
                {/* Bridge Header */}
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-white tracking-wide">ARENA BRIDGE</h2>
                  <button className="p-2 rounded-lg hover:bg-white/5 transition-colors">
                    <Settings className="h-5 w-5 text-gray-400" />
                  </button>
                </div>

                {/* From Chain */}
                <div
                  className="rounded-xl p-4 mb-2"
                  style={{
                    background: 'rgba(20, 20, 20, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-400">From</span>
                    <span className="text-sm text-gray-400">Balance: 2,450.00 USDC</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <input
                      type="text"
                      value={bridgeAmount}
                      onChange={(e) => setBridgeAmount(e.target.value)}
                      className="bg-transparent text-4xl font-light text-white outline-none w-1/2"
                      placeholder="0"
                    />
                    <button
                      className="flex items-center gap-2 px-4 py-2 rounded-full transition-colors"
                      style={{
                        background: 'rgba(237, 127, 47, 0.2)',
                        border: '1px solid rgba(237, 127, 47, 0.5)'
                      }}
                    >
                      <span className="text-lg">{chains.find(c => c.id === fromChain)?.icon}</span>
                      <span className="text-white font-medium">{chains.find(c => c.id === fromChain)?.name}</span>
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    </button>
                  </div>
                  <div className="mt-2 text-sm text-gray-500">USDC</div>
                </div>

                {/* Arrow */}
                <div className="relative flex justify-center -my-3 z-10">
                  <div
                    className="p-3 rounded-xl"
                    style={{
                      background: 'rgba(20, 20, 20, 0.9)',
                      border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}
                  >
                    <ArrowDown className="h-4 w-4" style={{ color: '#42c7e6' }} />
                  </div>
                </div>

                {/* To Chain */}
                <div
                  className="rounded-xl p-4 mt-2"
                  style={{
                    background: 'rgba(20, 20, 20, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-400">To</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-4xl font-light text-white">
                      {bridgeAmount || '0'}
                    </div>
                    <button
                      className="flex items-center gap-2 px-4 py-2 rounded-full transition-colors"
                      style={{
                        background: 'rgba(66, 199, 230, 0.2)',
                        border: '1px solid rgba(66, 199, 230, 0.5)'
                      }}
                    >
                      <span className="text-lg">{chains.find(c => c.id === toChain)?.icon}</span>
                      <span className="text-white font-medium">{chains.find(c => c.id === toChain)?.name}</span>
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    </button>
                  </div>
                  <div className="mt-2 text-sm" style={{ color: '#22c55e' }}>Native USDC</div>
                </div>

                {/* Bridge Info */}
                <div
                  className="rounded-xl p-4 mt-4"
                  style={{
                    background: 'rgba(20, 20, 20, 0.4)',
                    border: '1px dashed rgba(255, 255, 255, 0.1)'
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-500">Estimated Time</span>
                    <span className="text-sm text-white">~15-20 minutes</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Bridge Fee</span>
                    <span className="text-sm" style={{ color: '#42c7e6' }}>$0 (gas only)</span>
                  </div>
                </div>

                {/* Action Button */}
                <button
                  disabled={!bridgeAmount}
                  className="w-full mt-6 py-4 rounded-xl font-semibold text-lg tracking-wide transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: 'linear-gradient(135deg, #ed7f2f, #d946ef)',
                    color: 'white'
                  }}
                >
                  {bridgeAmount ? 'BRIDGE USDC' : 'ENTER AMOUNT'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Info Box */}
        <div
          className="mt-6 p-4 rounded-xl"
          style={{
            background: 'rgba(66, 199, 230, 0.1)',
            border: '1px solid rgba(66, 199, 230, 0.2)'
          }}
        >
          <p className="text-sm" style={{ color: '#42c7e6' }}>
            {activeTab === 'swap' ? 'Powered by LI.FI' : 'Powered by Circle CCTP'}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {activeTab === 'swap'
              ? 'LI.FI finds the best route across 15+ DEXs and bridges to get you the best price.'
              : 'CCTP burns USDC on the source chain and mints native USDC on the destination.'}
          </p>
        </div>
      </div>
    </div>
  );
}
