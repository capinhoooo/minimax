import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { Loader2, Shield } from 'lucide-react';
import { formatAddress, formatUSD } from '../lib/utils';
import {
  useUserBattles,
  useRangeBattles,
  useFeeBattles,
} from '../hooks/useBattleVault';
import { useUserPositions } from '../hooks/usePositionManager';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export default function Profile() {
  const { address, isConnected } = useAccount();

  // User battles from both vaults
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

  const { data: userRangeDetails, isLoading: loadingRange } = useRangeBattles(userRangeIds);
  const { data: userFeeDetails, isLoading: loadingFee } = useFeeBattles(userFeeIds);

  // LP positions
  const { tokenIds: userPositions, isLoading: loadingPositions } = useUserPositions(address);

  const isLoading = loadingRange || loadingFee;

  // Compute stats
  const userStats = useMemo(() => {
    let wins = 0, losses = 0, total = 0, active = 0;

    if (userRangeDetails && address) {
      userRangeDetails.forEach((r) => {
        if (r.status === 'success' && r.result) {
          const [, , winner, , , , , , isResolved] = r.result as [string, string, string, bigint, bigint, bigint, bigint, bigint, boolean, string];
          total++;
          if (isResolved) {
            if (winner.toLowerCase() === address.toLowerCase()) wins++;
            else if (winner !== ZERO_ADDRESS) losses++;
          } else {
            active++;
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
          } else {
            active++;
          }
        }
      });
    }

    const winRate = (wins + losses) > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : '0.0';
    return { wins, losses, total, active, winRate };
  }, [userRangeDetails, userFeeDetails, address]);

  // Full battle history
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

    return history.reverse();
  }, [userRangeDetails, userFeeDetails, userRangeBattles, userFeeBattles, address]);

  const rankLabel = userStats.wins >= 10 ? 'ELITE GLADIATOR' : userStats.wins >= 3 ? 'VETERAN' : 'RECRUIT';
  const rankColor = userStats.wins >= 10 ? '#ed7f2f' : userStats.wins >= 3 ? '#42c7e6' : '#6b7280';

  // Not connected state
  if (!isConnected) {
    return (
      <div className="min-h-screen grid-bg">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="flex flex-col items-center justify-center py-32">
            <Shield className="h-16 w-16 mb-6" style={{ color: '#ed7f2f', opacity: 0.4 }} />
            <h2 className="text-2xl font-black tracking-wider mb-3" style={{ color: '#ed7f2f' }}>
              ACCESS RESTRICTED
            </h2>
            <p className="text-sm font-mono text-gray-500 tracking-wider">
              CONNECT WALLET TO ACCESS PILOT DOSSIER
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid-bg">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black mb-3 tracking-tight">
            <span className="gradient-text-magenta italic">PILOT DOSSIER</span>
          </h1>
          <p className="text-xs sm:text-sm tracking-[0.3em] text-gray-500 uppercase font-mono">
            Your combat record and arsenal
          </p>
        </div>

        {/* Pilot Card + Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 mb-8">
          {/* Pilot Card */}
          <div
            className="lg:col-span-1 rounded-xl p-6"
            style={{
              background: 'linear-gradient(135deg, rgba(10, 10, 10, 0.95), rgba(1, 1, 1, 0.98))',
              border: '1px solid rgba(237, 127, 47, 0.3)',
              boxShadow: '0 0 30px rgba(237, 127, 47, 0.08)',
            }}
          >
            <div className="flex flex-col items-center text-center">
              {/* Rank Icon */}
              <div
                className="w-20 h-20 rounded-lg rotate-45 flex items-center justify-center mb-5"
                style={{
                  border: `2px solid ${rankColor}`,
                  background: `${rankColor}10`,
                  boxShadow: `0 0 25px ${rankColor}20`,
                }}
              >
                <Shield className="h-8 w-8 -rotate-45" style={{ color: rankColor }} />
              </div>
              <span
                className="inline-block px-3 py-1 text-[10px] font-mono font-bold tracking-widest rounded mb-3"
                style={{
                  border: `1px solid ${rankColor}`,
                  color: rankColor,
                }}
              >
                {rankLabel}
              </span>
              <p className="text-sm font-bold font-mono tracking-wide text-white mb-1">
                {formatAddress(address!, 6)}
              </p>
              <p className="text-[10px] font-mono text-gray-600 tracking-wider">
                SEPOLIA TESTNET
              </p>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="lg:col-span-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'TOTAL BATTLES', value: userStats.total.toString(), color: '#ed7f2f' },
              { label: 'VICTORIES', value: userStats.wins.toString(), color: '#22c55e' },
              { label: 'DEFEATS', value: userStats.losses.toString(), color: '#ef4444' },
              { label: 'WIN RATE', value: `${userStats.winRate}%`, color: '#42c7e6' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl p-5 flex flex-col justify-between"
                style={{
                  background: 'linear-gradient(135deg, rgba(10, 10, 10, 0.95), rgba(1, 1, 1, 0.98))',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                <p className="text-[10px] font-mono tracking-widest text-gray-600 mb-3">{stat.label}</p>
                <p className="text-3xl font-black font-mono" style={{ color: stat.color }}>
                  {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-gray-600" /> : stat.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Active Battles Banner */}
        {userStats.active > 0 && (
          <div
            className="rounded-lg px-5 py-3 mb-8 flex items-center justify-between"
            style={{
              background: 'rgba(34, 197, 94, 0.08)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
            }}
          >
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-mono font-bold tracking-wider" style={{ color: '#22c55e' }}>
                {userStats.active} ACTIVE BATTLE{userStats.active !== 1 ? 'S' : ''} IN PROGRESS
              </span>
            </div>
            <Link
              to="/battle"
              className="text-[10px] font-mono tracking-wider hover:underline"
              style={{ color: '#22c55e' }}
            >
              VIEW ARENA
            </Link>
          </div>
        )}

        {/* Two Column: Battle History + LP Arsenal */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Battle History */}
          <div
            className="lg:col-span-2 rounded-xl overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(10, 10, 10, 0.95), rgba(1, 1, 1, 0.98))',
              border: '1px solid rgba(237, 127, 47, 0.3)',
            }}
          >
            <div
              className="px-6 py-4 flex items-center justify-between"
              style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}
            >
              <h3 className="text-xs font-mono font-bold tracking-widest" style={{ color: '#ed7f2f' }}>
                BATTLE HISTORY
              </h3>
              <span className="text-[10px] font-mono text-gray-600 tracking-wider">
                {battleHistory.length} RECORD{battleHistory.length !== 1 ? 'S' : ''}
              </span>
            </div>

            <div className="p-6">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin" style={{ color: '#42c7e6' }} />
                  <span className="ml-3 text-xs font-mono text-gray-500 tracking-wider">LOADING COMBAT RECORDS...</span>
                </div>
              ) : battleHistory.length > 0 ? (
                <div className="space-y-0">
                  {battleHistory.map((entry, i) => (
                    <Link
                      key={`${entry.vaultType}-${entry.battleId}`}
                      to={`/battle/${entry.vaultType}-${entry.battleId}`}
                      className="flex items-center justify-between py-3.5 px-3 -mx-3 rounded-lg hover:bg-white/[0.02] transition-colors"
                      style={{
                        borderBottom: i < battleHistory.length - 1 ? '1px solid rgba(255, 255, 255, 0.04)' : 'none',
                      }}
                    >
                      <div className="flex items-center gap-4">
                        {/* Result Badge */}
                        <span
                          className="w-16 text-center text-[10px] font-mono font-bold tracking-wider py-1 rounded"
                          style={{
                            color: entry.result === 'VICTORY' ? '#22c55e' : entry.result === 'DEFEAT' ? '#ef4444' : '#ed7f2f',
                            background: entry.result === 'VICTORY' ? 'rgba(34, 197, 94, 0.1)' : entry.result === 'DEFEAT' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(237, 127, 47, 0.1)',
                            border: `1px solid ${entry.result === 'VICTORY' ? 'rgba(34, 197, 94, 0.3)' : entry.result === 'DEFEAT' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(237, 127, 47, 0.3)'}`,
                          }}
                        >
                          {entry.result}
                        </span>

                        {/* Vault Type */}
                        <span
                          className="text-[10px] font-mono tracking-wider px-1.5 py-0.5 rounded"
                          style={{
                            color: entry.vaultType === 'range' ? '#42c7e6' : '#a855f7',
                            border: `1px solid ${entry.vaultType === 'range' ? 'rgba(66, 199, 230, 0.3)' : 'rgba(168, 85, 247, 0.3)'}`,
                          }}
                        >
                          {entry.vaultType === 'range' ? 'RNG' : 'FEE'}
                        </span>

                        {/* Battle Info */}
                        <div>
                          <span className="text-sm font-mono text-white tracking-wider">
                            BATTLE #{entry.battleId.toString()}
                          </span>
                          <span className="text-xs font-mono text-gray-600 ml-3">
                            vs {entry.opponent !== ZERO_ADDRESS ? formatAddress(entry.opponent) : 'AWAITING'}
                          </span>
                        </div>
                      </div>

                      {/* Value */}
                      <span className="text-xs font-mono text-gray-400 tracking-wider hidden sm:inline">
                        {formatUSD(entry.valueUSD)}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-sm font-mono text-gray-600 tracking-wider mb-4">
                    NO BATTLES ON RECORD
                  </p>
                  <Link
                    to="/battle/create"
                    className="inline-block px-6 py-2.5 rounded-lg text-xs font-bold tracking-wider transition-all hover:opacity-90"
                    style={{
                      border: '1px solid rgba(237, 127, 47, 0.5)',
                      color: '#ed7f2f',
                    }}
                  >
                    ENTER YOUR FIRST BATTLE
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* LP Arsenal */}
          <div
            className="lg:col-span-1 rounded-xl overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(10, 10, 10, 0.95), rgba(1, 1, 1, 0.98))',
              border: '1px solid rgba(66, 199, 230, 0.3)',
            }}
          >
            <div
              className="px-6 py-4 flex items-center justify-between"
              style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}
            >
              <h3 className="text-xs font-mono font-bold tracking-widest" style={{ color: '#42c7e6' }}>
                LP ARSENAL
              </h3>
              <span className="text-[10px] font-mono text-gray-600 tracking-wider">
                {userPositions.length} NFT{userPositions.length !== 1 ? 'S' : ''}
              </span>
            </div>

            <div className="p-6">
              {loadingPositions ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin" style={{ color: '#42c7e6' }} />
                  <span className="ml-2 text-xs font-mono text-gray-500 tracking-wider">SCANNING...</span>
                </div>
              ) : userPositions.length > 0 ? (
                <div className="space-y-3">
                  {userPositions.map((id) => (
                    <div
                      key={id.toString()}
                      className="flex items-center justify-between px-4 py-3 rounded-lg"
                      style={{
                        background: 'rgba(15, 15, 15, 0.8)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                      }}
                    >
                      <div>
                        <p className="text-sm font-mono font-bold text-white tracking-wider">
                          POSITION #{id.toString()}
                        </p>
                        <p className="text-[10px] font-mono text-gray-600 tracking-wider">
                          V4 LP NFT
                        </p>
                      </div>
                      <Link
                        to="/battle/create"
                        className="text-[10px] font-mono tracking-wider px-2.5 py-1 rounded transition-all hover:opacity-80"
                        style={{
                          border: '1px solid rgba(237, 127, 47, 0.4)',
                          color: '#ed7f2f',
                        }}
                      >
                        BATTLE
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-xs font-mono text-gray-600 tracking-wider mb-3">
                    NO LP POSITIONS FOUND
                  </p>
                  <p className="text-[10px] font-mono text-gray-700 tracking-wider">
                    ADD LIQUIDITY ON UNISWAP V4 TO GET STARTED
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Terminal Footer */}
        <div className="mt-16 text-center">
          <p className="text-xs font-mono text-gray-600 tracking-wider">
            TERMINAL STATUS: <span style={{ color: '#22c55e' }}>ONLINE</span> // PILOT: {formatAddress(address!, 4)} // PROFILE_V4
          </p>
        </div>
      </div>
    </div>
  );
}
