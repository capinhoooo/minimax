import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Loader2 } from 'lucide-react';
import { useActiveBattles, useRangeBattles, useFeeBattles } from '../../hooks/useBattleVault';
import { formatAddress, formatUSD, formatTimeRemaining } from '../../lib/utils';

export default function BattleArena() {
  const [searchQuery, setSearchQuery] = useState('');
  const [vaultFilter, setVaultFilter] = useState<'all' | 'range' | 'fee'>('all');

  // Fetch active battles from both vaults
  const { data: rangeIds, isLoading: loadingRange } = useActiveBattles('range');
  const { data: feeIds, isLoading: loadingFee } = useActiveBattles('fee');

  // Fetch battle details for each
  const { data: rangeBattles } = useRangeBattles((rangeIds as readonly bigint[]) ?? []);
  const { data: feeBattles } = useFeeBattles((feeIds as readonly bigint[]) ?? []);

  const isLoading = loadingRange || loadingFee;

  // Normalize battle data from both vaults into a unified list
  type BattleItem = {
    id: bigint;
    vaultType: 'range' | 'fee';
    creator: string;
    opponent: string;
    status: string;
    valueUSD: bigint;
    duration: bigint;
    startTime: bigint;
  };

  const battles: BattleItem[] = [];

  if (rangeBattles && rangeIds) {
    const ids = rangeIds as readonly bigint[];
    rangeBattles.forEach((r, i) => {
      if (r.status === 'success' && r.result) {
        const [creator, opponent, , , , startTime, duration, totalValueUSD, , status] = r.result as [string, string, string, bigint, bigint, bigint, bigint, bigint, boolean, string];
        battles.push({
          id: ids[i],
          vaultType: 'range',
          creator,
          opponent,
          status,
          valueUSD: totalValueUSD,
          duration,
          startTime,
        });
      }
    });
  }

  if (feeBattles && feeIds) {
    const ids = feeIds as readonly bigint[];
    feeBattles.forEach((r, i) => {
      if (r.status === 'success' && r.result) {
        const [creator, opponent, , , , startTime, duration, creatorLPValue, , , status] = r.result as [string, string, string, bigint, bigint, bigint, bigint, bigint, bigint, boolean, string];
        battles.push({
          id: ids[i],
          vaultType: 'fee',
          creator,
          opponent,
          status,
          valueUSD: creatorLPValue,
          duration,
          startTime,
        });
      }
    });
  }

  // Filter
  const filtered = battles.filter((b) => {
    if (vaultFilter !== 'all' && b.vaultType !== vaultFilter) return false;
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

  const statusLabel = (s: string) => {
    switch (s) {
      case 'pending': case 'waiting_for_opponent': return 'OPEN';
      case 'ongoing': return 'LIVE';
      case 'ready_to_resolve': return 'RESOLVE';
      case 'resolved': return 'ENDED';
      default: return s.toUpperCase();
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'pending': case 'waiting_for_opponent': return '#22c55e';
      case 'ongoing': return '#42c7e6';
      case 'ready_to_resolve': return '#ed7f2f';
      case 'resolved': return '#6b7280';
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
                onClick={() => setVaultFilter(f)}
                className="px-4 py-2.5 rounded-lg text-xs font-mono font-bold tracking-wider transition-all"
                style={{
                  background: vaultFilter === f ? 'rgba(237, 127, 47, 0.15)' : 'rgba(10, 10, 10, 0.6)',
                  border: vaultFilter === f ? '1px solid rgba(237, 127, 47, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
                  color: vaultFilter === f ? '#ed7f2f' : '#6b7280',
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
                key={`${battle.vaultType}-${battle.id}`}
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

                  {/* Vault Type Badge */}
                  <div className="mb-4">
                    <span
                      className="text-[10px] font-mono tracking-widest px-2 py-0.5 rounded"
                      style={{
                        color: battle.vaultType === 'range' ? '#42c7e6' : '#a855f7',
                        border: `1px solid ${battle.vaultType === 'range' ? 'rgba(66, 199, 230, 0.4)' : 'rgba(168, 85, 247, 0.4)'}`,
                      }}
                    >
                      {battle.vaultType === 'range' ? 'RANGE BATTLE' : 'FEE BATTLE'}
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
                    to={`/battle/${battle.vaultType}-${battle.id}`}
                    className="block w-full py-3 rounded-lg text-center font-medium text-sm tracking-wider transition-all hover:opacity-90"
                    style={{
                      background: battle.status === 'pending' || battle.status === 'waiting_for_opponent'
                        ? 'linear-gradient(135deg, rgba(237, 127, 47, 0.2), rgba(138, 56, 21, 0.2))'
                        : 'rgba(255, 255, 255, 0.05)',
                      border: battle.status === 'pending' || battle.status === 'waiting_for_opponent'
                        ? '1px solid rgba(237, 127, 47, 0.5)'
                        : '1px solid rgba(255, 255, 255, 0.1)',
                      color: battle.status === 'pending' || battle.status === 'waiting_for_opponent' ? '#ed7f2f' : '#9ca3af',
                    }}
                  >
                    {battle.status === 'pending' || battle.status === 'waiting_for_opponent'
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
            TERMINAL STATUS: <span style={{ color: '#22c55e' }}>ONLINE</span> // BATTLES: {battles.length} // ARENA_V4_CORE
          </p>
        </div>
      </div>
    </div>
  );
}
