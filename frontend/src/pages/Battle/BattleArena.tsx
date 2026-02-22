import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Loader2 } from 'lucide-react';
import { useActiveBattles, usePendingBattles, useBattles } from '../../hooks/useBattleVault';
import { formatAddress, formatUSD, formatTimeRemaining } from '../../lib/utils';
import { BattleStatus, BattleType, battleTypeName, dexTypeName } from '../../types';
import type { Battle } from '../../types';

export default function BattleArena() {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'range' | 'fee'>('all');

  // Fetch active and pending battle IDs
  const { data: activeIds, isLoading: loadingActive } = useActiveBattles();
  const { data: pendingIds, isLoading: loadingPending } = usePendingBattles();

  // Combine all IDs
  const allIds = [
    ...((activeIds as readonly bigint[]) ?? []),
    ...((pendingIds as readonly bigint[]) ?? []),
  ];

  // Fetch battle details for all
  const { data: battleResults } = useBattles(allIds);

  const isLoading = loadingActive || loadingPending;

  // Normalize battle data into a unified list
  type BattleItem = {
    id: bigint;
    battleType: number;
    creatorDex: number;
    creator: string;
    opponent: string;
    status: number;
    valueUSD: bigint;
    duration: bigint;
    startTime: bigint;
  };

  const battles: BattleItem[] = [];

  if (battleResults) {
    battleResults.forEach((r, i) => {
      if (r.status === 'success' && r.result) {
        const b = r.result as Battle;
        battles.push({
          id: allIds[i],
          battleType: b.battleType,
          creatorDex: b.creatorDex,
          creator: b.creator,
          opponent: b.opponent,
          status: b.status,
          valueUSD: b.creatorValueUSD,
          duration: b.duration,
          startTime: b.startTime,
        });
      }
    });
  }

  // Filter
  const filtered = battles.filter((b) => {
    if (typeFilter === 'range' && b.battleType !== BattleType.RANGE) return false;
    if (typeFilter === 'fee' && b.battleType !== BattleType.FEE) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        b.creator.toLowerCase().includes(q) ||
        b.opponent.toLowerCase().includes(q) ||
        b.id.toString().includes(q)
      );
    }
    return true;
  });

  const statusLabel = (s: number) => {
    switch (s) {
      case BattleStatus.PENDING: return 'OPEN';
      case BattleStatus.ACTIVE: return 'LIVE';
      case BattleStatus.EXPIRED: return 'RESOLVE';
      case BattleStatus.RESOLVED: return 'ENDED';
      default: return 'UNKNOWN';
    }
  };

  const statusColor = (s: number) => {
    switch (s) {
      case BattleStatus.PENDING: return '#22c55e';
      case BattleStatus.ACTIVE: return '#42c7e6';
      case BattleStatus.EXPIRED: return '#ed7f2f';
      case BattleStatus.RESOLVED: return '#6b7280';
      default: return '#6b7280';
    }
  };

  return (
    <div className="min-h-screen grid-bg">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-12">
          <div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black mb-3 tracking-tight">
              <span className="gradient-text-magenta italic">SELECT YOUR ARENA</span>
            </h1>
            <p className="text-xs sm:text-sm tracking-[0.3em] text-gray-500 uppercase font-mono">
              Choose a battle and enter the battlefield
            </p>
          </div>
          <Link
            to="/battle/create"
            className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-xs tracking-wider transition-all hover:opacity-90 self-start"
            style={{
              background: 'linear-gradient(135deg, rgba(237, 127, 47, 0.2), rgba(138, 56, 21, 0.2))',
              border: '1px solid rgba(237, 127, 47, 0.5)',
              color: '#ed7f2f',
              boxShadow: '0 0 15px rgba(237, 127, 47, 0.15)',
            }}
          >
            + INITIALIZE BATTLE
          </Link>
        </div>

        {/* Search + Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-10">
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-lg flex-1"
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
              placeholder="SEARCH BY ADDRESS OR BATTLE ID..."
              className="flex-1 bg-transparent text-sm text-gray-400 placeholder-gray-600 outline-none font-mono tracking-wider"
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'range', 'fee'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setTypeFilter(f)}
                className="px-4 py-2.5 rounded-lg text-xs font-mono font-bold tracking-wider transition-all"
                style={{
                  background: typeFilter === f ? 'rgba(237, 127, 47, 0.15)' : 'rgba(10, 10, 10, 0.6)',
                  border: typeFilter === f ? '1px solid rgba(237, 127, 47, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
                  color: typeFilter === f ? '#ed7f2f' : '#6b7280',
                }}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#42c7e6' }} />
            <span className="ml-3 text-sm font-mono text-gray-500 tracking-wider">SCANNING ACTIVE BATTLES...</span>
          </div>
        )}

        {/* Battle Cards */}
        {!isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((battle) => (
              <div
                key={battle.id.toString()}
                className="rounded-xl overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, rgba(10, 10, 10, 0.95), rgba(1, 1, 1, 0.98))',
                  border: '1px solid rgba(237, 127, 47, 0.3)',
                  boxShadow: '0 0 30px rgba(237, 127, 47, 0.1)',
                }}
              >
                <div className="p-5">
                  {/* Battle Header */}
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold text-white">
                      BATTLE #{battle.id.toString()}
                    </h3>
                    <span
                      className="text-xs font-mono font-bold tracking-wider px-2 py-1 rounded"
                      style={{
                        color: statusColor(battle.status),
                        background: `${statusColor(battle.status)}15`,
                        border: `1px solid ${statusColor(battle.status)}40`,
                      }}
                    >
                      {statusLabel(battle.status)}
                    </span>
                  </div>

                  {/* Type Badges */}
                  <div className="flex gap-2 mb-4">
                    <span
                      className="text-[10px] font-mono tracking-widest px-2 py-0.5 rounded"
                      style={{
                        color: battle.battleType === BattleType.RANGE ? '#42c7e6' : '#a855f7',
                        border: `1px solid ${battle.battleType === BattleType.RANGE ? 'rgba(66, 199, 230, 0.4)' : 'rgba(168, 85, 247, 0.4)'}`,
                      }}
                    >
                      {battleTypeName(battle.battleType).toUpperCase()}
                    </span>
                    <span
                      className="text-[10px] font-mono tracking-widest px-2 py-0.5 rounded"
                      style={{
                        color: '#9ca3af',
                        border: '1px solid rgba(156, 163, 175, 0.3)',
                      }}
                    >
                      {dexTypeName(battle.creatorDex).toUpperCase()}
                    </span>
                  </div>

                  {/* Stats */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-gray-500 tracking-wider">VALUE:</span>
                      <span className="text-sm font-mono text-white">{formatUSD(battle.valueUSD)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-gray-500 tracking-wider">DURATION:</span>
                      <span className="text-sm font-mono text-white">{formatTimeRemaining(Number(battle.duration))}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-gray-500 tracking-wider">CREATOR:</span>
                      <span className="text-sm font-mono text-white">{formatAddress(battle.creator)}</span>
                    </div>
                    {battle.opponent !== '0x0000000000000000000000000000000000000000' && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-gray-500 tracking-wider">OPPONENT:</span>
                        <span className="text-sm font-mono text-white">{formatAddress(battle.opponent)}</span>
                      </div>
                    )}
                  </div>

                  {/* Action Button */}
                  <Link
                    to={`/battle/${battle.id}`}
                    className="block w-full py-3 rounded-lg text-center font-medium text-sm tracking-wider transition-all hover:opacity-90"
                    style={{
                      background: battle.status === BattleStatus.PENDING
                        ? 'linear-gradient(135deg, rgba(237, 127, 47, 0.2), rgba(138, 56, 21, 0.2))'
                        : 'rgba(255, 255, 255, 0.05)',
                      border: battle.status === BattleStatus.PENDING
                        ? '1px solid rgba(237, 127, 47, 0.5)'
                        : '1px solid rgba(255, 255, 255, 0.1)',
                      color: battle.status === BattleStatus.PENDING ? '#ed7f2f' : '#9ca3af',
                    }}
                  >
                    {battle.status === BattleStatus.PENDING
                      ? 'JOIN BATTLE'
                      : 'VIEW BATTLE'}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="text-gray-500 font-mono text-sm tracking-wider mb-4">
              {battles.length === 0
                ? 'NO ACTIVE BATTLES FOUND ON-CHAIN'
                : 'NO BATTLES MATCH YOUR FILTERS'}
            </p>
            <Link
              to="/battle/create"
              className="inline-block px-6 py-3 rounded-lg text-sm font-bold tracking-wider transition-all hover:opacity-90"
              style={{
                border: '1px solid rgba(237, 127, 47, 0.5)',
                color: '#ed7f2f',
              }}
            >
              CREATE THE FIRST BATTLE
            </Link>
          </div>
        )}

        {/* Terminal Status Footer */}
        <div className="mt-16 text-center">
          <p className="text-xs font-mono text-gray-600 tracking-wider">
            TERMINAL STATUS: <span style={{ color: '#22c55e' }}>ONLINE</span> // BATTLES: {battles.length} // ARBITRUM_SEPOLIA
          </p>
        </div>
      </div>
    </div>
  );
}
