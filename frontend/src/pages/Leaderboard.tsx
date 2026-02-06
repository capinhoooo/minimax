import { useState } from 'react';

const stats = [
  { label: 'TOTAL YIELD CONTESTED', value: '$12,402,192' },
  { label: 'ACTIVE GLADIATORS', value: '8,142' },
  { label: 'BATTLES CONCLUDED', value: '142,091' },
  { label: 'AVG. EFFICIENCY', value: '94.2%' },
];

const gladiators = [
  {
    rank: 1,
    name: '0xCyber_Viking',
    badge: 'LEGEND',
    badgeColor: '#ed7f2f',
    wins: 842,
    losses: 12,
    yield: '$482,103.20',
    efficiency: 99.8,
    pool: 'ETH/USDC (0.05%)',
    star: true,
  },
  {
    rank: 2,
    name: 'Yield_Runner_99',
    badge: 'PRO',
    badgeColor: '#42c7e6',
    wins: 715,
    losses: 45,
    yield: '$391,002.55',
    efficiency: 98.2,
    pool: 'WBTC/ETH (0.3%)',
  },
  {
    rank: 3,
    name: 'Hook_Master_Flex',
    wins: 654,
    losses: 89,
    yield: '$315,992.10',
    efficiency: 97.5,
    pool: 'ETH/USDC (0.05%)',
  },
  {
    rank: 4,
    name: 'Liquidity_Lich',
    wins: 522,
    losses: 104,
    yield: '$288,441.00',
    efficiency: 95.1,
    pool: 'DAI/USDC (0.01%)',
  },
  {
    rank: 5,
    name: 'Tick_Sniper_X',
    wins: 489,
    losses: 62,
    yield: '$245,110.80',
    efficiency: 96.8,
    pool: 'ETH/USDC (0.05%)',
  },
  {
    rank: 6,
    name: 'ZeroSum_Game',
    wins: 412,
    losses: 198,
    yield: '$192,553.44',
    efficiency: 92.4,
    pool: 'WBTC/ETH (0.3%)',
  },
  {
    rank: 7,
    name: 'Gas_Guzzler_V4',
    wins: 388,
    losses: 142,
    yield: '$177,201.12',
    efficiency: 93.9,
    pool: 'ETH/USDC (0.05%)',
  },
  {
    rank: 8,
    name: 'Range_Bound_AI',
    wins: 355,
    losses: 34,
    yield: '$154,882.00',
    efficiency: 99.1,
    pool: 'PEPE/ETH (1.0%)',
  },
  {
    rank: 9,
    name: 'Delta_Neutral_D',
    wins: 310,
    losses: 88,
    yield: '$132,440.90',
    efficiency: 91.7,
    pool: 'ETH/USDC (0.05%)',
  },
  {
    rank: 10,
    name: 'MEV_Whisperer',
    wins: 298,
    losses: 155,
    yield: '$119,301.00',
    efficiency: 90.3,
    pool: 'WBTC/ETH (0.3%)',
  },
];

export default function Leaderboard() {
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  return (
    <div className="min-h-screen grid-bg">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Title */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black mb-3 tracking-tight">
          <span className="gradient-text-magenta italic">ARENA RANKINGS</span>
        </h1>
        <p className="text-xs sm:text-sm tracking-[0.3em] text-gray-500 mb-12 uppercase font-mono">
          The elite liquidity gladiators of Uniswap V4 Season 1
        </p>

        {/* Stats Cards */}
        <div
          className="grid grid-cols-2 lg:grid-cols-4 gap-px rounded-lg overflow-hidden mb-12"
          style={{
            border: '1px solid rgba(66, 199, 230, 0.3)',
          }}
        >
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="px-5 py-4"
              style={{
                background: 'rgba(10, 10, 10, 0.8)',
                borderLeft: '2px solid rgba(66, 199, 230, 0.4)',
              }}
            >
              <p className="text-[10px] sm:text-xs font-mono tracking-wider text-gray-500 mb-1">
                {stat.label}
              </p>
              <p className="text-xl sm:text-2xl font-black" style={{ color: '#42c7e6' }}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Leaderboard Table */}
        <div
          className="rounded-xl overflow-hidden"
          style={{
            border: '1px solid rgba(237, 127, 47, 0.3)',
            boxShadow: '0 0 30px rgba(237, 127, 47, 0.1)',
          }}
        >
          {/* Live Feed Header */}
          <div
            className="flex items-center gap-2 px-4 py-2"
            style={{
              background: 'linear-gradient(90deg, #c026d3, #a855f7, #c026d3)',
            }}
          >
            <div className="w-2.5 h-2.5 rounded-sm bg-white/30" />
            <span className="text-xs font-mono font-bold tracking-wider text-white">
              LIVE_TELEMETRY_FEED_V4.02
            </span>
          </div>

          {/* Table Header */}
          <div
            className="grid px-4 py-3"
            style={{
              gridTemplateColumns: '80px 1fr 120px 1fr 140px 1fr',
              background: 'rgba(10, 10, 10, 0.95)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <span className="text-xs font-mono font-bold tracking-wider text-gray-400">RANK</span>
            <span className="text-xs font-mono font-bold tracking-wider text-gray-400">GLADIATOR</span>
            <span className="text-xs font-mono font-bold tracking-wider text-gray-400">WIN/LOSS</span>
            <span className="text-xs font-mono font-bold tracking-wider text-gray-400">TOTAL YIELD CAPTURED</span>
            <span className="text-xs font-mono font-bold tracking-wider text-gray-400">EFFICIENCY SCORE</span>
            <span className="text-xs font-mono font-bold tracking-wider text-gray-400">MAIN POOL</span>
          </div>

          {/* Table Rows */}
          {gladiators.map((g) => (
            <div
              key={g.rank}
              className="grid items-center px-4 py-4 transition-colors"
              style={{
                gridTemplateColumns: '80px 1fr 120px 1fr 140px 1fr',
                background:
                  hoveredRow === g.rank
                    ? 'rgba(237, 127, 47, 0.05)'
                    : 'rgba(5, 5, 5, 0.95)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
              }}
              onMouseEnter={() => setHoveredRow(g.rank)}
              onMouseLeave={() => setHoveredRow(null)}
            >
              {/* Rank */}
              <span className="text-lg font-mono font-bold text-gray-300 flex items-center gap-1.5">
                {String(g.rank).padStart(2, '0')}
                {g.star && <span className="text-yellow-400 text-base">&#9733;</span>}
              </span>

              {/* Gladiator Name + Badge */}
              <div className="flex items-center gap-2">
                <span className="font-mono font-medium" style={{ color: '#42c7e6' }}>
                  {g.name}
                </span>
                {g.badge && (
                  <span
                    className="text-[10px] font-mono font-bold px-2 py-0.5 rounded"
                    style={{
                      backgroundColor: `${g.badgeColor}20`,
                      border: `1px solid ${g.badgeColor}60`,
                      color: g.badgeColor,
                    }}
                  >
                    {g.badge}
                  </span>
                )}
              </div>

              {/* Win/Loss */}
              <span className="font-mono text-sm text-gray-400">
                <span className="text-white">{g.wins}</span>
                {' / '}
                <span className="text-gray-600">{g.losses}</span>
              </span>

              {/* Total Yield */}
              <span className="font-mono text-sm font-semibold text-white">
                {g.yield}
              </span>

              {/* Efficiency Score */}
              <span>
                <span
                  className="inline-block font-mono text-xs font-bold px-2.5 py-1 rounded"
                  style={{
                    border: '1px solid rgba(66, 199, 230, 0.4)',
                    color: '#42c7e6',
                    background: 'rgba(66, 199, 230, 0.08)',
                  }}
                >
                  {g.efficiency}%
                </span>
              </span>

              {/* Main Pool */}
              <span className="font-mono text-sm text-gray-400">
                {g.pool}
              </span>
            </div>
          ))}
        </div>

        {/* Mobile Table (scrollable) */}
        <div className="lg:hidden mt-4 text-center">
          <p className="text-xs font-mono text-gray-600 tracking-wider">
            &#8592; SCROLL HORIZONTALLY FOR FULL TABLE &#8594;
          </p>
        </div>

        {/* Terminal Status Footer */}
        <div className="mt-16 text-center">
          <p className="text-xs font-mono text-gray-600 tracking-wider">
            TERMINAL STATUS: <span style={{ color: '#22c55e' }}>ONLINE</span> // BLOCK: 18492031 // ARENA_RANKINGS_V4
          </p>
        </div>
      </div>
    </div>
  );
}
