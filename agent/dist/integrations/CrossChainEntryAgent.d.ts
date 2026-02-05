/**
 * Cross-Chain Entry Agent
 *
 * Combines LI.FI and Arc integrations to provide seamless cross-chain
 * battle entry from any EVM chain with any token.
 *
 * Strategy Loop: Monitor → Decide → Act
 * - Monitor: User intents from any chain
 * - Decide: Optimal route (LI.FI direct vs Arc CCTP)
 * - Act: Execute cross-chain transfer and LP position creation
 */
import { ArcIntegration } from './ArcIntegration.js';
import type { Route } from '@lifi/sdk';
export interface BattleEntryIntent {
    userAddress: `0x${string}`;
    sourceChain: number;
    sourceToken: string;
    amount: bigint;
    targetPool: {
        chainId: number;
        token0: string;
        token1: string;
        tickLower: number;
        tickUpper: number;
    };
    battleId?: bigint;
    duration?: number;
}
export interface RouteOption {
    method: 'lifi_direct' | 'arc_cctp' | 'lifi_bridge_then_swap';
    estimatedTime: string;
    estimatedOutput: string;
    fees: string;
    steps: number;
    recommended: boolean;
    details: {
        route?: Route;
        bridgeInstructions?: ReturnType<ArcIntegration['getBridgeInstructions']>;
    };
}
export interface ExecutionPlan {
    intent: BattleEntryIntent;
    selectedRoute: RouteOption;
    transactions: Array<{
        step: number;
        action: string;
        chainId: number;
        to: string;
        data?: string;
        value?: string;
        description: string;
    }>;
    estimatedTotalGas: string;
}
export declare class CrossChainEntryAgent {
    private lifi;
    private arc;
    constructor();
    /**
     * STRATEGY LOOP: MONITOR
     * Analyze user intent and current market conditions
     */
    analyzeIntent(intent: BattleEntryIntent): Promise<{
        isValid: boolean;
        issues: string[];
        recommendations: string[];
    }>;
    /**
     * STRATEGY LOOP: DECIDE
     * Determine the best route for cross-chain entry
     */
    getRouteOptions(intent: BattleEntryIntent): Promise<RouteOption[]>;
    /**
     * STRATEGY LOOP: ACT
     * Create execution plan for the selected route
     */
    createExecutionPlan(intent: BattleEntryIntent, selectedRoute: RouteOption): Promise<ExecutionPlan>;
    /**
     * Print execution plan summary
     */
    printExecutionPlan(plan: ExecutionPlan): void;
    private getChainName;
    private isUSDCToken;
    private estimateFees;
    private estimateTotalGas;
}
