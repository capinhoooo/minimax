import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Clock, Trophy, User } from 'lucide-react';
import { formatAddress, formatUSD, formatTimeRemaining, getStatusBadgeClass, formatStatus } from '../../lib/utils';

export default function BattleDetail() {
  const { id } = useParams();

  // Mock data - will be replaced with contract read
  const battle = {
    id: BigInt(id || '1'),
    creator: '0x1234567890123456789012345678901234567890',
    opponent: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    winner: '0x0000000000000000000000000000000000000000',
    creatorTokenId: 42n,
    opponentTokenId: 38n,
    startTime: BigInt(Math.floor(Date.now() / 1000) - 20000),
    duration: 86400n,
    totalValueUSD: 485000000000n,
    isResolved: false,
    status: 'ongoing',
    creatorInRangePercent: 72,
    opponentInRangePercent: 58,
    timeRemaining: 66400,
  };

  return (
    <div className="py-8 px-4">
      <div className="mx-auto max-w-5xl">
        {/* Back Link */}
        <Link to="/battle" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6">
          <ArrowLeft className="h-4 w-4" />
          Back to Arena
        </Link>

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">Battle #{id}</h1>
              <span className={getStatusBadgeClass(battle.status)}>
                {formatStatus(battle.status)}
              </span>
            </div>
            <p className="text-gray-400">WETH/USDC • Range Battle</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400">Total Value</p>
            <p className="text-2xl font-bold">{formatUSD(battle.totalValueUSD)}</p>
          </div>
        </div>

        {/* Timer */}
        <div className="card text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Clock className="h-5 w-5 text-accent-blue" />
            <span className="text-gray-400">Time Remaining</span>
          </div>
          <p className="text-4xl font-bold font-mono">
            {formatTimeRemaining(battle.timeRemaining)}
          </p>
        </div>

        {/* Players */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Creator */}
          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-accent-blue/10">
                <User className="h-6 w-6 text-accent-blue" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Creator</p>
                <p className="font-mono">{formatAddress(battle.creator, 6)}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">In Range</span>
                  <span className="font-medium">{battle.creatorInRangePercent}%</span>
                </div>
                <div className="h-2 bg-background rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent-green rounded-full transition-all"
                    style={{ width: `${battle.creatorInRangePercent}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-accent-green" />
                <span className="text-sm">Currently In Range</span>
              </div>

              <div className="pt-4 border-t border-border">
                <p className="text-sm text-gray-400">Position ID</p>
                <p className="font-mono">#{battle.creatorTokenId.toString()}</p>
              </div>
            </div>
          </div>

          {/* Opponent */}
          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-accent-purple/10">
                <User className="h-6 w-6 text-accent-purple" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Opponent</p>
                <p className="font-mono">{formatAddress(battle.opponent, 6)}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">In Range</span>
                  <span className="font-medium">{battle.opponentInRangePercent}%</span>
                </div>
                <div className="h-2 bg-background rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent-purple rounded-full transition-all"
                    style={{ width: `${battle.opponentInRangePercent}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-accent-red" />
                <span className="text-sm">Currently Out of Range</span>
              </div>

              <div className="pt-4 border-t border-border">
                <p className="text-sm text-gray-400">Position ID</p>
                <p className="font-mono">#{battle.opponentTokenId.toString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Current Leader */}
        <div className="card text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Trophy className="h-5 w-5 text-accent-yellow" />
            <span className="text-gray-400">Current Leader</span>
          </div>
          <p className="text-xl font-bold">
            {battle.creatorInRangePercent > battle.opponentInRangePercent ? 'Creator' : 'Opponent'}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Leading by {Math.abs(battle.creatorInRangePercent - battle.opponentInRangePercent)}%
          </p>
        </div>
      </div>
    </div>
  );
}
