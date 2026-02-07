import { useState, useEffect } from 'react';
import { useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import type { Address } from 'viem';
import { CONTRACTS, ERC721_ABI } from '../lib/contracts';

// Minimal ABI for nextTokenId (public state variable on V4 PositionManager)
const NEXT_TOKEN_ID_ABI = [
  {
    name: 'nextTokenId',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const;

/** Get the number of LP positions owned by an address */
export function usePositionBalance(owner: Address | undefined) {
  return useReadContract({
    address: CONTRACTS.POSITION_MANAGER,
    abi: ERC721_ABI,
    functionName: 'balanceOf',
    args: owner ? [owner] : undefined,
    chainId: sepolia.id,
    query: { enabled: !!owner },
  });
}

/** Get all position token IDs owned by an address */
export function useUserPositions(owner: Address | undefined) {
  const publicClient = usePublicClient({ chainId: sepolia.id });
  const [tokenIds, setTokenIds] = useState<bigint[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // How many positions does this user own?
  const { data: balanceData } = useReadContract({
    address: CONTRACTS.POSITION_MANAGER,
    abi: ERC721_ABI,
    functionName: 'balanceOf',
    args: owner ? [owner] : undefined,
    chainId: sepolia.id,
    query: { enabled: !!owner },
  });

  // What's the latest minted token ID? (upper bound for search)
  const { data: nextIdData } = useReadContract({
    address: CONTRACTS.POSITION_MANAGER,
    abi: NEXT_TOKEN_ID_ABI,
    functionName: 'nextTokenId',
    chainId: sepolia.id,
    query: { enabled: !!owner },
  });

  const balance = balanceData as bigint | undefined;
  const nextId = nextIdData as bigint | undefined;

  useEffect(() => {
    const count = balance !== undefined ? Number(balance) : 0;
    const maxTokenId = nextId !== undefined ? Number(nextId) : 0;

    if (!owner || !publicClient || count === 0 || maxTokenId === 0) {
      setTokenIds([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    const fetchPositions = async () => {
      try {
        const found: bigint[] = [];
        const BATCH_SIZE = 500;

        // Search backwards from the most recently minted token
        for (let end = maxTokenId - 1; end >= 1 && found.length < count; end -= BATCH_SIZE) {
          const start = Math.max(end - BATCH_SIZE + 1, 1);
          const batchIds: bigint[] = [];
          for (let id = end; id >= start; id--) {
            batchIds.push(BigInt(id));
          }

          const results = await publicClient.multicall({
            contracts: batchIds.map((id) => ({
              address: CONTRACTS.POSITION_MANAGER,
              abi: ERC721_ABI,
              functionName: 'ownerOf' as const,
              args: [id] as const,
            })),
          });

          for (let i = 0; i < results.length; i++) {
            const result = results[i];
            if (
              result.status === 'success' &&
              typeof result.result === 'string' &&
              result.result.toLowerCase() === owner.toLowerCase()
            ) {
              found.push(batchIds[i]);
            }
          }

          if (cancelled) return;
        }

        if (!cancelled) {
          setTokenIds(found);
        }
      } catch (error) {
        console.error('Error fetching LP positions:', error);
        if (!cancelled) {
          setTokenIds([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchPositions();

    return () => {
      cancelled = true;
    };
  }, [owner, publicClient, balance, nextId]);

  return { tokenIds, isLoading };
}

/** Check who the current approved address is for a token */
export function useGetApproved(tokenId: bigint | undefined) {
  return useReadContract({
    address: CONTRACTS.POSITION_MANAGER,
    abi: ERC721_ABI,
    functionName: 'getApproved',
    args: tokenId !== undefined ? [tokenId] : undefined,
    chainId: sepolia.id,
    query: { enabled: tokenId !== undefined },
  });
}

/** Check if an operator is approved for all tokens of an owner */
export function useIsApprovedForAll(owner: Address | undefined, operator: Address) {
  return useReadContract({
    address: CONTRACTS.POSITION_MANAGER,
    abi: ERC721_ABI,
    functionName: 'isApprovedForAll',
    args: owner ? [owner, operator] : undefined,
    chainId: sepolia.id,
    query: { enabled: !!owner },
  });
}

/** Approve a single token for transfer to a vault */
export function useApprovePosition() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const approve = (to: Address, tokenId: bigint) => {
    writeContract({
      address: CONTRACTS.POSITION_MANAGER,
      abi: ERC721_ABI,
      functionName: 'approve',
      args: [to, tokenId],
      chainId: sepolia.id,
    });
  };

  return { approve, hash, isPending, isConfirming, isSuccess, error };
}

/** Set approval for all tokens to a vault operator */
export function useSetApprovalForAll() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const setApprovalForAll = (operator: Address, approved: boolean) => {
    writeContract({
      address: CONTRACTS.POSITION_MANAGER,
      abi: ERC721_ABI,
      functionName: 'setApprovalForAll',
      args: [operator, approved],
      chainId: sepolia.id,
    });
  };

  return { setApprovalForAll, hash, isPending, isConfirming, isSuccess, error };
}
