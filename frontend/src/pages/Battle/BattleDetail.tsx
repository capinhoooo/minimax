import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAccount } from 'wagmi';
import {
  useRangeBattle,
  useFeeBattle,
  useTimeRemaining,
  useCurrentPerformance,
  useCurrentFeePerformance,
  useJoinBattle,
  useResolveBattle,
} from '../../hooks/useBattleVault';
import { formatAddress, formatUSD } from '../../lib/utils';
import type { VaultType } from '../../types';

export default function BattleDetail() {
  const { id } = useParams();
  const { address } = useAccount();

  // Parse the route param: "range-0" or "fee-1"
  const { vaultType, battleId } = useMemo(() => {
    if (!id) return { vaultType: 'range' as VaultType, battleId: undefined };
    const parts = id.split('-');
    if (parts.length === 2 && (parts[0] === 'range' || parts[0] === 'fee')) {
      return { vaultType: parts[0] as VaultType, battleId: BigInt(parts[1]) };
    }
    // Fallback: assume range vault with numeric ID
    return { vaultType: 'range' as VaultType, battleId: BigInt(id) };
  }, [id]);

  // Fetch battle data based on vault type
  const { data: rangeBattleData, isLoading: loadingRange } = useRangeBattle(
    vaultType === 'range' ? battleId : undefined
  );
  const { data: feeBattleData, isLoading: loadingFee } = useFeeBattle(
    vaultType === 'fee' ? battleId : undefined
  );

  const { data: timeRemaining, refetch: refetchTime } = useTimeRemaining(battleId, vaultType);
  const { data: rangePerf } = useCurrentPerformance(
    vaultType === 'range' && battleId !== undefined ? battleId : undefined
  );
  const { data: feePerf } = useCurrentFeePerformance(
    vaultType === 'fee' && battleId !== undefined ? battleId : undefined
  );

  const isLoading = loadingRange || loadingFee;

  // Local countdown timer
  const [localTime, setLocalTime] = useState<number>(0);

  useEffect(() => {
    if (timeRemaining !== undefined) {
      setLocalTime(Number(timeRemaining as bigint));
    }
  }, [timeRemaining]);

  useEffect(() => {
    const timer = setInterval(() => {
      setLocalTime((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Refetch time every 30s to stay synced
  useEffect(() => {
    const interval = setInterval(() => refetchTime(), 30000);
    return () => clearInterval(interval);
  }, [refetchTime]);

  // Normalize battle data
  const battle = useMemo(() => {
    if (vaultType === 'range' && rangeBattleData) {
      const [creator, opponent, winner, creatorTokenId, opponentTokenId, startTime, duration, totalValueUSD, isResolved, status] = rangeBattleData as [string, string, string, bigint, bigint, bigint, bigint, bigint, boolean, string];
      return { creator, opponent, winner, creatorTokenId, opponentTokenId, startTime, duration, valueUSD: totalValueUSD, isResolved, status };
    }
    if (vaultType === 'fee' && feeBattleData) {
      const [creator, opponent, winner, creatorTokenId, opponentTokenId, startTime, duration, creatorLPValue, , isResolved, status] = feeBattleData as [string, string, string, bigint, bigint, bigint, bigint, bigint, bigint, boolean, string];
      return { creator, opponent, winner, creatorTokenId, opponentTokenId, startTime, duration, valueUSD: creatorLPValue, isResolved, status };
    }
    return null;
  }, [vaultType, rangeBattleData, feeBattleData]);

  // Write hooks
  const { joinBattle, isPending: joinPending } = useJoinBattle(vaultType);
  const { resolveBattle, isPending: resolvePending } = useResolveBattle(vaultType);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const zeroAddr = '0x0000000000000000000000000000000000000000';
  const isOpen = battle?.status === 'pending' || battle?.status === 'waiting_for_opponent';
  const isOngoing = battle?.status === 'ongoing';
  const isReadyToResolve = battle?.status === 'ready_to_resolve';
  const isCreator = address && battle?.creator.toLowerCase() === address.toLowerCase();
  const isOpponent = address && battle?.opponent.toLowerCase() === address.toLowerCase();

  // Performance data
  const creatorEfficiency = rangePerf
    ? (() => {
        const [, , creatorTime, opponentTime] = rangePerf as [boolean, boolean, bigint, bigint, string];
        const total = Number(creatorTime) + Number(opponentTime);
        return total > 0 ? ((Number(creatorTime) / total) * 100).toFixed(1) : '0.0';
      })()
    : null;

  const opponentEfficiency = rangePerf
    ? (() => {
        const [, , creatorTime, opponentTime] = rangePerf as [boolean, boolean, bigint, bigint, string];
        const total = Number(creatorTime) + Number(opponentTime);
        return total > 0 ? ((Number(opponentTime) / total) * 100).toFixed(1) : '0.0';
      })()
    : null;

  if (isLoading) {
    return (
      <div className="min-h-screen grid-bg flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#42c7e6' }} />
        <span className="ml-3 text-sm font-mono text-gray-500">LOADING BATTLE DATA...</span>
      </div>
    );
  }

  if (!battle) {
    return (
      <div className="min-h-screen grid-bg flex items-center justify-center">
        <p className="text-gray-500 font-mono">BATTLE NOT FOUND</p>
      </div>
    );
  }

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
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: isOngoing ? '#ed7f2f' : '#6b7280' }} />
            <span className="text-xs font-mono tracking-wider" style={{ color: '#ed7f2f' }}>
              {battle.status.toUpperCase()} // BATTLE #{battleId?.toString()}
            </span>
            <span
              className="text-[10px] font-mono tracking-widest px-2 py-0.5 rounded ml-2"
              style={{
                color: vaultType === 'range' ? '#42c7e6' : '#a855f7',
                border: `1px solid ${vaultType === 'range' ? 'rgba(66, 199, 230, 0.4)' : 'rgba(168, 85, 247, 0.4)'}`,
              }}
            >
              {vaultType === 'range' ? 'RANGE' : 'FEE'}
            </span>
          </div>
          <p
            className="text-6xl sm:text-7xl font-bold font-mono mb-2"
            style={{ color: '#42c7e6' }}
          >
            {formatTime(localTime)}
          </p>
          <p className="text-sm font-mono text-gray-500 tracking-wider">
            VALUE: {formatUSD(battle.valueUSD)}
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4">
        {/* Two Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Creator Card (Left) - Cyan theme */}
          <div
            className="rounded-lg p-6"
            style={{
              background: 'linear-gradient(135deg, rgba(10, 10, 10, 0.95), rgba(1, 1, 1, 0.98))',
              border: `1px solid ${isCreator ? 'rgba(66, 199, 230, 0.6)' : 'rgba(66, 199, 230, 0.4)'}`,
              boxShadow: isCreator ? '0 0 20px rgba(66, 199, 230, 0.15)' : 'none',
            }}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold" style={{ color: '#42c7e6' }}>
                  {formatAddress(battle.creator, 6)}
                </h2>
                <p className="text-xs font-mono text-gray-500">
                  CREATOR {isCreator && '(YOU)'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-mono text-gray-500">EFFICIENCY</p>
                <p className="text-2xl font-bold" style={{ color: '#42c7e6' }}>
                  {creatorEfficiency ?? '--'}%
                </p>
                {creatorEfficiency && (
                  <div className="h-1 w-24 rounded-full mt-1" style={{ background: 'rgba(66, 199, 230, 0.3)' }}>
                    <div className="h-full rounded-full" style={{ width: `${creatorEfficiency}%`, background: '#42c7e6' }} />
                  </div>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 rounded" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <p className="text-xs font-mono text-gray-500 mb-1">TOKEN ID</p>
                <p className="text-lg font-bold text-white">#{battle.creatorTokenId.toString()}</p>
              </div>
              <div className="p-3 rounded" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <p className="text-xs font-mono text-gray-500 mb-1">
                  {vaultType === 'range' ? 'IN RANGE' : 'FEE RATE'}
                </p>
                <p className="text-lg font-bold text-white">
                  {rangePerf
                    ? ((rangePerf as [boolean, boolean, bigint, bigint, string])[0] ? 'YES' : 'NO')
                    : '--'}
                </p>
              </div>
            </div>

            {/* Range Visualizer */}
            <div
              className="relative h-32 rounded-lg p-4"
              style={{ background: 'rgba(66, 199, 230, 0.05)', border: '1px solid rgba(66, 199, 230, 0.2)' }}
            >
              <div
                className="absolute left-1/4 right-1/4 top-1/4 bottom-1/3 rounded"
                style={{ background: 'rgba(66, 199, 230, 0.2)', border: '1px solid rgba(66, 199, 230, 0.5)' }}
              />
              <span className="absolute bottom-2 left-4 text-xs font-mono text-gray-600">
                TOKEN #{battle.creatorTokenId.toString()}
              </span>
            </div>
          </div>

          {/* Opponent Card (Right) - Magenta theme */}
          <div
            className="rounded-lg p-6"
            style={{
              background: 'linear-gradient(135deg, rgba(10, 10, 10, 0.95), rgba(1, 1, 1, 0.98))',
              border: battle.opponent === zeroAddr
                ? '1px dashed rgba(237, 127, 47, 0.3)'
                : `1px solid ${isOpponent ? 'rgba(237, 127, 47, 0.6)' : 'rgba(237, 127, 47, 0.4)'}`,
              boxShadow: isOpponent ? '0 0 20px rgba(237, 127, 47, 0.15)' : 'none',
            }}
          >
            {battle.opponent === zeroAddr ? (
              /* Waiting for opponent */
              <div className="flex flex-col items-center justify-center h-full py-12">
                <p className="text-xl font-bold text-gray-500 mb-4">AWAITING CHALLENGER</p>
                <p className="text-xs font-mono text-gray-600 mb-6">This battle is open for an opponent to join</p>
                {!isCreator && address && (
                  <button
                    onClick={() => {
                      // TODO: add token selector modal
                      // For now, this shows the concept
                      const tokenId = prompt('Enter your LP position token ID:');
                      if (tokenId && battleId !== undefined) {
                        joinBattle(battleId, BigInt(tokenId));
                      }
                    }}
                    disabled={joinPending}
                    className="px-8 py-3 rounded-lg font-bold text-sm tracking-wider transition-all hover:opacity-90 disabled:opacity-50"
                    style={{
                      background: 'linear-gradient(135deg, rgba(237, 127, 47, 0.2), rgba(138, 56, 21, 0.2))',
                      border: '1px solid rgba(237, 127, 47, 0.5)',
                      color: '#ed7f2f',
                    }}
                  >
                    {joinPending ? 'JOINING...' : 'JOIN THIS BATTLE'}
                  </button>
                )}
              </div>
            ) : (
              /* Opponent present */
              <>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold" style={{ color: '#ed7f2f' }}>
                      {formatAddress(battle.opponent, 6)}
                    </h2>
                    <p className="text-xs font-mono text-gray-500">
                      OPPONENT {isOpponent && '(YOU)'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-mono text-gray-500">EFFICIENCY</p>
                    <p className="text-2xl font-bold" style={{ color: '#ed7f2f' }}>
                      {opponentEfficiency ?? '--'}%
                    </p>
                    {opponentEfficiency && (
                      <div className="h-1 w-24 rounded-full mt-1" style={{ background: 'rgba(237, 127, 47, 0.3)' }}>
                        <div className="h-full rounded-full" style={{ width: `${opponentEfficiency}%`, background: '#ed7f2f' }} />
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3 rounded" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    <p className="text-xs font-mono text-gray-500 mb-1">TOKEN ID</p>
                    <p className="text-lg font-bold text-white">#{battle.opponentTokenId.toString()}</p>
                  </div>
                  <div className="p-3 rounded" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    <p className="text-xs font-mono text-gray-500 mb-1">
                      {vaultType === 'range' ? 'IN RANGE' : 'FEE RATE'}
                    </p>
                    <p className="text-lg font-bold text-white">
                      {rangePerf
                        ? ((rangePerf as [boolean, boolean, bigint, bigint, string])[1] ? 'YES' : 'NO')
                        : '--'}
                    </p>
                  </div>
                </div>

                <div
                  className="relative h-32 rounded-lg p-4"
                  style={{ background: 'rgba(237, 127, 47, 0.05)', border: '1px solid rgba(237, 127, 47, 0.2)' }}
                >
                  <div
                    className="absolute left-1/3 right-1/4 top-1/3 bottom-1/4 rounded"
                    style={{ background: 'rgba(237, 127, 47, 0.2)', border: '1px solid rgba(237, 127, 47, 0.5)' }}
                  />
                  <span className="absolute bottom-2 left-4 text-xs font-mono text-gray-600">
                    TOKEN #{battle.opponentTokenId.toString()}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Resolve Button */}
        {isReadyToResolve && (
          <div className="mt-8 text-center">
            <button
              onClick={() => battleId !== undefined && resolveBattle(battleId)}
              disabled={resolvePending}
              className="px-12 py-4 rounded-lg font-black text-lg tracking-widest transition-all hover:opacity-90 disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, rgba(237, 127, 47, 0.3), rgba(138, 56, 21, 0.3))',
                border: '2px solid rgba(237, 127, 47, 0.6)',
                color: '#ed7f2f',
                boxShadow: '0 0 30px rgba(237, 127, 47, 0.2)',
              }}
            >
              {resolvePending ? 'RESOLVING...' : 'RESOLVE BATTLE'}
            </button>
            <p className="text-xs font-mono text-gray-600 mt-2">Anyone can resolve - earn 1% resolver reward</p>
          </div>
        )}

        {/* Winner Banner */}
        {battle.isResolved && battle.winner !== zeroAddr && (
          <div
            className="mt-8 rounded-xl p-6 text-center"
            style={{
              background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(10, 10, 10, 0.95))',
              border: '1px solid rgba(34, 197, 94, 0.4)',
            }}
          >
            <p className="text-xs font-mono text-gray-500 tracking-wider mb-1">BATTLE RESOLVED</p>
            <p className="text-2xl font-black" style={{ color: '#22c55e' }}>
              WINNER: {formatAddress(battle.winner, 6)}
            </p>
            {(battle.winner.toLowerCase() === address?.toLowerCase()) && (
              <p className="text-sm font-mono mt-2" style={{ color: '#22c55e' }}>
                CONGRATULATIONS - YOU WON!
              </p>
            )}
          </div>
        )}

        {/* Bottom Section - Battle Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          {/* Battle Info */}
          <div
            className="rounded-xl p-5"
            style={{
              background: 'linear-gradient(135deg, rgba(10, 10, 10, 0.95), rgba(1, 1, 1, 0.98))',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <h3 className="text-sm font-bold mb-4" style={{ color: '#ed7f2f' }}>BATTLE INFO</h3>
            <div className="space-y-3 text-sm font-mono">
              <div className="flex justify-between">
                <span className="text-gray-400">Battle ID:</span>
                <span style={{ color: '#42c7e6' }}>#{battleId?.toString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Type:</span>
                <span className="text-white">{vaultType === 'range' ? 'Range Battle' : 'Fee Battle'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Value:</span>
                <span className="text-white">{formatUSD(battle.valueUSD)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Status:</span>
                <span className="text-white">{battle.status.toUpperCase()}</span>
              </div>
            </div>
          </div>

          {/* Performance */}
          <div
            className="rounded-xl p-5"
            style={{
              background: 'linear-gradient(135deg, rgba(10, 10, 10, 0.95), rgba(1, 1, 1, 0.98))',
              border: '1px solid rgba(237, 127, 47, 0.3)',
            }}
          >
            <h3 className="text-sm font-bold mb-4" style={{ color: '#ed7f2f' }}>
              {vaultType === 'range' ? 'RANGE PERFORMANCE' : 'FEE PERFORMANCE'}
            </h3>
            {vaultType === 'range' && rangePerf ? (
              <div className="space-y-3 text-sm font-mono">
                <div className="flex justify-between">
                  <span className="text-gray-400">Creator In Range:</span>
                  <span style={{ color: (rangePerf as [boolean, boolean, bigint, bigint, string])[0] ? '#22c55e' : '#ef4444' }}>
                    {(rangePerf as [boolean, boolean, bigint, bigint, string])[0] ? 'YES' : 'NO'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Opponent In Range:</span>
                  <span style={{ color: (rangePerf as [boolean, boolean, bigint, bigint, string])[1] ? '#22c55e' : '#ef4444' }}>
                    {(rangePerf as [boolean, boolean, bigint, bigint, string])[1] ? 'YES' : 'NO'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Leader:</span>
                  <span style={{ color: '#42c7e6' }}>
                    {formatAddress((rangePerf as [boolean, boolean, bigint, bigint, string])[4])}
                  </span>
                </div>
              </div>
            ) : vaultType === 'fee' && feePerf ? (
              <div className="space-y-3 text-sm font-mono">
                <div className="flex justify-between">
                  <span className="text-gray-400">Creator Fee Growth:</span>
                  <span className="text-white">{formatUSD((feePerf as [bigint, bigint, bigint, bigint, string])[0])}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Opponent Fee Growth:</span>
                  <span className="text-white">{formatUSD((feePerf as [bigint, bigint, bigint, bigint, string])[1])}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Leader:</span>
                  <span style={{ color: '#42c7e6' }}>
                    {formatAddress((feePerf as [bigint, bigint, bigint, bigint, string])[4])}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs font-mono text-gray-600">
                {isOpen ? 'Waiting for opponent to join...' : 'Loading performance data...'}
              </p>
            )}
          </div>

          {/* Arena Rules */}
          <div
            className="rounded-xl p-5"
            style={{
              background: 'linear-gradient(135deg, rgba(10, 10, 10, 0.95), rgba(1, 1, 1, 0.98))',
              border: '1px solid rgba(237, 127, 47, 0.3)',
            }}
          >
            <h3 className="text-sm font-bold mb-4" style={{ color: '#ed7f2f' }}>ARENA RULES</h3>
            <p className="text-xs font-mono text-gray-400 leading-relaxed mb-4">
              {vaultType === 'range'
                ? 'The provider who stays in-range longer wins. When the battle ends, the position with more in-range time claims victory.'
                : 'The provider who earns a higher fee rate (fees / LP value) wins. Efficiency matters more than raw fees.'}
            </p>
            <p className="text-xs font-mono text-gray-400 leading-relaxed">
              Anyone can resolve an expired battle and earn a 1% resolver reward.
            </p>
          </div>
        </div>
      </div>

      {/* Terminal Status Footer */}
      <div className="text-center py-12">
        <p className="text-xs font-mono text-gray-600 tracking-wider">
          UNISWAP_V4_ARENA_CLIENT // REAL-TIME DATA STREAM // SEPOLIA TESTNET
        </p>
      </div>
    </div>
  );
}
