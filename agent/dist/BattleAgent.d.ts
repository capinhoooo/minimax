import { type PublicClient, type Address, type Hash } from 'viem';
import { PoolAnalyzer, type BattleAnalysis } from './analyzers/PoolAnalyzer.js';
import { CrossChainEntryAgent, type BattleEntryIntent } from './integrations/CrossChainEntryAgent.js';
import { LiFiIntegration } from './integrations/LiFiIntegration.js';
export declare const BattleStatus: {
    readonly PENDING: 0;
    readonly ACTIVE: 1;
    readonly EXPIRED: 2;
    readonly RESOLVED: 3;
};
export declare const BattleType: {
    readonly RANGE: 0;
    readonly FEE: 1;
};
export declare const DexType: {
    readonly UNISWAP_V4: 0;
    readonly CAMELOT_V3: 1;
};
export declare function statusName(status: number): string;
export declare function battleTypeName(type: number): string;
export declare function dexTypeName(type: number): string;
export interface BattleInfo {
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
}
export interface AgentAction {
    type: 'resolve' | 'update_status' | 'analyze' | 'cross_chain_entry';
    priority: number;
    battleId?: bigint;
    battleType?: 'range' | 'fee';
    reasoning: string;
    data?: Record<string, unknown>;
}
export declare class BattleAgent {
    private publicClient;
    private walletClient;
    private account;
    private isRunning;
    private poolAnalyzer;
    private crossChainAgent;
    private lifi;
    private cycleCount;
    private startedAt;
    private lastMonitorResult;
    private lastDecisions;
    private lastRoutes;
    constructor();
    getAddress(): Address;
    getPublicClient(): PublicClient;
    getPoolAnalyzer(): PoolAnalyzer;
    getCrossChainAgent(): CrossChainEntryAgent;
    getLiFi(): LiFiIntegration;
    getBalance(): Promise<string>;
    getBattlesByStatus(status: number): Promise<bigint[]>;
    getActiveBattles(): Promise<bigint[]>;
    getPendingBattles(): Promise<bigint[]>;
    getExpiredBattles(): Promise<bigint[]>;
    getBattleCount(): Promise<bigint>;
    getBattlesReadyToResolve(): Promise<bigint[]>;
    getBattle(battleId: bigint): Promise<BattleInfo | null>;
    getTimeRemaining(battle: BattleInfo): bigint;
    monitor(): Promise<{
        analyses: BattleAnalysis[];
        pendingBattles: bigint[];
        expiredBattles: bigint[];
    }>;
    decide(analyses: BattleAnalysis[], pendingBattles: bigint[], expiredBattles: bigint[]): AgentAction[];
    act(actions: AgentAction[]): Promise<void>;
    runStrategyCycle(): Promise<void>;
    getCrossChainRoutes(intent: BattleEntryIntent): Promise<import("./integrations/CrossChainEntryAgent.js").RouteOption[] | null>;
    planCrossChainEntry(intent: BattleEntryIntent): Promise<import("./integrations/CrossChainEntryAgent.js").ExecutionPlan | null>;
    settleBattle(battleId: bigint): Promise<Hash | null>;
    updateBattleStatus(battleId: bigint): Promise<Hash | null>;
    startMonitoring(): Promise<void>;
    stopMonitoring(): void;
    checkAndSettleBattles(): Promise<void>;
    printStatus(): Promise<void>;
    getCycleCount(): number;
    getIsRunning(): boolean;
    getStartedAt(): number;
    getLastMonitorResult(): {
        analyses: BattleAnalysis[];
        pendingBattles: bigint[];
        expiredBattles: bigint[];
    } | null;
    getLastDecisions(): AgentAction[];
    getLastRoutes(): unknown[];
    setLastRoutes(routes: unknown[]): void;
    private sleep;
}
