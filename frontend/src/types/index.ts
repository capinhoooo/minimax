import type { Address } from 'viem';

// Battle types
export interface Battle {
  id: bigint;
  creator: Address;
  opponent: Address;
  winner: Address;
  creatorTokenId: bigint;
  opponentTokenId: bigint;
  startTime: bigint;
  duration: bigint;
  totalValueUSD: bigint;
  isResolved: boolean;
  status: string;
}

export type BattleStatus =
  | 'waiting_for_opponent'
  | 'ongoing'
  | 'ready_to_resolve'
  | 'resolved';

export type BattleType = 'range' | 'fee';

// Contract type for vault selection
export type VaultType = 'range' | 'fee';

// Duration options
export interface DurationOption {
  label: string;
  value: number; // seconds
}

export const DURATION_OPTIONS: DurationOption[] = [
  { label: '1 Hour', value: 3600 },
  { label: '6 Hours', value: 21600 },
  { label: '24 Hours', value: 86400 },
  { label: '3 Days', value: 259200 },
  { label: '7 Days', value: 604800 },
];

// LP Position
export interface LPPosition {
  tokenId: bigint;
  pool: string;
  token0: Address;
  token1: Address;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  valueUSD: bigint;
  isInRange: boolean;
}

// Chain info
export interface ChainInfo {
  id: number;
  name: string;
  icon?: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

// Token info
export interface TokenInfo {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  chainId: number;
  logoURI?: string;
}

// Swap quote
export interface SwapQuote {
  fromChain: number;
  toChain: number;
  fromToken: TokenInfo;
  toToken: TokenInfo;
  fromAmount: string;
  toAmount: string;
  estimatedGas: string;
  route: unknown;
}

// Bridge transaction
export interface BridgeTransaction {
  sourceChain: string;
  destChain: string;
  amount: bigint;
  status: 'pending' | 'attesting' | 'ready' | 'completed' | 'failed';
  burnTxHash?: string;
  mintTxHash?: string;
}

// Agent status
export interface AgentStatus {
  isOnline: boolean;
  address: Address;
  balance: string;
  network: string;
  battlesMonitored: number;
  settledToday: number;
  gasUsedToday: string;
}

// Agent action log
export interface AgentAction {
  timestamp: string;
  action: string;
  battleId?: string;
  reasoning: string;
  txHash?: string;
  status: 'pending' | 'success' | 'failed';
}
