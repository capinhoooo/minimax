/**
 * Pool State Analyzer for BattleArena
 *
 * Reads V4 pool state directly from PoolManager via extsload.
 * Analyzes battle state from the unified BattleArena contract
 * to score battles and recommend strategies.
 */

import {
  type PublicClient,
  type Address,
  encodePacked,
  keccak256,
  toHex,
  hexToBigInt,
} from 'viem';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

import PoolManagerABI from '../abis/PoolManager.json' assert { type: 'json' };
import BattleArenaABI from '../abis/BattleArena.json' assert { type: 'json' };

// ============ Types ============

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
  battleType: number;        // 0=RANGE, 1=FEE
  status: number;            // 0=PENDING, 1=ACTIVE, 2=EXPIRED, 3=RESOLVED
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

export interface WinProbability {
  creatorProbability: number;  // 0-1
  opponentProbability: number; // 0-1
  reasoning: string;
  factors: {
    inRangeTimeFactor?: number;
    rangeWidthFactor?: number;
    elapsedTimeFactor?: number;
    dexFactor?: string;
  };
}

export interface BattleInfoLike {
  id: bigint;
  creator: string;
  opponent: string;
  battleType: number;
  status: number;
  startTime: bigint;
  duration: bigint;
  creatorInRangeTime: bigint;
  opponentInRangeTime: bigint;
  lastUpdateTime: bigint;
}

// ============ Constants ============

const BATTLE_STATUS_NAMES = ['PENDING', 'ACTIVE', 'EXPIRED', 'RESOLVED'];
const BATTLE_TYPE_NAMES = ['RANGE', 'FEE'];
const DEX_TYPE_NAMES = ['UNISWAP_V4', 'CAMELOT_V3'];

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

// Storage Slot Constants (V4 PoolManager)
const POOLS_MAPPING_SLOT = 6n;

export class PoolAnalyzer {
  private publicClient: PublicClient;

  constructor(publicClient: PublicClient) {
    this.publicClient = publicClient;
  }

  // ============ Pool State Reading ============

  private computePoolSlot0(poolId: `0x${string}`): `0x${string}` {
    return keccak256(
      encodePacked(
        ['bytes32', 'uint256'],
        [poolId, POOLS_MAPPING_SLOT]
      )
    );
  }

  async getPoolState(poolId: `0x${string}`): Promise<PoolState | null> {
    try {
      const slot = this.computePoolSlot0(poolId);

      const data = await this.publicClient.readContract({
        address: config.poolManager as Address,
        abi: PoolManagerABI,
        functionName: 'extsload',
        args: [slot],
      }) as `0x${string}`;

      const raw = hexToBigInt(data);

      const sqrtPriceX96 = raw & ((1n << 160n) - 1n);
      const tick = Number((raw >> 160n) & ((1n << 24n) - 1n));
      const signedTick = tick > 0x7FFFFF ? tick - 0x1000000 : tick;
      const protocolFee = Number((raw >> 184n) & ((1n << 24n) - 1n));
      const lpFee = Number((raw >> 208n) & ((1n << 24n) - 1n));

      return { sqrtPriceX96, tick: signedTick, protocolFee, lpFee };
    } catch (error) {
      logger.debug(`Failed to read pool state for ${poolId}`, error);
      return null;
    }
  }

  async getPoolLiquidity(poolId: `0x${string}`): Promise<bigint | null> {
    try {
      const slot0 = this.computePoolSlot0(poolId);
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

  isPositionInRange(currentTick: number, tickLower: number, tickUpper: number): boolean {
    return currentTick >= tickLower && currentTick < tickUpper;
  }

  analyzePosition(currentTick: number, tickLower: number, tickUpper: number): PositionAnalysis {
    const isInRange = this.isPositionInRange(currentTick, tickLower, tickUpper);
    const rangeWidth = tickUpper - tickLower;
    const rangeMid = tickLower + rangeWidth / 2;
    const tickDistance = Math.abs(currentTick - rangeMid);

    let positionInRange = (currentTick - tickLower) / rangeWidth;
    positionInRange = Math.max(0, Math.min(1, positionInRange));

    return { isInRange, tickDistance, rangeWidth, positionInRange };
  }

  sqrtPriceToPrice(sqrtPriceX96: bigint, decimals0: number = 18, decimals1: number = 18): number {
    const Q96 = 2n ** 96n;
    const priceNum = Number(sqrtPriceX96) / Number(Q96);
    const price = priceNum * priceNum;
    return price * Math.pow(10, decimals0 - decimals1);
  }

  // ============ Win Probability ============

  calculateWinProbability(battle: BattleInfoLike): WinProbability {
    // FEE battles - winner determined at resolution
    if (battle.battleType === 1) {
      return {
        creatorProbability: 0.5,
        opponentProbability: 0.5,
        reasoning: 'Fee battle winner determined at resolution based on accumulated fees. No prediction available.',
        factors: { dexFactor: 'fee_battle' },
      };
    }

    // RANGE battles
    const elapsed = battle.lastUpdateTime - battle.startTime;

    if (elapsed === 0n) {
      return {
        creatorProbability: 0.5,
        opponentProbability: 0.5,
        reasoning: 'Battle just started, no in-range data yet. Equal probability.',
        factors: { inRangeTimeFactor: 0, elapsedTimeFactor: 0 },
      };
    }

    const elapsedNum = Number(elapsed);
    const durationNum = Number(battle.duration);
    const creatorInRange = Number(battle.creatorInRangeTime);
    const opponentInRange = Number(battle.opponentInRangeTime);

    const creatorPct = creatorInRange / elapsedNum;
    const opponentPct = opponentInRange / elapsedNum;

    if (creatorPct === 0 && opponentPct === 0) {
      return {
        creatorProbability: 0.5,
        opponentProbability: 0.5,
        reasoning: 'Neither player has accumulated in-range time. Equal probability.',
        factors: { inRangeTimeFactor: 0, elapsedTimeFactor: elapsedNum / durationNum },
      };
    }

    const total = creatorPct + opponentPct;
    const rawCreatorProb = creatorPct / total;
    const rawOpponentProb = opponentPct / total;

    const elapsedRatio = Math.min(1, elapsedNum / durationNum);
    let confidence: number;
    if (elapsedRatio < 0.25) {
      confidence = elapsedRatio / 0.25 * 0.5;
    } else if (elapsedRatio > 0.75) {
      confidence = 0.5 + ((elapsedRatio - 0.75) / 0.25) * 0.5;
    } else {
      confidence = 0.5;
    }

    const creatorProbability = 0.5 * (1 - confidence) + rawCreatorProb * confidence;
    const opponentProbability = 0.5 * (1 - confidence) + rawOpponentProb * confidence;

    const elapsedPctStr = (elapsedRatio * 100).toFixed(1);
    const creatorPctStr = (creatorPct * 100).toFixed(1);
    const opponentPctStr = (opponentPct * 100).toFixed(1);
    const leader = creatorProbability > opponentProbability ? 'Creator' : 'Opponent';
    const leadProb = Math.max(creatorProbability, opponentProbability);

    const reasoning = `${elapsedPctStr}% of battle elapsed. ` +
      `Creator in-range ${creatorPctStr}%, Opponent in-range ${opponentPctStr}%. ` +
      `${leader} leads with ${(leadProb * 100).toFixed(1)}% win probability ` +
      `(confidence: ${(confidence * 100).toFixed(0)}%).`;

    return {
      creatorProbability,
      opponentProbability,
      reasoning,
      factors: { inRangeTimeFactor: total, elapsedTimeFactor: elapsedRatio },
    };
  }

  // ============ Battle Analysis ============

  /**
   * Analyze any battle from the BattleArena contract
   */
  async analyzeBattle(battleId: bigint): Promise<BattleAnalysis | null> {
    try {
      const result = await this.publicClient.readContract({
        address: config.battleArenaAddress as Address,
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

      const battleType = Number(result.battleType);
      const status = Number(result.status);
      const creatorDex = DEX_TYPE_NAMES[Number(result.creatorDex)] ?? 'UNKNOWN';
      const opponentDex = DEX_TYPE_NAMES[Number(result.opponentDex)] ?? 'UNKNOWN';

      // Check if battle is expired
      let isExpired = status >= 2; // EXPIRED or RESOLVED
      if (status === 1 && result.startTime > 0n) {
        // ACTIVE but possibly time-elapsed
        try {
          isExpired = await this.publicClient.readContract({
            address: config.battleArenaAddress as Address,
            abi: BattleArenaABI,
            functionName: 'isBattleExpired',
            args: [battleId],
          }) as boolean;
        } catch {
          // If check fails, compute locally
          const endTime = result.startTime + result.duration;
          const now = BigInt(Math.floor(Date.now() / 1000));
          isExpired = now >= endTime;
        }
      }

      // Compute time remaining
      let timeRemaining = 0n;
      if (status < 2 && result.startTime > 0n) {
        const endTime = result.startTime + result.duration;
        const now = BigInt(Math.floor(Date.now() / 1000));
        timeRemaining = endTime > now ? endTime - now : 0n;
      } else if (status === 0) {
        timeRemaining = result.duration; // PENDING - duration is the full time
      }

      // Already resolved
      if (status === 3) {
        return {
          battleId,
          battleType,
          status,
          isExpired: true,
          timeRemaining: 0n,
          creatorScore: 0,
          opponentScore: 0,
          currentLeader: result.winner,
          creatorDex,
          opponentDex,
          recommendation: `Battle resolved. Winner: ${result.winner.slice(0, 12)}...`,
        };
      }

      let creatorScore = 0;
      let opponentScore = 0;
      let currentLeader = '';
      let recommendation = '';

      const hasOpponent = result.opponent !== ZERO_ADDRESS;

      if (!hasOpponent) {
        recommendation = 'PENDING - Waiting for opponent to join';
      } else if (isExpired) {
        recommendation = 'RESOLVE NOW - Battle expired, earn resolver reward';
      } else if (battleType === 0) {
        // RANGE battle - use in-range time from contract
        creatorScore = Number(result.creatorInRangeTime);
        opponentScore = Number(result.opponentInRangeTime);
        currentLeader = creatorScore >= opponentScore ? result.creator : result.opponent;

        if (creatorScore === opponentScore) {
          recommendation = 'Tied on in-range time';
        } else {
          const leader = creatorScore > opponentScore ? 'Creator' : 'Opponent';
          recommendation = `${leader} leading with ${Math.max(creatorScore, opponentScore)}s in-range time`;
        }
      } else {
        // FEE battle - scores are determined at resolution by scoring engine
        recommendation = 'Fee battle in progress - winner determined at resolution';
        currentLeader = result.creator; // Placeholder
      }

      return {
        battleId,
        battleType,
        status,
        isExpired,
        timeRemaining,
        creatorScore,
        opponentScore,
        currentLeader,
        creatorDex,
        opponentDex,
        recommendation,
      };
    } catch (error) {
      logger.error(`Failed to analyze battle ${battleId}`, error);
      return null;
    }
  }

  /**
   * Score a battle's attractiveness for entry (0-100)
   */
  scoreBattleForEntry(analysis: BattleAnalysis): number {
    let score = 50;

    if (analysis.status !== 0) return 0; // Only PENDING battles are joinable

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
      gray: '\x1b[90m',
    };

    const statusStr = BATTLE_STATUS_NAMES[analysis.status] ?? 'UNKNOWN';
    const typeStr = BATTLE_TYPE_NAMES[analysis.battleType] ?? 'UNKNOWN';
    const statusColor = analysis.isExpired ? C.green
      : analysis.status === 1 ? C.yellow
      : analysis.status === 0 ? C.cyan
      : C.gray;

    console.log(`\n  Battle #${analysis.battleId} ${C.gray}(${typeStr} | ${analysis.creatorDex} vs ${analysis.opponentDex})${C.reset}`);
    console.log(`    Status:         ${statusColor}${statusStr}${analysis.isExpired && analysis.status !== 3 ? ' (EXPIRED)' : ''}${C.reset}`);
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
