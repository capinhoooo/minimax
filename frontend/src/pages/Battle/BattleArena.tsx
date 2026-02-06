import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';

// Mock pool data
const pools = [
  {
    id: 1,
    token0: 'ETH',
    token1: 'USDC',
    apy: 12.4,
    tier: '0.05%',
    liquidity: '$14.2M',
    volume24h: '$2.8M',
    activeBattles: 4,
    chartData: [35, 45, 30, 55, 70, 50, 80, 65],
  },
  {
    id: 2,
    token0: 'WBTC',
    token1: 'ETH',
    apy: 8.1,
    tier: '0.30%',
    liquidity: '$8.5M',
    volume24h: '$1.1M',
    activeBattles: 1,
    chartData: [40, 35, 50, 45, 55, 40, 60, 50],
  },
  {
    id: 3,
    token0: 'DAI',
    token1: 'USDC',
    apy: 4.2,
    tier: '0.01%',
    liquidity: '$22.1M',
    volume24h: '$14.5M',
    activeBattles: 0,
    chartData: [50, 52, 51, 53, 52, 54, 53, 55],
  },
];

export default function BattleArena() {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPools = pools.filter(
    (pool) =>
      pool.token0.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pool.token1.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen grid-bg">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <h1 className="text-4xl sm:text-5xl font-black mb-8 tracking-tight">
          <span style={{ color: '#ed7f2f' }}>SELECT</span>{' '}
          <span style={{ color: '#42c7e6' }}>YOUR BATTLEFIELD</span>
        </h1>

        {/* Search Bar */}
        <div className="relative mb-10">
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-lg"
            style={{
              background: 'rgba(10, 10, 10, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <Search className="h-4 w-4 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="SEARCH PAIR OR HOOK ADDRESS..."
              className="flex-1 bg-transparent text-sm text-gray-400 placeholder-gray-600 outline-none font-mono tracking-wider"
            />
          </div>
        </div>

        {/* Pool Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPools.map((pool) => (
            <div
              key={pool.id}
              className="rounded-xl overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(10, 10, 10, 0.95), rgba(1, 1, 1, 0.98))',
                border: '1px solid rgba(237, 127, 47, 0.3)',
                boxShadow: '0 0 30px rgba(237, 127, 47, 0.1)',
              }}
            >
              <div className="p-5">
                {/* Pool Header */}
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xl font-bold text-white">
                    {pool.token0} / {pool.token1}
                  </h3>
                  <span
                    className="text-sm font-mono font-semibold"
                    style={{ color: '#22c55e' }}
                  >
                    +{pool.apy}% <span className="text-xs">APY</span>
                  </span>
                </div>

                {/* Tier */}
                <p className="text-xs font-mono text-gray-500 mb-4 tracking-wider">
                  TIER: {pool.tier}
                </p>

                {/* Chart */}
                <div className="h-20 flex items-end justify-between gap-1 mb-4">
                  {pool.chartData.map((height, index) => (
                    <div
                      key={index}
                      className="flex-1 rounded-t"
                      style={{
                        height: `${height}%`,
                        background: 'linear-gradient(to top, rgba(66, 199, 230, 0.8), rgba(66, 199, 230, 0.4))',
                      }}
                    />
                  ))}
                </div>

                {/* Stats */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-gray-500 tracking-wider">LIQUIDITY:</span>
                    <span className="text-sm font-mono text-white">{pool.liquidity}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-gray-500 tracking-wider">VOL (24H):</span>
                    <span className="text-sm font-mono text-white">{pool.volume24h}</span>
                  </div>
                </div>

                {/* Active Battles Badge */}
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded mb-4"
                  style={{
                    background: pool.activeBattles > 0
                      ? 'rgba(34, 197, 94, 0.1)'
                      : 'rgba(255, 255, 255, 0.05)',
                    border: pool.activeBattles > 0
                      ? '1px solid rgba(34, 197, 94, 0.3)'
                      : '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: pool.activeBattles > 0 ? '#22c55e' : '#6b7280',
                    }}
                  />
                  <span
                    className="text-xs font-mono tracking-wider"
                    style={{
                      color: pool.activeBattles > 0 ? '#22c55e' : '#6b7280',
                    }}
                  >
                    {pool.activeBattles > 0
                      ? `${pool.activeBattles} ACTIVE BATTLE${pool.activeBattles > 1 ? 'S' : ''}`
                      : 'NO ACTIVE BATTLES'}
                  </span>
                </div>

                {/* Action Button */}
                <Link
                  to={`/battle/${pool.id}`}
                  className="block w-full py-3 rounded-lg text-center font-medium text-sm tracking-wider transition-all hover:opacity-90"
                  style={{
                    background: pool.activeBattles > 0
                      ? 'linear-gradient(135deg, rgba(237, 127, 47, 0.2), rgba(138, 56, 21, 0.2))'
                      : 'rgba(255, 255, 255, 0.05)',
                    border: pool.activeBattles > 0
                      ? '1px solid rgba(237, 127, 47, 0.5)'
                      : '1px solid rgba(255, 255, 255, 0.1)',
                    color: pool.activeBattles > 0 ? '#ed7f2f' : '#9ca3af',
                  }}
                >
                  {pool.activeBattles > 0 ? 'ENTER ARENA' : 'OPEN POOL'}
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredPools.length === 0 && (
          <div className="text-center py-16">
            <p className="text-gray-500 font-mono">No pools found matching your search.</p>
          </div>
        )}

        {/* Terminal Status Footer */}
        <div className="mt-16 text-center">
          <p className="text-xs font-mono text-gray-600 tracking-wider">
            TERMINAL STATUS: <span style={{ color: '#22c55e' }}>ONLINE</span> // BLOCK: 18492031 // ARENA_V4_CORE
          </p>
        </div>
      </div>
    </div>
  );
}
