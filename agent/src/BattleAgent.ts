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

// Import ABIs
import RangeVaultABI from './abis/LPBattleVaultV4.json' assert { type: 'json' };
import FeeVaultABI from './abis/LPFeeBattleV4.json' assert { type: 'json' };

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

// ============ Strategy Action Types ============

export interface AgentAction {
  type: 'resolve' | 'update_status' | 'analyze' | 'cross_chain_entry';
  priority: number; // higher = more urgent
  battleId?: bigint;
  vaultType?: 'range' | 'fee';
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
    rangeAnalyses: BattleAnalysis[];
    feeAnalyses: BattleAnalysis[];
    pendingBattles: { range: bigint[]; fee: bigint[] };
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

  async getActiveBattles(contractType: 'range' | 'fee' = 'range'): Promise<bigint[]> {
    const address = contractType === 'range' ? config.rangeVaultAddress : config.feeVaultAddress;
    const abi = contractType === 'range' ? RangeVaultABI : FeeVaultABI;

    try {
      const result = await this.publicClient.readContract({
        address,
        abi,
        functionName: 'getActiveBattles',
      }) as bigint[];
      return result;
    } catch (error) {
      logger.error(`Failed to get active battles from ${contractType} vault`, error);
      return [];
    }
  }

  async getBattlesReadyToResolve(contractType: 'range' | 'fee' = 'range'): Promise<bigint[]> {
    const activeBattles = await this.getActiveBattles(contractType);
    const readyBattles: bigint[] = [];

    for (const battleId of activeBattles) {
      const battle = await this.getBattle(battleId, contractType);
      if (battle && battle.status === 'ready_to_resolve') {
        readyBattles.push(battleId);
      }
    }
    return readyBattles;
  }

  async getBattle(battleId: bigint, contractType: 'range' | 'fee' = 'range'): Promise<BattleInfo | null> {
    const address = contractType === 'range' ? config.rangeVaultAddress : config.feeVaultAddress;
    const abi = contractType === 'range' ? RangeVaultABI : FeeVaultABI;

    try {
      const result = await this.publicClient.readContract({
        address,
        abi,
        functionName: 'getBattle',
        args: [battleId],
      }) as [Address, Address, Address, bigint, bigint, bigint, bigint, bigint, boolean, string];

      return {
        id: battleId,
        creator: result[0],
        opponent: result[1],
        winner: result[2],
        creatorTokenId: result[3],
        opponentTokenId: result[4],
        startTime: result[5],
        duration: result[6],
        totalValueUSD: result[7],
        isResolved: result[8],
        status: result[9],
      };
    } catch (error) {
      logger.error(`Failed to get battle ${battleId}`, error);
      return null;
    }
  }

  async getBattleStatus(battleId: bigint, contractType: 'range' | 'fee' = 'range'): Promise<string> {
    const address = contractType === 'range' ? config.rangeVaultAddress : config.feeVaultAddress;
    const abi = contractType === 'range' ? RangeVaultABI : FeeVaultABI;

    try {
      const result = await this.publicClient.readContract({
        address,
        abi,
        functionName: 'getBattleStatus',
        args: [battleId],
      }) as string;
      return result;
    } catch (error) {
      logger.error(`Failed to get battle status for ${battleId}`, error);
      return 'unknown';
    }
  }

  async getTimeRemaining(battleId: bigint, contractType: 'range' | 'fee' = 'range'): Promise<bigint> {
    const address = contractType === 'range' ? config.rangeVaultAddress : config.feeVaultAddress;
    const abi = contractType === 'range' ? RangeVaultABI : FeeVaultABI;

    try {
      const result = await this.publicClient.readContract({
        address,
        abi,
        functionName: 'getTimeRemaining',
        args: [battleId],
      }) as bigint;
      return result;
    } catch (error) {
      logger.error(`Failed to get time remaining for battle ${battleId}`, error);
      return 0n;
    }
  }

  // ============ STRATEGY LOOP: MONITOR ============

  /**
   * Scan all vaults, analyze battles, detect opportunities
   */
  async monitor(): Promise<{
    rangeAnalyses: BattleAnalysis[];
    feeAnalyses: BattleAnalysis[];
    pendingBattles: { range: bigint[]; fee: bigint[] };
  }> {
    logger.info('[MONITOR] Scanning Uniswap V4 battle vaults...');

    // Get active battles from both vaults
    const [rangeActive, feeActive] = await Promise.all([
      this.getActiveBattles('range'),
      this.getActiveBattles('fee'),
    ]);

    logger.info(`[MONITOR] Range Vault: ${rangeActive.length} active | Fee Vault: ${feeActive.length} active`);

    // Analyze each battle
    const rangeAnalyses: BattleAnalysis[] = [];
    for (const id of rangeActive) {
      const analysis = await this.poolAnalyzer.analyzeRangeBattle(id);
      if (analysis) {
        rangeAnalyses.push(analysis);
        this.poolAnalyzer.printBattleAnalysis(analysis);
      }
    }

    const feeAnalyses: BattleAnalysis[] = [];
    for (const id of feeActive) {
      const analysis = await this.poolAnalyzer.analyzeFeeBattle(id);
      if (analysis) {
        feeAnalyses.push(analysis);
        this.poolAnalyzer.printBattleAnalysis(analysis);
      }
    }

    // Get pending battles (joinable)
    const pendingBattles = await this.poolAnalyzer.getPendingBattles();
    if (pendingBattles.range.length > 0 || pendingBattles.fee.length > 0) {
      logger.info(`[MONITOR] Pending battles: ${pendingBattles.range.length} range, ${pendingBattles.fee.length} fee`);
    }

    return { rangeAnalyses, feeAnalyses, pendingBattles };
  }

  // ============ STRATEGY LOOP: DECIDE ============

  /**
   * Given monitor results, decide what actions to take
   */
  decide(
    rangeAnalyses: BattleAnalysis[],
    feeAnalyses: BattleAnalysis[],
    pendingBattles: { range: bigint[]; fee: bigint[] }
  ): AgentAction[] {
    const actions: AgentAction[] = [];

    logger.info('[DECIDE] Evaluating actions...');

    // Priority 1: Resolve expired battles (earns resolver reward)
    for (const analysis of [...rangeAnalyses, ...feeAnalyses]) {
      if (analysis.status === 'ready_to_resolve') {
        actions.push({
          type: 'resolve',
          priority: 100,
          battleId: analysis.battleId,
          vaultType: analysis.vaultType,
          reasoning: `Battle #${analysis.battleId} expired on ${analysis.vaultType} vault - resolve for reward`,
        });
      }
    }

    // Priority 2: Update in-range status for ongoing range battles
    for (const analysis of rangeAnalyses) {
      if (analysis.status === 'ongoing') {
        actions.push({
          type: 'update_status',
          priority: 50,
          battleId: analysis.battleId,
          vaultType: 'range',
          reasoning: `Update in-range tracking for battle #${analysis.battleId}`,
        });
      }
    }

    // Priority 3: Analyze pending battles for cross-chain entry
    for (const id of [...pendingBattles.range]) {
      actions.push({
        type: 'analyze',
        priority: 30,
        battleId: id,
        vaultType: 'range',
        reasoning: `Pending battle #${id} - evaluate for cross-chain entry opportunity`,
      });
    }
    for (const id of [...pendingBattles.fee]) {
      actions.push({
        type: 'analyze',
        priority: 30,
        battleId: id,
        vaultType: 'fee',
        reasoning: `Pending battle #${id} - evaluate for cross-chain entry opportunity`,
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

  /**
   * Execute the decided actions
   */
  async act(actions: AgentAction[]): Promise<void> {
    for (const action of actions) {
      logger.info(`[ACT] Executing: ${action.type} - ${action.reasoning}`);

      switch (action.type) {
        case 'resolve':
          if (action.battleId !== undefined && action.vaultType) {
            await this.settleBattle(action.battleId, action.vaultType);
          }
          break;

        case 'update_status':
          if (action.battleId !== undefined) {
            await this.updateBattleStatus(action.battleId);
          }
          break;

        case 'analyze':
          // Log the analysis for transparency
          logger.logAction({
            timestamp: new Date().toISOString(),
            action: 'ANALYZE_OPPORTUNITY',
            battleId: action.battleId?.toString(),
            contractType: action.vaultType,
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

  /**
   * Run one complete MONITOR -> DECIDE -> ACT cycle
   */
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
      const actions = this.decide(monitorResult.rangeAnalyses, monitorResult.feeAnalyses, monitorResult.pendingBattles);
      this.lastDecisions = actions;

      // ACT
      await this.act(actions);
    } catch (error) {
      logger.error('Strategy cycle error', error);
    }
  }

  // ============ Cross-Chain Entry via LI.FI ============

  /**
   * Get cross-chain route options for entering a battle
   */
  async getCrossChainRoutes(intent: BattleEntryIntent) {
    logger.info('[LIFI] Analyzing cross-chain routes...');

    // Validate intent
    const validation = await this.crossChainAgent.analyzeIntent(intent);
    if (!validation.isValid) {
      logger.error('[LIFI] Invalid intent:', validation.issues);
      return null;
    }

    for (const rec of validation.recommendations) {
      logger.info(`[LIFI] Recommendation: ${rec}`);
    }

    // Get route options
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

  /**
   * Create and display execution plan for cross-chain entry
   */
  async planCrossChainEntry(intent: BattleEntryIntent) {
    const routes = await this.getCrossChainRoutes(intent);
    if (!routes || routes.length === 0) return null;

    const recommended = routes.find(r => r.recommended) || routes[0];
    const plan = await this.crossChainAgent.createExecutionPlan(intent, recommended);

    this.crossChainAgent.printExecutionPlan(plan);

    return plan;
  }

  // ============ Transaction Methods ============

  async settleBattle(battleId: bigint, contractType: 'range' | 'fee' = 'range'): Promise<Hash | null> {
    const address = contractType === 'range' ? config.rangeVaultAddress : config.feeVaultAddress;
    const abi = contractType === 'range' ? RangeVaultABI : FeeVaultABI;

    const battle = await this.getBattle(battleId, contractType);
    if (!battle) {
      logger.error(`Cannot settle - battle ${battleId} not found`);
      return null;
    }

    logger.logAction({
      timestamp: new Date().toISOString(),
      action: 'SETTLE_BATTLE',
      battleId: battleId.toString(),
      contractType,
      reasoning: `Battle duration elapsed. Status: ${battle.status}. Creator: ${battle.creator.slice(0, 10)}... vs Opponent: ${battle.opponent.slice(0, 10)}...`,
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
        address,
        abi,
        functionName: 'resolveBattle',
        args: [battleId],
      });

      const hash = await this.walletClient.writeContract(request);
      logger.info(`Transaction submitted: ${hash}`);

      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

      const updatedBattle = await this.getBattle(battleId, contractType);

      // Record TX evidence
      txCollector.record({
        hash,
        description: `Resolve battle #${battleId} (${contractType} vault)`,
        chain: 'Sepolia',
        chainId: 11155111,
        type: 'resolve',
        timestamp: Date.now(),
        gasUsed: receipt.gasUsed.toString(),
        blockNumber: Number(receipt.blockNumber),
        from: this.account.address,
        to: address,
      });

      logger.logAction({
        timestamp: new Date().toISOString(),
        action: 'SETTLE_BATTLE',
        battleId: battleId.toString(),
        contractType,
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
      logger.info(`TX: https://sepolia.etherscan.io/tx/${hash}`);

      return hash;
    } catch (error) {
      logger.logAction({
        timestamp: new Date().toISOString(),
        action: 'SETTLE_BATTLE',
        battleId: battleId.toString(),
        contractType,
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
        address: config.rangeVaultAddress,
        abi: RangeVaultABI,
        functionName: 'updateBattleStatus',
        args: [battleId],
      });

      const hash = await this.walletClient.writeContract(request);
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

      txCollector.record({
        hash,
        description: `Update in-range status for battle #${battleId}`,
        chain: 'Sepolia',
        chainId: 11155111,
        type: 'update',
        timestamp: Date.now(),
        gasUsed: receipt.gasUsed.toString(),
        blockNumber: Number(receipt.blockNumber),
        from: this.account.address,
        to: config.rangeVaultAddress,
      });

      logger.logAction({
        timestamp: new Date().toISOString(),
        action: 'UPDATE_BATTLE_STATUS',
        battleId: battleId.toString(),
        contractType: 'range',
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
    console.log(`${C.cyan}  LP BATTLEVAULT AUTONOMOUS AGENT${C.reset}`);
    console.log(`${C.cyan}${'='.repeat(70)}${C.reset}`);

    console.log(`\n  ${C.blue}Agent${C.reset}`);
    console.log(`    Address:  ${this.account.address}`);
    console.log(`    Balance:  ${await this.getBalance()} ETH`);
    console.log(`    Network:  ${config.chain.name} (${config.chainId})`);
    console.log(`    Cycles:   ${this.cycleCount}`);

    console.log(`\n  ${C.blue}Range Vault${C.reset} ${C.gray}${config.rangeVaultAddress}${C.reset}`);
    const rangeActive = await this.getActiveBattles('range');
    console.log(`    Active Battles: ${rangeActive.length}`);
    for (const id of rangeActive) {
      const battle = await this.getBattle(id, 'range');
      if (battle) {
        console.log(`    Battle #${id}: ${battle.status} | Value: ${formatUnits(battle.totalValueUSD, 8)} USD`);
      }
    }

    console.log(`\n  ${C.blue}Fee Vault${C.reset} ${C.gray}${config.feeVaultAddress}${C.reset}`);
    const feeActive = await this.getActiveBattles('fee');
    console.log(`    Active Battles: ${feeActive.length}`);
    for (const id of feeActive) {
      const battle = await this.getBattle(id, 'fee');
      if (battle) {
        console.log(`    Battle #${id}: ${battle.status} | Creator: ${battle.creator.slice(0, 12)}...`);
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
