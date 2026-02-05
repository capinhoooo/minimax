import { Link } from 'react-router-dom';
import { Plus, Swords, Clock, DollarSign } from 'lucide-react';
import { formatAddress, formatUSD, formatTimeRemaining, getStatusBadgeClass, formatStatus } from '../../lib/utils';

// Mock data for now - will be replaced with contract reads
const mockBattles = [
  {
    id: 1n,
    creator: '0x1234567890123456789012345678901234567890',
    opponent: '0x0000000000000000000000000000000000000000',
    status: 'waiting_for_opponent',
    totalValueUSD: 245000000000n, // $2,450 with 8 decimals
    duration: 86400n,
    startTime: 0n,
    timeRemaining: 0,
  },
  {
    id: 2n,
    creator: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    opponent: '0x9876543210987654321098765432109876543210',
    status: 'ongoing',
    totalValueUSD: 512000000000n, // $5,120
    duration: 86400n,
    startTime: BigInt(Math.floor(Date.now() / 1000) - 20000),
    timeRemaining: 66400,
  },
];

export default function BattleArena() {
  return (
    <div className="py-8 px-4">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Battle Arena</h1>
            <p className="text-gray-400">Find opponents and enter LP position battles</p>
          </div>
          <Link to="/battle/create" className="btn-primary flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create Battle
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-8">
          <select className="input max-w-[150px]">
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="ongoing">Ongoing</option>
            <option value="resolved">Resolved</option>
          </select>
          <select className="input max-w-[150px]">
            <option value="all">All Pools</option>
            <option value="weth-usdc">WETH/USDC</option>
            <option value="wbtc-usdc">WBTC/USDC</option>
          </select>
          <select className="input max-w-[150px]">
            <option value="range">Range Battle</option>
            <option value="fee">Fee Battle</option>
          </select>
        </div>

        {/* Battle Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {mockBattles.map((battle) => (
            <Link
              key={battle.id.toString()}
              to={`/battle/${battle.id}`}
              className="card-hover"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-accent-blue/10">
                    <Swords className="h-6 w-6 text-accent-blue" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Battle #{battle.id.toString()}</h3>
                    <p className="text-sm text-gray-400">WETH/USDC • Range Battle</p>
                  </div>
                </div>
                <span className={getStatusBadgeClass(battle.status)}>
                  {formatStatus(battle.status)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-400">Total Value</p>
                    <p className="font-medium">{formatUSD(battle.totalValueUSD)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-400">
                      {battle.status === 'waiting_for_opponent' ? 'Duration' : 'Time Left'}
                    </p>
                    <p className="font-medium">
                      {battle.status === 'waiting_for_opponent'
                        ? '24 hours'
                        : formatTimeRemaining(battle.timeRemaining)
                      }
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-border">
                <div>
                  <p className="text-xs text-gray-400">Creator</p>
                  <p className="font-mono text-sm">{formatAddress(battle.creator)}</p>
                </div>
                {battle.opponent !== '0x0000000000000000000000000000000000000000' ? (
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Opponent</p>
                    <p className="font-mono text-sm">{formatAddress(battle.opponent)}</p>
                  </div>
                ) : (
                  <button className="btn-primary text-sm py-1.5 px-4">
                    Join Battle
                  </button>
                )}
              </div>
            </Link>
          ))}
        </div>

        {/* Empty State */}
        {mockBattles.length === 0 && (
          <div className="text-center py-16">
            <Swords className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Battles Found</h3>
            <p className="text-gray-400 mb-6">Be the first to create a battle!</p>
            <Link to="/battle/create" className="btn-primary">
              Create Battle
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
