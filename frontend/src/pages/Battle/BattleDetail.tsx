import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

type BattleType = 'fee' | 'range';

// Mock battle data
const mockBattles: Record<string, {
  id: string;
  type: BattleType;
  pool: string;
  tier: string;
  round: number;
  totalRounds: number;
  timeRemaining: number;
  currentPrice: number;
  challenger: {
    name: string;
    address: string;
    rank: number;
    winRate: number;
    liquidity: string;
    efficiency: number;
    feeAccrual: number;
    tickPosition: string;
    role: 'ATTACKING' | 'DEFENDING';
    chartData: number[];
    rangeTop: number;
    rangeBottom: number;
    logs: string[];
  };
  defender: {
    name: string;
    address: string;
    rank: number;
    winRate: number;
    liquidity: string;
    efficiency: number;
    feeAccrual: number;
    tickPosition: string;
    role: 'ATTACKING' | 'DEFENDING';
    chartData: number[];
    rangeTop: number;
    rangeBottom: number;
    strategy: {
      mode: string;
      autoCentering: boolean;
      slippage: string;
    };
  };
}> = {
  '1': {
    id: '842',
    type: 'fee',
    pool: 'ETH/USDC',
    tier: '0.05%',
    round: 4,
    totalRounds: 12,
    timeRemaining: 164,
    currentPrice: 1844.21,
    challenger: {
      name: '0xSIGMA_CORE',
      address: '0x92f...A2',
      rank: 14,
      winRate: 68,
      liquidity: '$42.5K',
      efficiency: 94.2,
      feeAccrual: 412.05,
      tickPosition: '194k',
      role: 'ATTACKING',
      chartData: [30, 45, 35, 60, 55, 70, 50, 80, 45, 65, 40, 75],
      rangeTop: 1940,
      rangeBottom: 1750,
      logs: [],
    },
    defender: {
      name: '0xALPHA_ZERO',
      address: '0x4f...9B',
      rank: 8,
      winRate: 72,
      liquidity: '$38.1K',
      efficiency: 97.8,
      feeAccrual: 589.12,
      tickPosition: '194k',
      role: 'DEFENDING',
      chartData: [40, 35, 50, 45, 55, 60, 70, 65, 80, 75, 90, 85],
      rangeTop: 1910,
      rangeBottom: 1780,
      strategy: {
        mode: 'DEFENSIVE',
        autoCentering: true,
        slippage: '0.1%',
      },
    },
  },
  '2': {
    id: '0x92f...A2',
    type: 'range',
    pool: 'ETH / USDC',
    tier: '0.05%',
    round: 4,
    totalRounds: 12,
    timeRemaining: 164,
    currentPrice: 1892.42,
    challenger: {
      name: 'CHALLENGER_01',
      address: '0x82...1A',
      rank: 12,
      winRate: 65,
      liquidity: '$42.5K',
      efficiency: 94.2,
      feeAccrual: 142.10,
      tickPosition: '194k',
      role: 'ATTACKING',
      chartData: [30, 45, 35, 60, 55, 70, 50, 80],
      rangeTop: 1940,
      rangeBottom: 1842,
      logs: [
        '[14:02:11] Range shifted to 1842 - 1920',
        '[14:02:45] Hook trigger: rebalance_mid',
        '[14:03:02] Capture initiated: +0.02 ETH',
      ],
    },
    defender: {
      name: 'DEFENDER_LYRA',
      address: '0x4f...9B',
      rank: 8,
      winRate: 72,
      liquidity: '$38.1K',
      efficiency: 81.5,
      feeAccrual: 98.44,
      tickPosition: '194k',
      role: 'DEFENDING',
      chartData: [40, 35, 50, 45, 55, 60, 70, 65],
      rangeTop: 1910,
      rangeBottom: 1800,
      strategy: {
        mode: 'DEFENSIVE',
        autoCentering: true,
        slippage: '0.1%',
      },
    },
  },
  '3': {
    id: '0x92f...A2',
    type: 'range',
    pool: 'DAI / USDC',
    tier: '0.01%',
    round: 2,
    totalRounds: 8,
    timeRemaining: 320,
    currentPrice: 1.0001,
    challenger: {
      name: 'CHALLENGER_01',
      address: '0x82...1A',
      rank: 12,
      winRate: 65,
      liquidity: '$42.5K',
      efficiency: 94.2,
      feeAccrual: 142.10,
      tickPosition: '194k',
      role: 'ATTACKING',
      chartData: [30, 45, 35, 60, 55, 70, 50, 80],
      rangeTop: 1.001,
      rangeBottom: 0.999,
      logs: [
        '[14:02:11] Range shifted to 0.999 - 1.001',
        '[14:02:45] Hook trigger: rebalance_mid',
      ],
    },
    defender: {
      name: 'DEFENDER_LYRA',
      address: '0x4f...9B',
      rank: 8,
      winRate: 72,
      liquidity: '$38.1K',
      efficiency: 81.5,
      feeAccrual: 98.44,
      tickPosition: '194k',
      role: 'DEFENDING',
      chartData: [40, 35, 50, 45, 55, 60, 70, 65],
      rangeTop: 1.0005,
      rangeBottom: 0.9995,
      strategy: {
        mode: 'DEFENSIVE',
        autoCentering: true,
        slippage: '0.1%',
      },
    },
  },
};

// Scrolling battle log messages
const battleLogMessages = [
  'Sigma fee yield accelerating +12%...',
  'BATTLE_LOG: Market price breach detected at 1,842.50...',
  'BATTLE_LOG: Hook execution successful for 0xAlpha...',
];

export default function BattleDetail() {
  const { id } = useParams();
  const [timeLeft, setTimeLeft] = useState(164);
  const [logIndex, setLogIndex] = useState(0);

  const battle = mockBattles[id || '1'] || mockBattles['1'];

  // Timer countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Rotate battle log messages
  useEffect(() => {
    const logTimer = setInterval(() => {
      setLogIndex((prev) => (prev + 1) % battleLogMessages.length);
    }, 4000);
    return () => clearInterval(logTimer);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Fee Battle Layout (Image #8)
  if (battle.type === 'fee') {
    return (
      <div className="min-h-screen grid-bg">
        {/* Header */}
        <div className="text-center py-8">
          <p className="text-xs font-mono tracking-wider mb-2" style={{ color: '#ed7f2f' }}>
            POOL: {battle.pool} ({battle.tier})
          </p>
          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
            LIVE BATTLE #{battle.id}
          </h1>
        </div>

        {/* Scrolling Battle Log */}
        <div className="overflow-hidden py-2 border-y border-gray-800/50 mb-8">
          <div className="flex gap-16 animate-scroll whitespace-nowrap">
            {battleLogMessages.map((msg, i) => (
              <span
                key={i}
                className="text-xs font-mono tracking-wider"
                style={{ color: i === 0 ? '#ed7f2f' : '#42c7e6' }}
              >
                {msg}
              </span>
            ))}
          </div>
        </div>

        {/* Main Battle Area */}
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-4 items-start">
            {/* Challenger Card */}
            <div
              className="rounded-xl p-5"
              style={{
                background: 'linear-gradient(135deg, rgba(10, 10, 10, 0.95), rgba(1, 1, 1, 0.98))',
                border: '1px solid rgba(237, 127, 47, 0.3)',
              }}
            >
              {/* Player Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                    style={{ background: 'rgba(237, 127, 47, 0.3)', border: '1px solid rgba(237, 127, 47, 0.5)' }}
                  >
                    &Sigma;
                  </div>
                  <div>
                    <p className="font-mono font-bold text-white">{battle.challenger.name}</p>
                    <p className="text-xs font-mono text-gray-500">
                      Rank: #{battle.challenger.rank} | Win Rate: {battle.challenger.winRate}%
                    </p>
                  </div>
                </div>
                <span className="text-sm font-mono" style={{ color: '#ed7f2f' }}>
                  {battle.challenger.role}
                </span>
              </div>

              {/* Chart */}
              <div
                className="relative h-56 mb-4 rounded-lg p-4"
                style={{ background: 'rgba(237, 127, 47, 0.05)', border: '1px solid rgba(237, 127, 47, 0.2)' }}
              >
                {/* Range lines */}
                <div className="absolute top-8 left-0 right-0 border-t border-dashed" style={{ borderColor: '#ed7f2f' }} />
                <div className="absolute bottom-16 left-0 right-0 border-t border-dashed" style={{ borderColor: '#ed7f2f' }} />
                <span className="absolute top-6 right-2 text-xs font-mono" style={{ color: '#ed7f2f' }}>ACTIVE RANGE</span>

                {/* Bars */}
                <div className="absolute bottom-12 left-4 right-4 h-32 flex items-end justify-between gap-1">
                  {battle.challenger.chartData.map((height, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t"
                      style={{
                        height: `${height}%`,
                        background: i % 2 === 0
                          ? 'linear-gradient(to top, rgba(237, 127, 47, 0.8), rgba(237, 127, 47, 0.4))'
                          : 'linear-gradient(to top, rgba(138, 56, 21, 0.8), rgba(138, 56, 21, 0.4))',
                      }}
                    />
                  ))}
                </div>

                {/* Price line */}
                <div className="absolute bottom-20 left-0 right-0 flex items-center">
                  <div className="flex-1 border-t-2" style={{ borderColor: '#42c7e6' }} />
                  <span
                    className="px-2 py-1 text-xs font-mono rounded"
                    style={{ background: '#010101', border: '1px solid #42c7e6', color: '#42c7e6' }}
                  >
                    {battle.currentPrice.toLocaleString()} USDC
                  </span>
                </div>
              </div>

              {/* Stats */}
              <div
                className="grid grid-cols-3 gap-4 p-4 rounded-lg"
                style={{ background: 'rgba(237, 127, 47, 0.05)', border: '1px solid rgba(237, 127, 47, 0.2)' }}
              >
                <div className="text-center">
                  <p className="text-xs font-mono text-gray-500 mb-1">EFFICIENCY</p>
                  <p className="text-xl font-bold text-white">{battle.challenger.efficiency}%</p>
                </div>
                <div className="text-center">
                  <p className="text-xs font-mono text-gray-500 mb-1">FEE ACCRUAL</p>
                  <p className="text-xl font-bold" style={{ color: '#ed7f2f' }}>${battle.challenger.feeAccrual}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs font-mono text-gray-500 mb-1">TICK POSITION</p>
                  <p className="text-xl font-bold text-white">{battle.challenger.tickPosition}</p>
                </div>
              </div>
            </div>

            {/* VS Badge */}
            <div className="flex items-center justify-center py-8 md:py-0">
              <div
                className="w-20 h-20 rotate-45 flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, rgba(237, 127, 47, 0.3), rgba(138, 56, 21, 0.3))',
                  border: '2px solid rgba(237, 127, 47, 0.5)',
                  boxShadow: '0 0 30px rgba(237, 127, 47, 0.3)',
                }}
              >
                <span className="-rotate-45 text-2xl font-black text-white">VS</span>
              </div>
            </div>

            {/* Defender Card */}
            <div
              className="rounded-xl p-5"
              style={{
                background: 'linear-gradient(135deg, rgba(10, 10, 10, 0.95), rgba(1, 1, 1, 0.98))',
                border: '1px solid rgba(34, 197, 94, 0.3)',
              }}
            >
              {/* Player Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                    style={{ background: 'rgba(34, 197, 94, 0.3)', border: '1px solid rgba(34, 197, 94, 0.5)' }}
                  >
                    A
                  </div>
                  <div>
                    <p className="font-mono font-bold text-white">{battle.defender.name}</p>
                    <p className="text-xs font-mono text-gray-500">
                      Rank: #{battle.defender.rank} | Win Rate: {battle.defender.winRate}%
                    </p>
                  </div>
                </div>
                <span className="text-sm font-mono" style={{ color: '#22c55e' }}>
                  {battle.defender.role}
                </span>
              </div>

              {/* Chart */}
              <div
                className="relative h-56 mb-4 rounded-lg p-4"
                style={{ background: 'rgba(34, 197, 94, 0.05)', border: '1px solid rgba(34, 197, 94, 0.2)' }}
              >
                {/* Range lines */}
                <div className="absolute top-12 left-0 right-0 border-t border-dashed" style={{ borderColor: '#22c55e' }} />
                <div className="absolute bottom-20 left-0 right-0 border-t border-dashed" style={{ borderColor: '#22c55e' }} />

                {/* Bars */}
                <div className="absolute bottom-12 left-4 right-4 h-32 flex items-end justify-between gap-1">
                  {battle.defender.chartData.map((height, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t"
                      style={{
                        height: `${height}%`,
                        background: i % 2 === 0
                          ? 'linear-gradient(to top, rgba(139, 92, 246, 0.8), rgba(139, 92, 246, 0.4))'
                          : 'linear-gradient(to top, rgba(34, 197, 94, 0.8), rgba(34, 197, 94, 0.4))',
                      }}
                    />
                  ))}
                </div>

                {/* Price line */}
                <div className="absolute bottom-24 left-0 right-0 flex items-center">
                  <div className="flex-1 border-t-2" style={{ borderColor: '#42c7e6' }} />
                  <span
                    className="px-2 py-1 text-xs font-mono rounded"
                    style={{ background: '#ed7f2f', color: 'white' }}
                  >
                    {battle.currentPrice.toLocaleString()} USDC
                  </span>
                </div>
              </div>

              {/* Stats */}
              <div
                className="grid grid-cols-3 gap-4 p-4 rounded-lg"
                style={{ background: 'rgba(34, 197, 94, 0.05)', border: '1px solid rgba(34, 197, 94, 0.2)' }}
              >
                <div className="text-center">
                  <p className="text-xs font-mono text-gray-500 mb-1">EFFICIENCY</p>
                  <p className="text-xl font-bold text-white">{battle.defender.efficiency}%</p>
                </div>
                <div className="text-center">
                  <p className="text-xs font-mono text-gray-500 mb-1">FEE ACCRUAL</p>
                  <p className="text-xl font-bold" style={{ color: '#ed7f2f' }}>${battle.defender.feeAccrual}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs font-mono text-gray-500 mb-1">TICK POSITION</p>
                  <p className="text-xl font-bold text-white">{battle.defender.tickPosition}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center gap-4 mt-12 mb-8">
            <button
              className="px-8 py-3 rounded-lg font-medium tracking-wider transition-all hover:opacity-90"
              style={{
                background: 'transparent',
                border: '1px solid rgba(237, 127, 47, 0.5)',
                color: '#ed7f2f',
              }}
            >
              WITHDRAW POSITION
            </button>
            <button
              className="px-8 py-3 rounded-lg font-medium tracking-wider transition-all hover:opacity-90"
              style={{
                background: 'linear-gradient(135deg, rgba(237, 127, 47, 0.3), rgba(138, 56, 21, 0.3))',
                border: '1px solid rgba(237, 127, 47, 0.5)',
                color: '#ed7f2f',
              }}
            >
              ADJUST RANGE LOGIC
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Price Range Battle Layout (Image #7)
  return (
    <div className="min-h-screen grid-bg">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <h1 className="text-xl font-bold">
          <span style={{ color: '#ed7f2f' }}>ARENA_V4</span>
          <span className="text-gray-500"> // </span>
          <span style={{ color: '#42c7e6' }}>BATTLE_ID: {battle.id}</span>
        </h1>
      </div>

      {/* Timer Section */}
      <div className="max-w-5xl mx-auto px-4 mb-8">
        <div
          className="rounded-xl p-8 text-center"
          style={{
            background: 'linear-gradient(135deg, rgba(10, 10, 10, 0.95), rgba(1, 1, 1, 0.98))',
            border: '1px solid rgba(237, 127, 47, 0.3)',
          }}
        >
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#ed7f2f' }} />
            <span className="text-xs font-mono tracking-wider" style={{ color: '#ed7f2f' }}>
              LIVE: ROUND {battle.round}/{battle.totalRounds}
            </span>
          </div>
          <p
            className="text-6xl sm:text-7xl font-bold font-mono mb-2"
            style={{ color: '#42c7e6' }}
          >
            {formatTime(timeLeft)}
          </p>
          <p className="text-sm font-mono text-gray-500 tracking-wider">
            {battle.pool} Pool — {battle.tier} Tier
          </p>
        </div>
      </div>

      {/* Three Column Layout */}
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr,1.2fr,1fr] gap-4">
          {/* Challenger Card */}
          <div
            className="rounded-xl p-5"
            style={{
              background: 'linear-gradient(135deg, rgba(10, 10, 10, 0.95), rgba(1, 1, 1, 0.98))',
              border: '1px solid rgba(237, 127, 47, 0.3)',
            }}
          >
            <h3 className="text-lg font-bold mb-4" style={{ color: '#42c7e6' }}>
              {battle.challenger.name}
            </h3>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div
                className="p-3 rounded"
                style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)' }}
              >
                <p className="text-xs font-mono text-gray-500 mb-1">LIQUIDITY</p>
                <p className="text-lg font-bold text-white">{battle.challenger.liquidity}</p>
              </div>
              <div
                className="p-3 rounded"
                style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)' }}
              >
                <p className="text-xs font-mono text-gray-500 mb-1">EFFICIENCY</p>
                <p className="text-lg font-bold text-white">{battle.challenger.efficiency}%</p>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-dashed border-gray-700 my-4" />

            {/* Fees Progress */}
            <div className="mb-4">
              <div className="flex justify-between text-xs font-mono mb-2">
                <span className="text-gray-500">FEES ACCUMULATED</span>
                <span className="text-white">${battle.challenger.feeAccrual}</span>
              </div>
              <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255, 255, 255, 0.1)' }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: '60%',
                    background: 'linear-gradient(90deg, #42c7e6, #ed7f2f)',
                  }}
                />
              </div>
            </div>

            {/* Active Range Logs */}
            <div className="mt-auto">
              <p className="text-xs font-mono text-gray-500 mb-2">ACTIVE RANGE LOGS</p>
              <div className="space-y-1">
                {battle.challenger.logs.map((log, i) => (
                  <p key={i} className="text-xs font-mono text-gray-400">{log}</p>
                ))}
              </div>
            </div>
          </div>

          {/* Tick Range Visualizer */}
          <div
            className="rounded-xl p-5"
            style={{
              background: 'linear-gradient(135deg, rgba(10, 10, 10, 0.95), rgba(1, 1, 1, 0.98))',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <span className="text-xs font-mono text-gray-500">TICK RANGE VISUALIZER v1.04</span>
              <span className="text-xs font-mono" style={{ color: '#42c7e6' }}>
                PRICE: {battle.currentPrice.toLocaleString()} USDC
              </span>
            </div>

            {/* Visualizer */}
            <div className="relative h-80">
              {/* Y-axis labels */}
              <div className="absolute left-0 top-0 bottom-0 w-12 flex flex-col justify-between text-xs font-mono text-gray-600">
                <span>2100</span>
                <span>2000</span>
                <span>1900</span>
                <span>1800</span>
                <span>1700</span>
              </div>

              {/* Chart area */}
              <div className="ml-14 h-full relative">
                {/* Challenger Range (Orange) */}
                <div
                  className="absolute left-4 right-1/2 rounded"
                  style={{
                    top: '20%',
                    height: '25%',
                    background: 'rgba(237, 127, 47, 0.15)',
                    border: '1px solid rgba(237, 127, 47, 0.5)',
                  }}
                >
                  <span
                    className="absolute -top-5 left-0 text-xs font-mono"
                    style={{ color: '#ed7f2f' }}
                  >
                    C_RANGE_TOP: {battle.challenger.rangeTop}
                  </span>
                </div>

                {/* Defender Range (Cyan) */}
                <div
                  className="absolute left-1/4 right-4 rounded"
                  style={{
                    top: '35%',
                    height: '30%',
                    background: 'rgba(66, 199, 230, 0.15)',
                    border: '1px solid rgba(66, 199, 230, 0.5)',
                  }}
                >
                  <span
                    className="absolute -top-5 right-0 text-xs font-mono"
                    style={{ color: '#42c7e6' }}
                  >
                    D_RANGE_TOP: {battle.defender.rangeTop}
                  </span>
                </div>

                {/* Current Price Line */}
                <div
                  className="absolute left-0 right-0 flex items-center"
                  style={{ top: '45%' }}
                >
                  <div className="flex-1 border-t-2 border-white" />
                  <span
                    className="px-2 py-1 text-xs font-mono rounded ml-2"
                    style={{ background: '#010101', border: '1px solid white', color: 'white' }}
                  >
                    {battle.currentPrice.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Defender Card */}
          <div
            className="rounded-xl p-5"
            style={{
              background: 'linear-gradient(135deg, rgba(10, 10, 10, 0.95), rgba(1, 1, 1, 0.98))',
              border: '1px solid rgba(66, 199, 230, 0.3)',
            }}
          >
            <h3 className="text-lg font-bold mb-4" style={{ color: '#42c7e6' }}>
              {battle.defender.name}
            </h3>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div
                className="p-3 rounded"
                style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)' }}
              >
                <p className="text-xs font-mono text-gray-500 mb-1">LIQUIDITY</p>
                <p className="text-lg font-bold text-white">{battle.defender.liquidity}</p>
              </div>
              <div
                className="p-3 rounded"
                style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)' }}
              >
                <p className="text-xs font-mono text-gray-500 mb-1">EFFICIENCY</p>
                <p className="text-lg font-bold text-white">{battle.defender.efficiency}%</p>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-dashed border-gray-700 my-4" />

            {/* Fees Progress */}
            <div className="mb-4">
              <div className="flex justify-between text-xs font-mono mb-2">
                <span className="text-gray-500">FEES ACCUMULATED</span>
                <span className="text-white">${battle.defender.feeAccrual}</span>
              </div>
              <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255, 255, 255, 0.1)' }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: '35%',
                    background: 'linear-gradient(90deg, #42c7e6, #ed7f2f)',
                  }}
                />
              </div>
            </div>

            {/* Arena Strategy */}
            <div className="mt-8">
              <p className="text-xs font-mono text-gray-500 mb-2">ARENA STRATEGY</p>
              <div
                className="p-3 rounded text-xs font-mono"
                style={{ background: 'rgba(66, 199, 230, 0.1)', border: '1px solid rgba(66, 199, 230, 0.3)' }}
              >
                <p style={{ color: '#42c7e6' }}>MODE: {battle.defender.strategy.mode}</p>
                <p className="text-gray-400">Automatic centering: {battle.defender.strategy.autoCentering ? 'ENABLED' : 'DISABLED'}</p>
                <p className="text-gray-400">Slippage Tolerance: {battle.defender.strategy.slippage}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Terminal Status Footer */}
      <div className="text-center py-12">
        <p className="text-xs font-mono text-gray-600 tracking-wider">
          UNISWAP_V4_ARENA_CLIENT // REAL-TIME DATA STREAM // BLOCK_HEIGHT: 18420831
        </p>
      </div>
    </div>
  );
}
