import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader2, ArrowLeft, Shield, Swords, Clock, Trophy } from 'lucide-react';
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

type BattleEvent = {
  time: string;
  message: string;
  type: 'info' | 'creator' | 'opponent' | 'system';
};

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
    return { vaultType: 'range' as VaultType, battleId: BigInt(id) };
  }, [id]);

  // Fetch battle data
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

  // ---- Performance calculations ----
  const perfData = useMemo(() => {
    if (vaultType === 'range' && rangePerf) {
      const [creatorInRange, opponentInRange, creatorTime, opponentTime, leader] = rangePerf as [boolean, boolean, bigint, bigint, string];
      const cTime = Number(creatorTime);
      const oTime = Number(opponentTime);
      const total = cTime + oTime;
      return {
        creatorInRange,
        opponentInRange,
        creatorPct: total > 0 ? (cTime / total) * 100 : 0,
        opponentPct: total > 0 ? (oTime / total) * 100 : 0,
        leader,
        type: 'range' as const,
      };
    }
    if (vaultType === 'fee' && feePerf) {
      const [creatorFeeGrowth, opponentFeeGrowth, creatorFeeRate, opponentFeeRate, leader] = feePerf as [bigint, bigint, bigint, bigint, string];
      const cRate = Number(creatorFeeRate);
      const oRate = Number(opponentFeeRate);
      const total = cRate + oRate;
      return {
        creatorInRange: true,
        opponentInRange: true,
        creatorPct: total > 0 ? (cRate / total) * 100 : 0,
        opponentPct: total > 0 ? (oRate / total) * 100 : 0,
        creatorFeeGrowth,
        opponentFeeGrowth,
        leader,
        type: 'fee' as const,
      };
    }
    return null;
  }, [vaultType, rangePerf, feePerf]);

  // ---- Battle Event Log ----
  const [events, setEvents] = useState<BattleEvent[]>([]);
  const prevPerfRef = useRef<{ creatorInRange: boolean; opponentInRange: boolean } | null>(null);
  const initializedRef = useRef(false);

  const getNow = useCallback(() => {
    const d = new Date();
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
  }, []);

  // Add initial events + track state changes
  useEffect(() => {
    if (!perfData || !battle) return;

    if (!initializedRef.current) {
      initializedRef.current = true;
      const initEvents: BattleEvent[] = [];

      if (battle.status === 'ongoing' || battle.status === 'ready_to_resolve') {
        initEvents.push({ time: '--:--:--', message: 'Battle started', type: 'system' });
      }
      if (perfData.creatorInRange) {
        initEvents.push({ time: getNow(), message: 'Creator position is IN RANGE', type: 'creator' });
      }
      if (perfData.opponentInRange) {
        initEvents.push({ time: getNow(), message: 'Opponent position is IN RANGE', type: 'opponent' });
      }
      if (perfData.leader && perfData.leader !== '0x0000000000000000000000000000000000000000') {
        initEvents.push({ time: getNow(), message: `Current leader: ${formatAddress(perfData.leader)}`, type: 'info' });
      }
      setEvents(initEvents);
      prevPerfRef.current = { creatorInRange: perfData.creatorInRange, opponentInRange: perfData.opponentInRange };
      return;
    }

    // Track state changes
    const prev = prevPerfRef.current;
    if (prev) {
      const newEvents: BattleEvent[] = [];
      if (prev.creatorInRange !== perfData.creatorInRange) {
        newEvents.push({
          time: getNow(),
          message: perfData.creatorInRange ? 'Creator position went IN RANGE' : 'Creator position went OUT OF RANGE',
          type: 'creator',
        });
      }
      if (prev.opponentInRange !== perfData.opponentInRange) {
        newEvents.push({
          time: getNow(),
          message: perfData.opponentInRange ? 'Opponent position went IN RANGE' : 'Opponent position went OUT OF RANGE',
          type: 'opponent',
        });
      }
      if (newEvents.length > 0) {
        setEvents((prev) => [...newEvents, ...prev].slice(0, 20));
      }
    }
    prevPerfRef.current = { creatorInRange: perfData.creatorInRange, opponentInRange: perfData.opponentInRange };
  }, [perfData, battle, getNow]);

  // Add resolved event
  useEffect(() => {
    if (battle?.isResolved) {
      setEvents((prev) => {
        if (prev.some((e) => e.message.includes('RESOLVED'))) return prev;
        return [{ time: getNow(), message: 'Battle RESOLVED', type: 'system' }, ...prev];
      });
    }
  }, [battle?.isResolved, getNow]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const zeroAddr = '0x0000000000000000000000000000000000000000';
  const isOpen = battle?.status === 'pending' || battle?.status === 'waiting_for_opponent';
  const isReadyToResolve = battle?.status === 'ready_to_resolve';
  const isCreator = address && battle?.creator.toLowerCase() === address.toLowerCase();
  const isOpponent = address && battle?.opponent.toLowerCase() === address.toLowerCase();

  const statusColor = (s: string) => {
    switch (s) {
      case 'pending': case 'waiting_for_opponent': return '#22c55e';
      case 'ongoing': return '#42c7e6';
      case 'ready_to_resolve': return '#ed7f2f';
      case 'resolved': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case 'pending': case 'waiting_for_opponent': return 'OPEN';
      case 'ongoing': return 'LIVE';
      case 'ready_to_resolve': return 'RESOLVE';
      case 'resolved': return 'ENDED';
      default: return s.toUpperCase();
    }
  };

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
      <div className="max-w-6xl mx-auto px-4 py-12">

        {/* Back Link */}
        <Link
          to="/battle"
          className="inline-flex items-center gap-2 text-xs font-mono text-gray-500 tracking-wider mb-8 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          BACK TO ARENA
        </Link>

        {/* ===== TIMER HEADER ===== */}
        <div
          className="rounded-xl p-8 text-center mb-8"
          style={{
            background: 'linear-gradient(135deg, rgba(10, 10, 10, 0.95), rgba(1, 1, 1, 0.98))',
            border: '1px solid rgba(237, 127, 47, 0.3)',
          }}
        >
          <div className="flex items-center justify-center gap-3 mb-3">
            <Swords className="w-4 h-4" style={{ color: '#ed7f2f' }} />
            <span className="text-xs font-mono tracking-wider text-gray-400">
              BATTLE #{battleId?.toString()}
            </span>
            <span
              className="text-[10px] font-mono font-bold tracking-widest px-2 py-0.5 rounded"
              style={{
                color: statusColor(battle.status),
                background: `${statusColor(battle.status)}15`,
                border: `1px solid ${statusColor(battle.status)}40`,
              }}
            >
              {statusLabel(battle.status)}
            </span>
            <span
              className="text-[10px] font-mono tracking-widest px-2 py-0.5 rounded"
              style={{
                color: vaultType === 'range' ? '#42c7e6' : '#a855f7',
                border: `1px solid ${vaultType === 'range' ? 'rgba(66, 199, 230, 0.4)' : 'rgba(168, 85, 247, 0.4)'}`,
              }}
            >
              {vaultType === 'range' ? 'RANGE' : 'FEE'}
            </span>
          </div>

          <div className="flex items-center justify-center gap-3 mb-2">
            <Clock className="w-5 h-5 text-gray-600" />
            <p
              className="text-5xl sm:text-6xl lg:text-7xl font-bold font-mono"
              style={{ color: localTime > 0 ? '#42c7e6' : '#6b7280' }}
            >
              {formatTime(localTime)}
            </p>
          </div>

          <p className="text-sm font-mono text-gray-500 tracking-wider">
            VALUE: {formatUSD(battle.valueUSD)}
          </p>
        </div>

        {/* ===== TWO PLAYER CARDS ===== */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">

          {/* Creator Card */}
          <div
            className="rounded-xl p-6"
            style={{
              background: 'linear-gradient(135deg, rgba(10, 10, 10, 0.95), rgba(1, 1, 1, 0.98))',
              border: `1px solid ${isCreator ? 'rgba(66, 199, 230, 0.6)' : 'rgba(66, 199, 230, 0.3)'}`,
              boxShadow: isCreator ? '0 0 25px rgba(66, 199, 230, 0.1)' : 'none',
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4" style={{ color: '#42c7e6' }} />
              <span className="text-[10px] font-mono tracking-widest text-gray-500">CREATOR</span>
              {isCreator && (
                <span className="text-[9px] font-mono tracking-wider px-1.5 py-0.5 rounded" style={{ color: '#42c7e6', border: '1px solid rgba(66, 199, 230, 0.4)' }}>
                  YOU
                </span>
              )}
            </div>

            <h2 className="text-xl font-bold font-mono mb-4" style={{ color: '#42c7e6' }}>
              {formatAddress(battle.creator, 6)}
            </h2>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 rounded-lg" style={{ background: 'rgba(66, 199, 230, 0.05)', border: '1px solid rgba(66, 199, 230, 0.15)' }}>
                <p className="text-[10px] font-mono text-gray-500 tracking-wider mb-1">TOKEN ID</p>
                <p className="text-lg font-bold text-white">#{battle.creatorTokenId.toString()}</p>
              </div>
              <div className="p-3 rounded-lg" style={{ background: 'rgba(66, 199, 230, 0.05)', border: '1px solid rgba(66, 199, 230, 0.15)' }}>
                <p className="text-[10px] font-mono text-gray-500 tracking-wider mb-1">
                  {vaultType === 'range' ? 'IN RANGE' : 'FEE STATUS'}
                </p>
                <p className="text-lg font-bold" style={{ color: perfData?.creatorInRange ? '#22c55e' : '#ef4444' }}>
                  {perfData ? (perfData.creatorInRange ? 'YES' : 'NO') : '--'}
                </p>
              </div>
            </div>

            {/* Efficiency Bar */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-[10px] font-mono text-gray-500 tracking-wider">EFFICIENCY</span>
                <span className="text-sm font-bold font-mono" style={{ color: '#42c7e6' }}>
                  {perfData ? perfData.creatorPct.toFixed(1) : '--'}%
                </span>
              </div>
              <div className="h-2 rounded-full" style={{ background: 'rgba(66, 199, 230, 0.15)' }}>
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{ width: `${perfData?.creatorPct ?? 0}%`, background: '#42c7e6' }}
                />
              </div>
            </div>
          </div>

          {/* Opponent Card */}
          <div
            className="rounded-xl p-6"
            style={{
              background: 'linear-gradient(135deg, rgba(10, 10, 10, 0.95), rgba(1, 1, 1, 0.98))',
              border: battle.opponent === zeroAddr
                ? '1px dashed rgba(237, 127, 47, 0.25)'
                : `1px solid ${isOpponent ? 'rgba(237, 127, 47, 0.6)' : 'rgba(237, 127, 47, 0.3)'}`,
              boxShadow: isOpponent ? '0 0 25px rgba(237, 127, 47, 0.1)' : 'none',
            }}
          >
            {battle.opponent === zeroAddr ? (
              <div className="flex flex-col items-center justify-center h-full py-8">
                <Swords className="w-8 h-8 text-gray-600 mb-4" />
                <p className="text-lg font-bold text-gray-500 mb-2">AWAITING CHALLENGER</p>
                <p className="text-xs font-mono text-gray-600 mb-6 text-center">
                  This battle is open for an opponent to join
                </p>
                {!isCreator && address && (
                  <button
                    onClick={() => {
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
              <>
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="w-4 h-4" style={{ color: '#ed7f2f' }} />
                  <span className="text-[10px] font-mono tracking-widest text-gray-500">OPPONENT</span>
                  {isOpponent && (
                    <span className="text-[9px] font-mono tracking-wider px-1.5 py-0.5 rounded" style={{ color: '#ed7f2f', border: '1px solid rgba(237, 127, 47, 0.4)' }}>
                      YOU
                    </span>
                  )}
                </div>

                <h2 className="text-xl font-bold font-mono mb-4" style={{ color: '#ed7f2f' }}>
                  {formatAddress(battle.opponent, 6)}
                </h2>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3 rounded-lg" style={{ background: 'rgba(237, 127, 47, 0.05)', border: '1px solid rgba(237, 127, 47, 0.15)' }}>
                    <p className="text-[10px] font-mono text-gray-500 tracking-wider mb-1">TOKEN ID</p>
                    <p className="text-lg font-bold text-white">#{battle.opponentTokenId.toString()}</p>
                  </div>
                  <div className="p-3 rounded-lg" style={{ background: 'rgba(237, 127, 47, 0.05)', border: '1px solid rgba(237, 127, 47, 0.15)' }}>
                    <p className="text-[10px] font-mono text-gray-500 tracking-wider mb-1">
                      {vaultType === 'range' ? 'IN RANGE' : 'FEE STATUS'}
                    </p>
                    <p className="text-lg font-bold" style={{ color: perfData?.opponentInRange ? '#22c55e' : '#ef4444' }}>
                      {perfData ? (perfData.opponentInRange ? 'YES' : 'NO') : '--'}
                    </p>
                  </div>
                </div>

                {/* Efficiency Bar */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-[10px] font-mono text-gray-500 tracking-wider">EFFICIENCY</span>
                    <span className="text-sm font-bold font-mono" style={{ color: '#ed7f2f' }}>
                      {perfData ? perfData.opponentPct.toFixed(1) : '--'}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: 'rgba(237, 127, 47, 0.15)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-1000"
                      style={{ width: `${perfData?.opponentPct ?? 0}%`, background: '#ed7f2f' }}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ===== PERFORMANCE COMPARISON ===== */}
        {perfData && battle.opponent !== zeroAddr && (
          <div
            className="rounded-xl p-6 mb-8"
            style={{
              background: 'linear-gradient(135deg, rgba(10, 10, 10, 0.95), rgba(1, 1, 1, 0.98))',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <h3 className="text-xs font-bold tracking-widest mb-5" style={{ color: '#ed7f2f' }}>
              {vaultType === 'range' ? 'RANGE PERFORMANCE' : 'FEE PERFORMANCE'}
            </h3>

            <div className="space-y-4">
              {/* Creator bar */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-mono text-gray-400">
                    {formatAddress(battle.creator, 4)}
                    {isCreator && <span style={{ color: '#42c7e6' }}> (YOU)</span>}
                  </span>
                  <span className="text-sm font-bold font-mono" style={{ color: '#42c7e6' }}>
                    {perfData.creatorPct.toFixed(1)}%
                  </span>
                </div>
                <div className="h-3 rounded-full" style={{ background: 'rgba(66, 199, 230, 0.1)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{ width: `${perfData.creatorPct}%`, background: 'linear-gradient(90deg, #42c7e6, #2a8fa5)' }}
                  />
                </div>
              </div>

              {/* Opponent bar */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-mono text-gray-400">
                    {formatAddress(battle.opponent, 4)}
                    {isOpponent && <span style={{ color: '#ed7f2f' }}> (YOU)</span>}
                  </span>
                  <span className="text-sm font-bold font-mono" style={{ color: '#ed7f2f' }}>
                    {perfData.opponentPct.toFixed(1)}%
                  </span>
                </div>
                <div className="h-3 rounded-full" style={{ background: 'rgba(237, 127, 47, 0.1)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{ width: `${perfData.opponentPct}%`, background: 'linear-gradient(90deg, #ed7f2f, #8a3815)' }}
                  />
                </div>
              </div>
            </div>

            {/* Leader indicator */}
            {perfData.leader && perfData.leader !== zeroAddr && (
              <div className="flex items-center justify-center gap-2 mt-5 pt-4" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <Trophy className="w-3.5 h-3.5" style={{ color: '#22c55e' }} />
                <span className="text-xs font-mono tracking-wider" style={{ color: '#22c55e' }}>
                  LEADER: {formatAddress(perfData.leader, 6)}
                  {perfData.leader.toLowerCase() === address?.toLowerCase() && ' (YOU)'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ===== RESOLVE BUTTON ===== */}
        {isReadyToResolve && (
          <div
            className="rounded-xl p-6 mb-8 text-center"
            style={{
              background: 'linear-gradient(135deg, rgba(237, 127, 47, 0.08), rgba(10, 10, 10, 0.95))',
              border: '2px solid rgba(237, 127, 47, 0.5)',
              boxShadow: '0 0 30px rgba(237, 127, 47, 0.15)',
            }}
          >
            <p className="text-xs font-mono text-gray-400 tracking-wider mb-3">BATTLE TIME EXPIRED</p>
            <button
              onClick={() => battleId !== undefined && resolveBattle(battleId)}
              disabled={resolvePending}
              className="px-12 py-4 rounded-lg font-black text-lg tracking-widest transition-all hover:opacity-90 disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, rgba(237, 127, 47, 0.25), rgba(138, 56, 21, 0.25))',
                border: '1px solid rgba(237, 127, 47, 0.6)',
                color: '#ed7f2f',
              }}
            >
              {resolvePending ? 'RESOLVING...' : 'RESOLVE BATTLE'}
            </button>
            <p className="text-[10px] font-mono text-gray-600 mt-3">Anyone can resolve and earn a 1% resolver reward</p>
          </div>
        )}

        {/* ===== WINNER BANNER ===== */}
        {battle.isResolved && battle.winner !== zeroAddr && (
          <div
            className="rounded-xl p-6 mb-8 text-center"
            style={{
              background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.08), rgba(10, 10, 10, 0.95))',
              border: '1px solid rgba(34, 197, 94, 0.4)',
              boxShadow: '0 0 30px rgba(34, 197, 94, 0.1)',
            }}
          >
            <Trophy className="w-8 h-8 mx-auto mb-2" style={{ color: '#22c55e' }} />
            <p className="text-xs font-mono text-gray-500 tracking-wider mb-1">BATTLE RESOLVED</p>
            <p className="text-2xl font-black" style={{ color: '#22c55e' }}>
              WINNER: {formatAddress(battle.winner, 6)}
            </p>
            {battle.winner.toLowerCase() === address?.toLowerCase() && (
              <p className="text-sm font-mono mt-2" style={{ color: '#22c55e' }}>
                CONGRATULATIONS - YOU WON!
              </p>
            )}
          </div>
        )}

        {/* ===== BATTLE LOG ===== */}
        {events.length > 0 && (
          <div
            className="rounded-xl p-6 mb-8"
            style={{
              background: 'linear-gradient(135deg, rgba(10, 10, 10, 0.95), rgba(1, 1, 1, 0.98))',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <h3 className="text-xs font-bold tracking-widest mb-4" style={{ color: '#ed7f2f' }}>
              BATTLE LOG
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {events.map((event, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 py-1.5"
                  style={{ borderBottom: i < events.length - 1 ? '1px solid rgba(255, 255, 255, 0.03)' : 'none' }}
                >
                  <span className="text-[10px] font-mono text-gray-600 flex-shrink-0 w-16">
                    {event.time}
                  </span>
                  <span
                    className="text-xs font-mono"
                    style={{
                      color: event.type === 'creator' ? '#42c7e6'
                        : event.type === 'opponent' ? '#ed7f2f'
                        : event.type === 'system' ? '#22c55e'
                        : '#9ca3af',
                    }}
                  >
                    {event.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== BOTTOM INFO GRID ===== */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Battle Info */}
          <div
            className="rounded-xl p-5"
            style={{
              background: 'linear-gradient(135deg, rgba(10, 10, 10, 0.95), rgba(1, 1, 1, 0.98))',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <h3 className="text-xs font-bold tracking-widest mb-4" style={{ color: '#ed7f2f' }}>BATTLE INFO</h3>
            <div className="space-y-3 text-sm font-mono">
              <div className="flex justify-between">
                <span className="text-gray-500">Battle ID</span>
                <span style={{ color: '#42c7e6' }}>#{battleId?.toString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Type</span>
                <span className="text-white">{vaultType === 'range' ? 'Range Battle' : 'Fee Battle'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Value</span>
                <span className="text-white">{formatUSD(battle.valueUSD)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span style={{ color: statusColor(battle.status) }}>{statusLabel(battle.status)}</span>
              </div>
            </div>
          </div>

          {/* Live Performance */}
          <div
            className="rounded-xl p-5"
            style={{
              background: 'linear-gradient(135deg, rgba(10, 10, 10, 0.95), rgba(1, 1, 1, 0.98))',
              border: '1px solid rgba(237, 127, 47, 0.2)',
            }}
          >
            <h3 className="text-xs font-bold tracking-widest mb-4" style={{ color: '#ed7f2f' }}>
              LIVE DATA
            </h3>
            {perfData ? (
              <div className="space-y-3 text-sm font-mono">
                {vaultType === 'range' ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Creator</span>
                      <span style={{ color: perfData.creatorInRange ? '#22c55e' : '#ef4444' }}>
                        {perfData.creatorInRange ? 'IN RANGE' : 'OUT'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Opponent</span>
                      <span style={{ color: perfData.opponentInRange ? '#22c55e' : '#ef4444' }}>
                        {perfData.opponentInRange ? 'IN RANGE' : 'OUT'}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Creator Fees</span>
                      <span className="text-white">{perfData.type === 'fee' ? formatUSD(perfData.creatorFeeGrowth!) : '--'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Opponent Fees</span>
                      <span className="text-white">{perfData.type === 'fee' ? formatUSD(perfData.opponentFeeGrowth!) : '--'}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Leader</span>
                  <span style={{ color: '#22c55e' }}>
                    {perfData.leader && perfData.leader !== zeroAddr ? formatAddress(perfData.leader) : 'TBD'}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs font-mono text-gray-600">
                {isOpen ? 'Waiting for opponent...' : 'Loading...'}
              </p>
            )}
          </div>

          {/* Arena Rules */}
          <div
            className="rounded-xl p-5"
            style={{
              background: 'linear-gradient(135deg, rgba(10, 10, 10, 0.95), rgba(1, 1, 1, 0.98))',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <h3 className="text-xs font-bold tracking-widest mb-4" style={{ color: '#ed7f2f' }}>ARENA RULES</h3>
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

        {/* Terminal Footer */}
        <div className="text-center py-12">
          <p className="text-xs font-mono text-gray-600 tracking-wider">
            UNISWAP_V4_ARENA_CLIENT // REAL-TIME DATA STREAM // SEPOLIA TESTNET
          </p>
        </div>
      </div>
    </div>
  );
}
