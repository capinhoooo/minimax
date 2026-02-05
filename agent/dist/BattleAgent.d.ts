import { type Address, type Hash } from 'viem';
export interface BattleInfo {
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
export interface BattlePerformance {
    creatorInRange: boolean;
    opponentInRange: boolean;
    creatorInRangeTime: bigint;
    opponentInRangeTime: bigint;
    currentLeader: Address;
}
export declare class BattleAgent {
    private publicClient;
    private walletClient;
    private account;
    private isRunning;
    constructor();
    getAddress(): Address;
    getBalance(): Promise<string>;
    getActiveBattles(contractType?: 'range' | 'fee'): Promise<bigint[]>;
    getBattlesReadyToResolve(contractType?: 'range' | 'fee'): Promise<bigint[]>;
    getBattle(battleId: bigint, contractType?: 'range' | 'fee'): Promise<BattleInfo | null>;
    getBattleStatus(battleId: bigint, contractType?: 'range' | 'fee'): Promise<string>;
    getTimeRemaining(battleId: bigint, contractType?: 'range' | 'fee'): Promise<bigint>;
    settleBattle(battleId: bigint, contractType?: 'range' | 'fee'): Promise<Hash | null>;
    updateBattleStatus(battleId: bigint): Promise<Hash | null>;
    startMonitoring(): Promise<void>;
    stopMonitoring(): void;
    checkAndSettleBattles(): Promise<void>;
    printStatus(): Promise<void>;
    private sleep;
}
