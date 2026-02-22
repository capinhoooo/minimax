import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { formatAddress, formatUSD } from '../lib/utils';
import {
  useBattleCount,
  useActiveBattles,
  useBattles,
} from '../hooks/useBattleVault';
import { usePlayersStats } from '../hooks/useStylus';
import { BattleStatus } from '../types';
import type { Battle } from '../types';
import type { Address } from 'viem';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export default function Leaderboard() {
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  // Get total battle count
  const { data: battleCountData, isLoading: loadingCount } = useBattleCount();
  const { data: activeIds } = useActiveBattles();

  const totalCount = battleCountData ? Number(battleCountData as bigint) : 0;

  // Generate all battle IDs to fetch
  const allBattleIds = useMemo(() => {
    return Array.from({ length: totalCount }, (_, i) => BigInt(i));
  }, [totalCount]);

  // Multicall fetch all battles
  const { data: allBattleResults, isLoading: loadingBattles } = useBattles(allBattleIds);

  const isLoading = loadingCount || loadingBattles;

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

    if (allBattleResults) {
      allBattleResults.forEach((r) => {
        if (r.status === 'success' && r.result) {
          const b = r.result as Battle;
          const isResolved = b.status === BattleStatus.RESOLVED;
          const isActive = b.status === BattleStatus.ACTIVE || b.status === BattleStatus.EXPIRED;

          if (b.creator !== ZERO_ADDRESS) {
            const cs = getOrCreate(b.creator.toLowerCase());
            if (isActive) cs.activeBattles++;
          }
          if (b.opponent !== ZERO_ADDRESS) {
            const os = getOrCreate(b.opponent.toLowerCase());
            if (isActive) os.activeBattles++;
          }

          if (isResolved && b.winner !== ZERO_ADDRESS) {
            resolved++;
            const ws = getOrCreate(b.winner.toLowerCase());
            ws.wins++;
            ws.totalValue += b.creatorValueUSD;

            const loser = b.winner.toLowerCase() === b.creator.toLowerCase() ? b.opponent : b.creator;
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
  }, [allBattleResults]);

  const totalActive = ((activeIds as bigint[]) ?? []).length;

  // Fetch on-chain ELO from Stylus Leaderboard for all gladiators
  const gladiatorAddresses = useMemo(
    () => gladiators.map((g) => g.address as Address),
    [gladiators],
  );
  const { data: stylusStats } = usePlayersStats(gladiatorAddresses);

  // Map address -> ELO
  const eloMap = useMemo(() => {
    const map = new Map<string, bigint>();
    if (stylusStats) {
      stylusStats.forEach((r, i) => {
        if (r.status === 'success' && r.result) {
          const [elo] = r.result as readonly [bigint, bigint, bigint, bigint, bigint];
          map.set(gladiatorAddresses[i].toLowerCase(), elo);
        }
      });
    }
    return map;
  }, [stylusStats, gladiatorAddresses]);

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
          On-chain leaderboard from Multi-DEX LP Battles
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
              {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : totalCount}
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
                gridTemplateColumns: '60px 1fr 80px 120px 140px 100px 100px',
                background: 'rgba(10, 10, 10, 0.95)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <span className="text-xs font-mono font-bold tracking-wider text-gray-400">RANK</span>
              <span className="text-xs font-mono font-bold tracking-wider text-gray-400">GLADIATOR</span>
              <span className="text-xs font-mono font-bold tracking-wider text-gray-400">ELO</span>
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
                      gridTemplateColumns: '60px 1fr 80px 120px 140px 100px 100px',
                      background:
                        hoveredRow === rank
                          ? 'rgba(237, 127, 47, 0.05)'
                          : 'rgba(5, 5, 5, 0.95)',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                    }}
                    onMouseEnter={() => setHoveredRow(rank)}
                    onMouseLeave={() => setHoveredRow(null)}
                  >
                    <span className="text-lg font-mono font-bold text-gray-300 flex items-center gap-1.5">
                      {String(rank).padStart(2, '0')}
                      {rank === 1 && <span className="text-yellow-400 text-base">&#9733;</span>}
                    </span>

                    <div className="flex items-center gap-2">
                      <a
                        href={`https://sepolia.arbiscan.io/address/${g.address}`}
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

                    <span className="font-mono text-sm font-bold" style={{ color: '#a855f7' }}>
                      {eloMap.get(g.address) ? Number(eloMap.get(g.address)!).toString() : '--'}
                    </span>

                    <span className="font-mono text-sm text-gray-400">
                      <span className="text-white">{g.wins}</span>
                      {' / '}
                      <span className="text-gray-600">{g.losses}</span>
                    </span>

                    <span className="font-mono text-sm font-semibold text-white">
                      {formatUSD(g.totalValue)}
                    </span>

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
            TERMINAL STATUS: <span style={{ color: '#22c55e' }}>ONLINE</span> // BATTLES: {totalCount} // ARENA_RANKINGS // ARBITRUM SEPOLIA
          </p>
        </div>
      </div>
    </div>
  );
}
