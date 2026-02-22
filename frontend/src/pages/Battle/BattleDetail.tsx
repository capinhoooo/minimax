import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader2, ArrowLeft, Clock, Trophy, ExternalLink } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useBattle, useResolveBattle, useUpdateBattleStatus } from '../../hooks/useBattleVault';
import { useBattleEvents } from '../../hooks/useBattleEvents';
import { useCalculateRangeScore, useCalculateFeeScore, useNormalizeCrossDex, usePlayerStats } from '../../hooks/useStylus';
import { formatAddress, formatUSD, getExplorerUrl } from '../../lib/utils';
import JoinBattleModal from '../../components/battle/JoinBattleModal';
import PerformanceChart from '../../components/battle/PerformanceChart';
import { BattleStatus, BattleType, battleTypeName, dexTypeName } from '../../types';
import type { Battle } from '../../types';

export default function BattleDetail() {
  const { id } = useParams();
  const { address } = useAccount();

  // Parse battle ID from route
  const battleId = useMemo(() => {
    if (!id) return undefined;
    try {
      return BigInt(id);
    } catch {
      return undefined;
    }
  }, [id]);

  // Fetch battle data from single BattleArena contract
  const { data: battleData, isLoading, refetch: refetchBattle } = useBattle(battleId);

  // Normalize battle data from the struct
  const battle = useMemo(() => {
    if (!battleData) return null;
    const b = battleData as Battle;
    return {
      creator: b.creator,
      opponent: b.opponent,
      winner: b.winner,
      creatorDex: b.creatorDex,
      opponentDex: b.opponentDex,
      creatorTokenId: b.creatorTokenId,
      opponentTokenId: b.opponentTokenId,
      creatorValueUSD: b.creatorValueUSD,
      opponentValueUSD: b.opponentValueUSD,
      battleType: b.battleType,
      status: b.status,
      startTime: b.startTime,
      duration: b.duration,
      token0: b.token0,
      token1: b.token1,
      creatorInRangeTime: b.creatorInRangeTime,
      opponentInRangeTime: b.opponentInRangeTime,
      lastUpdateTime: b.lastUpdateTime,
      creatorStartFeeGrowth0: b.creatorStartFeeGrowth0,
      creatorStartFeeGrowth1: b.creatorStartFeeGrowth1,
      opponentStartFeeGrowth0: b.opponentStartFeeGrowth0,
      opponentStartFeeGrowth1: b.opponentStartFeeGrowth1,
      creatorLiquidity: b.creatorLiquidity,
      opponentLiquidity: b.opponentLiquidity,
    };
  }, [battleData]);

  // Compute time remaining from struct
  const computeTimeRemaining = useMemo(() => {
    if (!battle || battle.status !== BattleStatus.ACTIVE) return 0;
    const now = Math.floor(Date.now() / 1000);
    const endTime = Number(battle.startTime) + Number(battle.duration);
    return Math.max(0, endTime - now);
  }, [battle]);

  // Write hooks
  const { resolveBattle, isPending: resolvePending } = useResolveBattle();
  const { isSuccess: updateSuccess } = useUpdateBattleStatus();

  // Join battle modal
  const [showJoinModal, setShowJoinModal] = useState(false);

  // On-chain battle events
  const { events: battleEvents, isLoading: eventsLoading } = useBattleEvents(battleId);

  // Local countdown timer
  const [localTime, setLocalTime] = useState<number>(0);

  useEffect(() => {
    setLocalTime(computeTimeRemaining);
  }, [computeTimeRemaining]);

  useEffect(() => {
    const timer = setInterval(() => {
      setLocalTime((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Refetch on update success
  useEffect(() => {
    if (updateSuccess) refetchBattle();
  }, [updateSuccess, refetchBattle]);

  // Refresh battle data every 30s
  useEffect(() => {
    const interval = setInterval(() => refetchBattle(), 30000);
    return () => clearInterval(interval);
  }, [refetchBattle]);

  // Performance calculations from struct data
  const perfData = useMemo(() => {
    if (!battle || battle.status === BattleStatus.PENDING) return null;

    if (battle.battleType === BattleType.RANGE) {
      const cTime = Number(battle.creatorInRangeTime);
      const oTime = Number(battle.opponentInRangeTime);
      const total = cTime + oTime;
      return {
        creatorPct: total > 0 ? (cTime / total) * 100 : 50,
        opponentPct: total > 0 ? (oTime / total) * 100 : 50,
        creatorInRangeTime: cTime,
        opponentInRangeTime: oTime,
        leader: cTime >= oTime ? battle.creator : battle.opponent,
        type: 'range' as const,
      };
    }

    if (battle.battleType === BattleType.FEE) {
      const cFee = Number(battle.creatorStartFeeGrowth0) + Number(battle.creatorStartFeeGrowth1);
      const oFee = Number(battle.opponentStartFeeGrowth0) + Number(battle.opponentStartFeeGrowth1);
      const total = cFee + oFee;
      return {
        creatorPct: total > 0 ? (cFee / total) * 100 : 50,
        opponentPct: total > 0 ? (oFee / total) * 100 : 50,
        creatorInRangeTime: 0,
        opponentInRangeTime: 0,
        leader: cFee >= oFee ? battle.creator : battle.opponent,
        type: 'fee' as const,
      };
    }

    return null;
  }, [battle]);

  const zeroAddr = '0x0000000000000000000000000000000000000000';

  // Stylus ScoringEngine: compute on-chain scores
  const isRangeBattle = battle?.battleType === BattleType.RANGE;
  const totalElapsed = battle && battle.status !== BattleStatus.PENDING
    ? BigInt(Math.max(1, Math.floor(Date.now() / 1000) - Number(battle.startTime)))
    : undefined;

  const { data: creatorRangeScore } = useCalculateRangeScore(
    isRangeBattle ? battle?.creatorInRangeTime : undefined,
    isRangeBattle ? totalElapsed : undefined,
    isRangeBattle ? 10n : undefined,
  );
  const { data: opponentRangeScore } = useCalculateRangeScore(
    isRangeBattle ? battle?.opponentInRangeTime : undefined,
    isRangeBattle ? totalElapsed : undefined,
    isRangeBattle ? 10n : undefined,
  );
  const { data: creatorFeeScore } = useCalculateFeeScore(
    !isRangeBattle ? battle?.creatorStartFeeGrowth0 : undefined,
    !isRangeBattle ? battle?.creatorValueUSD : undefined,
    !isRangeBattle ? battle?.duration : undefined,
  );
  const { data: opponentFeeScore } = useCalculateFeeScore(
    !isRangeBattle ? battle?.opponentStartFeeGrowth0 : undefined,
    !isRangeBattle ? battle?.opponentValueUSD : undefined,
    !isRangeBattle ? battle?.duration : undefined,
  );

  const rawCreatorScore = isRangeBattle ? creatorRangeScore : creatorFeeScore;
  const rawOpponentScore = isRangeBattle ? opponentRangeScore : opponentFeeScore;

  const { data: normalizedCreatorScore } = useNormalizeCrossDex(
    rawCreatorScore as bigint | undefined,
    battle?.creatorDex,
  );
  const { data: normalizedOpponentScore } = useNormalizeCrossDex(
    rawOpponentScore as bigint | undefined,
    battle?.opponentDex,
  );

  // Stylus Leaderboard: player ELO
  const { data: creatorStats } = usePlayerStats(battle?.creator as `0x${string}` | undefined);
  const { data: opponentStats } = usePlayerStats(
    battle?.opponent !== zeroAddr ? (battle?.opponent as `0x${string}`) : undefined,
  );

  const formatScore = (score: unknown) => {
    if (!score) return '--';
    const s = Number(score as bigint);
    if (s === 0) return '0';
    return (s / 1e18).toFixed(4);
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isOpen = battle?.status === BattleStatus.PENDING;
  const isExpired = battle?.status === BattleStatus.EXPIRED;
  const isResolved = battle?.status === BattleStatus.RESOLVED;
  const isCreator = address && battle?.creator.toLowerCase() === address.toLowerCase();
  const isOpponent = address && battle?.opponent.toLowerCase() === address.toLowerCase();

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

  const vaultType = battle.battleType === BattleType.RANGE ? 'range' : 'fee';

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
                color: battle.battleType === BattleType.RANGE ? '#42c7e6' : '#a855f7',
                border: `1px solid ${battle.battleType === BattleType.RANGE ? 'rgba(66, 199, 230, 0.4)' : 'rgba(168, 85, 247, 0.4)'}`,
              }}
            >
              {battleTypeName(battle.battleType).toUpperCase()}
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
            VALUE: {formatUSD(battle.creatorValueUSD)}
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
              <span className="text-[10px] font-mono tracking-widest text-gray-500">CREATOR</span>
              <span className="text-[9px] font-mono tracking-wider px-1.5 py-0.5 rounded" style={{ color: '#9ca3af', border: '1px solid rgba(156, 163, 175, 0.3)' }}>
                {dexTypeName(battle.creatorDex).toUpperCase()}
              </span>
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
                  {battle.battleType === BattleType.RANGE ? 'IN-RANGE TIME' : 'FEE SCORE'}
                </p>
                <p className="text-lg font-bold" style={{ color: '#42c7e6' }}>
                  {perfData ? `${perfData.creatorPct.toFixed(1)}%` : '--'}
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
                <p className="text-lg font-bold text-gray-500 mb-2">AWAITING CHALLENGER</p>
                <p className="text-xs font-mono text-gray-600 mb-6 text-center">
                  This battle is open for an opponent to join
                </p>
                {!isCreator && address && (
                  <button
                    onClick={() => setShowJoinModal(true)}
                    className="px-8 py-3 rounded-lg font-bold text-sm tracking-wider transition-all hover:opacity-90"
                    style={{
                      background: 'linear-gradient(135deg, rgba(237, 127, 47, 0.2), rgba(138, 56, 21, 0.2))',
                      border: '1px solid rgba(237, 127, 47, 0.5)',
                      color: '#ed7f2f',
                    }}
                  >
                    JOIN THIS BATTLE
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-[10px] font-mono tracking-widest text-gray-500">OPPONENT</span>
                  <span className="text-[9px] font-mono tracking-wider px-1.5 py-0.5 rounded" style={{ color: '#9ca3af', border: '1px solid rgba(156, 163, 175, 0.3)' }}>
                    {dexTypeName(battle.opponentDex).toUpperCase()}
                  </span>
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
                      {battle.battleType === BattleType.RANGE ? 'IN-RANGE TIME' : 'FEE SCORE'}
                    </p>
                    <p className="text-lg font-bold" style={{ color: '#ed7f2f' }}>
                      {perfData ? `${perfData.opponentPct.toFixed(1)}%` : '--'}
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

        {/* ===== PERFORMANCE CHART ===== */}
        {battle.opponent !== zeroAddr && (
          <PerformanceChart
            perfData={perfData}
            vaultType={vaultType}
            creatorAddress={battle.creator}
            opponentAddress={battle.opponent}
          />
        )}

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
              {battle.battleType === BattleType.RANGE ? 'RANGE PERFORMANCE' : 'FEE PERFORMANCE'}
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
                <span className="text-xs font-mono tracking-wider" style={{ color: '#22c55e' }}>
                  LEADER: {formatAddress(perfData.leader, 6)}
                  {perfData.leader.toLowerCase() === address?.toLowerCase() && ' (YOU)'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ===== RESOLVE BUTTON ===== */}
        {isExpired && (
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
        {isResolved && battle.winner !== zeroAddr && (
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

        {/* ===== BATTLE LOG (On-Chain Events) ===== */}
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
          {eventsLoading ? (
            <div className="flex items-center gap-2 py-4">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-500" />
              <span className="text-xs font-mono text-gray-600">LOADING ON-CHAIN EVENTS...</span>
            </div>
          ) : battleEvents.length === 0 ? (
            <p className="text-xs font-mono text-gray-600 py-4">NO EVENTS RECORDED YET</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {battleEvents.map((event, i) => {
                const time = new Date(event.timestamp * 1000);
                const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}:${time.getSeconds().toString().padStart(2, '0')}`;
                return (
                  <div
                    key={`${event.txHash}-${i}`}
                    className="flex items-start gap-3 py-1.5"
                    style={{ borderBottom: i < battleEvents.length - 1 ? '1px solid rgba(255, 255, 255, 0.03)' : 'none' }}
                  >
                    <span className="text-[10px] font-mono text-gray-600 flex-shrink-0 w-16">
                      {timeStr}
                    </span>
                    <span
                      className="text-xs font-mono flex-1"
                      style={{
                        color: event.type === 'creator' ? '#42c7e6'
                          : event.type === 'opponent' ? '#ed7f2f'
                          : event.type === 'system' ? '#22c55e'
                          : '#9ca3af',
                      }}
                    >
                      {event.message}
                    </span>
                    <a
                      href={getExplorerUrl(event.txHash, 'tx')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 p-1 rounded hover:bg-white/10 transition-colors"
                      title="View transaction"
                    >
                      <ExternalLink className="h-3 w-3 text-gray-600" />
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </div>

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
                <span className="text-white">{battleTypeName(battle.battleType)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Value</span>
                <span className="text-white">{formatUSD(battle.creatorValueUSD)}</span>
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
                <div className="flex justify-between">
                  <span className="text-gray-500">Creator Score</span>
                  <span style={{ color: '#42c7e6' }}>{perfData.creatorPct.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Opponent Score</span>
                  <span style={{ color: '#ed7f2f' }}>{perfData.opponentPct.toFixed(1)}%</span>
                </div>
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

          {/* Stylus Scoring (on-chain via Rust/WASM) */}
          <div
            className="rounded-xl p-5"
            style={{
              background: 'linear-gradient(135deg, rgba(10, 10, 10, 0.95), rgba(1, 1, 1, 0.98))',
              border: '1px solid rgba(168, 85, 247, 0.25)',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold tracking-widest" style={{ color: '#a855f7' }}>STYLUS SCORING</h3>
              <span className="text-[9px] font-mono tracking-wider px-1.5 py-0.5 rounded" style={{ color: '#a855f7', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                RUST/WASM
              </span>
            </div>
            <div className="space-y-3 text-sm font-mono">
              <div className="flex justify-between">
                <span className="text-gray-500">Creator Score</span>
                <span style={{ color: '#42c7e6' }}>{formatScore(normalizedCreatorScore ?? rawCreatorScore)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Opponent Score</span>
                <span style={{ color: '#ed7f2f' }}>{formatScore(normalizedOpponentScore ?? rawOpponentScore)}</span>
              </div>
              {creatorStats && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Creator ELO</span>
                  <span style={{ color: '#a855f7' }}>{Number((creatorStats as readonly bigint[])[0])}</span>
                </div>
              )}
              {opponentStats && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Opponent ELO</span>
                  <span style={{ color: '#a855f7' }}>{Number((opponentStats as readonly bigint[])[0])}</span>
                </div>
              )}
            </div>
            <p className="text-[10px] font-mono text-gray-700 mt-3 tracking-wider">
              Scores computed by Stylus (Rust/WASM) on Arbitrum
            </p>
          </div>
        </div>

        {/* Terminal Footer */}
        <div className="text-center py-12">
          <p className="text-xs font-mono text-gray-600 tracking-wider">
            MULTI_DEX_ARENA_CLIENT // REAL-TIME DATA STREAM // ARBITRUM SEPOLIA
          </p>
        </div>
      </div>

      {/* Join Battle Modal */}
      {battleId !== undefined && (
        <JoinBattleModal
          isOpen={showJoinModal}
          onClose={() => setShowJoinModal(false)}
          battleId={battleId}
        />
      )}
    </div>
  );
}
