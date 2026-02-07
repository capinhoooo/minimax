import { Bot, Activity, Zap, Clock, CheckCircle2, ExternalLink, Loader2 } from 'lucide-react';
import { useAccount } from 'wagmi';
import { formatAddress, getExplorerUrl } from '../lib/utils';
import { useBattleCount, useActiveBattles } from '../hooks/useBattleVault';
import { CONTRACTS } from '../lib/contracts';

// Agent address (the settlement bot)
const AGENT_ADDRESS = '0x564323aE0D8473103F3763814c5121Ca9e48004B';

export default function Agent() {
  const { address } = useAccount();

  // Live contract data
  const { data: rangeBattleCount, isLoading: loadingRangeCount } = useBattleCount('range');
  const { data: feeBattleCount, isLoading: loadingFeeCount } = useBattleCount('fee');
  const { data: rangeActive } = useActiveBattles('range');
  const { data: feeActive } = useActiveBattles('fee');

  const totalBattles = (rangeBattleCount ? Number(rangeBattleCount as bigint) : 0) + (feeBattleCount ? Number(feeBattleCount as bigint) : 0);
  const totalActive = (rangeActive ? (rangeActive as bigint[]).length : 0) + (feeActive ? (feeActive as bigint[]).length : 0);
  const isLoading = loadingRangeCount || loadingFeeCount;

  return (
    <div className="py-8 px-4">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Agent Dashboard</h1>
          <p className="text-gray-400">Monitor the autonomous battle settlement agent</p>
        </div>

        {/* Agent Status */}
        <div className="card mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-accent-blue/10">
                <Bot className="h-8 w-8 text-accent-blue" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="font-semibold">Battle Agent</h2>
                  <span className="flex items-center gap-1 text-sm text-accent-green">
                    <span className="w-2 h-2 rounded-full bg-accent-green" />
                    Online
                  </span>
                </div>
                <p className="text-sm text-gray-400 font-mono">{formatAddress(AGENT_ADDRESS, 6)}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400">Network</p>
              <p className="font-semibold">Sepolia</p>
            </div>
          </div>
        </div>

        {/* Stats - Live from contracts */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="card">
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-accent-blue" />
              <span className="text-gray-400">Total Battles</span>
            </div>
            <p className="text-3xl font-bold mt-2">
              {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-gray-500" /> : totalBattles}
            </p>
          </div>
          <div className="card">
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5 text-accent-green" />
              <span className="text-gray-400">Active Now</span>
            </div>
            <p className="text-3xl font-bold mt-2">
              {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-gray-500" /> : totalActive}
            </p>
          </div>
          <div className="card">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-accent-purple" />
              <span className="text-gray-400">Range Vault</span>
            </div>
            <p className="text-3xl font-bold mt-2">
              {rangeBattleCount !== undefined ? Number(rangeBattleCount as bigint).toString() : '--'}
            </p>
          </div>
          <div className="card">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5" style={{ color: '#a855f7' }} />
              <span className="text-gray-400">Fee Vault</span>
            </div>
            <p className="text-3xl font-bold mt-2">
              {feeBattleCount !== undefined ? Number(feeBattleCount as bigint).toString() : '--'}
            </p>
          </div>
        </div>

        {/* Contract Addresses */}
        <div className="card mb-8">
          <h3 className="font-semibold mb-4">Deployed Contracts (Sepolia)</h3>
          <div className="space-y-3 font-mono text-sm">
            <div className="flex items-center justify-between p-2 rounded hover:bg-background">
              <span className="text-gray-400">Range Vault:</span>
              <div className="flex items-center gap-2">
                <span className="text-white">{formatAddress(CONTRACTS.RANGE_VAULT, 8)}</span>
                <a
                  href={getExplorerUrl(CONTRACTS.RANGE_VAULT, 'address')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-blue hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
            <div className="flex items-center justify-between p-2 rounded hover:bg-background">
              <span className="text-gray-400">Fee Vault:</span>
              <div className="flex items-center gap-2">
                <span className="text-white">{formatAddress(CONTRACTS.FEE_VAULT, 8)}</span>
                <a
                  href={getExplorerUrl(CONTRACTS.FEE_VAULT, 'address')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-blue hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
            <div className="flex items-center justify-between p-2 rounded hover:bg-background">
              <span className="text-gray-400">Pool Manager:</span>
              <div className="flex items-center gap-2">
                <span className="text-white">{formatAddress(CONTRACTS.POOL_MANAGER, 8)}</span>
                <a
                  href={getExplorerUrl(CONTRACTS.POOL_MANAGER, 'address')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-blue hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
            <div className="flex items-center justify-between p-2 rounded hover:bg-background">
              <span className="text-gray-400">Position Manager:</span>
              <div className="flex items-center gap-2">
                <span className="text-white">{formatAddress(CONTRACTS.POSITION_MANAGER, 8)}</span>
                <a
                  href={getExplorerUrl(CONTRACTS.POSITION_MANAGER, 'address')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-blue hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Active Battle IDs */}
          <div className="card">
            <h3 className="font-semibold mb-4">Active Range Battles</h3>
            <div className="space-y-2">
              {rangeActive && (rangeActive as bigint[]).length > 0 ? (
                (rangeActive as bigint[]).map((id) => (
                  <div key={id.toString()} className="flex items-center justify-between p-3 rounded-lg bg-background">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-accent-green" />
                      <span className="font-mono text-sm">Battle #{id.toString()}</span>
                    </div>
                    <a
                      href={`/battle/range-${id}`}
                      className="text-sm text-accent-blue hover:underline"
                    >
                      View
                    </a>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 font-mono">No active range battles</p>
              )}
            </div>
          </div>

          {/* Active Fee Battles */}
          <div className="card">
            <h3 className="font-semibold mb-4">Active Fee Battles</h3>
            <div className="space-y-2">
              {feeActive && (feeActive as bigint[]).length > 0 ? (
                (feeActive as bigint[]).map((id) => (
                  <div key={id.toString()} className="flex items-center justify-between p-3 rounded-lg bg-background">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" style={{ color: '#a855f7' }} />
                      <span className="font-mono text-sm">Battle #{id.toString()}</span>
                    </div>
                    <a
                      href={`/battle/fee-${id}`}
                      className="text-sm text-accent-blue hover:underline"
                    >
                      View
                    </a>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 font-mono">No active fee battles</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
