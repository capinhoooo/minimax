import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Trophy, Zap, ShieldOff } from 'lucide-react';
import { formatAddress } from '../../lib/utils';
import type { VaultType } from '../../types';

interface PerfData {
  creatorInRange: boolean;
  opponentInRange: boolean;
  creatorPct: number;
  opponentPct: number;
  leader: string;
  type: 'range' | 'fee';
  creatorFeeGrowth?: bigint;
  opponentFeeGrowth?: bigint;
}

interface PerformanceChartProps {
  perfData: PerfData | null;
  vaultType: VaultType;
  creatorAddress: string;
  opponentAddress: string;
}

const CREATOR_COLOR = '#42c7e6';
const CREATOR_GLOW = 'rgba(66, 199, 230, 0.4)';
const OPPONENT_COLOR = '#ed7f2f';
const OPPONENT_GLOW = 'rgba(237, 127, 47, 0.4)';
const ZERO_ADDR = '0x0000000000000000000000000000000000000000';

export default function PerformanceChart({ perfData, vaultType, creatorAddress, opponentAddress }: PerformanceChartProps) {
  if (!perfData) {
    return (
      <div
        className="rounded-xl p-6 mb-8"
        style={{
          background: 'linear-gradient(135deg, rgba(10, 10, 10, 0.95), rgba(1, 1, 1, 0.98))',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <h3 className="text-xs font-bold tracking-widest mb-4" style={{ color: '#ed7f2f' }}>
          BATTLE ARENA
        </h3>
        <p className="text-xs font-mono text-gray-600 text-center py-8">
          Waiting for battle data...
        </p>
      </div>
    );
  }

  const creatorPct = perfData.creatorPct;
  const opponentPct = perfData.opponentPct;
  const isLeaderCreator = perfData.leader?.toLowerCase() === creatorAddress.toLowerCase();
  const isLeaderOpponent = perfData.leader?.toLowerCase() === opponentAddress.toLowerCase();
  const isTied = creatorPct === opponentPct;

  // Doughnut data for the center ring
  const ringData = [
    { name: 'Creator', value: creatorPct || 0.5, color: CREATOR_COLOR },
    { name: 'Opponent', value: opponentPct || 0.5, color: OPPONENT_COLOR },
  ];

  // Outer ring for in-range status
  const creatorRangeAngle = perfData.creatorInRange ? 180 : 0;
  const opponentRangeAngle = perfData.opponentInRange ? 180 : 0;

  return (
    <div
      className="rounded-xl p-6 mb-8 overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(10, 10, 10, 0.95), rgba(1, 1, 1, 0.98))',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xs font-bold tracking-widest" style={{ color: '#ed7f2f' }}>
          BATTLE ARENA
        </h3>
        <span className="text-[10px] font-mono tracking-widest text-gray-600">
          {vaultType === 'range' ? 'RANGE_MODE' : 'FEE_MODE'}
        </span>
      </div>

      {/* Main Duel Layout */}
      <div className="grid grid-cols-3 gap-4 items-center">

        {/* Creator Side */}
        <div className="text-center">
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-3"
            style={{
              background: 'rgba(66, 199, 230, 0.1)',
              border: `1px solid ${isLeaderCreator ? CREATOR_GLOW : 'rgba(66, 199, 230, 0.2)'}`,
              boxShadow: isLeaderCreator ? `0 0 15px ${CREATOR_GLOW}` : 'none',
            }}
          >
            <div className="w-2 h-2 rounded-full" style={{ background: CREATOR_COLOR }} />
            <span className="text-[10px] font-mono font-bold tracking-wider" style={{ color: CREATOR_COLOR }}>
              CREATOR
            </span>
          </div>

          <p className="text-3xl font-black font-mono mb-1" style={{ color: CREATOR_COLOR }}>
            {creatorPct.toFixed(1)}%
          </p>

          <div
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
            style={{
              background: perfData.creatorInRange ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              border: `1px solid ${perfData.creatorInRange ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
            }}
          >
            {perfData.creatorInRange ? (
              <Zap className="w-3 h-3" style={{ color: '#22c55e' }} />
            ) : (
              <ShieldOff className="w-3 h-3" style={{ color: '#ef4444' }} />
            )}
            <span
              className="text-[9px] font-mono font-bold tracking-wider"
              style={{ color: perfData.creatorInRange ? '#22c55e' : '#ef4444' }}
            >
              {perfData.creatorInRange ? 'IN RANGE' : 'OUT'}
            </span>
          </div>

          <p className="text-[10px] font-mono text-gray-600 mt-2 tracking-wider">
            {formatAddress(creatorAddress, 4)}
          </p>
        </div>

        {/* Center Ring Chart */}
        <div className="relative">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                {/* Outer glow ring */}
                <Pie
                  data={ringData}
                  cx="50%"
                  cy="50%"
                  startAngle={90}
                  endAngle={-270}
                  innerRadius="62%"
                  outerRadius="80%"
                  paddingAngle={4}
                  dataKey="value"
                  animationDuration={1200}
                  animationBegin={0}
                  stroke="none"
                >
                  {ringData.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={entry.color}
                      fillOpacity={0.9}
                      style={{
                        filter: `drop-shadow(0 0 6px ${entry.color}80)`,
                      }}
                    />
                  ))}
                </Pie>
                {/* Inner thin ring */}
                <Pie
                  data={ringData}
                  cx="50%"
                  cy="50%"
                  startAngle={90}
                  endAngle={-270}
                  innerRadius="50%"
                  outerRadius="56%"
                  paddingAngle={4}
                  dataKey="value"
                  animationDuration={1200}
                  animationBegin={200}
                  stroke="none"
                >
                  {ringData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} fillOpacity={0.3} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Center Label */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              {isTied ? (
                <>
                  <p className="text-lg font-black text-white tracking-wider">TIED</p>
                  <p className="text-[10px] font-mono text-gray-500 tracking-widest">50 / 50</p>
                </>
              ) : (
                <>
                  <Trophy className="w-5 h-5 mx-auto mb-1" style={{ color: '#22c55e' }} />
                  <p className="text-[10px] font-mono font-bold tracking-wider" style={{ color: '#22c55e' }}>
                    LEADING
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Opponent Side */}
        <div className="text-center">
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-3"
            style={{
              background: 'rgba(237, 127, 47, 0.1)',
              border: `1px solid ${isLeaderOpponent ? OPPONENT_GLOW : 'rgba(237, 127, 47, 0.2)'}`,
              boxShadow: isLeaderOpponent ? `0 0 15px ${OPPONENT_GLOW}` : 'none',
            }}
          >
            <div className="w-2 h-2 rounded-full" style={{ background: OPPONENT_COLOR }} />
            <span className="text-[10px] font-mono font-bold tracking-wider" style={{ color: OPPONENT_COLOR }}>
              OPPONENT
            </span>
          </div>

          <p className="text-3xl font-black font-mono mb-1" style={{ color: OPPONENT_COLOR }}>
            {opponentPct.toFixed(1)}%
          </p>

          <div
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
            style={{
              background: perfData.opponentInRange ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              border: `1px solid ${perfData.opponentInRange ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
            }}
          >
            {perfData.opponentInRange ? (
              <Zap className="w-3 h-3" style={{ color: '#22c55e' }} />
            ) : (
              <ShieldOff className="w-3 h-3" style={{ color: '#ef4444' }} />
            )}
            <span
              className="text-[9px] font-mono font-bold tracking-wider"
              style={{ color: perfData.opponentInRange ? '#22c55e' : '#ef4444' }}
            >
              {perfData.opponentInRange ? 'IN RANGE' : 'OUT'}
            </span>
          </div>

          <p className="text-[10px] font-mono text-gray-600 mt-2 tracking-wider">
            {formatAddress(opponentAddress, 4)}
          </p>
        </div>
      </div>

      {/* Bottom Power Bar */}
      <div className="mt-6 pt-4" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono font-bold tracking-wider flex-shrink-0" style={{ color: CREATOR_COLOR }}>
            {creatorPct.toFixed(0)}%
          </span>
          <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255, 255, 255, 0.05)' }}>
            <div className="h-full flex">
              <div
                className="h-full transition-all duration-1000 rounded-l-full"
                style={{
                  width: `${creatorPct}%`,
                  background: `linear-gradient(90deg, ${CREATOR_COLOR}, ${CREATOR_COLOR}aa)`,
                  boxShadow: `0 0 10px ${CREATOR_GLOW}`,
                }}
              />
              <div
                className="h-full transition-all duration-1000 rounded-r-full"
                style={{
                  width: `${opponentPct}%`,
                  background: `linear-gradient(90deg, ${OPPONENT_COLOR}aa, ${OPPONENT_COLOR})`,
                  boxShadow: `0 0 10px ${OPPONENT_GLOW}`,
                }}
              />
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold tracking-wider flex-shrink-0" style={{ color: OPPONENT_COLOR }}>
            {opponentPct.toFixed(0)}%
          </span>
        </div>

        {/* Leader tag */}
        {perfData.leader && perfData.leader !== ZERO_ADDR && !isTied && (
          <div className="flex items-center justify-center gap-2 mt-3">
            <Trophy className="w-3 h-3" style={{ color: '#22c55e' }} />
            <span className="text-[10px] font-mono tracking-wider" style={{ color: '#22c55e' }}>
              {isLeaderCreator ? 'CREATOR' : 'OPPONENT'} LEADS — {formatAddress(perfData.leader, 6)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
