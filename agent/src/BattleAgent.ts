import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  formatUnits,
  type PublicClient,
  type WalletClient,
  type Address,
  type Hash,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import { txCollector } from './utils/txCollector.js';
import { PoolAnalyzer, type BattleAnalysis } from './analyzers/PoolAnalyzer.js';
import { CrossChainEntryAgent, type BattleEntryIntent } from './integrations/CrossChainEntryAgent.js';
import { LiFiIntegration } from './integrations/LiFiIntegration.js';

// Import ABI
import BattleArenaABI from './abis/BattleArena.json' assert { type: 'json' };

// ============ Contract Enums ============

export const BattleStatus = {
  PENDING: 0,
  ACTIVE: 1,
  EXPIRED: 2,
  RESOLVED: 3,
} as const;

export const BattleType = {
  RANGE: 0,
  FEE: 1,
} as const;

export const DexType = {
  UNISWAP_V4: 0,
  CAMELOT_V3: 1,
} as const;

const BATTLE_STATUS_NAMES = ['PENDING', 'ACTIVE', 'EXPIRED', 'RESOLVED'] as const;
const BATTLE_TYPE_NAMES = ['RANGE', 'FEE'] as const;
const DEX_TYPE_NAMES = ['UNISWAP_V4', 'CAMELOT_V3'] as const;

export function statusName(status: number): string {
  return BATTLE_STATUS_NAMES[status] ?? 'UNKNOWN';
}
export function battleTypeName(type: number): string {
  return BATTLE_TYPE_NAMES[type] ?? 'UNKNOWN';
}
export function dexTypeName(type: number): string {
  return DEX_TYPE_NAMES[type] ?? 'UNKNOWN';
}

// ============ Types ============

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

export class BattleAgent {
  private publicClient: PublicClient;
  private walletClient: WalletClient;
  private account: ReturnType<typeof privateKeyToAccount>;
  private isRunning: boolean = false;
  private poolAnalyzer: PoolAnalyzer;
  private crossChainAgent: CrossChainEntryAgent;
  private lifi: LiFiIntegration;
  private cycleCount: number = 0;
  private startedAt: number = Date.now();
  private lastMonitorResult: {
    analyses: BattleAnalysis[];
    pendingBattles: bigint[];
    expiredBattles: bigint[];
  } | null = null;
  private lastDecisions: AgentAction[] = [];
  private lastRoutes: unknown[] = [];

  constructor() {
    this.account = privateKeyToAccount(config.privateKey);

    this.publicClient = createPublicClient({
      chain: config.chain,
      transport: http(config.rpcUrl),
    });

    this.walletClient = createWalletClient({
      account: this.account,
      chain: config.chain,
      transport: http(config.rpcUrl),
    });

    this.poolAnalyzer = new PoolAnalyzer(this.publicClient);
    this.crossChainAgent = new CrossChainEntryAgent();
    this.lifi = new LiFiIntegration();

    logger.info(`Agent initialized with address: ${this.account.address}`);
  }

  // ============ Getters ============

  getAddress(): Address {
    return this.account.address;
  }

  getPublicClient(): PublicClient {
    return this.publicClient;
  }

  getPoolAnalyzer(): PoolAnalyzer {
    return this.poolAnalyzer;
  }

  getCrossChainAgent(): CrossChainEntryAgent {
    return this.crossChainAgent;
  }

  getLiFi(): LiFiIntegration {
    return this.lifi;
  }

  async getBalance(): Promise<string> {
    const balance = await this.publicClient.getBalance({
      address: this.account.address,
    });
    return formatEther(balance);
  }

  // ============ Contract Read Methods ============

  async getBattlesByStatus(status: number): Promise<bigint[]> {
    try {
      const result = await this.publicClient.readContract({
        address: config.battleArenaAddress,
        abi: BattleArenaABI,
        functionName: 'getBattlesByStatus',
        args: [status],
      }) as bigint[];
      return result;
    } catch (error) {
      logger.error(`Failed to get battles with status ${statusName(status)}`, error);
      return [];
    }
  }

  async getActiveBattles(): Promise<bigint[]> {
    return this.getBattlesByStatus(BattleStatus.ACTIVE);
  }

  async getPendingBattles(): Promise<bigint[]> {
    return this.getBattlesByStatus(BattleStatus.PENDING);
  }

  async getExpiredBattles(): Promise<bigint[]> {
    return this.getBattlesByStatus(BattleStatus.EXPIRED);
  }

  async getBattleCount(): Promise<bigint> {
    try {
      const result = await this.publicClient.readContract({
        address: config.battleArenaAddress,
        abi: BattleArenaABI,
        functionName: 'getBattleCount',
      }) as bigint;
      return result;
    } catch (error) {
      logger.error('Failed to get battle count', error);
      return 0n;
    }
  }

  async getBattlesReadyToResolve(): Promise<bigint[]> {
    // Check both ACTIVE and EXPIRED battles
    const [active, expired] = await Promise.all([
      this.getActiveBattles(),
      this.getExpiredBattles(),
    ]);

    const readyBattles: bigint[] = [...expired]; // All EXPIRED are ready

    // Check which ACTIVE battles have actually expired
    for (const battleId of active) {
      try {
        const isExpired = await this.publicClient.readContract({
          address: config.battleArenaAddress,
          abi: BattleArenaABI,
          functionName: 'isBattleExpired',
          args: [battleId],
        }) as boolean;
        if (isExpired) {
          readyBattles.push(battleId);
        }
      } catch {
        // Skip if check fails
      }
    }

    return readyBattles;
  }

  async getBattle(battleId: bigint): Promise<BattleInfo | null> {
    try {
      const result = await this.publicClient.readContract({
        address: config.battleArenaAddress,
        abi: BattleArenaABI,
        functionName: 'getBattle',
        args: [battleId],
      }) as {
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
      };

      return {
        id: battleId,
        creator: result.creator,
        opponent: result.opponent,
        winner: result.winner,
        creatorDex: Number(result.creatorDex),
        opponentDex: Number(result.opponentDex),
        creatorTokenId: result.creatorTokenId,
        opponentTokenId: result.opponentTokenId,
        creatorValueUSD: result.creatorValueUSD,
        opponentValueUSD: result.opponentValueUSD,
        battleType: Number(result.battleType),
        status: Number(result.status),
        startTime: result.startTime,
        duration: result.duration,
        token0: result.token0,
        token1: result.token1,
        creatorInRangeTime: result.creatorInRangeTime,
        opponentInRangeTime: result.opponentInRangeTime,
        lastUpdateTime: result.lastUpdateTime,
      };
    } catch (error) {
      logger.error(`Failed to get battle ${battleId}`, error);
      return null;
    }
  }

  getTimeRemaining(battle: BattleInfo): bigint {
    if (battle.status >= BattleStatus.EXPIRED) return 0n;
    if (battle.startTime === 0n) return battle.duration; // PENDING, not started
    const endTime = battle.startTime + battle.duration;
    const now = BigInt(Math.floor(Date.now() / 1000));
    return endTime > now ? endTime - now : 0n;
  }

  // ============ STRATEGY LOOP: MONITOR ============

  async monitor(): Promise<{
    analyses: BattleAnalysis[];
    pendingBattles: bigint[];
    expiredBattles: bigint[];
  }> {
    logger.info('[MONITOR] Scanning BattleArena on Arbitrum Sepolia...');

    const [activeBattles, pendingBattles, expiredBattles] = await Promise.all([
      this.getActiveBattles(),
      this.getPendingBattles(),
      this.getExpiredBattles(),
    ]);

    logger.info(`[MONITOR] Active: ${activeBattles.length} | Pending: ${pendingBattles.length} | Expired: ${expiredBattles.length}`);

    // Analyze active and expired battles
    const analyses: BattleAnalysis[] = [];
    for (const id of [...activeBattles, ...expiredBattles]) {
      const analysis = await this.poolAnalyzer.analyzeBattle(id);
      if (analysis) {
        analyses.push(analysis);
        this.poolAnalyzer.printBattleAnalysis(analysis);
      }
    }

    if (pendingBattles.length > 0) {
      logger.info(`[MONITOR] Joinable battles: ${pendingBattles.length}`);
    }

    return { analyses, pendingBattles, expiredBattles };
  }

  // ============ STRATEGY LOOP: DECIDE ============

  decide(
    analyses: BattleAnalysis[],
    pendingBattles: bigint[],
    expiredBattles: bigint[]
  ): AgentAction[] {
    const actions: AgentAction[] = [];

    logger.info('[DECIDE] Evaluating actions...');

    // Priority 1: Resolve expired battles (earns resolver reward)
    for (const analysis of analyses) {
      if (analysis.isExpired) {
        actions.push({
          type: 'resolve',
          priority: 100,
          battleId: analysis.battleId,
          battleType: analysis.battleType === 0 ? 'range' : 'fee',
          reasoning: `Battle #${analysis.battleId} expired (${battleTypeName(analysis.battleType)}) - resolve for reward`,
        });
      }
    }

    // Priority 2: Update in-range status for active range battles
    for (const analysis of analyses) {
      if (!analysis.isExpired && analysis.battleType === BattleType.RANGE && analysis.status === BattleStatus.ACTIVE) {
        actions.push({
          type: 'update_status',
          priority: 50,
          battleId: analysis.battleId,
          battleType: 'range',
          reasoning: `Update in-range tracking for battle #${analysis.battleId}`,
        });
      }
    }

    // Priority 3: Analyze pending battles for cross-chain entry
    for (const id of pendingBattles) {
      actions.push({
        type: 'analyze',
        priority: 30,
        battleId: id,
        reasoning: `Pending battle #${id} - evaluate for entry opportunity`,
      });
    }

    // Sort by priority (highest first)
    actions.sort((a, b) => b.priority - a.priority);

    if (actions.length === 0) {
      logger.info('[DECIDE] No actions needed this cycle');
    } else {
      logger.info(`[DECIDE] ${actions.length} actions planned:`);
      actions.forEach((a, i) => {
        logger.info(`  ${i + 1}. [${a.type.toUpperCase()}] ${a.reasoning}`);
      });
    }

    return actions;
  }

  // ============ STRATEGY LOOP: ACT ============

  async act(actions: AgentAction[]): Promise<void> {
    for (const action of actions) {
      logger.info(`[ACT] Executing: ${action.type} - ${action.reasoning}`);

      switch (action.type) {
        case 'resolve':
          if (action.battleId !== undefined) {
            await this.settleBattle(action.battleId);
          }
          break;

        case 'update_status':
          if (action.battleId !== undefined) {
            await this.updateBattleStatus(action.battleId);
          }
          break;

        case 'analyze':
          logger.logAction({
            timestamp: new Date().toISOString(),
            action: 'ANALYZE_OPPORTUNITY',
            battleId: action.battleId?.toString(),
            reasoning: action.reasoning,
            status: 'success',
          });
          break;

        case 'cross_chain_entry':
          logger.logAction({
            timestamp: new Date().toISOString(),
            action: 'CROSS_CHAIN_ENTRY',
            reasoning: action.reasoning,
            inputs: action.data,
            status: 'pending',
          });
          break;
      }
    }
  }

  // ============ Full Strategy Loop ============

  async runStrategyCycle(): Promise<void> {
    this.cycleCount++;
    const C = { cyan: '\x1b[36m', reset: '\x1b[0m', gray: '\x1b[90m' };
    console.log(`\n${C.cyan}${'='.repeat(70)}${C.reset}`);
    console.log(`${C.cyan}  STRATEGY CYCLE #${this.cycleCount}  ${C.gray}${new Date().toISOString()}${C.reset}`);
    console.log(`${C.cyan}${'='.repeat(70)}${C.reset}`);

    try {
      // MONITOR
      const monitorResult = await this.monitor();
      this.lastMonitorResult = monitorResult;

      // DECIDE
      const actions = this.decide(monitorResult.analyses, monitorResult.pendingBattles, monitorResult.expiredBattles);
      this.lastDecisions = actions;

      // ACT
      await this.act(actions);
    } catch (error) {
      logger.error('Strategy cycle error', error);
    }
  }

  // ============ Cross-Chain Entry via LI.FI ============

  async getCrossChainRoutes(intent: BattleEntryIntent) {
    logger.info('[LIFI] Analyzing cross-chain routes...');

    const validation = await this.crossChainAgent.analyzeIntent(intent);
    if (!validation.isValid) {
      logger.error('[LIFI] Invalid intent:', validation.issues);
      return null;
    }

    for (const rec of validation.recommendations) {
      logger.info(`[LIFI] Recommendation: ${rec}`);
    }

    const routes = await this.crossChainAgent.getRouteOptions(intent);

    if (routes.length === 0) {
      logger.warn('[LIFI] No routes found');
      return null;
    }

    logger.info(`[LIFI] Found ${routes.length} route options:`);
    routes.forEach((r, i) => {
      const tag = r.recommended ? ' (RECOMMENDED)' : '';
      logger.info(`  ${i + 1}. ${r.method}${tag} - ${r.estimatedTime} - ${r.fees}`);
    });

    return routes;
  }

  async planCrossChainEntry(intent: BattleEntryIntent) {
    const routes = await this.getCrossChainRoutes(intent);
    if (!routes || routes.length === 0) return null;

    const recommended = routes.find(r => r.recommended) || routes[0];
    const plan = await this.crossChainAgent.createExecutionPlan(intent, recommended);

    this.crossChainAgent.printExecutionPlan(plan);

    return plan;
  }

  // ============ Transaction Methods ============

  async settleBattle(battleId: bigint): Promise<Hash | null> {
    const battle = await this.getBattle(battleId);
    if (!battle) {
      logger.error(`Cannot settle - battle ${battleId} not found`);
      return null;
    }

    logger.logAction({
      timestamp: new Date().toISOString(),
      action: 'SETTLE_BATTLE',
      battleId: battleId.toString(),
      contractType: battleTypeName(battle.battleType),
      reasoning: `Battle duration elapsed. Status: ${statusName(battle.status)}. Creator: ${battle.creator.slice(0, 10)}... vs Opponent: ${battle.opponent.slice(0, 10)}...`,
      inputs: {
        battleId: battleId.toString(),
        creator: battle.creator,
        opponent: battle.opponent,
        startTime: battle.startTime.toString(),
        duration: battle.duration.toString(),
      },
      status: 'pending',
    });

    try {
      const { request } = await this.publicClient.simulateContract({
        account: this.account,
        address: config.battleArenaAddress,
        abi: BattleArenaABI,
        functionName: 'resolveBattle',
        args: [battleId],
      });

      const hash = await this.walletClient.writeContract(request);
      logger.info(`Transaction submitted: ${hash}`);

      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

      const updatedBattle = await this.getBattle(battleId);

      txCollector.record({
        hash,
        description: `Resolve battle #${battleId} (${battleTypeName(battle.battleType)})`,
        chain: 'Arbitrum Sepolia',
        chainId: 421614,
        type: 'resolve',
        timestamp: Date.now(),
        gasUsed: receipt.gasUsed.toString(),
        blockNumber: Number(receipt.blockNumber),
        from: this.account.address,
        to: config.battleArenaAddress,
      });

      logger.logAction({
        timestamp: new Date().toISOString(),
        action: 'SETTLE_BATTLE',
        battleId: battleId.toString(),
        contractType: battleTypeName(battle.battleType),
        reasoning: `Battle ${battleId} settled successfully. Winner: ${updatedBattle?.winner || 'unknown'}`,
        outputs: {
          winner: updatedBattle?.winner,
          blockNumber: receipt.blockNumber.toString(),
        },
        txHash: hash,
        gasUsed: receipt.gasUsed.toString(),
        status: 'success',
      });

      logger.success(`Battle ${battleId} settled! Winner: ${updatedBattle?.winner}`);
      logger.info(`TX: https://sepolia.arbiscan.io/tx/${hash}`);

      return hash;
    } catch (error) {
      logger.logAction({
        timestamp: new Date().toISOString(),
        action: 'SETTLE_BATTLE',
        battleId: battleId.toString(),
        contractType: battleTypeName(battle.battleType),
        reasoning: `Failed to settle battle: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status: 'failed',
      });

      logger.error(`Failed to settle battle ${battleId}`, error);
      return null;
    }
  }

  async updateBattleStatus(battleId: bigint): Promise<Hash | null> {
    try {
      const { request } = await this.publicClient.simulateContract({
        account: this.account,
        address: config.battleArenaAddress,
        abi: BattleArenaABI,
        functionName: 'updateBattleStatus',
        args: [battleId],
      });

      const hash = await this.walletClient.writeContract(request);
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

      txCollector.record({
        hash,
        description: `Update in-range status for battle #${battleId}`,
        chain: 'Arbitrum Sepolia',
        chainId: 421614,
        type: 'update',
        timestamp: Date.now(),
        gasUsed: receipt.gasUsed.toString(),
        blockNumber: Number(receipt.blockNumber),
        from: this.account.address,
        to: config.battleArenaAddress,
      });

      logger.logAction({
        timestamp: new Date().toISOString(),
        action: 'UPDATE_BATTLE_STATUS',
        battleId: battleId.toString(),
        reasoning: 'Updated in-range time tracking for active battle',
        txHash: hash,
        gasUsed: receipt.gasUsed.toString(),
        status: 'success',
      });

      return hash;
    } catch (error) {
      logger.debug(`Failed to update battle status for ${battleId}`, error);
      return null;
    }
  }

  // ============ Monitoring Loop ============

  async startMonitoring(): Promise<void> {
    this.isRunning = true;
    logger.info('Starting autonomous strategy loop...');

    const balance = await this.getBalance();
    logger.info(`Agent balance: ${balance} ETH`);

    while (this.isRunning) {
      try {
        await this.runStrategyCycle();
      } catch (error) {
        logger.error('Error in strategy cycle', error);
      }

      await this.sleep(config.pollIntervalMs);
    }
  }

  stopMonitoring(): void {
    this.isRunning = false;
    logger.info('Stopping agent...');
    logger.printSummary();
    txCollector.printSummary();
  }

  // Legacy method for backward compat
  async checkAndSettleBattles(): Promise<void> {
    await this.runStrategyCycle();
  }

  // ============ Status Display ============

  async printStatus(): Promise<void> {
    const C = {
      reset: '\x1b[0m',
      cyan: '\x1b[36m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      gray: '\x1b[90m',
      blue: '\x1b[34m',
    };

    console.log(`\n${C.cyan}${'='.repeat(70)}${C.reset}`);
    console.log(`${C.cyan}  MINIMAX LP BATTLEVAULT - AUTONOMOUS AGENT${C.reset}`);
    console.log(`${C.cyan}${'='.repeat(70)}${C.reset}`);

    console.log(`\n  ${C.blue}Agent${C.reset}`);
    console.log(`    Address:  ${this.account.address}`);
    console.log(`    Balance:  ${await this.getBalance()} ETH`);
    console.log(`    Network:  ${config.chain.name} (${config.chainId})`);
    console.log(`    Cycles:   ${this.cycleCount}`);

    console.log(`\n  ${C.blue}BattleArena${C.reset} ${C.gray}${config.battleArenaAddress}${C.reset}`);

    const [activeBattles, pendingBattles, battleCount] = await Promise.all([
      this.getActiveBattles(),
      this.getPendingBattles(),
      this.getBattleCount(),
    ]);

    console.log(`    Total Battles:   ${battleCount}`);
    console.log(`    Active Battles:  ${activeBattles.length}`);
    console.log(`    Pending Battles: ${pendingBattles.length}`);

    for (const id of activeBattles) {
      const battle = await this.getBattle(id);
      if (battle) {
        const timeRem = this.getTimeRemaining(battle);
        const typeName = battleTypeName(battle.battleType);
        const totalValue = formatUnits(battle.creatorValueUSD + battle.opponentValueUSD, 8);
        console.log(`    Battle #${id}: ${C.green}ACTIVE${C.reset} | ${typeName} | ${totalValue} USD | ${Number(timeRem)}s remaining`);
      }
    }

    for (const id of pendingBattles) {
      const battle = await this.getBattle(id);
      if (battle) {
        const typeName = battleTypeName(battle.battleType);
        const dex = dexTypeName(battle.creatorDex);
        console.log(`    Battle #${id}: ${C.yellow}PENDING${C.reset} | ${typeName} | ${dex} | Creator: ${battle.creator.slice(0, 12)}...`);
      }
    }

    // Show TX evidence if any
    if (txCollector.count() > 0) {
      txCollector.printSummary();
    }

    console.log(`\n${C.cyan}${'='.repeat(70)}${C.reset}\n`);
  }

  // ============ State Exposure (for API) ============

  getCycleCount(): number {
    return this.cycleCount;
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }

  getStartedAt(): number {
    return this.startedAt;
  }

  getLastMonitorResult() {
    return this.lastMonitorResult;
  }

  getLastDecisions(): AgentAction[] {
    return this.lastDecisions;
  }

  getLastRoutes(): unknown[] {
    return this.lastRoutes;
  }

  setLastRoutes(routes: unknown[]): void {
    this.lastRoutes = routes;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
