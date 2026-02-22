import type { Address } from 'viem';

// ============ Contract Enums ============

// BattleStatus: PENDING=0, ACTIVE=1, EXPIRED=2, RESOLVED=3
export const BattleStatus = {
  PENDING: 0,
  ACTIVE: 1,
  EXPIRED: 2,
  RESOLVED: 3,
} as const;
export type BattleStatus = (typeof BattleStatus)[keyof typeof BattleStatus];

// BattleType: RANGE=0, FEE=1
export const BattleType = {
  RANGE: 0,
  FEE: 1,
} as const;
export type BattleType = (typeof BattleType)[keyof typeof BattleType];

// DexType: UNISWAP_V4=0, CAMELOT_V3=1
export const DexType = {
  UNISWAP_V4: 0,
  CAMELOT_V3: 1,
} as const;
export type DexType = (typeof DexType)[keyof typeof DexType];

// ============ Battle Data ============

export interface Battle {
  id: bigint;
  creator: Address;
  opponent: Address;
  winner: Address;
  creatorDex: number;
  opponentDex: number;
  creatorTokenId: bigint;
  opponentTokenId: bigint;
  creatorValueUSD: bigint;
  opponentValueUSD: bigint;
  battleType: number;
  status: number;
  startTime: bigint;
  duration: bigint;
  token0: Address;
  token1: Address;
  creatorInRangeTime: bigint;
  opponentInRangeTime: bigint;
  lastUpdateTime: bigint;
  creatorStartFeeGrowth0: bigint;
  creatorStartFeeGrowth1: bigint;
  opponentStartFeeGrowth0: bigint;
  opponentStartFeeGrowth1: bigint;
  creatorLiquidity: bigint;
  opponentLiquidity: bigint;
}

// Duration options
export interface DurationOption {
  label: string;
  value: number; // seconds
}

export const DURATION_OPTIONS: DurationOption[] = [
  { label: '5 Minutes', value: 300 },
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

// ============ Helper Functions ============

export function statusName(status: number): string {
  switch (status) {
    case BattleStatus.PENDING: return 'Pending';
    case BattleStatus.ACTIVE: return 'Active';
    case BattleStatus.EXPIRED: return 'Expired';
    case BattleStatus.RESOLVED: return 'Resolved';
    default: return 'Unknown';
  }
}

export function battleTypeName(battleType: number): string {
  switch (battleType) {
    case BattleType.RANGE: return 'Range Battle';
    case BattleType.FEE: return 'Fee Battle';
    default: return 'Unknown';
  }
}

export function dexTypeName(dexType: number): string {
  switch (dexType) {
    case DexType.UNISWAP_V4: return 'Uniswap V4';
    case DexType.CAMELOT_V3: return 'Camelot V3';
    default: return 'Unknown';
  }
}
