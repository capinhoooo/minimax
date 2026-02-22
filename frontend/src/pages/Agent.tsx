import { useState, useEffect, useCallback } from 'react';
import { Bot, Activity, Zap, Route, Shield, CheckCircle, AlertTriangle, Radio, ChevronRight, Loader2 } from 'lucide-react';
import { formatAddress } from '../lib/utils';

// Types matching agent API responses
interface AgentStatus {
  address: string;
  balance: string;
  network: string;
  chainId: number;
  cycleCount: number;
  isRunning: boolean;
  startedAt: number;
  uptime: number;
}

interface VaultData {
  range: { active: number; pending: number; battles: BattleInfo[] };
  fee: { active: number; pending: number; battles: BattleInfo[] };
}

interface BattleInfo {
  id: string;
  creator: string;
  opponent: string;
  status: string;
  totalValueUSD: string;
  timeRemaining: string;
}

interface AgentActionLog {
  timestamp: string;
  action: string;
  battleId?: string;
  contractType?: 'range' | 'fee';
  reasoning: string;
  txHash?: string;
  gasUsed?: string;
  status: 'pending' | 'success' | 'failed';
}

interface AgentDecision {
  type: string;
  priority: number;
  reasoning: string;
  vaultType?: 'range' | 'fee';
  battleId?: string;
}

interface LiFiRouteStep {
  tool: string;
  type: string;
  estimate?: {
    executionDuration?: number;
    feeCosts?: Array<{ amountUSD?: string }>;
  };
}

interface LiFiRoute {
  toAmount: string;
  toToken: { symbol: string; decimals: number };
  steps: LiFiRouteStep[];
}

type Phase = 'monitor' | 'decide' | 'act';

// Helpers
function formatAmount(amount: string, decimals: number): string {
  const val = BigInt(amount);
  const div = BigInt(10 ** decimals);
  const integer = val / div;
  const frac = val % div;
  return `${integer}.${frac.toString().padStart(decimals, '0').slice(0, 4)}`;
}

function estimateFees(route: LiFiRoute): string {
  let total = 0;
  for (const step of route.steps) {
    if (step.estimate?.feeCosts) {
      for (const fee of step.estimate.feeCosts) {
        total += parseFloat(fee.amountUSD || '0');
      }
    }
  }
  return `$${total.toFixed(2)}`;
}

function estimateTime(route: LiFiRoute): string {
  let totalSeconds = 0;
  for (const step of route.steps) {
    totalSeconds += step.estimate?.executionDuration || 0;
  }
  if (totalSeconds < 60) return `${totalSeconds}s`;
  return `~${Math.ceil(totalSeconds / 60)} min`;
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

// In dev, Vite proxy handles /api -> agent. In production, use the env var.
const AGENT_API_BASE = import.meta.env.VITE_AGENT_API_URL || '';

async function fetchApi<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${AGENT_API_BASE}${path}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default function Agent() {
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [vaults, setVaults] = useState<VaultData | null>(null);
  const [logs, setLogs] = useState<AgentActionLog[]>([]);
  const [decisions, setDecisions] = useState<AgentDecision[]>([]);
  const [routes, setRoutes] = useState<LiFiRoute[]>([]);
  const [connected, setConnected] = useState<boolean | null>(null); // null = loading
  const [activePhase, setActivePhase] = useState<Phase | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Determine active phase from recent logs
  const detectPhase = useCallback((actionLogs: AgentActionLog[]) => {
    if (actionLogs.length === 0) return;
    const latest = actionLogs[0]; // most recent
    const age = Date.now() - new Date(latest.timestamp).getTime();
    // Only show active phase if log is less than 15 seconds old
    if (age < 15000) {
      if (latest.action.includes('MONITOR') || latest.action.includes('SCAN')) {
        setActivePhase('monitor');
      } else if (latest.action.includes('DECIDE') || latest.action.includes('ANALYZE')) {
        setActivePhase('decide');
      } else if (latest.action.includes('ACT') || latest.action.includes('SETTLE') || latest.action.includes('CROSS_CHAIN')) {
        setActivePhase('act');
      }
      setTimeout(() => setActivePhase(null), 5000);
    } else {
      setActivePhase(null);
    }
  }, []);

  // Poll /api/status every 5s
  useEffect(() => {
    const poll = async () => {
      const data = await fetchApi<AgentStatus>('/api/status');
      if (data) {
        setStatus(data);
        setConnected(true);
        setLastUpdate(new Date());
      } else {
        setConnected(false);
      }
    };
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, []);

  // Poll /api/vaults every 10s
  useEffect(() => {
    if (!connected) return;
    const poll = async () => {
      const data = await fetchApi<VaultData>('/api/vaults');
      if (data) setVaults(data);
    };
    poll();
    const interval = setInterval(poll, 10000);
    return () => clearInterval(interval);
  }, [connected]);

  // Poll /api/logs every 5s
  useEffect(() => {
    if (!connected) return;
    const poll = async () => {
      const data = await fetchApi<AgentActionLog[]>('/api/logs?limit=50');
      if (data) {
        setLogs(data);
        detectPhase(data);
      }
    };
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [connected, detectPhase]);

  // Poll /api/decisions every 10s
  useEffect(() => {
    if (!connected) return;
    const poll = async () => {
      const data = await fetchApi<AgentDecision[]>('/api/decisions');
      if (data) setDecisions(data);
    };
    poll();
    const interval = setInterval(poll, 10000);
    return () => clearInterval(interval);
  }, [connected]);

  // Poll /api/routes every 30s
  useEffect(() => {
    if (!connected) return;
    const poll = async () => {
      const data = await fetchApi<LiFiRoute[]>('/api/routes');
      if (data) setRoutes(data);
    };
    poll();
    const interval = setInterval(poll, 30000);
    return () => clearInterval(interval);
  }, [connected]);

  const phaseColors: Record<Phase | 'system', string> = {
    monitor: '#42c7e6',
    decide: '#ed7f2f',
    act: '#22c55e',
    system: '#a855f7',
  };

  // Disconnected or loading state
  if (connected === false || connected === null) {
    return (
      <div className="min-h-screen grid-bg">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="flex items-center gap-3 mb-3">
            <Bot className="h-8 w-8" style={{ color: '#a855f7' }} />
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight">
              <span className="gradient-text-magenta italic">AUTONOMOUS AGENT</span>
            </h1>
          </div>
          <p className="text-xs sm:text-sm tracking-[0.2em] text-gray-500 mb-12 uppercase font-mono">
            MONITOR &rarr; DECIDE &rarr; ACT // STRATEGY LOOP // LI.FI CROSS-CHAIN
          </p>

          {/* Agent Overview */}
          <div
            className="rounded-xl p-6 mb-8"
            style={{
              background: 'rgba(5, 5, 5, 0.95)',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              boxShadow: '0 0 30px rgba(168, 85, 247, 0.1)',
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: connected === null ? '#eab308' : '#ef4444' }} />
              <h3 className="text-xs font-mono font-bold tracking-widest" style={{ color: '#a855f7' }}>
                {connected === null ? 'CONNECTING TO AGENT...' : 'AGENT SERVER OFFLINE'}
              </h3>
            </div>
            <p className="text-sm font-mono text-gray-400 mb-4">
              The autonomous agent monitors the BattleArena, auto-settles expired battles for resolver rewards, and provides advisory intelligence via REST API.
            </p>
            <code
              className="block text-sm font-mono px-4 py-3 rounded-lg mb-4"
              style={{ background: 'rgba(66, 199, 230, 0.08)', color: '#42c7e6', border: '1px solid rgba(66, 199, 230, 0.2)' }}
            >
              cd agent && npx tsx src/index.ts serve
            </code>
            <p className="text-[10px] font-mono text-gray-600">
              {connected === null ? 'Attempting connection...' : 'Retrying every 5 seconds...'}
            </p>
          </div>

          {/* Strategy Loop Explanation */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div
              className="rounded-xl p-6"
              style={{
                background: 'rgba(5, 5, 5, 0.95)',
                border: '1px solid rgba(66, 199, 230, 0.3)',
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Radio size={16} style={{ color: '#42c7e6' }} />
                <h4 className="text-sm font-black tracking-wider" style={{ color: '#42c7e6' }}>MONITOR</h4>
              </div>
              <p className="text-xs font-mono text-gray-500">
                Scans BattleArena every 30s for active, pending, and expired battles across V4 and Camelot pools.
              </p>
            </div>
            <div
              className="rounded-xl p-6"
              style={{
                background: 'rgba(5, 5, 5, 0.95)',
                border: '1px solid rgba(237, 127, 47, 0.3)',
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Activity size={16} style={{ color: '#ed7f2f' }} />
                <h4 className="text-sm font-black tracking-wider" style={{ color: '#ed7f2f' }}>DECIDE</h4>
              </div>
              <p className="text-xs font-mono text-gray-500">
                Prioritizes actions: resolve expired battles for rewards, analyze active battles, compute win probabilities.
              </p>
            </div>
            <div
              className="rounded-xl p-6"
              style={{
                background: 'rgba(5, 5, 5, 0.95)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Zap size={16} style={{ color: '#22c55e' }} />
                <h4 className="text-sm font-black tracking-wider" style={{ color: '#22c55e' }}>ACT</h4>
              </div>
              <p className="text-xs font-mono text-gray-500">
                Executes on-chain: settles battles, updates status, queries LI.FI for cross-chain bridge routes.
              </p>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div
              className="rounded-xl p-6"
              style={{
                background: 'rgba(5, 5, 5, 0.95)',
                border: '1px solid rgba(66, 199, 230, 0.2)',
              }}
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-6 rounded-full" style={{ background: '#42c7e6' }} />
                <h4 className="text-xs font-bold tracking-widest text-white">UNISWAP V4 INTEGRATION</h4>
              </div>
              <ul className="space-y-2">
                {[
                  'Direct V4 PoolManager state via extsload',
                  'LP position battle management',
                  'Win probability computation',
                  'Auto-resolve expired battles for 1% reward',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <CheckCircle size={10} style={{ color: '#42c7e6' }} />
                    <span className="text-[10px] font-mono text-gray-400">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div
              className="rounded-xl p-6"
              style={{
                background: 'rgba(5, 5, 5, 0.95)',
                border: '1px solid rgba(237, 127, 47, 0.2)',
              }}
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-6 rounded-full" style={{ background: '#ed7f2f' }} />
                <h4 className="text-xs font-bold tracking-widest text-white">LI.FI CROSS-CHAIN</h4>
              </div>
              <ul className="space-y-2">
                {[
                  'Multi-bridge route optimization (9+ providers)',
                  'Cross-chain battle entry planning',
                  'Live SDK route querying',
                  'Automated bridge + swap + LP + battle flow',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <CheckCircle size={10} style={{ color: '#ed7f2f' }} />
                    <span className="text-[10px] font-mono text-gray-400">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* REST API Endpoints */}
          <div
            className="rounded-xl p-6 mt-6"
            style={{
              background: 'rgba(5, 5, 5, 0.95)',
              border: '1px solid rgba(168, 85, 247, 0.2)',
            }}
          >
            <h4 className="text-xs font-bold tracking-widest mb-4" style={{ color: '#a855f7' }}>
              ADVISORY REST API (PORT 3001)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                ['GET /api/status', 'Agent address, balance, uptime'],
                ['GET /api/battles', 'Active + pending battle data'],
                ['GET /api/battles/:id', 'Single battle + pool analysis'],
                ['GET /api/battles/:id/probability', 'Win probability calc'],
                ['GET /api/recommendations', 'Scored pending battles'],
                ['GET /api/pools', 'V4 + Camelot pool state'],
                ['GET /api/players/:address', 'Player stats from Stylus'],
                ['GET /api/leaderboard', 'All players ranked by ELO'],
              ].map(([endpoint, desc], i) => (
                <div key={i} className="flex items-start gap-2 px-2 py-1.5">
                  <code className="text-[9px] font-mono flex-shrink-0" style={{ color: '#42c7e6' }}>{endpoint}</code>
                  <span className="text-[9px] font-mono text-gray-600">{desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Terminal Status */}
          <div className="mt-16 text-center">
            <p className="text-xs font-mono text-gray-600 tracking-wider">
              TERMINAL STATUS: <span style={{ color: connected === null ? '#eab308' : '#ef4444' }}>{connected === null ? 'CONNECTING' : 'OFFLINE'}</span> // AUTONOMOUS AGENT // ARBITRUM_SEPOLIA
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
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight">
            <span className="gradient-text-magenta italic">AUTONOMOUS AGENT</span>
          </h1>
        </div>
        <p className="text-xs sm:text-sm tracking-[0.3em] text-gray-500 mb-10 uppercase font-mono">
          MONITOR &rarr; DECIDE &rarr; ACT &middot; Live on {status?.network ?? 'Sepolia'} &middot; LI.FI Cross-Chain
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column */}
          <div className="lg:col-span-4 space-y-5">
            {/* Agent Identity */}
            <div
              className="rounded-lg p-5"
              style={{
                background: 'rgba(10, 10, 10, 0.95)',
                border: '1px solid rgba(66, 199, 230, 0.25)',
              }}
            >
              <div className="flex items-center gap-2 mb-4">
                <div
                  className="w-2 h-2 rounded-full animate-pulse"
                  style={{
                    backgroundColor: status?.isRunning ? '#22c55e' : '#eab308',
                    boxShadow: `0 0 8px ${status?.isRunning ? 'rgba(34, 197, 94, 0.6)' : 'rgba(234, 179, 8, 0.6)'}`,
                  }}
                />
                <h3 className="text-xs font-bold tracking-widest" style={{ color: '#42c7e6' }}>
                  {status?.isRunning ? 'AGENT LIVE' : 'AGENT IDLE'}
                </h3>
                {activePhase && (
                  <Loader2 size={10} className="animate-spin ml-auto" style={{ color: phaseColors[activePhase] }} />
                )}
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono text-gray-500 tracking-wider">ADDRESS</span>
                  <span className="text-[11px] font-mono text-white">{status ? formatAddress(status.address) : '...'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono text-gray-500 tracking-wider">BALANCE</span>
                  <span className="text-[11px] font-mono text-white">{status ? `${parseFloat(status.balance).toFixed(4)} ETH` : '...'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono text-gray-500 tracking-wider">NETWORK</span>
                  <span className="text-[11px] font-mono text-white">{status ? `${status.network} (${status.chainId})` : '...'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono text-gray-500 tracking-wider">CYCLES</span>
                  <span className="text-[11px] font-mono" style={{ color: '#42c7e6' }}>{status?.cycleCount ?? 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono text-gray-500 tracking-wider">UPTIME</span>
                  <span className="text-[11px] font-mono text-gray-400">{status ? formatUptime(status.uptime) : '...'}</span>
                </div>
                {lastUpdate && (
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-mono text-gray-500 tracking-wider">LAST POLL</span>
                    <span className="text-[11px] font-mono text-gray-400">{lastUpdate.toLocaleTimeString()}</span>
                  </div>
                )}
              </div>

              {/* Status indicator */}
              <div
                className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-mono tracking-wider"
                style={{
                  background: 'rgba(34, 197, 94, 0.05)',
                  border: '1px solid rgba(34, 197, 94, 0.15)',
                  color: '#22c55e',
                }}
              >
                {activePhase ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    {activePhase.toUpperCase()}...
                  </>
                ) : (
                  'CONNECTED TO AGENT'
                )}
              </div>
            </div>

            {/* Strategy Loop Visualization */}
            <div
              className="rounded-lg p-5"
              style={{
                background: 'rgba(10, 10, 10, 0.95)',
                border: '1px solid rgba(237, 127, 47, 0.25)',
              }}
            >
              <h3 className="text-xs font-bold tracking-widest mb-4" style={{ color: '#ed7f2f' }}>
                STRATEGY LOOP
              </h3>

              <div className="space-y-2">
                {(['monitor', 'decide', 'act'] as Phase[]).map((p, i) => {
                  const isActive = activePhase === p;
                  const phaseOrder = ['monitor', 'decide', 'act'];
                  const isPast = activePhase ? phaseOrder.indexOf(activePhase) > phaseOrder.indexOf(p) : false;
                  const icons = {
                    monitor: <Radio size={14} />,
                    decide: <Activity size={14} />,
                    act: <Zap size={14} />,
                  };
                  const labels = {
                    monitor: ['MONITOR', 'Scan vaults for active battles'],
                    decide: ['DECIDE', 'Prioritize actions by urgency'],
                    act: ['ACT', 'Execute on-chain + query LI.FI'],
                  };

                  return (
                    <div key={p}>
                      <div
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all"
                        style={{
                          background: isActive ? `${phaseColors[p]}12` : 'transparent',
                          border: isActive ? `1px solid ${phaseColors[p]}40` : '1px solid transparent',
                        }}
                      >
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{
                            background: isActive ? `${phaseColors[p]}20` : isPast ? `${phaseColors[p]}10` : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${isActive ? phaseColors[p] : isPast ? `${phaseColors[p]}50` : 'rgba(255,255,255,0.08)'}`,
                            color: isActive || isPast ? phaseColors[p] : '#4b5563',
                            boxShadow: isActive ? `0 0 12px ${phaseColors[p]}30` : 'none',
                          }}
                        >
                          {isPast ? <CheckCircle size={14} /> : icons[p]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div
                            className="text-[11px] font-bold tracking-wider"
                            style={{ color: isActive || isPast ? phaseColors[p] : '#6b7280' }}
                          >
                            {labels[p][0]}
                          </div>
                          <div className="text-[10px] font-mono text-gray-600 truncate">
                            {labels[p][1]}
                          </div>
                        </div>
                        {isActive && (
                          <Loader2 size={12} className="animate-spin flex-shrink-0" style={{ color: phaseColors[p] }} />
                        )}
                      </div>
                      {i < 2 && (
                        <div className="flex justify-center py-0.5">
                          <ChevronRight size={12} className="rotate-90 text-gray-700" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Vault Monitoring */}
            <div
              className="rounded-lg p-5"
              style={{
                background: 'rgba(10, 10, 10, 0.95)',
                border: '1px solid rgba(237, 127, 47, 0.25)',
              }}
            >
              <h3 className="text-xs font-bold tracking-widest mb-4" style={{ color: '#ed7f2f' }}>
                VAULT MONITORING
              </h3>

              <div className="space-y-3">
                <div
                  className="rounded-lg p-3"
                  style={{ background: 'rgba(66, 199, 230, 0.05)', border: '1px solid rgba(66, 199, 230, 0.15)' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold tracking-widest" style={{ color: '#42c7e6' }}>RANGE VAULT</span>
                    <Shield size={12} style={{ color: '#42c7e6' }} />
                  </div>
                  <div className="flex gap-4">
                    <div>
                      <div className="text-lg font-black text-white">{vaults?.range?.active ?? 0}</div>
                      <div className="text-[9px] font-mono text-gray-500">ACTIVE</div>
                    </div>
                    <div>
                      <div className="text-lg font-black" style={{ color: '#42c7e6' }}>{vaults?.range?.pending ?? 0}</div>
                      <div className="text-[9px] font-mono text-gray-500">PENDING</div>
                    </div>
                  </div>
                </div>

                <div
                  className="rounded-lg p-3"
                  style={{ background: 'rgba(237, 127, 47, 0.05)', border: '1px solid rgba(237, 127, 47, 0.15)' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold tracking-widest" style={{ color: '#ed7f2f' }}>FEE VAULT</span>
                    <Zap size={12} style={{ color: '#ed7f2f' }} />
                  </div>
                  <div className="flex gap-4">
                    <div>
                      <div className="text-lg font-black text-white">{vaults?.fee?.active ?? 0}</div>
                      <div className="text-[9px] font-mono text-gray-500">ACTIVE</div>
                    </div>
                    <div>
                      <div className="text-lg font-black" style={{ color: '#ed7f2f' }}>{vaults?.fee?.pending ?? 0}</div>
                      <div className="text-[9px] font-mono text-gray-500">PENDING</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Agent Decisions */}
            {decisions.length > 0 && (
              <div
                className="rounded-lg p-5"
                style={{
                  background: 'rgba(10, 10, 10, 0.95)',
                  border: '1px solid rgba(168, 85, 247, 0.25)',
                }}
              >
                <h3 className="text-xs font-bold tracking-widest mb-3" style={{ color: '#a855f7' }}>
                  DECISIONS ({decisions.length})
                </h3>
                <div className="space-y-2">
                  {decisions.slice(0, 5).map((d, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span
                        className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{
                          background: d.priority >= 50 ? 'rgba(237, 127, 47, 0.15)' : 'rgba(66, 199, 230, 0.1)',
                          color: d.priority >= 50 ? '#ed7f2f' : '#42c7e6',
                          border: `1px solid ${d.priority >= 50 ? 'rgba(237, 127, 47, 0.3)' : 'rgba(66, 199, 230, 0.2)'}`,
                        }}
                      >
                        P{d.priority}
                      </span>
                      <div className="min-w-0">
                        <div className="text-[10px] font-bold text-white tracking-wider">{d.type}</div>
                        <div className="text-[9px] font-mono text-gray-500 truncate">{d.reasoning}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column */}
          <div className="lg:col-span-8 space-y-5">
            {/* LI.FI Cross-Chain Routes */}
            <div
              className="rounded-lg p-5"
              style={{
                background: 'linear-gradient(135deg, rgba(10, 10, 10, 0.95), rgba(1, 1, 1, 0.98))',
                border: '1px solid rgba(237, 127, 47, 0.3)',
                boxShadow: '0 0 30px rgba(237, 127, 47, 0.08)',
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Route size={14} style={{ color: '#ed7f2f' }} />
                  <h3 className="text-xs font-bold tracking-widest" style={{ color: '#ed7f2f' }}>
                    LI.FI CROSS-CHAIN ROUTES
                  </h3>
                  {routes.length > 0 && (
                    <span
                      className="text-[8px] font-bold tracking-wider px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.3)' }}
                    >
                      LIVE
                    </span>
                  )}
                </div>
                <span className="text-[9px] font-mono text-gray-600">Base (8453) &rarr; Ethereum (1) &middot; 50 USDC</span>
              </div>

              {routes.length === 0 ? (
                <div className="flex items-center justify-center py-8 gap-2">
                  <Loader2 size={16} className="animate-spin" style={{ color: '#ed7f2f' }} />
                  <span className="text-xs font-mono text-gray-500">Waiting for agent to query routes...</span>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {routes.slice(0, 5).map((route, i) => (
                      <div
                        key={i}
                        className="rounded-lg p-3 transition-all"
                        style={{
                          background: i === 0 ? 'rgba(34, 197, 94, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                          border: i === 0 ? '1px solid rgba(34, 197, 94, 0.25)' : '1px solid rgba(255, 255, 255, 0.05)',
                        }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">
                              {route.steps[0]?.tool || 'Unknown'}
                            </span>
                            {i === 0 && (
                              <span
                                className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded"
                                style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.3)' }}
                              >
                                BEST
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-mono text-gray-500">
                            {route.steps.map(s => s.type).join(' + ')}
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-3">
                          <div>
                            <div className="text-[9px] font-mono text-gray-600 mb-0.5">OUTPUT</div>
                            <div className="text-[11px] font-mono font-bold text-white">
                              {formatAmount(route.toAmount, route.toToken.decimals)} {route.toToken.symbol}
                            </div>
                          </div>
                          <div>
                            <div className="text-[9px] font-mono text-gray-600 mb-0.5">TIME</div>
                            <div className="text-[11px] font-mono text-white">{estimateTime(route)}</div>
                          </div>
                          <div>
                            <div className="text-[9px] font-mono text-gray-600 mb-0.5">FEES</div>
                            <div className="text-[11px] font-mono text-white">{estimateFees(route)}</div>
                          </div>
                          <div>
                            <div className="text-[9px] font-mono text-gray-600 mb-0.5">STEPS</div>
                            <div className="text-[11px] font-mono" style={{ color: '#42c7e6' }}>
                              {route.steps.length} step{route.steps.length > 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-2 text-right">
                    <span className="text-[9px] font-mono text-gray-600">
                      {routes.length} total routes from LI.FI SDK
                    </span>
                  </div>

                  {/* Execution Plan */}
                  <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="text-[10px] font-bold tracking-widest text-gray-500 mb-3">EXECUTION PLAN</div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {[
                        `Bridge via ${routes[0]?.steps[0]?.tool || 'LI.FI'}`,
                        'Swap 50% USDC \u2192 ETH',
                        'Add V4 Liquidity',
                        'Enter Battle',
                      ].map((step, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span
                            className="text-[10px] font-mono px-2 py-1 rounded"
                            style={{
                              background: 'rgba(66, 199, 230, 0.08)',
                              border: '1px solid rgba(66, 199, 230, 0.2)',
                              color: '#42c7e6',
                            }}
                          >
                            {i + 1}. {step}
                          </span>
                          {i < 3 && <ChevronRight size={10} className="text-gray-700 flex-shrink-0" />}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Action Log (Terminal-style) */}
            <div
              className="rounded-lg overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(10, 10, 10, 0.95), rgba(1, 1, 1, 0.98))',
                border: '1px solid rgba(66, 199, 230, 0.2)',
              }}
            >
              <div
                className="px-4 py-2.5 flex items-center justify-between"
                style={{ borderBottom: '1px solid rgba(66, 199, 230, 0.1)' }}
              >
                <div className="flex items-center gap-2">
                  <Activity size={12} style={{ color: '#42c7e6' }} />
                  <span className="text-[10px] font-bold tracking-widest" style={{ color: '#42c7e6' }}>
                    AGENT ACTION LOG
                  </span>
                  {activePhase && (
                    <Loader2 size={10} className="animate-spin" style={{ color: phaseColors[activePhase] }} />
                  )}
                </div>
                <span className="text-[9px] font-mono text-gray-600">{logs.length} entries</span>
              </div>

              <div className="p-3 max-h-[400px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                {logs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-600">
                    <Bot size={24} className="mb-3 opacity-30" />
                    <span className="text-xs font-mono tracking-wider">Waiting for agent actions...</span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {logs.map((log, i) => {
                      const statusColors: Record<string, string> = {
                        pending: '#3b82f6',
                        success: '#22c55e',
                        failed: '#ef4444',
                      };
                      const statusIcons: Record<string, React.ReactNode> = {
                        pending: <Loader2 size={10} />,
                        success: <CheckCircle size={10} />,
                        failed: <AlertTriangle size={10} />,
                      };

                      return (
                        <div
                          key={i}
                          className="flex items-start gap-2 px-2 py-1.5 rounded transition-all hover:bg-white/[0.02]"
                        >
                          <span className="text-[9px] font-mono text-gray-700 flex-shrink-0 pt-0.5 w-[130px]">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                          <span
                            className="text-[8px] font-bold tracking-wider flex-shrink-0 pt-0.5 w-16 text-right"
                            style={{ color: statusColors[log.status] ?? '#6b7280' }}
                          >
                            {log.status.toUpperCase()}
                          </span>
                          {statusIcons[log.status] && (
                            <span style={{ color: statusColors[log.status] }} className="flex-shrink-0 pt-0.5">
                              {statusIcons[log.status]}
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <span className="text-[10px] font-bold text-white tracking-wider">
                              {log.action}
                            </span>
                            {log.contractType && (
                              <span className="text-[9px] font-mono text-gray-600 ml-2">
                                [{log.contractType}]
                              </span>
                            )}
                            {log.battleId && (
                              <span className="text-[9px] font-mono text-gray-600 ml-1">
                                #{log.battleId}
                              </span>
                            )}
                            <div className="text-[9px] font-mono text-gray-500 truncate">
                              {log.reasoning}
                            </div>
                            {log.txHash && (
                              <div className="text-[9px] font-mono" style={{ color: '#42c7e6' }}>
                                TX: {log.txHash.slice(0, 18)}...
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Sponsor Coverage */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                className="rounded-lg p-4"
                style={{
                  background: 'rgba(10, 10, 10, 0.95)',
                  border: '1px solid rgba(66, 199, 230, 0.2)',
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-6 rounded-full" style={{ background: '#42c7e6' }} />
                  <h4 className="text-xs font-bold tracking-widest text-white">UNISWAP V4</h4>
                </div>
                <ul className="space-y-1.5">
                  {[
                    'Direct V4 PoolManager interaction',
                    'LP position battle management',
                    'extsload pool state analysis',
                    'Auto-resolve for rewards',
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <CheckCircle size={10} style={{ color: '#42c7e6' }} />
                      <span className="text-[10px] font-mono text-gray-400">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div
                className="rounded-lg p-4"
                style={{
                  background: 'rgba(10, 10, 10, 0.95)',
                  border: '1px solid rgba(237, 127, 47, 0.2)',
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-6 rounded-full" style={{ background: '#ed7f2f' }} />
                  <h4 className="text-xs font-bold tracking-widest text-white">LI.FI</h4>
                </div>
                <ul className="space-y-1.5">
                  {[
                    'MONITOR \u2192 DECIDE \u2192 ACT loop',
                    'Live SDK route querying',
                    'Cross-chain battle entry planning',
                    'Multi-bridge route optimization',
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <CheckCircle size={10} style={{ color: '#ed7f2f' }} />
                      <span className="text-[10px] font-mono text-gray-400">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
