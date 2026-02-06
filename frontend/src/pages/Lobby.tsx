import { Link } from 'react-router-dom';
import { ChevronDown, TrendingUp } from 'lucide-react';

// Mock data
const pilotProfile = {
  badge: 'ELITE GLADIATOR',
  username: 'CYBER_STAKER_99',
  eloRating: 2480,
  winRate: 68.2,
  totalYieldClaimed: 4.21,
};

const featuredBattle = {
  sector: 'OBSERVING SECTOR 7-G',
  liveBattles: 142,
  player1: { name: 'SIGMA_LP', symbol: '\u03A3', range: '1850-1920' },
  player2: { name: 'OMEGA_REFI', symbol: '\u03A9', range: '1845-1915' },
  pool: 'WETH / USDC Pool',
  prizePool: 0.842,
};

const upcomingMatches = [
  { time: '14:30 UTC', player1: 'WHALE_HUNTER', player2: 'TIK_TOK_LP' },
  { time: '14:45 UTC', player1: 'BOT_KILR', player2: 'VOL_CRUSH' },
  { time: '15:00 UTC', player1: 'MEV_GHOST', player2: 'STABLE_JOE' },
];

const battleHistory = [
  { result: 'VICTORY', opponent: 'OxAlpha', amount: '+0.12 ETH', time: '2H AGO' },
  { result: 'DEFEAT', opponent: 'QuantBot', amount: '-0.05 ETH', time: '5H AGO' },
  { result: 'VICTORY', opponent: 'MoonBoy', amount: '+0.44 ETH', time: '1D AGO' },
];

const tournaments = [
  { name: 'V4 GENESIS CUP', prize: 'Prize: 10,000 ARB' },
  { name: 'WEEKLY TICK WAR', prize: 'Prize: 2.5 ETH' },
];

const arenaStats = [
  { label: 'TOTAL VALUE LOCKED', value: '$1.2M' },
  { label: '24H VOLUME', value: '$42.8M' },
  { label: 'UNIQUE BATTLERS', value: '1,204' },
];

export default function Lobby() {
  return (
    <div className="min-h-screen pt-24 pb-12 px-4">
      <div className="mx-auto max-w-7xl">

        {/* Three Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          {/* ===== LEFT COLUMN ===== */}
          <div className="lg:col-span-3 flex flex-col gap-5">

            {/* Pilot Profile */}
            <div
              className="rounded-lg p-5"
              style={{
                background: 'rgba(10, 10, 10, 0.95)',
                border: '1px solid rgba(237, 127, 47, 0.25)',
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3
                  className="text-xs font-bold tracking-widest"
                  style={{ color: '#ed7f2f' }}
                >
                  PILOT PROFILE
                </h3>
                <button
                  className="px-3 py-1 text-[10px] font-mono tracking-wider rounded"
                  style={{
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#9ca3af',
                  }}
                >
                  EDIT
                </button>
              </div>

              <div
                className="rounded-md p-4 mb-4"
                style={{ border: '1px solid rgba(255, 255, 255, 0.1)' }}
              >
                <span
                  className="inline-block px-2 py-0.5 text-[10px] font-mono tracking-wider rounded mb-2"
                  style={{
                    border: '1px solid #42c7e6',
                    color: '#42c7e6',
                  }}
                >
                  {pilotProfile.badge}
                </span>
                <p className="text-sm font-bold font-mono tracking-wide text-white">
                  {pilotProfile.username}
                </p>
              </div>

              <div className="space-y-2 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-gray-500 tracking-wider">ELO RATING</span>
                  <span className="text-white">{pilotProfile.eloRating.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 tracking-wider">WIN RATE</span>
                  <span className="text-white">{pilotProfile.winRate}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 tracking-wider">TOTAL YIELD CLAIMED</span>
                  <span className="text-white">{pilotProfile.totalYieldClaimed} ETH</span>
                </div>
              </div>
            </div>

            {/* Active Pool Selection */}
            <div
              className="rounded-lg p-5"
              style={{
                background: 'rgba(10, 10, 10, 0.95)',
                border: '1px solid rgba(237, 127, 47, 0.25)',
              }}
            >
              <p
                className="text-[10px] font-mono tracking-widest mb-3"
                style={{ color: '#6b7280' }}
              >
                ACTIVE POOL SELECTION
              </p>
              <div
                className="flex items-center justify-between px-3 py-2.5 rounded-md cursor-pointer"
                style={{
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  background: 'rgba(255, 255, 255, 0.03)',
                }}
              >
                <span className="text-xs font-mono text-white tracking-wider">
                  ETH / USDC (0.05%)
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
              </div>

              {/* Enter Queue Button */}
              <button
                className="w-full mt-4 py-3 rounded-md text-xs font-bold tracking-widest transition-all hover:opacity-90"
                style={{
                  border: '1px solid #ed7f2f',
                  color: '#ed7f2f',
                  background: 'rgba(237, 127, 47, 0.08)',
                }}
              >
                ENTER QUEUE
              </button>

              <p className="text-center text-[11px] font-mono text-gray-600 mt-3 tracking-wider">
                00:00:00
              </p>
            </div>

            {/* Active Tournaments */}
            <div
              className="rounded-lg p-5"
              style={{
                background: 'rgba(10, 10, 10, 0.95)',
                border: '1px solid rgba(237, 127, 47, 0.25)',
              }}
            >
              <h3
                className="text-xs font-bold tracking-widest mb-4"
                style={{ color: '#ed7f2f' }}
              >
                ACTIVE TOURNAMENTS
              </h3>
              <div className="space-y-3">
                {tournaments.map((t) => (
                  <div
                    key={t.name}
                    className="flex items-center justify-between py-2"
                    style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}
                  >
                    <div>
                      <p className="text-xs font-mono text-white tracking-wider">{t.name}</p>
                      <p className="text-[10px] font-mono text-gray-600">{t.prize}</p>
                    </div>
                    <button
                      className="px-3 py-1 text-[10px] font-mono tracking-wider rounded transition-all hover:opacity-80"
                      style={{
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        color: '#9ca3af',
                      }}
                    >
                      JOIN
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ===== CENTER COLUMN ===== */}
          <div className="lg:col-span-6 flex flex-col gap-5">

            {/* Featured Arena */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold font-mono tracking-wider text-white">
                  FEATURED ARENA
                </h2>
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full animate-pulse"
                    style={{ backgroundColor: '#ed7f2f' }}
                  />
                  <span className="text-[10px] font-mono text-gray-500 tracking-wider">
                    {featuredBattle.liveBattles} BATTLES LIVE
                  </span>
                </div>
              </div>

              <div
                className="rounded-lg p-6 relative overflow-hidden"
                style={{
                  background: 'rgba(10, 10, 10, 0.95)',
                  border: '1px solid rgba(237, 127, 47, 0.25)',
                }}
              >
                {/* Grid overlay */}
                <div
                  className="absolute inset-0 opacity-30"
                  style={{
                    backgroundImage:
                      'linear-gradient(rgba(66, 199, 230, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(66, 199, 230, 0.03) 1px, transparent 1px)',
                    backgroundSize: '30px 30px',
                  }}
                />

                <p className="text-center text-[10px] font-mono text-gray-600 tracking-widest mb-6 relative z-10">
                  {featuredBattle.sector}
                </p>

                {/* VS Battle Display */}
                <div className="flex items-center justify-center gap-6 md:gap-10 mb-6 relative z-10">
                  {/* Player 1 */}
                  <div className="flex flex-col items-center">
                    <div
                      className="w-20 h-20 md:w-24 md:h-24 flex items-center justify-center rotate-45 rounded-md mb-3"
                      style={{
                        border: '2px solid rgba(66, 199, 230, 0.5)',
                        background: 'rgba(66, 199, 230, 0.08)',
                        boxShadow: '0 0 20px rgba(66, 199, 230, 0.15)',
                      }}
                    >
                      <span
                        className="text-2xl md:text-3xl font-bold -rotate-45"
                        style={{ color: '#42c7e6' }}
                      >
                        {featuredBattle.player1.symbol}
                      </span>
                    </div>
                    <p className="text-xs font-mono font-bold tracking-wider text-white">
                      {featuredBattle.player1.name}
                    </p>
                    <p className="text-[9px] font-mono text-gray-600 tracking-wider">
                      RANGE: {featuredBattle.player1.range}
                    </p>
                  </div>

                  {/* VS */}
                  <span className="text-2xl md:text-3xl font-black text-gray-600 tracking-wider">
                    VS
                  </span>

                  {/* Player 2 */}
                  <div className="flex flex-col items-center">
                    <div
                      className="w-20 h-20 md:w-24 md:h-24 flex items-center justify-center rotate-45 rounded-md mb-3"
                      style={{
                        border: '2px solid rgba(237, 127, 47, 0.5)',
                        background: 'rgba(237, 127, 47, 0.08)',
                        boxShadow: '0 0 20px rgba(237, 127, 47, 0.15)',
                      }}
                    >
                      <span
                        className="text-2xl md:text-3xl font-bold -rotate-45"
                        style={{ color: '#ed7f2f' }}
                      >
                        {featuredBattle.player2.symbol}
                      </span>
                    </div>
                    <p className="text-xs font-mono font-bold tracking-wider text-white">
                      {featuredBattle.player2.name}
                    </p>
                    <p className="text-[9px] font-mono text-gray-600 tracking-wider">
                      RANGE: {featuredBattle.player2.range}
                    </p>
                  </div>
                </div>

                {/* Pool Badge */}
                <div className="flex justify-center mb-4 relative z-10">
                  <span
                    className="px-4 py-1 rounded-full text-[10px] font-mono tracking-wider"
                    style={{
                      border: '1px solid #42c7e6',
                      color: '#42c7e6',
                      background: 'rgba(66, 199, 230, 0.08)',
                    }}
                  >
                    {featuredBattle.pool}
                  </span>
                </div>

                {/* Prize Pool */}
                <p className="text-center text-sm font-mono font-bold tracking-wider text-white mb-5 relative z-10">
                  PRIZE POOL: {featuredBattle.prizePool} ETH
                </p>

                {/* Spectate Button */}
                <div className="flex justify-center relative z-10">
                  <Link
                    to="/battle/1"
                    className="px-6 py-2.5 rounded-md text-xs font-bold font-mono tracking-widest transition-all hover:opacity-80"
                    style={{
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      color: 'white',
                      background: 'rgba(255, 255, 255, 0.05)',
                    }}
                  >
                    SPECTATE BATTLE
                  </Link>
                </div>
              </div>
            </div>

            {/* Upcoming Matches */}
            <div
              className="rounded-lg p-5"
              style={{
                background: 'rgba(10, 10, 10, 0.95)',
                border: '1px solid rgba(237, 127, 47, 0.25)',
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3
                  className="text-xs font-bold tracking-widest"
                  style={{ color: '#ed7f2f' }}
                >
                  UPCOMING MATCHES
                </h3>
                <span className="text-[10px] font-mono text-gray-600 tracking-wider">
                  NEXT IN 2:45
                </span>
              </div>

              <div className="space-y-0">
                {upcomingMatches.map((match, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-3"
                    style={{
                      borderBottom:
                        i < upcomingMatches.length - 1
                          ? '1px solid rgba(255, 255, 255, 0.05)'
                          : 'none',
                    }}
                  >
                    <span className="text-[11px] font-mono text-gray-600 tracking-wider w-20">
                      {match.time}
                    </span>
                    <span className="text-xs font-mono text-white tracking-wider flex-1 text-center">
                      <span className="font-bold">{match.player1}</span>
                      <span className="text-gray-600 mx-2">vs</span>
                      <span className="font-bold">{match.player2}</span>
                    </span>
                    <button
                      className="px-3 py-1 text-[10px] font-mono tracking-wider rounded transition-all hover:opacity-80"
                      style={{
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        color: '#9ca3af',
                      }}
                    >
                      BET
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ===== RIGHT COLUMN ===== */}
          <div className="lg:col-span-3 flex flex-col gap-5">

            {/* Battle History */}
            <div
              className="rounded-lg p-5"
              style={{
                background: 'rgba(10, 10, 10, 0.95)',
                border: '1px solid rgba(237, 127, 47, 0.25)',
              }}
            >
              <h3
                className="text-xs font-bold tracking-widest mb-4"
                style={{ color: '#ed7f2f' }}
              >
                BATTLE HISTORY
              </h3>
              <div className="space-y-3">
                {battleHistory.map((entry, i) => (
                  <div
                    key={i}
                    className="py-2"
                    style={{
                      borderBottom:
                        i < battleHistory.length - 1
                          ? '1px solid rgba(255, 255, 255, 0.05)'
                          : 'none',
                    }}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span
                        className="text-[10px] font-bold tracking-widest"
                        style={{
                          color: entry.result === 'VICTORY' ? '#42c7e6' : '#ed7f2f',
                        }}
                      >
                        {entry.result}
                      </span>
                      <span className="text-[9px] font-mono text-gray-600">{entry.time}</span>
                    </div>
                    <p className="text-[11px] font-mono text-gray-500">
                      vs {entry.opponent} ({entry.amount})
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Arena Analytics */}
            <div
              className="rounded-lg p-5"
              style={{
                background: 'rgba(10, 10, 10, 0.95)',
                border: '1px solid rgba(237, 127, 47, 0.25)',
              }}
            >
              <h3
                className="text-xs font-bold tracking-widest mb-4"
                style={{ color: '#ed7f2f' }}
              >
                ARENA ANALYTICS
              </h3>

              {/* Mini Chart */}
              <div
                className="rounded-md p-4 mb-4 relative"
                style={{
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  height: '120px',
                }}
              >
                <svg
                  className="w-full h-full"
                  viewBox="0 0 200 80"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="chartLine" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#42c7e6" />
                      <stop offset="100%" stopColor="#ed7f2f" />
                    </linearGradient>
                    <linearGradient id="chartFill" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="rgba(66, 199, 230, 0.15)" />
                      <stop offset="100%" stopColor="rgba(66, 199, 230, 0)" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0 60 Q20 55 40 50 T80 35 T120 25 T160 30 T200 15"
                    fill="none"
                    stroke="url(#chartLine)"
                    strokeWidth="2"
                  />
                  <path
                    d="M0 60 Q20 55 40 50 T80 35 T120 25 T160 30 T200 15 L200 80 L0 80 Z"
                    fill="url(#chartFill)"
                  />
                </svg>
                <TrendingUp
                  className="absolute top-3 right-3 w-3.5 h-3.5"
                  style={{ color: '#42c7e6' }}
                />
              </div>

              {/* Stats */}
              <div className="space-y-2.5 font-mono text-[11px]">
                {arenaStats.map((stat) => (
                  <div key={stat.label} className="flex justify-between">
                    <span className="text-gray-500 tracking-wider">{stat.label}</span>
                    <span className="text-white font-bold">{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-[10px] font-mono text-gray-700 tracking-widest">
            ARENA_V4 SECURE TERMINAL // CONNECTION STABLE // SYSTEM READY
          </p>
        </div>
      </div>
    </div>
  );
}
