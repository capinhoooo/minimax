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

export class BattleAgent {
  private publicClient: PublicClient;
  private walletClient: WalletClient;
  private account: ReturnType<typeof privateKeyToAccount>;
  private isRunning: boolean = false;

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

    logger.info(`Agent initialized with address: ${this.account.address}`);
  }

  // Get agent's wallet address
  getAddress(): Address {
    return this.account.address;
  }

  // Check agent's ETH balance
  async getBalance(): Promise<string> {
    const balance = await this.publicClient.getBalance({
      address: this.account.address,
    });
    return formatEther(balance);
  }

  // Get all active battles from Range Vault
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

  // Get battles ready to resolve
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

  // Get battle details
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

  // Get battle status
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

  // Get time remaining for a battle
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

  // Settle a battle
  async settleBattle(battleId: bigint, contractType: 'range' | 'fee' = 'range'): Promise<Hash | null> {
    const address = contractType === 'range' ? config.rangeVaultAddress : config.feeVaultAddress;
    const abi = contractType === 'range' ? RangeVaultABI : FeeVaultABI;

    // Get battle info for logging
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
      // Simulate first
      const { request } = await this.publicClient.simulateContract({
        account: this.account,
        address,
        abi,
        functionName: 'resolveBattle',
        args: [battleId],
      });

      // Execute transaction
      const hash = await this.walletClient.writeContract(request);

      logger.info(`Transaction submitted: ${hash}`);

      // Wait for confirmation
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

      // Get updated battle info
      const updatedBattle = await this.getBattle(battleId, contractType);

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

  // Update battle status (for range vault - updates in-range time)
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

  // Main monitoring loop
  async startMonitoring(): Promise<void> {
    this.isRunning = true;
    logger.info('Starting battle monitoring...');

    const balance = await this.getBalance();
    logger.info(`Agent balance: ${balance} ETH`);

    while (this.isRunning) {
      try {
        await this.checkAndSettleBattles();
      } catch (error) {
        logger.error('Error in monitoring loop', error);
      }

      // Wait before next poll
      await this.sleep(config.pollIntervalMs);
    }
  }

  // Stop monitoring
  stopMonitoring(): void {
    this.isRunning = false;
    logger.info('Stopping battle monitoring...');
    logger.printSummary();
  }

  // Check and settle any ready battles
  async checkAndSettleBattles(): Promise<void> {
    logger.debug('Checking for battles ready to settle...');

    // Check Range Vault
    const rangeActiveBattles = await this.getActiveBattles('range');
    logger.debug(`Range Vault: ${rangeActiveBattles.length} active battles`);

    for (const battleId of rangeActiveBattles) {
      const status = await this.getBattleStatus(battleId, 'range');

      if (status === 'ready_to_resolve') {
        logger.info(`Found battle ${battleId} ready to resolve (Range Vault)`);
        await this.settleBattle(battleId, 'range');
      } else if (status === 'ongoing') {
        // Update in-range tracking
        const timeRemaining = await this.getTimeRemaining(battleId, 'range');
        logger.debug(`Battle ${battleId}: ${status}, ${timeRemaining}s remaining`);
      }
    }

    // Check Fee Vault
    const feeActiveBattles = await this.getActiveBattles('fee');
    logger.debug(`Fee Vault: ${feeActiveBattles.length} active battles`);

    for (const battleId of feeActiveBattles) {
      const status = await this.getBattleStatus(battleId, 'fee');

      if (status === 'ready_to_resolve') {
        logger.info(`Found battle ${battleId} ready to resolve (Fee Vault)`);
        await this.settleBattle(battleId, 'fee');
      }
    }
  }

  // Print current status
  async printStatus(): Promise<void> {
    console.log('\n' + '='.repeat(60));
    console.log('LP BATTLEVAULT AGENT STATUS');
    console.log('='.repeat(60));

    console.log(`\nAgent Address: ${this.account.address}`);
    console.log(`Balance: ${await this.getBalance()} ETH`);
    console.log(`Network: ${config.chain.name} (${config.chainId})`);

    console.log('\n--- Range Vault ---');
    console.log(`Address: ${config.rangeVaultAddress}`);
    const rangeActive = await this.getActiveBattles('range');
    console.log(`Active Battles: ${rangeActive.length}`);
    for (const id of rangeActive) {
      const battle = await this.getBattle(id, 'range');
      if (battle) {
        console.log(`  Battle #${id}: ${battle.status} | Creator: ${battle.creator.slice(0, 10)}... | Value: ${formatUnits(battle.totalValueUSD, 8)} USD`);
      }
    }

    console.log('\n--- Fee Vault ---');
    console.log(`Address: ${config.feeVaultAddress}`);
    const feeActive = await this.getActiveBattles('fee');
    console.log(`Active Battles: ${feeActive.length}`);
    for (const id of feeActive) {
      const battle = await this.getBattle(id, 'fee');
      if (battle) {
        console.log(`  Battle #${id}: ${battle.status} | Creator: ${battle.creator.slice(0, 10)}...`);
      }
    }

    console.log('\n' + '='.repeat(60) + '\n');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
