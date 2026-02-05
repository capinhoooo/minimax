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

import { LiFiIntegration, SUPPORTED_CHAINS, TOKENS } from './LiFiIntegration.js';
import { ArcIntegration, CCTP_CONTRACTS, type SupportedChain } from './ArcIntegration.js';
import { logger } from '../utils/logger.js';
import type { Route } from '@lifi/sdk';

export interface BattleEntryIntent {
  userAddress: `0x${string}`;
  sourceChain: number;           // Chain ID where user has funds
  sourceToken: string;           // Token address on source chain
  amount: bigint;                // Amount in source token decimals
  targetPool: {
    chainId: number;             // Destination chain (where battle is)
    token0: string;              // Pool token0
    token1: string;              // Pool token1
    tickLower: number;
    tickUpper: number;
  };
  battleId?: bigint;             // If joining existing battle
  duration?: number;             // Battle duration in seconds (if creating)
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

export class CrossChainEntryAgent {
  private lifi: LiFiIntegration;
  private arc: ArcIntegration;

  constructor() {
    this.lifi = new LiFiIntegration();
    this.arc = new ArcIntegration();
    logger.info('CrossChainEntryAgent initialized');
  }

  /**
   * STRATEGY LOOP: MONITOR
   * Analyze user intent and current market conditions
   */
  async analyzeIntent(intent: BattleEntryIntent): Promise<{
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Validate source chain is supported
    const sourceChainName = this.getChainName(intent.sourceChain);
    if (!sourceChainName) {
      issues.push(`Source chain ${intent.sourceChain} not supported`);
    }

    // Validate target chain is supported
    const targetChainName = this.getChainName(intent.targetPool.chainId);
    if (!targetChainName) {
      issues.push(`Target chain ${intent.targetPool.chainId} not supported`);
    }

    // Check if amount is reasonable
    if (intent.amount < BigInt(10e6)) {
      recommendations.push('Amount is small, fees may be significant percentage');
    }

    // Check if USDC is available for Arc CCTP
    const isUSDCSource = this.isUSDCToken(intent.sourceChain, intent.sourceToken);
    if (isUSDCSource) {
      recommendations.push('USDC detected - Arc CCTP available for fast native bridging');
    }

    // Same chain doesn't need bridging
    if (intent.sourceChain === intent.targetPool.chainId) {
      recommendations.push('Same chain - no bridging needed, just swap');
    }

    return {
      isValid: issues.length === 0,
      issues,
      recommendations,
    };
  }

  /**
   * STRATEGY LOOP: DECIDE
   * Determine the best route for cross-chain entry
   */
  async getRouteOptions(intent: BattleEntryIntent): Promise<RouteOption[]> {
    const options: RouteOption[] = [];

    logger.logAction({
      timestamp: new Date().toISOString(),
      action: 'ANALYZE_ROUTES',
      reasoning: `Finding optimal routes from chain ${intent.sourceChain} to chain ${intent.targetPool.chainId}`,
      inputs: {
        sourceChain: intent.sourceChain,
        targetChain: intent.targetPool.chainId,
        amount: intent.amount.toString(),
      },
      status: 'pending',
    });

    // Option 1: LI.FI Direct (swap + bridge in one)
    try {
      const routes = await this.lifi.getSwapRoutes(
        intent.sourceChain,
        intent.targetPool.chainId,
        intent.sourceToken,
        intent.targetPool.token1, // Bridge to one of the LP tokens first
        intent.amount.toString(),
        intent.userAddress
      );

      if (routes.length > 0) {
        const bestRoute = routes[0];
        options.push({
          method: 'lifi_direct',
          estimatedTime: '5-15 minutes',
          estimatedOutput: this.lifi.formatAmount(bestRoute.toAmount, 6),
          fees: this.estimateFees(bestRoute),
          steps: bestRoute.steps.length,
          recommended: true,
          details: { route: bestRoute },
        });
      }
    } catch (error) {
      logger.debug('LI.FI direct route not available', error);
    }

    // Option 2: Arc CCTP (if source is USDC)
    const isUSDC = this.isUSDCToken(intent.sourceChain, intent.sourceToken);
    if (isUSDC) {
      const sourceChainName = this.getChainName(intent.sourceChain) as SupportedChain;
      const targetChainName = this.getChainName(intent.targetPool.chainId) as SupportedChain;

      if (sourceChainName && targetChainName) {
        const bridgeInstructions = this.arc.getBridgeInstructions({
          sourceChain: sourceChainName,
          destChain: targetChainName,
          amount: intent.amount,
          recipient: intent.userAddress,
        });

        options.push({
          method: 'arc_cctp',
          estimatedTime: '15-20 minutes',
          estimatedOutput: this.arc.formatUSDC(intent.amount),
          fees: '~$0.50-1.00 (gas only)',
          steps: bridgeInstructions.steps.length,
          recommended: false,
          details: { bridgeInstructions },
        });
      }
    }

    // Sort by recommendation
    options.sort((a, b) => (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0));

    logger.logAction({
      timestamp: new Date().toISOString(),
      action: 'ANALYZE_ROUTES',
      reasoning: `Found ${options.length} route options`,
      outputs: {
        options: options.map(o => ({ method: o.method, time: o.estimatedTime, recommended: o.recommended })),
      },
      status: 'success',
    });

    return options;
  }

  /**
   * STRATEGY LOOP: ACT
   * Create execution plan for the selected route
   */
  async createExecutionPlan(
    intent: BattleEntryIntent,
    selectedRoute: RouteOption
  ): Promise<ExecutionPlan> {
    const transactions: ExecutionPlan['transactions'] = [];
    let stepNum = 0;

    logger.logAction({
      timestamp: new Date().toISOString(),
      action: 'CREATE_EXECUTION_PLAN',
      reasoning: `Building execution plan using ${selectedRoute.method}`,
      inputs: {
        method: selectedRoute.method,
        sourceChain: intent.sourceChain,
        targetChain: intent.targetPool.chainId,
      },
      status: 'pending',
    });

    if (selectedRoute.method === 'lifi_direct' && selectedRoute.details.route) {
      // LI.FI handles the cross-chain swap
      const route = selectedRoute.details.route;

      for (const step of route.steps) {
        stepNum++;
        transactions.push({
          step: stepNum,
          action: step.type,
          chainId: step.action.fromChainId,
          to: step.action.fromAddress || '',
          description: `${step.type}: ${step.tool} - ${step.action.fromToken.symbol} → ${step.action.toToken.symbol}`,
        });
      }
    } else if (selectedRoute.method === 'arc_cctp' && selectedRoute.details.bridgeInstructions) {
      // Arc CCTP bridge steps
      const sourceChainName = this.getChainName(intent.sourceChain) as SupportedChain;
      const targetChainName = this.getChainName(intent.targetPool.chainId) as SupportedChain;

      // Approve
      stepNum++;
      const approveData = this.arc.prepareApproveData(sourceChainName, intent.amount);
      transactions.push({
        step: stepNum,
        action: 'approve',
        chainId: intent.sourceChain,
        to: approveData.to,
        data: approveData.data,
        description: 'Approve USDC for TokenMessenger',
      });

      // Burn
      stepNum++;
      const burnData = this.arc.prepareDepositForBurnData({
        sourceChain: sourceChainName,
        destChain: targetChainName,
        amount: intent.amount,
        recipient: intent.userAddress,
      });
      transactions.push({
        step: stepNum,
        action: 'depositForBurn',
        chainId: intent.sourceChain,
        to: burnData.to,
        data: burnData.data,
        description: 'Burn USDC on source chain',
      });

      // Wait for attestation (not a transaction)
      stepNum++;
      transactions.push({
        step: stepNum,
        action: 'waitForAttestation',
        chainId: 0,
        to: '',
        description: 'Wait for Circle attestation (~15 min)',
      });

      // Mint
      stepNum++;
      transactions.push({
        step: stepNum,
        action: 'receiveMessage',
        chainId: intent.targetPool.chainId,
        to: CCTP_CONTRACTS[targetChainName].messageTransmitter,
        description: 'Mint USDC on destination chain',
      });
    }

    // Add LP token swap step (USDC → WETH for half)
    stepNum++;
    transactions.push({
      step: stepNum,
      action: 'swap',
      chainId: intent.targetPool.chainId,
      to: 'LI.FI Router',
      description: 'Swap 50% USDC → WETH for LP position',
    });

    // Add liquidity step
    stepNum++;
    transactions.push({
      step: stepNum,
      action: 'addLiquidity',
      chainId: intent.targetPool.chainId,
      to: 'Uniswap V4 PositionManager',
      description: `Add liquidity at ticks [${intent.targetPool.tickLower}, ${intent.targetPool.tickUpper}]`,
    });

    // Enter battle step
    stepNum++;
    transactions.push({
      step: stepNum,
      action: intent.battleId ? 'joinBattle' : 'createBattle',
      chainId: intent.targetPool.chainId,
      to: 'LPBattleVaultV4',
      description: intent.battleId
        ? `Join battle #${intent.battleId}`
        : `Create new battle (${intent.duration || 86400}s duration)`,
    });

    const plan: ExecutionPlan = {
      intent,
      selectedRoute,
      transactions,
      estimatedTotalGas: this.estimateTotalGas(transactions),
    };

    logger.logAction({
      timestamp: new Date().toISOString(),
      action: 'CREATE_EXECUTION_PLAN',
      reasoning: `Execution plan created with ${transactions.length} steps`,
      outputs: {
        totalSteps: transactions.length,
        estimatedGas: plan.estimatedTotalGas,
      },
      status: 'success',
    });

    return plan;
  }

  /**
   * Print execution plan summary
   */
  printExecutionPlan(plan: ExecutionPlan): void {
    console.log('\n' + '═'.repeat(70));
    console.log('CROSS-CHAIN BATTLE ENTRY EXECUTION PLAN');
    console.log('═'.repeat(70));

    console.log('\n📋 Intent:');
    console.log(`   From: Chain ${plan.intent.sourceChain}`);
    console.log(`   To: Chain ${plan.intent.targetPool.chainId}`);
    console.log(`   Amount: ${plan.intent.amount.toString()}`);

    console.log('\n🛤️  Selected Route:');
    console.log(`   Method: ${plan.selectedRoute.method}`);
    console.log(`   Time: ${plan.selectedRoute.estimatedTime}`);
    console.log(`   Output: ${plan.selectedRoute.estimatedOutput}`);
    console.log(`   Fees: ${plan.selectedRoute.fees}`);

    console.log('\n📝 Transactions:');
    plan.transactions.forEach((tx) => {
      const chainLabel = tx.chainId === 0 ? '⏳' : `[${tx.chainId}]`;
      console.log(`   ${tx.step}. ${chainLabel} ${tx.action}`);
      console.log(`      ${tx.description}`);
    });

    console.log(`\n⛽ Estimated Total Gas: ${plan.estimatedTotalGas}`);
    console.log('═'.repeat(70) + '\n');
  }

  // Helper methods

  private getChainName(chainId: number): SupportedChain | null {
    const chainMap: Record<number, SupportedChain> = {
      1: 'ETHEREUM',
      42161: 'ARBITRUM',
      8453: 'BASE',
      137: 'POLYGON',
      10: 'OPTIMISM',
      11155111: 'SEPOLIA',
      84532: 'BASE_SEPOLIA',
      421614: 'ARBITRUM_SEPOLIA',
    };
    return chainMap[chainId] || null;
  }

  private isUSDCToken(chainId: number, tokenAddress: string): boolean {
    const usdcAddresses: Record<number, string> = {
      1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      137: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
      10: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
      11155111: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    };
    return usdcAddresses[chainId]?.toLowerCase() === tokenAddress.toLowerCase();
  }

  private estimateFees(route: Route): string {
    let totalFees = 0;
    for (const step of route.steps) {
      if (step.estimate?.feeCosts) {
        for (const fee of step.estimate.feeCosts) {
          totalFees += parseFloat(fee.amountUSD || '0');
        }
      }
    }
    return `~$${totalFees.toFixed(2)}`;
  }

  private estimateTotalGas(transactions: ExecutionPlan['transactions']): string {
    // Rough estimates per action
    const gasEstimates: Record<string, number> = {
      approve: 50000,
      depositForBurn: 150000,
      receiveMessage: 200000,
      swap: 200000,
      addLiquidity: 300000,
      createBattle: 200000,
      joinBattle: 150000,
    };

    let totalGas = 0;
    for (const tx of transactions) {
      if (tx.action !== 'waitForAttestation') {
        totalGas += gasEstimates[tx.action] || 100000;
      }
    }

    return `~${(totalGas / 1000000).toFixed(2)}M gas`;
  }
}
