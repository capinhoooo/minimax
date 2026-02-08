import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { formatAddress, formatUSD } from '../lib/utils';
import {
  useBattleCount,
  useActiveBattles,
  useRangeBattles,
  useFeeBattles,
} from '../hooks/useBattleVault';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export default function Leaderboard() {
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  // Get total battle counts
  const { data: rangeBattleCount, isLoading: loadingRange } = useBattleCount('range');
  const { data: feeBattleCount, isLoading: loadingFee } = useBattleCount('fee');
  const { data: rangeActiveIds } = useActiveBattles('range');
  const { data: feeActiveIds } = useActiveBattles('fee');

  const rangeCount = rangeBattleCount ? Number(rangeBattleCount as bigint) : 0;
  const feeCount = feeBattleCount ? Number(feeBattleCount as bigint) : 0;

  // Generate all battle IDs to fetch
  const allRangeIds = useMemo(() => {
    return Array.from({ length: rangeCount }, (_, i) => BigInt(i));
  }, [rangeCount]);

  const allFeeIds = useMemo(() => {
    return Array.from({ length: feeCount }, (_, i) => BigInt(i));
  }, [feeCount]);

  // Multicall fetch all battles
  const { data: allRangeBattles, isLoading: loadingRangeBattles } = useRangeBattles(allRangeIds);
  const { data: allFeeBattles, isLoading: loadingFeeBattles } = useFeeBattles(allFeeIds);

  const isLoading = loadingRange || loadingFee || loadingRangeBattles || loadingFeeBattles;

  // Aggregate per-address stats
  type GladiatorStats = {
    address: string;
    wins: number;
    losses: number;
    totalValue: bigint;
    activeBattles: number;
  };

  const { gladiators, totalResolved, uniqueAddresses } = useMemo(() => {
    const stats = new Map<string, GladiatorStats>();

    const getOrCreate = (addr: string): GladiatorStats => {
      if (!stats.has(addr)) {
        stats.set(addr, { address: addr, wins: 0, losses: 0, totalValue: 0n, activeBattles: 0 });
      }
      return stats.get(addr)!;
    };

    let resolved = 0;

    // Process range battles
    if (allRangeBattles) {
      allRangeBattles.forEach((r) => {
        if (r.status === 'success' && r.result) {
          const [creator, opponent, winner, , , , , totalValueUSD, isResolved] = r.result as [string, string, string, bigint, bigint, bigint, bigint, bigint, boolean, string];

          // Track creator
          if (creator !== ZERO_ADDRESS) {
            const cs = getOrCreate(creator.toLowerCase());
            if (!isResolved) cs.activeBattles++;
          }
          // Track opponent
          if (opponent !== ZERO_ADDRESS) {
            const os = getOrCreate(opponent.toLowerCase());
            if (!isResolved) os.activeBattles++;
          }

          if (isResolved && winner !== ZERO_ADDRESS) {
            resolved++;
            const ws = getOrCreate(winner.toLowerCase());
            ws.wins++;
            ws.totalValue += totalValueUSD;

            const loser = winner.toLowerCase() === creator.toLowerCase() ? opponent : creator;
            if (loser !== ZERO_ADDRESS) {
              const ls = getOrCreate(loser.toLowerCase());
              ls.losses++;
            }
          }
        }
      });
    }

    // Process fee battles
    if (allFeeBattles) {
      allFeeBattles.forEach((r) => {
        if (r.status === 'success' && r.result) {
          const [creator, opponent, winner, , , , , creatorLPValue, , isResolved] = r.result as [string, string, string, bigint, bigint, bigint, bigint, bigint, bigint, boolean, string];

          if (creator !== ZERO_ADDRESS) {
            const cs = getOrCreate(creator.toLowerCase());
            if (!isResolved) cs.activeBattles++;
          }
          if (opponent !== ZERO_ADDRESS) {
            const os = getOrCreate(opponent.toLowerCase());
            if (!isResolved) os.activeBattles++;
          }

          if (isResolved && winner !== ZERO_ADDRESS) {
            resolved++;
            const ws = getOrCreate(winner.toLowerCase());
            ws.wins++;
            ws.totalValue += creatorLPValue;

            const loser = winner.toLowerCase() === creator.toLowerCase() ? opponent : creator;
            if (loser !== ZERO_ADDRESS) {
              const ls = getOrCreate(loser.toLowerCase());
              ls.losses++;
            }
          }
        }
      });
    }

    const sorted = Array.from(stats.values())
      .filter((s) => s.wins + s.losses > 0)
      .sort((a, b) => {
        // Primary: wins desc, secondary: win rate desc, tertiary: total value desc
        if (b.wins !== a.wins) return b.wins - a.wins;
        const aRate = a.wins / (a.wins + a.losses);
        const bRate = b.wins / (b.wins + b.losses);
        if (bRate !== aRate) return bRate - aRate;
        return Number(b.totalValue - a.totalValue);
      })
      .slice(0, 20);

    return {
      gladiators: sorted,
      totalResolved: resolved,
      uniqueAddresses: stats.size,
    };
  }, [allRangeBattles, allFeeBattles]);

  const totalBattles = rangeCount + feeCount;
  const totalActive = ((rangeActiveIds as bigint[]) ?? []).length + ((feeActiveIds as bigint[]) ?? []).length;

  const getBadge = (rank: number, wins: number) => {
    if (rank === 1) return { label: 'LEGEND', color: '#ed7f2f' };
    if (rank <= 3) return { label: 'ELITE', color: '#a855f7' };
    if (wins >= 10) return { label: 'PRO', color: '#42c7e6' };
    if (wins >= 5) return { label: 'VETERAN', color: '#22c55e' };
    return null;
  };

  return (
    <div className="min-h-screen grid-bg">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Title */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black mb-3 tracking-tight">
          <span className="gradient-text-magenta italic">ARENA RANKINGS</span>
        </h1>
        <p className="text-xs sm:text-sm tracking-[0.3em] text-gray-500 mb-12 uppercase font-mono">
          On-chain leaderboard from Uniswap V4 LP Battles
        </p>

        {/* Stats Cards */}
        <div
          className="grid grid-cols-2 lg:grid-cols-4 gap-px rounded-lg overflow-hidden mb-12"
          style={{
            border: '1px solid rgba(66, 199, 230, 0.3)',
          }}
        >
          <div
            className="px-5 py-4"
            style={{
              background: 'rgba(10, 10, 10, 0.8)',
              borderLeft: '2px solid rgba(66, 199, 230, 0.4)',
            }}
          >
            <p className="text-[10px] sm:text-xs font-mono tracking-wider text-gray-500 mb-1">
              TOTAL BATTLES
            </p>
            <p className="text-xl sm:text-2xl font-black" style={{ color: '#42c7e6' }}>
              {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : totalBattles}
            </p>
          </div>
          <div
            className="px-5 py-4"
            style={{
              background: 'rgba(10, 10, 10, 0.8)',
              borderLeft: '2px solid rgba(66, 199, 230, 0.4)',
            }}
          >
            <p className="text-[10px] sm:text-xs font-mono tracking-wider text-gray-500 mb-1">
              ACTIVE GLADIATORS
            </p>
            <p className="text-xl sm:text-2xl font-black" style={{ color: '#42c7e6' }}>
              {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : uniqueAddresses}
            </p>
          </div>
          <div
            className="px-5 py-4"
            style={{
              background: 'rgba(10, 10, 10, 0.8)',
              borderLeft: '2px solid rgba(66, 199, 230, 0.4)',
            }}
          >
            <p className="text-[10px] sm:text-xs font-mono tracking-wider text-gray-500 mb-1">
              BATTLES CONCLUDED
            </p>
            <p className="text-xl sm:text-2xl font-black" style={{ color: '#42c7e6' }}>
              {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : totalResolved}
            </p>
          </div>
          <div
            className="px-5 py-4"
            style={{
              background: 'rgba(10, 10, 10, 0.8)',
              borderLeft: '2px solid rgba(66, 199, 230, 0.4)',
            }}
          >
            <p className="text-[10px] sm:text-xs font-mono tracking-wider text-gray-500 mb-1">
              LIVE BATTLES
            </p>
            <p className="text-xl sm:text-2xl font-black" style={{ color: '#42c7e6' }}>
              {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : totalActive}
            </p>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#42c7e6' }} />
            <span className="ml-3 text-sm font-mono text-gray-500 tracking-wider">AGGREGATING ON-CHAIN DATA...</span>
          </div>
        )}

        {/* Leaderboard Table */}
        {!isLoading && (
          <div
            className="rounded-xl overflow-hidden"
            style={{
              border: '1px solid rgba(237, 127, 47, 0.3)',
              boxShadow: '0 0 30px rgba(237, 127, 47, 0.1)',
            }}
          >
            {/* Table Header */}
            <div
              className="grid px-4 py-3"
              style={{
                gridTemplateColumns: '60px 1fr 120px 140px 120px 100px',
                background: 'rgba(10, 10, 10, 0.95)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <span className="text-xs font-mono font-bold tracking-wider text-gray-400">RANK</span>
              <span className="text-xs font-mono font-bold tracking-wider text-gray-400">GLADIATOR</span>
              <span className="text-xs font-mono font-bold tracking-wider text-gray-400">WIN/LOSS</span>
              <span className="text-xs font-mono font-bold tracking-wider text-gray-400">TOTAL VALUE</span>
              <span className="text-xs font-mono font-bold tracking-wider text-gray-400">WIN RATE</span>
              <span className="text-xs font-mono font-bold tracking-wider text-gray-400">ACTIVE</span>
            </div>

            {/* Table Rows */}
            {gladiators.length > 0 ? (
              gladiators.map((g, index) => {
                const rank = index + 1;
                const badge = getBadge(rank, g.wins);
                const winRate = g.wins + g.losses > 0
                  ? ((g.wins / (g.wins + g.losses)) * 100).toFixed(1)
                  : '0.0';

                return (
                  <div
                    key={g.address}
                    className="grid items-center px-4 py-4 transition-colors"
                    style={{
                      gridTemplateColumns: '60px 1fr 120px 140px 120px 100px',
                      background:
                        hoveredRow === rank
                          ? 'rgba(237, 127, 47, 0.05)'
                          : 'rgba(5, 5, 5, 0.95)',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                    }}
                    onMouseEnter={() => setHoveredRow(rank)}
                    onMouseLeave={() => setHoveredRow(null)}
                  >
                    {/* Rank */}
                    <span className="text-lg font-mono font-bold text-gray-300 flex items-center gap-1.5">
                      {String(rank).padStart(2, '0')}
                      {rank === 1 && <span className="text-yellow-400 text-base">&#9733;</span>}
                    </span>

                    {/* Address + Badge */}
                    <div className="flex items-center gap-2">
                      <a
                        href={`https://sepolia.etherscan.io/address/${g.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono font-medium hover:underline"
                        style={{ color: '#42c7e6' }}
                      >
                        {formatAddress(g.address, 6)}
                      </a>
                      {badge && (
                        <span
                          className="text-[10px] font-mono font-bold px-2 py-0.5 rounded"
                          style={{
                            backgroundColor: `${badge.color}20`,
                            border: `1px solid ${badge.color}60`,
                            color: badge.color,
                          }}
                        >
                          {badge.label}
                        </span>
                      )}
                    </div>

                    {/* Win/Loss */}
                    <span className="font-mono text-sm text-gray-400">
                      <span className="text-white">{g.wins}</span>
                      {' / '}
                      <span className="text-gray-600">{g.losses}</span>
                    </span>

                    {/* Total Value */}
                    <span className="font-mono text-sm font-semibold text-white">
                      {formatUSD(g.totalValue)}
                    </span>

                    {/* Win Rate */}
                    <span>
                      <span
                        className="inline-block font-mono text-xs font-bold px-2.5 py-1 rounded"
                        style={{
                          border: '1px solid rgba(66, 199, 230, 0.4)',
                          color: '#42c7e6',
                          background: 'rgba(66, 199, 230, 0.08)',
                        }}
                      >
                        {winRate}%
                      </span>
                    </span>

                    {/* Active Battles */}
                    <span className="font-mono text-sm text-gray-400">
                      {g.activeBattles > 0 ? (
                        <span className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                          {g.activeBattles}
                        </span>
                      ) : (
                        '0'
                      )}
                    </span>
                  </div>
                );
              })
            ) : (
              <div
                className="text-center py-16"
                style={{ background: 'rgba(5, 5, 5, 0.95)' }}
              >
                <p className="text-gray-500 font-mono text-sm tracking-wider mb-4">
                  NO RESOLVED BATTLES YET
                </p>
                <Link
                  to="/battle/create"
                  className="inline-block px-6 py-3 rounded-lg text-sm font-bold tracking-wider transition-all hover:opacity-90"
                  style={{
                    border: '1px solid rgba(237, 127, 47, 0.5)',
                    color: '#ed7f2f',
                  }}
                >
                  START THE FIRST BATTLE
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Mobile hint */}
        {!isLoading && gladiators.length > 0 && (
          <div className="lg:hidden mt-4 text-center">
            <p className="text-xs font-mono text-gray-600 tracking-wider">
              &#8592; SCROLL HORIZONTALLY FOR FULL TABLE &#8594;
            </p>
          </div>
        )}

        {/* Terminal Status Footer */}
        <div className="mt-16 text-center">
          <p className="text-xs font-mono text-gray-600 tracking-wider">
            TERMINAL STATUS: <span style={{ color: '#22c55e' }}>ONLINE</span> // BATTLES: {totalBattles} // ARENA_RANKINGS_V4
          </p>
        </div>
      </div>
    </div>
  );
}
