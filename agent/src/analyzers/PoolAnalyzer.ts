/**
 * Uniswap V4 Pool State Analyzer
 *
 * Reads V4 pool state directly from PoolManager via extsload.
 * Analyzes tick position, fee performance, and liquidity depth
 * to score battles and recommend strategies.
 */

import {
  type PublicClient,
  type Address,
  encodePacked,
  keccak256,
  pad,
  toHex,
  hexToBigInt,
  numberToHex,
} from 'viem';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

import PoolManagerABI from '../abis/PoolManager.json' assert { type: 'json' };
import RangeVaultABI from '../abis/LPBattleVaultV4.json' assert { type: 'json' };
import FeeVaultABI from '../abis/LPFeeBattleV4.json' assert { type: 'json' };

// ============ Types ============

export interface PoolState {
  sqrtPriceX96: bigint;
  tick: number;
  protocolFee: number;
  lpFee: number;
}

export interface PositionAnalysis {
  isInRange: boolean;
  tickDistance: number;         // How far current tick is from position center
  rangeWidth: number;           // tickUpper - tickLower
  positionInRange: number;      // 0-1, where in the range the tick sits
}

export interface BattleAnalysis {
  battleId: bigint;
  vaultType: 'range' | 'fee';
  status: string;
  timeRemaining: bigint;
  creatorScore: number;
  opponentScore: number;
  currentLeader: string;
  poolState?: PoolState;
  recommendation: string;
}

// ============ Storage Slot Constants (V4 PoolManager) ============
// Pool.State is stored at: pools[poolId] which maps to slot keccak256(poolId . POOLS_SLOT)
// POOLS_SLOT in PoolManager is slot 6 (after transient storage vars)
const POOLS_MAPPING_SLOT = 6n;

// Offsets within Pool.State struct:
// slot0: sqrtPriceX96 (160) | tick (24) | protocolFee (24) | lpFee (24) | 0 (24)
// slot1: feeGrowthGlobal0X128
// slot2: feeGrowthGlobal1X128
// slot3: liquidity (128)

export class PoolAnalyzer {
  private publicClient: PublicClient;

  constructor(publicClient: PublicClient) {
    this.publicClient = publicClient;
  }

  // ============ Pool State Reading ============

  /**
   * Compute the storage slot for a pool's slot0 data
   */
  private computePoolSlot0(poolId: `0x${string}`): `0x${string}` {
    // mapping(PoolId => Pool.State) at slot POOLS_MAPPING_SLOT
    // slot = keccak256(poolId . POOLS_MAPPING_SLOT)
    return keccak256(
      encodePacked(
        ['bytes32', 'uint256'],
        [poolId, POOLS_MAPPING_SLOT]
      )
    );
  }

  /**
   * Read pool slot0 (sqrtPriceX96, tick, protocolFee, lpFee) via extsload
   */
  async getPoolState(poolId: `0x${string}`): Promise<PoolState | null> {
    try {
      const slot = this.computePoolSlot0(poolId);

      const data = await this.publicClient.readContract({
        address: config.poolManager as Address,
        abi: PoolManagerABI,
        functionName: 'extsload',
        args: [slot],
      }) as `0x${string}`;

      // Parse slot0: packed as uint160 sqrtPriceX96 | int24 tick | uint24 protocolFee | uint24 lpFee
      // The data is stored right-aligned in the 32-byte slot
      const raw = hexToBigInt(data);

      const sqrtPriceX96 = raw & ((1n << 160n) - 1n);
      const tick = Number((raw >> 160n) & ((1n << 24n) - 1n));
      // Handle signed int24
      const signedTick = tick > 0x7FFFFF ? tick - 0x1000000 : tick;
      const protocolFee = Number((raw >> 184n) & ((1n << 24n) - 1n));
      const lpFee = Number((raw >> 208n) & ((1n << 24n) - 1n));

      return {
        sqrtPriceX96,
        tick: signedTick,
        protocolFee,
        lpFee,
      };
    } catch (error) {
      logger.debug(`Failed to read pool state for ${poolId}`, error);
      return null;
    }
  }

  /**
   * Read pool total liquidity
   */
  async getPoolLiquidity(poolId: `0x${string}`): Promise<bigint | null> {
    try {
      const slot0 = this.computePoolSlot0(poolId);
      // Liquidity is at offset 3 from the pool state base slot
      const liquiditySlot = toHex(hexToBigInt(slot0) + 3n, { size: 32 });

      const data = await this.publicClient.readContract({
        address: config.poolManager as Address,
        abi: PoolManagerABI,
        functionName: 'extsload',
        args: [liquiditySlot],
      }) as `0x${string}`;

      return hexToBigInt(data) & ((1n << 128n) - 1n);
    } catch (error) {
      logger.debug(`Failed to read pool liquidity for ${poolId}`, error);
      return null;
    }
  }

  // ============ Position Analysis ============

  /**
   * Check if a position's tick range contains the current pool tick
   */
  isPositionInRange(currentTick: number, tickLower: number, tickUpper: number): boolean {
    return currentTick >= tickLower && currentTick < tickUpper;
  }

  /**
   * Analyze a position relative to the current pool state
   */
  analyzePosition(currentTick: number, tickLower: number, tickUpper: number): PositionAnalysis {
    const isInRange = this.isPositionInRange(currentTick, tickLower, tickUpper);
    const rangeWidth = tickUpper - tickLower;
    const rangeMid = tickLower + rangeWidth / 2;
    const tickDistance = Math.abs(currentTick - rangeMid);

    // Position within range: 0 = at lower bound, 1 = at upper bound
    let positionInRange = (currentTick - tickLower) / rangeWidth;
    positionInRange = Math.max(0, Math.min(1, positionInRange));

    return {
      isInRange,
      tickDistance,
      rangeWidth,
      positionInRange,
    };
  }

  /**
   * Calculate approximate price from sqrtPriceX96
   * Returns price of token1 in terms of token0
   */
  sqrtPriceToPrice(sqrtPriceX96: bigint, decimals0: number = 18, decimals1: number = 18): number {
    const Q96 = 2n ** 96n;
    // price = (sqrtPrice / 2^96)^2 * 10^(decimals0 - decimals1)
    const priceNum = Number(sqrtPriceX96) / Number(Q96);
    const price = priceNum * priceNum;
    return price * Math.pow(10, decimals0 - decimals1);
  }

  // ============ Battle Analysis ============

  /**
   * Analyze a range vault battle using on-chain performance data
   */
  async analyzeRangeBattle(battleId: bigint): Promise<BattleAnalysis | null> {
    try {
      // Read battle data
      const battle = await this.publicClient.readContract({
        address: config.rangeVaultAddress as Address,
        abi: RangeVaultABI,
        functionName: 'getBattle',
        args: [battleId],
      }) as [Address, Address, Address, bigint, bigint, bigint, bigint, bigint, boolean, string];

      const status = battle[9];
      const isResolved = battle[8];

      if (isResolved) {
        return {
          battleId,
          vaultType: 'range',
          status,
          timeRemaining: 0n,
          creatorScore: 0,
          opponentScore: 0,
          currentLeader: battle[2], // winner
          recommendation: 'Battle already resolved',
        };
      }

      // Get time remaining
      const timeRemaining = await this.publicClient.readContract({
        address: config.rangeVaultAddress as Address,
        abi: RangeVaultABI,
        functionName: 'getTimeRemaining',
        args: [battleId],
      }) as bigint;

      // Get current performance if opponent has joined
      let creatorScore = 0;
      let opponentScore = 0;
      let currentLeader = '';
      let recommendation = '';

      if (battle[1] !== '0x0000000000000000000000000000000000000000') {
        try {
          const perf = await this.publicClient.readContract({
            address: config.rangeVaultAddress as Address,
            abi: RangeVaultABI,
            functionName: 'getCurrentPerformance',
            args: [battleId],
          }) as [boolean, boolean, bigint, bigint, Address];

          const creatorInRange = perf[0];
          const opponentInRange = perf[1];
          const creatorTime = Number(perf[2]);
          const opponentTime = Number(perf[3]);
          currentLeader = perf[4];

          creatorScore = creatorTime;
          opponentScore = opponentTime;

          if (timeRemaining === 0n) {
            recommendation = 'RESOLVE NOW - Battle expired, earn resolver reward';
          } else if (creatorInRange && opponentInRange) {
            recommendation = 'Both in range - close battle';
          } else if (!creatorInRange && !opponentInRange) {
            recommendation = 'Both out of range - waiting for tick movement';
          } else {
            const leader = creatorTime > opponentTime ? 'Creator' : 'Opponent';
            recommendation = `${leader} leading with ${Math.max(creatorTime, opponentTime)}s in-range time`;
          }
        } catch {
          recommendation = 'Performance data unavailable';
        }
      } else {
        recommendation = 'PENDING - Waiting for opponent to join';
      }

      return {
        battleId,
        vaultType: 'range',
        status,
        timeRemaining,
        creatorScore,
        opponentScore,
        currentLeader,
        recommendation,
      };
    } catch (error) {
      logger.error(`Failed to analyze range battle ${battleId}`, error);
      return null;
    }
  }

  /**
   * Analyze a fee vault battle using on-chain fee performance data
   */
  async analyzeFeeBattle(battleId: bigint): Promise<BattleAnalysis | null> {
    try {
      const battle = await this.publicClient.readContract({
        address: config.feeVaultAddress as Address,
        abi: FeeVaultABI,
        functionName: 'getBattle',
        args: [battleId],
      }) as [Address, Address, Address, bigint, bigint, bigint, bigint, bigint, bigint, boolean, string];

      const status = battle[10];
      const isResolved = battle[9];

      if (isResolved) {
        return {
          battleId,
          vaultType: 'fee',
          status,
          timeRemaining: 0n,
          creatorScore: 0,
          opponentScore: 0,
          currentLeader: battle[2],
          recommendation: 'Battle already resolved',
        };
      }

      const timeRemaining = await this.publicClient.readContract({
        address: config.feeVaultAddress as Address,
        abi: FeeVaultABI,
        functionName: 'getTimeRemaining',
        args: [battleId],
      }) as bigint;

      let creatorScore = 0;
      let opponentScore = 0;
      let currentLeader = '';
      let recommendation = '';

      if (battle[1] !== '0x0000000000000000000000000000000000000000') {
        try {
          const perf = await this.publicClient.readContract({
            address: config.feeVaultAddress as Address,
            abi: FeeVaultABI,
            functionName: 'getCurrentFeePerformance',
            args: [battleId],
          }) as [bigint, bigint, bigint, bigint, Address];

          creatorScore = Number(perf[2]); // creatorFeeRate
          opponentScore = Number(perf[3]); // opponentFeeRate
          currentLeader = perf[4];

          if (timeRemaining === 0n) {
            recommendation = 'RESOLVE NOW - Battle expired, earn resolver reward';
          } else {
            const leader = creatorScore > opponentScore ? 'Creator' : 'Opponent';
            recommendation = `${leader} leading on fee accumulation rate`;
          }
        } catch {
          recommendation = 'Fee performance data unavailable';
        }
      } else {
        recommendation = 'PENDING - Waiting for opponent to join';
      }

      return {
        battleId,
        vaultType: 'fee',
        status,
        timeRemaining,
        creatorScore,
        opponentScore,
        currentLeader,
        recommendation,
      };
    } catch (error) {
      logger.error(`Failed to analyze fee battle ${battleId}`, error);
      return null;
    }
  }

  /**
   * Get pending battles (waiting for opponent) from both vaults
   */
  async getPendingBattles(): Promise<{ range: bigint[]; fee: bigint[] }> {
    const [rangePending, feePending] = await Promise.all([
      this.publicClient.readContract({
        address: config.rangeVaultAddress as Address,
        abi: RangeVaultABI,
        functionName: 'getPendingBattles',
      }).catch(() => [] as bigint[]),
      this.publicClient.readContract({
        address: config.feeVaultAddress as Address,
        abi: FeeVaultABI,
        functionName: 'getPendingBattles',
      }).catch(() => [] as bigint[]),
    ]);

    return {
      range: rangePending as bigint[],
      fee: feePending as bigint[],
    };
  }

  /**
   * Score a battle's attractiveness for entry (0-100)
   * Higher = more attractive to join
   */
  scoreBattleForEntry(analysis: BattleAnalysis): number {
    let score = 50; // base

    // Pending battles are joinable
    if (analysis.status !== 'waiting_for_opponent') return 0;

    // Shorter duration = less risk
    const durationHours = Number(analysis.timeRemaining) / 3600;
    if (durationHours <= 1) score += 20;
    else if (durationHours <= 6) score += 10;
    else if (durationHours >= 24) score -= 10;

    return Math.max(0, Math.min(100, score));
  }

  // ============ Display Helpers ============

  printPoolState(poolId: string, state: PoolState): void {
    const C = {
      reset: '\x1b[0m',
      cyan: '\x1b[36m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      gray: '\x1b[90m',
    };

    console.log(`\n${C.cyan}  Pool: ${poolId.slice(0, 18)}...${C.reset}`);
    console.log(`    Tick:          ${state.tick}`);
    console.log(`    sqrtPriceX96:  ${state.sqrtPriceX96.toString().slice(0, 20)}...`);
    console.log(`    LP Fee:        ${state.lpFee / 10000}%`);
    console.log(`    Protocol Fee:  ${state.protocolFee}`);
  }

  printBattleAnalysis(analysis: BattleAnalysis): void {
    const C = {
      reset: '\x1b[0m',
      cyan: '\x1b[36m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      red: '\x1b[31m',
      gray: '\x1b[90m',
    };

    const statusColor = analysis.status === 'ready_to_resolve' ? C.green
      : analysis.status === 'ongoing' ? C.yellow
      : analysis.status === 'waiting_for_opponent' ? C.cyan
      : C.gray;

    console.log(`\n  Battle #${analysis.battleId} ${C.gray}(${analysis.vaultType} vault)${C.reset}`);
    console.log(`    Status:         ${statusColor}${analysis.status}${C.reset}`);
    if (analysis.timeRemaining > 0n) {
      const mins = Number(analysis.timeRemaining) / 60;
      console.log(`    Time Remaining: ${mins.toFixed(1)} minutes`);
    }
    if (analysis.creatorScore > 0 || analysis.opponentScore > 0) {
      console.log(`    Creator Score:  ${analysis.creatorScore}`);
      console.log(`    Opponent Score: ${analysis.opponentScore}`);
    }
    console.log(`    ${C.yellow}>> ${analysis.recommendation}${C.reset}`);
  }
}
