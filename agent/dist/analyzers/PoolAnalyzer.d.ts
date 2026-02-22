/**
 * Pool State Analyzer for BattleArena
 *
 * Reads V4 pool state directly from PoolManager via extsload.
 * Analyzes battle state from the unified BattleArena contract
 * to score battles and recommend strategies.
 */
import { type PublicClient } from 'viem';
export interface PoolState {
    sqrtPriceX96: bigint;
    tick: number;
    protocolFee: number;
    lpFee: number;
}
export interface PositionAnalysis {
    isInRange: boolean;
    tickDistance: number;
    rangeWidth: number;
    positionInRange: number;
}
export interface BattleAnalysis {
    battleId: bigint;
    battleType: number;
    status: number;
    isExpired: boolean;
    timeRemaining: bigint;
    creatorScore: number;
    opponentScore: number;
    currentLeader: string;
    creatorDex: string;
    opponentDex: string;
    poolState?: PoolState;
    recommendation: string;
}
export declare class PoolAnalyzer {
    private publicClient;
    constructor(publicClient: PublicClient);
    private computePoolSlot0;
    getPoolState(poolId: `0x${string}`): Promise<PoolState | null>;
    getPoolLiquidity(poolId: `0x${string}`): Promise<bigint | null>;
    isPositionInRange(currentTick: number, tickLower: number, tickUpper: number): boolean;
    analyzePosition(currentTick: number, tickLower: number, tickUpper: number): PositionAnalysis;
    sqrtPriceToPrice(sqrtPriceX96: bigint, decimals0?: number, decimals1?: number): number;
    /**
     * Analyze any battle from the BattleArena contract
     */
    analyzeBattle(battleId: bigint): Promise<BattleAnalysis | null>;
    /**
     * Score a battle's attractiveness for entry (0-100)
     */
    scoreBattleForEntry(analysis: BattleAnalysis): number;
    printPoolState(poolId: string, state: PoolState): void;
    printBattleAnalysis(analysis: BattleAnalysis): void;
}
