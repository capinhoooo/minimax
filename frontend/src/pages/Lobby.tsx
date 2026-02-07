import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { formatAddress, formatUSD, formatTimeRemaining } from '../lib/utils';
import {
  useUserBattles,
  useActiveBattles,
  usePendingBattles,
  useBattleCount,
  useRangeBattles,
  useFeeBattles,
} from '../hooks/useBattleVault';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export default function Lobby() {
  const { address, isConnected } = useAccount();

  // Global stats
  const { data: rangeBattleCount } = useBattleCount('range');
  const { data: feeBattleCount } = useBattleCount('fee');
  const { data: rangeActiveIds } = useActiveBattles('range');
  const { data: feeActiveIds } = useActiveBattles('fee');
  const { data: rangePendingIds } = usePendingBattles('range');
  const { data: feePendingIds } = usePendingBattles('fee');

  // User's battles
  const { data: userRangeBattles } = useUserBattles(address, 'range');
  const { data: userFeeBattles } = useUserBattles(address, 'fee');

  const userRangeIds = useMemo(() => {
    if (!userRangeBattles) return [] as bigint[];
    const [ids] = userRangeBattles as [bigint[], boolean[]];
    return ids;
  }, [userRangeBattles]);

  const userFeeIds = useMemo(() => {
    if (!userFeeBattles) return [] as bigint[];
    const [ids] = userFeeBattles as [bigint[], boolean[]];
    return ids;
  }, [userFeeBattles]);

  const { data: userRangeDetails } = useRangeBattles(userRangeIds);
  const { data: userFeeDetails } = useFeeBattles(userFeeIds);

  // Compute user stats
  const userStats = useMemo(() => {
    let wins = 0, losses = 0, total = 0;

    if (userRangeDetails && address) {
      userRangeDetails.forEach((r) => {
        if (r.status === 'success' && r.result) {
          const [, , winner, , , , , , isResolved] = r.result as [string, string, string, bigint, bigint, bigint, bigint, bigint, boolean, string];
          total++;
          if (isResolved) {
            if (winner.toLowerCase() === address.toLowerCase()) wins++;
            else if (winner !== ZERO_ADDRESS) losses++;
          }
        }
      });
    }

    if (userFeeDetails && address) {
      userFeeDetails.forEach((r) => {
        if (r.status === 'success' && r.result) {
          const [, , winner, , , , , , , isResolved] = r.result as [string, string, string, bigint, bigint, bigint, bigint, bigint, bigint, boolean, string];
          total++;
          if (isResolved) {
            if (winner.toLowerCase() === address.toLowerCase()) wins++;
            else if (winner !== ZERO_ADDRESS) losses++;
          }
        }
      });
    }

    const winRate = (wins + losses) > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : '0.0';
    return { wins, losses, total, winRate };
  }, [userRangeDetails, userFeeDetails, address]);

  // Battle history from user's battles
  type HistoryEntry = {
    vaultType: 'range' | 'fee';
    battleId: bigint;
    result: 'VICTORY' | 'DEFEAT' | 'ACTIVE';
    opponent: string;
    valueUSD: bigint;
  };

  const battleHistory = useMemo(() => {
    const history: HistoryEntry[] = [];

    if (userRangeDetails && userRangeBattles && address) {
      const [ids] = userRangeBattles as [bigint[], boolean[]];
      userRangeDetails.forEach((r, i) => {
        if (r.status === 'success' && r.result) {
          const [creator, opponent, winner, , , , , totalValueUSD, isResolved] = r.result as [string, string, string, bigint, bigint, bigint, bigint, bigint, boolean, string];
          const isUserCreator = creator.toLowerCase() === address.toLowerCase();
          const opponentAddr = isUserCreator ? opponent : creator;
          history.push({
            vaultType: 'range',
            battleId: ids[i],
            result: isResolved
              ? (winner.toLowerCase() === address.toLowerCase() ? 'VICTORY' : 'DEFEAT')
              : 'ACTIVE',
            opponent: opponentAddr,
            valueUSD: totalValueUSD,
          });
        }
      });
    }

    if (userFeeDetails && userFeeBattles && address) {
      const [ids] = userFeeBattles as [bigint[], boolean[]];
      userFeeDetails.forEach((r, i) => {
        if (r.status === 'success' && r.result) {
          const [creator, opponent, winner, , , , , creatorLPValue, , isResolved] = r.result as [string, string, string, bigint, bigint, bigint, bigint, bigint, bigint, boolean, string];
          const isUserCreator = creator.toLowerCase() === address.toLowerCase();
          const opponentAddr = isUserCreator ? opponent : creator;
          history.push({
            vaultType: 'fee',
            battleId: ids[i],
            result: isResolved
              ? (winner.toLowerCase() === address.toLowerCase() ? 'VICTORY' : 'DEFEAT')
              : 'ACTIVE',
            opponent: opponentAddr,
            valueUSD: creatorLPValue,
          });
        }
      });
    }

    return history.reverse().slice(0, 5);
  }, [userRangeDetails, userFeeDetails, userRangeBattles, userFeeBattles, address]);

  // Featured battle: first active battle with an opponent (ongoing)
  const activeRangeArr = (rangeActiveIds as bigint[]) ?? [];
  const activeFeeArr = (feeActiveIds as bigint[]) ?? [];
  const { data: activeRangeDetails } = useRangeBattles(activeRangeArr);
  const { data: activeFeeDetails } = useFeeBattles(activeFeeArr);

  type FeaturedBattle = {
    vaultType: 'range' | 'fee';
    id: bigint;
    creator: string;
    opponent: string;
    valueUSD: bigint;
    duration: bigint;
    status: string;
  };

  const featured = useMemo((): FeaturedBattle | null => {
    if (activeRangeDetails) {
      for (let i = 0; i < activeRangeDetails.length; i++) {
        const r = activeRangeDetails[i];
        if (r.status === 'success' && r.result) {
          const [creator, opponent, , , , , duration, totalValueUSD, , status] = r.result as [string, string, string, bigint, bigint, bigint, bigint, bigint, boolean, string];
          if (opponent !== ZERO_ADDRESS) {
            return { vaultType: 'range', id: activeRangeArr[i], creator, opponent, valueUSD: totalValueUSD, duration, status };
          }
        }
      }
    }
    if (activeFeeDetails) {
      for (let i = 0; i < activeFeeDetails.length; i++) {
        const r = activeFeeDetails[i];
        if (r.status === 'success' && r.result) {
          const [creator, opponent, , , , , duration, creatorLPValue, , , status] = r.result as [string, string, string, bigint, bigint, bigint, bigint, bigint, bigint, boolean, string];
          if (opponent !== ZERO_ADDRESS) {
            return { vaultType: 'fee', id: activeFeeArr[i], creator, opponent, valueUSD: creatorLPValue, duration, status };
          }
        }
      }
    }
    // Fallback: any active battle
    if (activeRangeDetails && activeRangeDetails.length > 0) {
      const r = activeRangeDetails[0];
      if (r.status === 'success' && r.result) {
        const [creator, opponent, , , , , duration, totalValueUSD, , status] = r.result as [string, string, string, bigint, bigint, bigint, bigint, bigint, boolean, string];
        return { vaultType: 'range', id: activeRangeArr[0], creator, opponent, valueUSD: totalValueUSD, duration, status };
      }
    }
    return null;
  }, [activeRangeDetails, activeFeeDetails, activeRangeArr, activeFeeArr]);

  // Pending battles = "open challenges"
  const pendingRangeArr = (rangePendingIds as bigint[]) ?? [];
  const pendingFeeArr = (feePendingIds as bigint[]) ?? [];
  const { data: pendingRangeDetails } = useRangeBattles(pendingRangeArr);
  const { data: pendingFeeDetails } = useFeeBattles(pendingFeeArr);

  type PendingMatch = {
    vaultType: 'range' | 'fee';
    id: bigint;
    creator: string;
    duration: bigint;
    valueUSD: bigint;
  };

  const pendingMatches = useMemo(() => {
    const matches: PendingMatch[] = [];
    if (pendingRangeDetails) {
      pendingRangeDetails.forEach((r, i) => {
        if (r.status === 'success' && r.result) {
          const [creator, , , , , , duration, totalValueUSD] = r.result as [string, string, string, bigint, bigint, bigint, bigint, bigint, boolean, string];
          matches.push({ vaultType: 'range', id: pendingRangeArr[i], creator, duration, valueUSD: totalValueUSD });
        }
      });
    }
    if (pendingFeeDetails) {
      pendingFeeDetails.forEach((r, i) => {
        if (r.status === 'success' && r.result) {
          const [creator, , , , , , duration, creatorLPValue] = r.result as [string, string, string, bigint, bigint, bigint, bigint, bigint, bigint, boolean, string];
          matches.push({ vaultType: 'fee', id: pendingFeeArr[i], creator, duration, valueUSD: creatorLPValue });
        }
      });
    }
    return matches.slice(0, 5);
  }, [pendingRangeDetails, pendingFeeDetails, pendingRangeArr, pendingFeeArr]);

  // Aggregate stats
  const totalBattles = (rangeBattleCount ? Number(rangeBattleCount as bigint) : 0) + (feeBattleCount ? Number(feeBattleCount as bigint) : 0);
  const totalActive = activeRangeArr.length + activeFeeArr.length;
  const totalPending = pendingRangeArr.length + pendingFeeArr.length;

  return (
    <div className="min-h-screen grid-bg">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-12">
          <div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black mb-3 tracking-tight">
              <span className="gradient-text-magenta italic">WELCOME TO THE ARENA</span>
            </h1>
            <p className="text-xs sm:text-sm tracking-[0.3em] text-gray-500 uppercase font-mono">
              Your mission briefing starts here
            </p>
          </div>
        </div>
        {/* Three Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          {/* ===== LEFT COLUMN ===== */}
          <div className="lg:col-span-3 flex flex-col gap-5">

            {/* Pilot Profile */}
            <div
              className="rounded-lg p-5"
              style={{
                background: 'rgba(10, 10, 10, 0.95)',
                border: '1px solid rgba(237, 127, 47, 0.25)',
              }}
            >
              <h3
                className="text-xs font-bold tracking-widest mb-4"
                style={{ color: '#ed7f2f' }}
              >
                PILOT PROFILE
              </h3>

              {!isConnected ? (
                <p className="text-xs font-mono text-gray-600 tracking-wider">
                  CONNECT WALLET TO VIEW PROFILE
                </p>
              ) : (
                <>
                  <div
                    className="rounded-md p-4 mb-4"
                    style={{ border: '1px solid rgba(255, 255, 255, 0.1)' }}
                  >
                    <span
                      className="inline-block px-2 py-0.5 text-[10px] font-mono tracking-wider rounded mb-2"
                      style={{
                        border: `1px solid ${userStats.wins >= 10 ? '#ed7f2f' : userStats.wins >= 3 ? '#42c7e6' : '#6b7280'}`,
                        color: userStats.wins >= 10 ? '#ed7f2f' : userStats.wins >= 3 ? '#42c7e6' : '#6b7280',
                      }}
                    >
                      {userStats.wins >= 10 ? 'ELITE GLADIATOR' : userStats.wins >= 3 ? 'VETERAN' : 'RECRUIT'}
                    </span>
                    <p className="text-sm font-bold font-mono tracking-wide text-white">
                      {formatAddress(address!, 6)}
                    </p>
                  </div>

                  <div className="space-y-2 font-mono text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-gray-500 tracking-wider">TOTAL BATTLES</span>
                      <span className="text-white">{userStats.total}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 tracking-wider">RECORD</span>
                      <span className="text-white">
                        <span style={{ color: '#42c7e6' }}>{userStats.wins}W</span>
                        {' / '}
                        <span style={{ color: '#ed7f2f' }}>{userStats.losses}L</span>
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 tracking-wider">WIN RATE</span>
                      <span className="text-white">{userStats.winRate}%</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Quick Actions */}
            <div
              className="rounded-lg p-5"
              style={{
                background: 'rgba(10, 10, 10, 0.95)',
                border: '1px solid rgba(237, 127, 47, 0.25)',
              }}
            >
              <p
                className="text-[10px] font-mono tracking-widest mb-3"
                style={{ color: '#6b7280' }}
              >
                QUICK ACTIONS
              </p>

              <Link
                to="/battle/create"
                className="block w-full mb-3 py-3 rounded-md text-xs font-bold tracking-widest transition-all hover:opacity-90 text-center"
                style={{
                  border: '1px solid #ed7f2f',
                  color: '#ed7f2f',
                  background: 'rgba(237, 127, 47, 0.08)',
                }}
              >
                CREATE BATTLE
              </Link>

              <Link
                to="/battle"
                className="block w-full py-3 rounded-md text-xs font-bold tracking-widest transition-all hover:opacity-90 text-center"
                style={{
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#9ca3af',
                }}
              >
                BROWSE ARENA
              </Link>
            </div>

            {/* Arena Stats */}
            <div
              className="rounded-lg p-5"
              style={{
                background: 'rgba(10, 10, 10, 0.95)',
                border: '1px solid rgba(237, 127, 47, 0.25)',
              }}
            >
              <h3
                className="text-xs font-bold tracking-widest mb-4"
                style={{ color: '#ed7f2f' }}
              >
                ARENA ANALYTICS
              </h3>

              {/* Mini Chart */}
              <div
                className="rounded-md p-4 mb-4 relative"
                style={{
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  height: '120px',
                }}
              >
                <svg
                  className="w-full h-full"
                  viewBox="0 0 200 80"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="chartLine" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#42c7e6" />
                      <stop offset="100%" stopColor="#ed7f2f" />
                    </linearGradient>
                    <linearGradient id="chartFill" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="rgba(66, 199, 230, 0.15)" />
                      <stop offset="100%" stopColor="rgba(66, 199, 230, 0)" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0 60 Q20 55 40 50 T80 35 T120 25 T160 30 T200 15"
                    fill="none"
                    stroke="url(#chartLine)"
                    strokeWidth="2"
                  />
                  <path
                    d="M0 60 Q20 55 40 50 T80 35 T120 25 T160 30 T200 15 L200 80 L0 80 Z"
                    fill="url(#chartFill)"
                  />
                </svg>
              </div>

              <div className="space-y-2.5 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-gray-500 tracking-wider">TOTAL BATTLES</span>
                  <span className="text-white font-bold">{totalBattles}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 tracking-wider">ACTIVE NOW</span>
                  <span className="text-white font-bold">{totalActive}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 tracking-wider">OPEN CHALLENGES</span>
                  <span className="text-white font-bold">{totalPending}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ===== CENTER COLUMN ===== */}
          <div className="lg:col-span-6 flex flex-col gap-5">
            {/* Featured Arena */}
            <div>
              <div
                className="rounded-lg p-6 relative overflow-hidden"
                style={{
                  background: 'rgba(10, 10, 10, 0.95)',
                  border: '1px solid rgba(237, 127, 47, 0.25)',
                }}
              >
                {/* Grid overlay */}
                <div
                  className="absolute inset-0 opacity-30"
                  style={{
                    backgroundImage:
                      'linear-gradient(rgba(66, 199, 230, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(66, 199, 230, 0.03) 1px, transparent 1px)',
                    backgroundSize: '30px 30px',
                  }}
                />

                {featured ? (
                  <>
                    <p className="text-center text-[10px] font-mono text-gray-600 tracking-widest mb-6 relative z-10">
                      {featured.vaultType === 'range' ? 'RANGE' : 'FEE'} BATTLE #{featured.id.toString()}
                    </p>

                    {/* VS Battle Display */}
                    <div className="flex items-center justify-center gap-6 md:gap-10 mb-6 relative z-10">
                      {/* Creator */}
                      <div className="flex flex-col items-center">
                        <div
                          className="w-20 h-20 md:w-24 md:h-24 flex items-center justify-center rotate-45 rounded-md mb-3"
                          style={{
                            border: '2px solid rgba(66, 199, 230, 0.5)',
                            background: 'rgba(66, 199, 230, 0.08)',
                            boxShadow: '0 0 20px rgba(66, 199, 230, 0.15)',
                          }}
                        >
                          <span
                            className="text-lg md:text-xl font-bold -rotate-45 font-mono"
                            style={{ color: '#42c7e6' }}
                          >
                            {formatAddress(featured.creator, 3)}
                          </span>
                        </div>
                        <p className="text-xs font-mono font-bold tracking-wider text-white pt-4">
                          CREATOR
                        </p>
                        <p className="text-[9px] font-mono text-gray-600 tracking-wider">
                          {formatAddress(featured.creator, 4)}
                        </p>
                      </div>

                      {/* VS */}
                      <span className="text-2xl md:text-3xl font-black text-gray-600 tracking-wider">
                        VS
                      </span>

                      {/* Opponent */}
                      <div className="flex flex-col items-center">
                        <div
                          className="w-20 h-20 md:w-24 md:h-24 flex items-center justify-center rotate-45 rounded-md mb-3"
                          style={{
                            border: `2px solid ${featured.opponent !== ZERO_ADDRESS ? 'rgba(237, 127, 47, 0.5)' : 'rgba(107, 114, 128, 0.3)'}`,
                            background: featured.opponent !== ZERO_ADDRESS ? 'rgba(237, 127, 47, 0.08)' : 'rgba(30, 30, 30, 0.5)',
                            boxShadow: featured.opponent !== ZERO_ADDRESS ? '0 0 20px rgba(237, 127, 47, 0.15)' : 'none',
                          }}
                        >
                          <span
                            className="text-lg md:text-xl font-bold -rotate-45 font-mono"
                            style={{ color: featured.opponent !== ZERO_ADDRESS ? '#ed7f2f' : '#6b7280' }}
                          >
                            {featured.opponent !== ZERO_ADDRESS ? formatAddress(featured.opponent, 3) : '???'}
                          </span>
                        </div>
                        <p className="text-xs font-mono font-bold tracking-wider text-white pt-4">
                          {featured.opponent !== ZERO_ADDRESS ? 'OPPONENT' : 'AWAITING'}
                        </p>
                        <p className="text-[9px] font-mono text-gray-600 tracking-wider">
                          {featured.opponent !== ZERO_ADDRESS ? formatAddress(featured.opponent, 4) : 'No challenger yet'}
                        </p>
                      </div>
                    </div>

                    {/* Type Badge */}
                    <div className="flex justify-center mb-4 relative z-10">
                      <span
                        className="px-4 py-1 rounded-full text-[10px] font-mono tracking-wider"
                        style={{
                          border: `1px solid ${featured.vaultType === 'range' ? '#42c7e6' : '#a855f7'}`,
                          color: featured.vaultType === 'range' ? '#42c7e6' : '#a855f7',
                          background: featured.vaultType === 'range' ? 'rgba(66, 199, 230, 0.08)' : 'rgba(168, 85, 247, 0.08)',
                        }}
                      >
                        {featured.vaultType === 'range' ? 'RANGE BATTLE' : 'FEE BATTLE'} // {formatTimeRemaining(Number(featured.duration))}
                      </span>
                    </div>

                    {/* Value */}
                    <p className="text-center text-sm font-mono font-bold tracking-wider text-white mb-5 relative z-10">
                      VALUE: {formatUSD(featured.valueUSD)}
                    </p>

                    {/* Spectate */}
                    <div className="flex justify-center relative z-10">
                      <Link
                        to={`/battle/${featured.vaultType}-${featured.id}`}
                        className="px-6 py-2.5 rounded-md text-xs font-bold font-mono tracking-widest transition-all hover:opacity-80"
                        style={{
                          border: '1px solid rgba(255, 255, 255, 0.3)',
                          color: 'white',
                          background: 'rgba(255, 255, 255, 0.05)',
                        }}
                      >
                        {featured.opponent === ZERO_ADDRESS ? 'JOIN BATTLE' : 'SPECTATE BATTLE'}
                      </Link>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-10 relative z-10">
                    <p className="text-sm font-mono text-gray-600 tracking-wider mb-4">
                      NO ACTIVE BATTLES
                    </p>
                    <Link
                      to="/battle/create"
                      className="inline-block px-6 py-2.5 rounded-md text-xs font-bold font-mono tracking-widest transition-all hover:opacity-80"
                      style={{
                        border: '1px solid rgba(237, 127, 47, 0.5)',
                        color: '#ed7f2f',
                      }}
                    >
                      BE THE FIRST
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Open Challenges (Pending Battles) */}
            <div
              className="rounded-lg p-5"
              style={{
                background: 'rgba(10, 10, 10, 0.95)',
                border: '1px solid rgba(237, 127, 47, 0.25)',
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3
                  className="text-xs font-bold tracking-widest"
                  style={{ color: '#ed7f2f' }}
                >
                  OPEN CHALLENGES
                </h3>
                <span className="text-[10px] font-mono text-gray-600 tracking-wider">
                  {totalPending} WAITING
                </span>
              </div>

              {pendingMatches.length > 0 ? (
                <div className="space-y-0">
                  {pendingMatches.map((match, i) => (
                    <div
                      key={`${match.vaultType}-${match.id}`}
                      className="flex items-center justify-between py-3"
                      style={{
                        borderBottom:
                          i < pendingMatches.length - 1
                            ? '1px solid rgba(255, 255, 255, 0.05)'
                            : 'none',
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="text-[10px] font-mono tracking-wider px-1.5 py-0.5 rounded"
                          style={{
                            color: match.vaultType === 'range' ? '#42c7e6' : '#a855f7',
                            border: `1px solid ${match.vaultType === 'range' ? 'rgba(66, 199, 230, 0.3)' : 'rgba(168, 85, 247, 0.3)'}`,
                          }}
                        >
                          {match.vaultType === 'range' ? 'RNG' : 'FEE'}
                        </span>
                        <span className="text-xs font-mono text-white tracking-wider">
                          <span className="font-bold">{formatAddress(match.creator)}</span>
                          <span className="text-gray-600 mx-2">#{match.id.toString()}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-mono text-gray-500">
                          {formatTimeRemaining(Number(match.duration))}
                        </span>
                        <Link
                          to={`/battle/${match.vaultType}-${match.id}`}
                          className="px-3 py-1 text-[10px] font-mono tracking-wider rounded transition-all hover:opacity-80"
                          style={{
                            border: '1px solid rgba(237, 127, 47, 0.4)',
                            color: '#ed7f2f',
                          }}
                        >
                          JOIN
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs font-mono text-gray-600 tracking-wider text-center py-4">
                  NO OPEN CHALLENGES RIGHT NOW
                </p>
              )}
            </div>
          </div>

          {/* ===== RIGHT COLUMN ===== */}
          <div className="lg:col-span-3 flex flex-col gap-5">

            {/* Battle History */}
            <div
              className="rounded-lg p-5"
              style={{
                background: 'rgba(10, 10, 10, 0.95)',
                border: '1px solid rgba(237, 127, 47, 0.25)',
              }}
            >
              <h3
                className="text-xs font-bold tracking-widest mb-4"
                style={{ color: '#ed7f2f' }}
              >
                BATTLE HISTORY
              </h3>

              {!isConnected ? (
                <p className="text-xs font-mono text-gray-600 tracking-wider">
                  CONNECT WALLET TO VIEW HISTORY
                </p>
              ) : battleHistory.length > 0 ? (
                <div className="space-y-3">
                  {battleHistory.map((entry, i) => (
                    <div
                      key={`${entry.vaultType}-${entry.battleId}`}
                      className="py-2"
                      style={{
                        borderBottom:
                          i < battleHistory.length - 1
                            ? '1px solid rgba(255, 255, 255, 0.05)'
                            : 'none',
                      }}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span
                          className="text-[10px] font-bold tracking-widest"
                          style={{
                            color: entry.result === 'VICTORY' ? '#42c7e6' : entry.result === 'DEFEAT' ? '#ef4444' : '#ed7f2f',
                          }}
                        >
                          {entry.result}
                        </span>
                        <span
                          className="text-[9px] font-mono tracking-wider px-1.5 py-0.5 rounded"
                          style={{
                            color: entry.vaultType === 'range' ? '#42c7e6' : '#a855f7',
                            border: `1px solid ${entry.vaultType === 'range' ? 'rgba(66, 199, 230, 0.3)' : 'rgba(168, 85, 247, 0.3)'}`,
                          }}
                        >
                          {entry.vaultType === 'range' ? 'RNG' : 'FEE'}
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-gray-500">
                        vs {entry.opponent !== ZERO_ADDRESS ? formatAddress(entry.opponent) : 'N/A'}{' '}
                        ({formatUSD(entry.valueUSD)})
                      </p>
                      <Link
                        to={`/battle/${entry.vaultType}-${entry.battleId}`}
                        className="text-[9px] font-mono tracking-wider hover:underline"
                        style={{ color: '#42c7e6' }}
                      >
                        Battle #{entry.battleId.toString()}
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs font-mono text-gray-600 tracking-wider">
                  NO BATTLES YET. ENTER THE ARENA!
                </p>
              )}
            </div>

            {/* Live Battles Feed */}
            <div
              className="rounded-lg p-5"
              style={{
                background: 'rgba(10, 10, 10, 0.95)',
                border: '1px solid rgba(237, 127, 47, 0.25)',
              }}
            >
              <h3
                className="text-xs font-bold tracking-widest mb-4"
                style={{ color: '#ed7f2f' }}
              >
                LIVE BATTLES
              </h3>

              {totalActive > 0 ? (
                <div className="space-y-2">
                  {activeRangeArr.slice(0, 3).map((id) => (
                    <Link
                      key={`range-${id}`}
                      to={`/battle/range-${id}`}
                      className="flex items-center justify-between py-2 px-2 rounded hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[11px] font-mono text-white tracking-wider">
                          RANGE #{id.toString()}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-gray-500">VIEW</span>
                    </Link>
                  ))}
                  {activeFeeArr.slice(0, 3).map((id) => (
                    <Link
                      key={`fee-${id}`}
                      to={`/battle/fee-${id}`}
                      className="flex items-center justify-between py-2 px-2 rounded hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                        <span className="text-[11px] font-mono text-white tracking-wider">
                          FEE #{id.toString()}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-gray-500">VIEW</span>
                    </Link>
                  ))}
                  {totalActive > 6 && (
                    <Link
                      to="/battle"
                      className="block text-center text-[10px] font-mono tracking-wider pt-2"
                      style={{ color: '#42c7e6' }}
                    >
                      VIEW ALL {totalActive} BATTLES
                    </Link>
                  )}
                </div>
              ) : (
                <p className="text-xs font-mono text-gray-600 tracking-wider">
                  NO LIVE BATTLES
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-[10px] font-mono text-gray-700 tracking-widest">
            ARENA_V4 SECURE TERMINAL // CONNECTION STABLE // SYSTEM READY
          </p>
        </div>
      </div>
    </div>
  );
}
