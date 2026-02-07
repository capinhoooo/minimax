import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell, LabelList } from 'recharts';
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
const OPPONENT_COLOR = '#ed7f2f';
const GRID_COLOR = 'rgba(255, 255, 255, 0.05)';

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
          PERFORMANCE CHART
        </h3>
        <p className="text-xs font-mono text-gray-600 text-center py-8">
          Waiting for battle data...
        </p>
      </div>
    );
  }

  const chartData = [
    {
      name: formatAddress(creatorAddress, 4),
      efficiency: Number(perfData.creatorPct.toFixed(1)),
      fill: CREATOR_COLOR,
      inRange: perfData.creatorInRange,
      label: 'CREATOR',
    },
    {
      name: formatAddress(opponentAddress, 4),
      efficiency: Number(perfData.opponentPct.toFixed(1)),
      fill: OPPONENT_COLOR,
      inRange: perfData.opponentInRange,
      label: 'OPPONENT',
    },
  ];

  const zeroAddr = '0x0000000000000000000000000000000000000000';

  return (
    <div
      className="rounded-xl p-6 mb-8"
      style={{
        background: 'linear-gradient(135deg, rgba(10, 10, 10, 0.95), rgba(1, 1, 1, 0.98))',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold tracking-widest" style={{ color: '#ed7f2f' }}>
          {vaultType === 'range' ? 'RANGE EFFICIENCY' : 'FEE EFFICIENCY'}
        </h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: CREATOR_COLOR }} />
            <span className="text-[10px] font-mono text-gray-500">CREATOR</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: OPPONENT_COLOR }} />
            <span className="text-[10px] font-mono text-gray-500">OPPONENT</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 40, left: 0, bottom: 5 }}
            barCategoryGap="30%"
          >
            <CartesianGrid horizontal={false} stroke={GRID_COLOR} />
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={{ fill: '#6b7280', fontSize: 10, fontFamily: 'monospace' }}
              tickLine={false}
              axisLine={{ stroke: GRID_COLOR }}
              tickFormatter={(v) => `${v}%`}
            />
            <YAxis
              type="category"
              dataKey="label"
              tick={{ fill: '#9ca3af', fontSize: 10, fontFamily: 'monospace', fontWeight: 'bold' }}
              tickLine={false}
              axisLine={false}
              width={70}
            />
            <Bar dataKey="efficiency" radius={[0, 6, 6, 0]} animationDuration={1000}>
              {chartData.map((entry, index) => (
                <Cell key={index} fill={entry.fill} fillOpacity={0.8} />
              ))}
              <LabelList
                dataKey="efficiency"
                position="right"
                formatter={(v: number) => `${v}%`}
                style={{ fill: '#ffffff', fontSize: 12, fontFamily: 'monospace', fontWeight: 'bold' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Status Indicators */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <div
          className="p-3 rounded-lg text-center"
          style={{
            background: perfData.creatorInRange ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
            border: `1px solid ${perfData.creatorInRange ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
          }}
        >
          <p className="text-[10px] font-mono text-gray-500 tracking-wider mb-1">CREATOR STATUS</p>
          <p
            className="text-sm font-bold font-mono"
            style={{ color: perfData.creatorInRange ? '#22c55e' : '#ef4444' }}
          >
            {perfData.creatorInRange ? 'IN RANGE' : 'OUT OF RANGE'}
          </p>
        </div>
        <div
          className="p-3 rounded-lg text-center"
          style={{
            background: perfData.opponentInRange ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
            border: `1px solid ${perfData.opponentInRange ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
          }}
        >
          <p className="text-[10px] font-mono text-gray-500 tracking-wider mb-1">OPPONENT STATUS</p>
          <p
            className="text-sm font-bold font-mono"
            style={{ color: perfData.opponentInRange ? '#22c55e' : '#ef4444' }}
          >
            {perfData.opponentInRange ? 'IN RANGE' : 'OUT OF RANGE'}
          </p>
        </div>
      </div>

      {/* Leader */}
      {perfData.leader && perfData.leader !== zeroAddr && (
        <div
          className="mt-3 p-2 rounded-lg text-center"
          style={{
            background: 'rgba(34, 197, 94, 0.05)',
            border: '1px solid rgba(34, 197, 94, 0.2)',
          }}
        >
          <span className="text-[10px] font-mono tracking-wider" style={{ color: '#22c55e' }}>
            LEADING: {formatAddress(perfData.leader, 6)}
          </span>
        </div>
      )}
    </div>
  );
}
