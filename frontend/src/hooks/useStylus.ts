import { useReadContract, useReadContracts } from 'wagmi';
import { arbitrumSepolia } from 'wagmi/chains';
import type { Address } from 'viem';
import { CONTRACTS, SCORING_ENGINE_ABI, LEADERBOARD_ABI } from '../lib/contracts';

// ============ Leaderboard (Stylus) ============

export interface PlayerStats {
  elo: bigint;
  wins: bigint;
  losses: bigint;
  totalBattles: bigint;
  totalValueWon: bigint;
}

/** Get a single player's stats from the Stylus Leaderboard */
export function usePlayerStats(player: Address | undefined) {
  return useReadContract({
    address: CONTRACTS.LEADERBOARD,
    abi: LEADERBOARD_ABI,
    functionName: 'getPlayerStats',
    args: player ? [player] : undefined,
    chainId: arbitrumSepolia.id,
    query: { enabled: !!player },
  });
}

/** Fetch multiple players' stats in a single multicall */
export function usePlayersStats(players: Address[]) {
  return useReadContracts({
    contracts: players.map((addr) => ({
      address: CONTRACTS.LEADERBOARD,
      abi: LEADERBOARD_ABI,
      functionName: 'getPlayerStats' as const,
      args: [addr] as const,
      chainId: arbitrumSepolia.id,
    })),
    query: { enabled: players.length > 0 },
  });
}

// ============ ScoringEngine (Stylus) ============

/** Calculate a range battle score via the Stylus ScoringEngine */
export function useCalculateRangeScore(
  inRangeTime: bigint | undefined,
  totalTime: bigint | undefined,
  tickDistance: bigint | undefined,
) {
  const enabled = inRangeTime !== undefined && totalTime !== undefined && tickDistance !== undefined && totalTime > 0n;
  return useReadContract({
    address: CONTRACTS.SCORING_ENGINE,
    abi: SCORING_ENGINE_ABI,
    functionName: 'calculateRangeScore',
    args: enabled ? [inRangeTime!, totalTime!, tickDistance!] : undefined,
    chainId: arbitrumSepolia.id,
    query: { enabled },
  });
}

/** Calculate a fee battle score via the Stylus ScoringEngine */
export function useCalculateFeeScore(
  feesUSD: bigint | undefined,
  lpValueUSD: bigint | undefined,
  duration: bigint | undefined,
) {
  const enabled = feesUSD !== undefined && lpValueUSD !== undefined && duration !== undefined && duration > 0n;
  return useReadContract({
    address: CONTRACTS.SCORING_ENGINE,
    abi: SCORING_ENGINE_ABI,
    functionName: 'calculateFeeScore',
    args: enabled ? [feesUSD!, lpValueUSD!, duration!] : undefined,
    chainId: arbitrumSepolia.id,
    query: { enabled },
  });
}

/** Normalize a score for cross-DEX fairness */
export function useNormalizeCrossDex(
  rawScore: bigint | undefined,
  dexType: number | undefined,
) {
  const enabled = rawScore !== undefined && dexType !== undefined;
  return useReadContract({
    address: CONTRACTS.SCORING_ENGINE,
    abi: SCORING_ENGINE_ABI,
    functionName: 'normalizeCrossDex',
    args: enabled ? [rawScore!, dexType!] : undefined,
    chainId: arbitrumSepolia.id,
    query: { enabled },
  });
}

/** Determine winner from two scores */
export function useDetermineWinner(
  scoreA: bigint | undefined,
  scoreB: bigint | undefined,
) {
  const enabled = scoreA !== undefined && scoreB !== undefined;
  return useReadContract({
    address: CONTRACTS.SCORING_ENGINE,
    abi: SCORING_ENGINE_ABI,
    functionName: 'determineWinner',
    args: enabled ? [scoreA!, scoreB!] : undefined,
    chainId: arbitrumSepolia.id,
    query: { enabled },
  });
}

/** Calculate reward distribution */
export function useCalculateRewards(
  totalFees: bigint | undefined,
  resolverBps: bigint | undefined,
) {
  const enabled = totalFees !== undefined && resolverBps !== undefined;
  return useReadContract({
    address: CONTRACTS.SCORING_ENGINE,
    abi: SCORING_ENGINE_ABI,
    functionName: 'calculateRewards',
    args: enabled ? [totalFees!, resolverBps!] : undefined,
    chainId: arbitrumSepolia.id,
    query: { enabled },
  });
}
