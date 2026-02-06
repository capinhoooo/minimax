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
    type: 'range',
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
    type: 'fee',
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

export default function BattleDetail() {
  const { id } = useParams();
  const [timeLeft, setTimeLeft] = useState(164);

  const battle = mockBattles[id || '1'] || mockBattles['1'];

  // Timer countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Unified Battle Layout - Two cards side by side with timer + extras
  return (
    <div className="min-h-screen grid-bg">
      {/* Timer Section */}
      <div className="max-w-5xl mx-auto px-4 py-8">
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

      <div className="max-w-6xl mx-auto px-4">
        {/* Two Column Layout */}
        <div className="grid grid-cols-2 gap-6">
            {/* Champion Card (Left) - Cyan theme */}
            <div
              className="rounded-lg p-6"
              style={{
                background: 'linear-gradient(135deg, rgba(10, 10, 10, 0.95), rgba(1, 1, 1, 0.98))',
                border: '1px solid rgba(66, 199, 230, 0.4)',
              }}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold" style={{ color: '#42c7e6' }}>
                    0XGLADIATOR_X
                  </h2>
                  <p className="text-xs font-mono text-gray-500">CURRENT CHAMPION</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-mono text-gray-500">EFFICIENCY</p>
                  <p className="text-2xl font-bold" style={{ color: '#42c7e6' }}>98.4%</p>
                  <div className="h-1 w-24 rounded-full mt-1" style={{ background: 'rgba(66, 199, 230, 0.3)' }}>
                    <div className="h-full rounded-full" style={{ width: '98%', background: '#42c7e6' }} />
                  </div>
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div
                  className="p-3 rounded"
                  style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)' }}
                >
                  <p className="text-xs font-mono text-gray-500 mb-1">DYNAMIC APY</p>
                  <p className="text-lg font-bold text-white">24.5%</p>
                </div>
                <div
                  className="p-3 rounded"
                  style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)' }}
                >
                  <p className="text-xs font-mono text-gray-500 mb-1">FEES ACCRUED</p>
                  <p className="text-lg font-bold text-white">0.12 ETH</p>
                </div>
              </div>

              {/* Range Visualizer */}
              <div
                className="relative h-48 rounded-lg p-4 mb-4"
                style={{ background: 'rgba(66, 199, 230, 0.05)', border: '1px solid rgba(66, 199, 230, 0.2)' }}
              >
                {/* Range box */}
                <div
                  className="absolute left-1/4 right-1/4 top-1/4 bottom-1/3 rounded"
                  style={{ background: 'rgba(66, 199, 230, 0.2)', border: '1px solid rgba(66, 199, 230, 0.5)' }}
                />
                {/* Tick labels */}
                <span className="absolute bottom-2 left-4 text-xs font-mono text-gray-600">
                  TICK MIN: 198640
                </span>
                <span className="absolute bottom-2 right-4 text-xs font-mono text-gray-600">
                  TICK MAX: 199220
                </span>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  className="py-3 rounded font-mono text-sm tracking-wider"
                  style={{ background: 'rgba(66, 199, 230, 0.1)', border: '1px solid rgba(66, 199, 230, 0.3)', color: '#42c7e6' }}
                >
                  ADJUST RANGE
                </button>
                <button
                  className="py-3 rounded font-mono text-sm tracking-wider"
                  style={{ background: 'rgba(66, 199, 230, 0.1)', border: '1px solid rgba(66, 199, 230, 0.3)', color: '#42c7e6' }}
                >
                  AUTO-COMPOUND
                </button>
              </div>
            </div>

            {/* Challenger Card (Right) - Magenta theme */}
            <div
              className="rounded-lg p-6"
              style={{
                background: 'linear-gradient(135deg, rgba(10, 10, 10, 0.95), rgba(1, 1, 1, 0.98))',
                border: '1px solid rgba(237, 127, 47, 0.4)',
              }}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold" style={{ color: '#ed7f2f' }}>
                    0XLIQUID_FORCE
                  </h2>
                  <p className="text-xs font-mono text-gray-500">CHALLENGER</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-mono text-gray-500">EFFICIENCY</p>
                  <p className="text-2xl font-bold" style={{ color: '#ed7f2f' }}>82.1%</p>
                  <div className="h-1 w-24 rounded-full mt-1" style={{ background: 'rgba(237, 127, 47, 0.3)' }}>
                    <div className="h-full rounded-full" style={{ width: '82%', background: '#ed7f2f' }} />
                  </div>
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div
                  className="p-3 rounded"
                  style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)' }}
                >
                  <p className="text-xs font-mono text-gray-500 mb-1">DYNAMIC APY</p>
                  <p className="text-lg font-bold text-white">18.2%</p>
                </div>
                <div
                  className="p-3 rounded"
                  style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)' }}
                >
                  <p className="text-xs font-mono text-gray-500 mb-1">FEES ACCRUED</p>
                  <p className="text-lg font-bold text-white">0.08 ETH</p>
                </div>
              </div>

              {/* Range Visualizer */}
              <div
                className="relative h-48 rounded-lg p-4 mb-4"
                style={{ background: 'rgba(237, 127, 47, 0.05)', border: '1px solid rgba(237, 127, 47, 0.2)' }}
              >
                {/* Range box */}
                <div
                  className="absolute left-1/3 right-1/4 top-1/3 bottom-1/4 rounded"
                  style={{ background: 'rgba(237, 127, 47, 0.2)', border: '1px solid rgba(237, 127, 47, 0.5)' }}
                />
                {/* Tick labels */}
                <span className="absolute bottom-2 left-4 text-xs font-mono text-gray-600">
                  TICK MIN: 197000
                </span>
                <span className="absolute bottom-2 right-4 text-xs font-mono text-gray-600">
                  TICK MAX: 201000
                </span>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  className="py-3 rounded font-mono text-sm tracking-wider"
                  style={{ background: 'rgba(237, 127, 47, 0.1)', border: '1px solid rgba(237, 127, 47, 0.3)', color: '#ed7f2f' }}
                >
                  SHIFT CENTER
                </button>
                <button
                  className="py-3 rounded font-mono text-sm tracking-wider"
                  style={{ background: 'rgba(237, 127, 47, 0.1)', border: '1px solid rgba(237, 127, 47, 0.3)', color: '#ed7f2f' }}
                >
                  TIGHTEN RANGE
                </button>
              </div>
            </div>
          </div>

        {/* Bottom Section - Battle Log, Position Tracking, Arena Rules */}
        <div className="grid grid-cols-3 gap-4 mt-8">
          {/* Battle Log */}
          <div
            className="rounded-xl p-5"
            style={{
              background: 'linear-gradient(135deg, rgba(10, 10, 10, 0.95), rgba(1, 1, 1, 0.98))',
              border: '1px solid rgba(237, 127, 47, 0.3)',
            }}
          >
            <h3 className="text-sm font-bold mb-4" style={{ color: '#ed7f2f' }}>
              BATTLE LOG
            </h3>
            <div className="space-y-3 text-xs font-mono">
              <div className="flex gap-2">
                <span className="text-gray-600">|</span>
                <span className="text-gray-400">[14:22:01] Opponent shifted range to 2240 - 2310.</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-600">|</span>
                <span className="text-white">[14:21:45] You captured 0.04 ETH in fee overlap.</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-600">|</span>
                <span className="text-gray-400">[14:20:12] Price volatility increased by 12%.</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-600">|</span>
                <span style={{ color: '#ed7f2f' }}>[14:18:55] WARNING: You are nearing out-of-range bounds.</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-600">|</span>
                <span className="text-gray-400">[14:15:22] Opponent efficiency dropped below 92%.</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-600">|</span>
                <span className="text-gray-400">[14:12:00] Match initialized at tick 204210.</span>
              </div>
            </div>
          </div>

          {/* Position Tracking */}
          <div
            className="rounded-xl p-5"
            style={{
              background: 'linear-gradient(135deg, rgba(10, 10, 10, 0.95), rgba(1, 1, 1, 0.98))',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <h3 className="text-sm font-bold mb-4" style={{ color: '#ed7f2f' }}>
              POSITION TRACKING
            </h3>
            <div className="space-y-4 text-sm font-mono">
              <div className="flex justify-between">
                <span className="text-gray-400">Current Tick:</span>
                <span style={{ color: '#42c7e6' }}>204,452</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Your Range:</span>
                <span className="text-white">204,100 - 204,600</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Opponent Range:</span>
                <span className="text-white">204,350 - 204,800</span>
              </div>
            </div>

            {/* Winning Margin */}
            <div
              className="mt-6 p-3 rounded text-center"
              style={{ border: '1px solid rgba(66, 199, 230, 0.3)' }}
            >
              <span className="text-sm font-mono" style={{ color: '#42c7e6' }}>
                WINNING MARGIN: +7.2%
              </span>
            </div>
          </div>

          {/* Arena Rules */}
          <div
            className="rounded-xl p-5"
            style={{
              background: 'linear-gradient(135deg, rgba(10, 10, 10, 0.95), rgba(1, 1, 1, 0.98))',
              border: '1px solid rgba(237, 127, 47, 0.3)',
            }}
          >
            <h3 className="text-sm font-bold mb-4" style={{ color: '#ed7f2f' }}>
              ARENA RULES
            </h3>
            <p className="text-xs font-mono text-gray-400 leading-relaxed mb-4">
              The provider who stays in-range for 75% of the block window claims the fee bonus. High volatility doubles the point multiplier.
            </p>
            <a
              href="#"
              className="text-xs font-mono underline decoration-dashed underline-offset-4"
              style={{ color: '#42c7e6' }}
            >
              VIEW PROTOCOL CODE
            </a>
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
