import { useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import type { Address } from 'viem';
import {
  CONTRACTS,
  RANGE_VAULT_ABI,
  FEE_VAULT_ABI,
  getVaultAddress,
} from '../lib/contracts';
import type { VaultType } from '../types';

function getAbi(vaultType: VaultType) {
  return vaultType === 'range' ? RANGE_VAULT_ABI : FEE_VAULT_ABI;
}

// ============ Read Hooks ============

/** Get total battle count for a vault */
export function useBattleCount(vaultType: VaultType) {
  return useReadContract({
    address: getVaultAddress(vaultType),
    abi: getAbi(vaultType),
    functionName: 'battleIdCounter',
    chainId: sepolia.id,
  });
}

/** Get all active (unresolved) battle IDs */
export function useActiveBattles(vaultType: VaultType) {
  return useReadContract({
    address: getVaultAddress(vaultType),
    abi: getAbi(vaultType),
    functionName: 'getActiveBattles',
    chainId: sepolia.id,
  });
}

/** Get battles waiting for an opponent */
export function usePendingBattles(vaultType: VaultType) {
  return useReadContract({
    address: getVaultAddress(vaultType),
    abi: getAbi(vaultType),
    functionName: 'getPendingBattles',
    chainId: sepolia.id,
  });
}

/** Get a single battle's details from the Range vault */
export function useRangeBattle(battleId: bigint | undefined) {
  return useReadContract({
    address: CONTRACTS.RANGE_VAULT,
    abi: RANGE_VAULT_ABI,
    functionName: 'getBattle',
    args: battleId !== undefined ? [battleId] : undefined,
    chainId: sepolia.id,
    query: { enabled: battleId !== undefined },
  });
}

/** Get a single battle's details from the Fee vault */
export function useFeeBattle(battleId: bigint | undefined) {
  return useReadContract({
    address: CONTRACTS.FEE_VAULT,
    abi: FEE_VAULT_ABI,
    functionName: 'getBattle',
    args: battleId !== undefined ? [battleId] : undefined,
    chainId: sepolia.id,
    query: { enabled: battleId !== undefined },
  });
}

/** Get battle status string */
export function useBattleStatus(battleId: bigint | undefined, vaultType: VaultType) {
  return useReadContract({
    address: getVaultAddress(vaultType),
    abi: getAbi(vaultType),
    functionName: 'getBattleStatus',
    args: battleId !== undefined ? [battleId] : undefined,
    chainId: sepolia.id,
    query: { enabled: battleId !== undefined },
  });
}

/** Get time remaining for a battle */
export function useTimeRemaining(battleId: bigint | undefined, vaultType: VaultType) {
  return useReadContract({
    address: getVaultAddress(vaultType),
    abi: getAbi(vaultType),
    functionName: 'getTimeRemaining',
    args: battleId !== undefined ? [battleId] : undefined,
    chainId: sepolia.id,
    query: { enabled: battleId !== undefined },
  });
}

/** Get current range performance (Range vault only) */
export function useCurrentPerformance(battleId: bigint | undefined) {
  return useReadContract({
    address: CONTRACTS.RANGE_VAULT,
    abi: RANGE_VAULT_ABI,
    functionName: 'getCurrentPerformance',
    args: battleId !== undefined ? [battleId] : undefined,
    chainId: sepolia.id,
    query: { enabled: battleId !== undefined },
  });
}

/** Get current fee performance (Fee vault only) */
export function useCurrentFeePerformance(battleId: bigint | undefined) {
  return useReadContract({
    address: CONTRACTS.FEE_VAULT,
    abi: FEE_VAULT_ABI,
    functionName: 'getCurrentFeePerformance',
    args: battleId !== undefined ? [battleId] : undefined,
    chainId: sepolia.id,
    query: { enabled: battleId !== undefined },
  });
}

/** Get a user's battles */
export function useUserBattles(user: Address | undefined, vaultType: VaultType) {
  return useReadContract({
    address: getVaultAddress(vaultType),
    abi: getAbi(vaultType),
    functionName: 'getUserBattles',
    args: user ? [user] : undefined,
    chainId: sepolia.id,
    query: { enabled: !!user },
  });
}

/** Get formatted USD value for a battle */
export function useBattleUSDValue(battleId: bigint | undefined, vaultType: VaultType) {
  return useReadContract({
    address: getVaultAddress(vaultType),
    abi: getAbi(vaultType),
    functionName: 'getBattleUSDValue',
    args: battleId !== undefined ? [battleId] : undefined,
    chainId: sepolia.id,
    query: { enabled: battleId !== undefined },
  });
}

/** Fetch multiple battles at once from Range vault */
export function useRangeBattles(battleIds: readonly bigint[]) {
  return useReadContracts({
    contracts: battleIds.map((id) => ({
      address: CONTRACTS.RANGE_VAULT,
      abi: RANGE_VAULT_ABI,
      functionName: 'getBattle' as const,
      args: [id] as const,
      chainId: sepolia.id,
    })),
    query: { enabled: battleIds.length > 0 },
  });
}

/** Fetch multiple battles at once from Fee vault */
export function useFeeBattles(battleIds: readonly bigint[]) {
  return useReadContracts({
    contracts: battleIds.map((id) => ({
      address: CONTRACTS.FEE_VAULT,
      abi: FEE_VAULT_ABI,
      functionName: 'getBattle' as const,
      args: [id] as const,
      chainId: sepolia.id,
    })),
    query: { enabled: battleIds.length > 0 },
  });
}

// ============ Write Hooks ============

/** Create a new battle */
export function useCreateBattle(vaultType: VaultType) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const createBattle = (tokenId: bigint, duration: bigint) => {
    writeContract({
      address: getVaultAddress(vaultType),
      abi: getAbi(vaultType),
      functionName: 'createBattle',
      args: [tokenId, duration],
      chainId: sepolia.id,
    });
  };

  return { createBattle, hash, isPending, isConfirming, isSuccess, error };
}

/** Join an existing battle */
export function useJoinBattle(vaultType: VaultType) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const joinBattle = (battleId: bigint, tokenId: bigint) => {
    writeContract({
      address: getVaultAddress(vaultType),
      abi: getAbi(vaultType),
      functionName: 'joinBattle',
      args: [battleId, tokenId],
      chainId: sepolia.id,
    });
  };

  return { joinBattle, hash, isPending, isConfirming, isSuccess, error };
}

/** Resolve a completed battle */
export function useResolveBattle(vaultType: VaultType) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const resolveBattle = (battleId: bigint) => {
    writeContract({
      address: getVaultAddress(vaultType),
      abi: getAbi(vaultType),
      functionName: 'resolveBattle',
      args: [battleId],
      chainId: sepolia.id,
    });
  };

  return { resolveBattle, hash, isPending, isConfirming, isSuccess, error };
}
