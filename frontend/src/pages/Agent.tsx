import { Bot, Activity, Zap, Clock, CheckCircle2, ExternalLink } from 'lucide-react';
import { formatAddress, getExplorerUrl } from '../lib/utils';

// Mock data - would come from agent API or logs
const agentStatus = {
  isOnline: true,
  address: '0x564323aE0D8473103F3763814c5121Ca9e48004B',
  balance: '0.174',
  network: 'Sepolia',
};

const stats = {
  battlesMonitored: 24,
  settledToday: 8,
  gasUsedToday: '0.012',
};

const recentSettlements = [
  {
    battleId: '12',
    timestamp: '14:32:01',
    winner: '0x1234567890123456789012345678901234567890',
    winnerType: 'Creator',
    reason: '72% in-range vs 48% in-range',
    txHash: '0xabc123def456789...',
    status: 'success',
  },
  {
    battleId: '11',
    timestamp: '12:15:33',
    winner: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    winnerType: 'Opponent',
    reason: '65% in-range vs 71% in-range',
    txHash: '0xdef456abc789012...',
    status: 'success',
  },
  {
    battleId: '10',
    timestamp: '09:45:12',
    winner: '0x0000000000000000000000000000000000000000',
    winnerType: 'Tie',
    reason: 'Both 50% in-range (tie)',
    txHash: '0x789012def456abc...',
    status: 'success',
  },
];

const actionLog = [
  { time: '14:32:01', action: 'SETTLE', message: 'Battle #12 settled successfully', status: 'success' },
  { time: '14:32:00', action: 'DETECT', message: 'Battle #12 ready to resolve', status: 'info' },
  { time: '14:31:30', action: 'POLL', message: 'Checking active battles...', status: 'info' },
  { time: '14:31:00', action: 'POLL', message: 'Checking active battles...', status: 'info' },
  { time: '12:15:33', action: 'SETTLE', message: 'Battle #11 settled successfully', status: 'success' },
  { time: '12:15:32', action: 'DETECT', message: 'Battle #11 ready to resolve', status: 'info' },
];

export default function Agent() {
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
                  <span className={`flex items-center gap-1 text-sm ${agentStatus.isOnline ? 'text-accent-green' : 'text-accent-red'}`}>
                    <span className={`w-2 h-2 rounded-full ${agentStatus.isOnline ? 'bg-accent-green' : 'bg-accent-red'}`} />
                    {agentStatus.isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
                <p className="text-sm text-gray-400 font-mono">{formatAddress(agentStatus.address, 6)}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400">Balance</p>
              <p className="font-semibold">{agentStatus.balance} ETH</p>
              <p className="text-xs text-gray-500">{agentStatus.network}</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="card">
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-accent-blue" />
              <span className="text-gray-400">Battles Monitored</span>
            </div>
            <p className="text-3xl font-bold mt-2">{stats.battlesMonitored}</p>
          </div>
          <div className="card">
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5 text-accent-green" />
              <span className="text-gray-400">Settled Today</span>
            </div>
            <p className="text-3xl font-bold mt-2">{stats.settledToday}</p>
          </div>
          <div className="card">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-accent-purple" />
              <span className="text-gray-400">Gas Used Today</span>
            </div>
            <p className="text-3xl font-bold mt-2">{stats.gasUsedToday} ETH</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Settlements */}
          <div className="card">
            <h3 className="font-semibold mb-4">Recent Settlements</h3>
            <div className="space-y-4">
              {recentSettlements.map((settlement) => (
                <div key={settlement.battleId} className="p-4 rounded-lg bg-background">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Battle #{settlement.battleId}</span>
                    <span className="text-sm text-gray-400">{settlement.timestamp}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-4 w-4 text-accent-green" />
                    <span className="text-sm">
                      Winner: <span className="text-accent-blue">{settlement.winnerType}</span>
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mb-2">{settlement.reason}</p>
                  <a
                    href={getExplorerUrl(settlement.txHash, 'tx')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-accent-blue hover:underline"
                  >
                    View TX <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ))}
            </div>
          </div>

          {/* Action Log */}
          <div className="card">
            <h3 className="font-semibold mb-4">Action Log</h3>
            <div className="space-y-2 font-mono text-sm">
              {actionLog.map((log, index) => (
                <div key={index} className="flex items-start gap-3 p-2 rounded hover:bg-background">
                  <span className="text-gray-500 flex-shrink-0">{log.time}</span>
                  <span className={`flex-shrink-0 px-2 py-0.5 rounded text-xs ${
                    log.action === 'SETTLE' ? 'bg-accent-green/20 text-accent-green' :
                    log.action === 'DETECT' ? 'bg-accent-yellow/20 text-accent-yellow' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {log.action}
                  </span>
                  <span className="text-gray-300">{log.message}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
