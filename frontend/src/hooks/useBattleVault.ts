import { useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { arbitrumSepolia } from 'wagmi/chains';
import type { Address } from 'viem';
import { CONTRACTS, BATTLE_ARENA_ABI } from '../lib/contracts';
import { BattleStatus } from '../types';

// ============ Read Hooks ============

/** Get total battle count */
export function useBattleCount() {
  return useReadContract({
    address: CONTRACTS.BATTLE_ARENA,
    abi: BATTLE_ARENA_ABI,
    functionName: 'getBattleCount',
    chainId: arbitrumSepolia.id,
  });
}

/** Get battle IDs by status (PENDING=0, ACTIVE=1, EXPIRED=2, RESOLVED=3) */
export function useBattlesByStatus(status: BattleStatus) {
  return useReadContract({
    address: CONTRACTS.BATTLE_ARENA,
    abi: BATTLE_ARENA_ABI,
    functionName: 'getBattlesByStatus',
    args: [status],
    chainId: arbitrumSepolia.id,
  });
}

/** Get all active battle IDs */
export function useActiveBattles() {
  return useBattlesByStatus(BattleStatus.ACTIVE);
}

/** Get all pending (joinable) battle IDs */
export function usePendingBattles() {
  return useBattlesByStatus(BattleStatus.PENDING);
}

/** Get all expired battle IDs */
export function useExpiredBattles() {
  return useBattlesByStatus(BattleStatus.EXPIRED);
}

/** Get a single battle's details */
export function useBattle(battleId: bigint | undefined) {
  return useReadContract({
    address: CONTRACTS.BATTLE_ARENA,
    abi: BATTLE_ARENA_ABI,
    functionName: 'getBattle',
    args: battleId !== undefined ? [battleId] : undefined,
    chainId: arbitrumSepolia.id,
    query: { enabled: battleId !== undefined },
  });
}

/** Check if a battle has expired */
export function useIsBattleExpired(battleId: bigint | undefined) {
  return useReadContract({
    address: CONTRACTS.BATTLE_ARENA,
    abi: BATTLE_ARENA_ABI,
    functionName: 'isBattleExpired',
    args: battleId !== undefined ? [battleId] : undefined,
    chainId: arbitrumSepolia.id,
    query: { enabled: battleId !== undefined },
  });
}

/** Get a player's battle IDs */
export function usePlayerBattles(player: Address | undefined) {
  return useReadContract({
    address: CONTRACTS.BATTLE_ARENA,
    abi: BATTLE_ARENA_ABI,
    functionName: 'getPlayerBattles',
    args: player ? [player] : undefined,
    chainId: arbitrumSepolia.id,
    query: { enabled: !!player },
  });
}

/** Fetch multiple battles at once */
export function useBattles(battleIds: readonly bigint[]) {
  return useReadContracts({
    contracts: battleIds.map((id) => ({
      address: CONTRACTS.BATTLE_ARENA,
      abi: BATTLE_ARENA_ABI,
      functionName: 'getBattle' as const,
      args: [id] as const,
      chainId: arbitrumSepolia.id,
    })),
    query: { enabled: battleIds.length > 0 },
  });
}

// ============ Write Hooks ============

/** Create a new battle */
export function useCreateBattle() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const createBattle = (dexType: number, tokenId: bigint, duration: bigint, battleType: number) => {
    writeContract({
      address: CONTRACTS.BATTLE_ARENA,
      abi: BATTLE_ARENA_ABI,
      functionName: 'createBattle',
      args: [dexType, tokenId, duration, battleType],
      chainId: arbitrumSepolia.id,
    });
  };

  return { createBattle, hash, isPending, isConfirming, isSuccess, error };
}

/** Join an existing battle */
export function useJoinBattle() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const joinBattle = (battleId: bigint, dexType: number, tokenId: bigint) => {
    writeContract({
      address: CONTRACTS.BATTLE_ARENA,
      abi: BATTLE_ARENA_ABI,
      functionName: 'joinBattle',
      args: [battleId, dexType, tokenId],
      chainId: arbitrumSepolia.id,
    });
  };

  return { joinBattle, hash, isPending, isConfirming, isSuccess, error };
}

/** Resolve a completed battle */
export function useResolveBattle() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const resolveBattle = (battleId: bigint) => {
    writeContract({
      address: CONTRACTS.BATTLE_ARENA,
      abi: BATTLE_ARENA_ABI,
      functionName: 'resolveBattle',
      args: [battleId],
      chainId: arbitrumSepolia.id,
    });
  };

  return { resolveBattle, hash, isPending, isConfirming, isSuccess, error };
}
