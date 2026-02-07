import { useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import type { Address } from 'viem';
import { CONTRACTS, ERC721_ABI } from '../lib/contracts';

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

/** Get a position token ID by owner and index */
export function usePositionTokenByIndex(owner: Address | undefined, index: bigint) {
  return useReadContract({
    address: CONTRACTS.POSITION_MANAGER,
    abi: ERC721_ABI,
    functionName: 'tokenOfOwnerByIndex',
    args: owner ? [owner, index] : undefined,
    chainId: sepolia.id,
    query: { enabled: !!owner },
  });
}

/** Get all position token IDs owned by an address */
export function useUserPositions(owner: Address | undefined, balance: bigint | undefined) {
  const count = balance !== undefined ? Number(balance) : 0;
  const indices = Array.from({ length: count }, (_, i) => BigInt(i));

  const { data, isLoading } = useReadContracts({
    contracts: indices.map((index) => ({
      address: CONTRACTS.POSITION_MANAGER,
      abi: ERC721_ABI,
      functionName: 'tokenOfOwnerByIndex' as const,
      args: [owner!, index] as const,
      chainId: sepolia.id,
    })),
    query: { enabled: !!owner && count > 0 },
  });

  const tokenIds: bigint[] = [];
  if (data) {
    for (const r of data) {
      if (r.status === 'success' && r.result !== undefined) {
        tokenIds.push(r.result as bigint);
      }
    }
  }

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
