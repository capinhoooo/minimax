import { useState, useEffect } from 'react';
import { useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { arbitrumSepolia } from 'wagmi/chains';
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
export function usePositionBalance(owner: Address | undefined, nftContract?: Address) {
  return useReadContract({
    address: nftContract ?? CONTRACTS.POSITION_MANAGER,
    abi: ERC721_ABI,
    functionName: 'balanceOf',
    args: owner ? [owner] : undefined,
    chainId: arbitrumSepolia.id,
    query: { enabled: !!owner },
  });
}

/** Get all position token IDs owned by an address for a given NFT contract */
export function useUserPositions(owner: Address | undefined, nftContract?: Address) {
  const contract = nftContract ?? CONTRACTS.POSITION_MANAGER;
  const isCamelot = contract === CONTRACTS.CAMELOT_NFT_MANAGER;
  const publicClient = usePublicClient({ chainId: arbitrumSepolia.id });
  const [tokenIds, setTokenIds] = useState<bigint[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // How many positions does this user own?
  const { data: balanceData } = useReadContract({
    address: contract,
    abi: ERC721_ABI,
    functionName: 'balanceOf',
    args: owner ? [owner] : undefined,
    chainId: arbitrumSepolia.id,
    query: { enabled: !!owner },
  });

  // What's the latest minted token ID? (upper bound for search — V4 only)
  const { data: nextIdData } = useReadContract({
    address: contract,
    abi: NEXT_TOKEN_ID_ABI,
    functionName: 'nextTokenId',
    chainId: arbitrumSepolia.id,
    query: { enabled: !!owner && !isCamelot },
  });

  const balance = balanceData as bigint | undefined;
  const nextId = nextIdData as bigint | undefined;

  useEffect(() => {
    const count = balance !== undefined ? Number(balance) : 0;

    if (!owner || !publicClient || count === 0) {
      setTokenIds([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    const fetchPositions = async () => {
      try {
        // Camelot NFT Manager supports ERC721Enumerable (tokenOfOwnerByIndex)
        if (isCamelot) {
          const calls = Array.from({ length: count }, (_, i) => ({
            address: contract,
            abi: [{
              name: 'tokenOfOwnerByIndex',
              type: 'function' as const,
              stateMutability: 'view' as const,
              inputs: [{ name: 'owner', type: 'address' }, { name: 'index', type: 'uint256' }],
              outputs: [{ name: 'tokenId', type: 'uint256' }],
            }] as const,
            functionName: 'tokenOfOwnerByIndex' as const,
            args: [owner, BigInt(i)] as const,
          }));

          const results = await publicClient.multicall({ contracts: calls });
          const found: bigint[] = [];
          for (const result of results) {
            if (result.status === 'success' && result.result !== undefined) {
              found.push(result.result as bigint);
            }
          }
          if (!cancelled) setTokenIds(found);
          return;
        }

        // V4 PositionManager: scan by ownerOf
        const maxTokenId = nextId !== undefined ? Number(nextId) : 0;
        if (maxTokenId === 0) {
          if (!cancelled) setTokenIds([]);
          return;
        }

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
              address: contract,
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
  }, [owner, publicClient, balance, nextId, contract, isCamelot]);

  return { tokenIds, isLoading };
}

/** Check who the current approved address is for a token */
export function useGetApproved(tokenId: bigint | undefined) {
  return useReadContract({
    address: CONTRACTS.POSITION_MANAGER,
    abi: ERC721_ABI,
    functionName: 'getApproved',
    args: tokenId !== undefined ? [tokenId] : undefined,
    chainId: arbitrumSepolia.id,
    query: { enabled: tokenId !== undefined },
  });
}

/** Check if an operator is approved for all tokens of an owner */
export function useIsApprovedForAll(owner: Address | undefined, operator: Address, nftContract?: Address) {
  return useReadContract({
    address: nftContract ?? CONTRACTS.POSITION_MANAGER,
    abi: ERC721_ABI,
    functionName: 'isApprovedForAll',
    args: owner ? [owner, operator] : undefined,
    chainId: arbitrumSepolia.id,
    query: { enabled: !!owner },
  });
}

/** Approve a single token for transfer to the BattleArena */
export function useApprovePosition() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const approve = (to: Address, tokenId: bigint) => {
    writeContract({
      address: CONTRACTS.POSITION_MANAGER,
      abi: ERC721_ABI,
      functionName: 'approve',
      args: [to, tokenId],
      chainId: arbitrumSepolia.id,
      maxFeePerGas: 100000000n,
    });
  };

  return { approve, hash, isPending, isConfirming, isSuccess, error };
}

/** Set approval for all tokens to an operator */
export function useSetApprovalForAll() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const setApprovalForAll = (operator: Address, approved: boolean, nftContract?: Address) => {
    writeContract({
      address: nftContract ?? CONTRACTS.POSITION_MANAGER,
      abi: ERC721_ABI,
      functionName: 'setApprovalForAll',
      args: [operator, approved],
      chainId: arbitrumSepolia.id,
      maxFeePerGas: 100000000n,
    });
  };

  return { setApprovalForAll, hash, isPending, isConfirming, isSuccess, error };
}
