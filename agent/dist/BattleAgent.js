import { createPublicClient, createWalletClient, http, formatEther, formatUnits, } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import { txCollector } from './utils/txCollector.js';
import { PoolAnalyzer } from './analyzers/PoolAnalyzer.js';
import { CrossChainEntryAgent } from './integrations/CrossChainEntryAgent.js';
import { LiFiIntegration } from './integrations/LiFiIntegration.js';
// Import ABI
import BattleArenaABI from './abis/BattleArena.json' assert { type: 'json' };
// ============ Contract Enums ============
export const BattleStatus = {
    PENDING: 0,
    ACTIVE: 1,
    EXPIRED: 2,
    RESOLVED: 3,
};
export const BattleType = {
    RANGE: 0,
    FEE: 1,
};
export const DexType = {
    UNISWAP_V4: 0,
    CAMELOT_V3: 1,
};
const BATTLE_STATUS_NAMES = ['PENDING', 'ACTIVE', 'EXPIRED', 'RESOLVED'];
const BATTLE_TYPE_NAMES = ['RANGE', 'FEE'];
const DEX_TYPE_NAMES = ['UNISWAP_V4', 'CAMELOT_V3'];
export function statusName(status) {
    return BATTLE_STATUS_NAMES[status] ?? 'UNKNOWN';
}
export function battleTypeName(type) {
    return BATTLE_TYPE_NAMES[type] ?? 'UNKNOWN';
}
export function dexTypeName(type) {
    return DEX_TYPE_NAMES[type] ?? 'UNKNOWN';
}
export class BattleAgent {
    publicClient;
    walletClient;
    account;
    isRunning = false;
    poolAnalyzer;
    crossChainAgent;
    lifi;
    cycleCount = 0;
    startedAt = Date.now();
    lastMonitorResult = null;
    lastDecisions = [];
    lastRoutes = [];
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
    getAddress() {
        return this.account.address;
    }
    getPublicClient() {
        return this.publicClient;
    }
    getPoolAnalyzer() {
        return this.poolAnalyzer;
    }
    getCrossChainAgent() {
        return this.crossChainAgent;
    }
    getLiFi() {
        return this.lifi;
    }
    async getBalance() {
        const balance = await this.publicClient.getBalance({
            address: this.account.address,
        });
        return formatEther(balance);
    }
    // ============ Contract Read Methods ============
    async getBattlesByStatus(status) {
        try {
            const result = await this.publicClient.readContract({
                address: config.battleArenaAddress,
                abi: BattleArenaABI,
                functionName: 'getBattlesByStatus',
                args: [status],
            });
            return result;
        }
        catch (error) {
            logger.error(`Failed to get battles with status ${statusName(status)}`, error);
            return [];
        }
    }
    async getActiveBattles() {
        return this.getBattlesByStatus(BattleStatus.ACTIVE);
    }
    async getPendingBattles() {
        return this.getBattlesByStatus(BattleStatus.PENDING);
    }
    async getExpiredBattles() {
        return this.getBattlesByStatus(BattleStatus.EXPIRED);
    }
    async getBattleCount() {
        try {
            const result = await this.publicClient.readContract({
                address: config.battleArenaAddress,
                abi: BattleArenaABI,
                functionName: 'getBattleCount',
            });
            return result;
        }
        catch (error) {
            logger.error('Failed to get battle count', error);
            return 0n;
        }
    }
    async getBattlesReadyToResolve() {
        // Check both ACTIVE and EXPIRED battles
        const [active, expired] = await Promise.all([
            this.getActiveBattles(),
            this.getExpiredBattles(),
        ]);
        const readyBattles = [...expired]; // All EXPIRED are ready
        // Check which ACTIVE battles have actually expired
        for (const battleId of active) {
            try {
                const isExpired = await this.publicClient.readContract({
                    address: config.battleArenaAddress,
                    abi: BattleArenaABI,
                    functionName: 'isBattleExpired',
                    args: [battleId],
                });
                if (isExpired) {
                    readyBattles.push(battleId);
                }
            }
            catch {
                // Skip if check fails
            }
        }
        return readyBattles;
    }
    async getBattle(battleId) {
        try {
            const result = await this.publicClient.readContract({
                address: config.battleArenaAddress,
                abi: BattleArenaABI,
                functionName: 'getBattle',
                args: [battleId],
            });
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
        }
        catch (error) {
            logger.error(`Failed to get battle ${battleId}`, error);
            return null;
        }
    }
    getTimeRemaining(battle) {
        if (battle.status >= BattleStatus.EXPIRED)
            return 0n;
        if (battle.startTime === 0n)
            return battle.duration; // PENDING, not started
        const endTime = battle.startTime + battle.duration;
        const now = BigInt(Math.floor(Date.now() / 1000));
        return endTime > now ? endTime - now : 0n;
    }
    // ============ STRATEGY LOOP: MONITOR ============
    async monitor() {
        logger.info('[MONITOR] Scanning BattleArena on Arbitrum Sepolia...');
        const [activeBattles, pendingBattles, expiredBattles] = await Promise.all([
            this.getActiveBattles(),
            this.getPendingBattles(),
            this.getExpiredBattles(),
        ]);
        logger.info(`[MONITOR] Active: ${activeBattles.length} | Pending: ${pendingBattles.length} | Expired: ${expiredBattles.length}`);
        // Analyze active and expired battles
        const analyses = [];
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
    decide(analyses, pendingBattles, expiredBattles) {
        const actions = [];
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
        }
        else {
            logger.info(`[DECIDE] ${actions.length} actions planned:`);
            actions.forEach((a, i) => {
                logger.info(`  ${i + 1}. [${a.type.toUpperCase()}] ${a.reasoning}`);
            });
        }
        return actions;
    }
    // ============ STRATEGY LOOP: ACT ============
    async act(actions) {
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
    async runStrategyCycle() {
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
        }
        catch (error) {
            logger.error('Strategy cycle error', error);
        }
    }
    // ============ Cross-Chain Entry via LI.FI ============
    async getCrossChainRoutes(intent) {
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
    async planCrossChainEntry(intent) {
        const routes = await this.getCrossChainRoutes(intent);
        if (!routes || routes.length === 0)
            return null;
        const recommended = routes.find(r => r.recommended) || routes[0];
        const plan = await this.crossChainAgent.createExecutionPlan(intent, recommended);
        this.crossChainAgent.printExecutionPlan(plan);
        return plan;
    }
    // ============ Transaction Methods ============
    async settleBattle(battleId) {
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
        }
        catch (error) {
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
    async updateBattleStatus(battleId) {
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
        }
        catch (error) {
            logger.debug(`Failed to update battle status for ${battleId}`, error);
            return null;
        }
    }
    // ============ Monitoring Loop ============
    async startMonitoring() {
        this.isRunning = true;
        logger.info('Starting autonomous strategy loop...');
        const balance = await this.getBalance();
        logger.info(`Agent balance: ${balance} ETH`);
        while (this.isRunning) {
            try {
                await this.runStrategyCycle();
            }
            catch (error) {
                logger.error('Error in strategy cycle', error);
            }
            await this.sleep(config.pollIntervalMs);
        }
    }
    stopMonitoring() {
        this.isRunning = false;
        logger.info('Stopping agent...');
        logger.printSummary();
        txCollector.printSummary();
    }
    // Legacy method for backward compat
    async checkAndSettleBattles() {
        await this.runStrategyCycle();
    }
    // ============ Status Display ============
    async printStatus() {
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
    getCycleCount() {
        return this.cycleCount;
    }
    getIsRunning() {
        return this.isRunning;
    }
    getStartedAt() {
        return this.startedAt;
    }
    getLastMonitorResult() {
        return this.lastMonitorResult;
    }
    getLastDecisions() {
        return this.lastDecisions;
    }
    getLastRoutes() {
        return this.lastRoutes;
    }
    setLastRoutes(routes) {
        this.lastRoutes = routes;
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
