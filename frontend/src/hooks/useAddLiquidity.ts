/**
 * Add Liquidity Hooks for V4 and Camelot
 *
 * Handles the multi-step approval + mint flow for both DEXes.
 */

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { arbitrumSepolia } from 'wagmi/chains';
import { type Address, maxUint256, maxUint160 } from 'viem';
import {
  CONTRACTS,
  ERC20_ABI,
  PERMIT2_ABI,
  POSITION_MANAGER_MINT_ABI,
  CAMELOT_NFT_MANAGER_ABI,
} from '../lib/contracts';
import { encodeMintPosition, type PoolKey } from '../lib/v4-encoding';

// ============ Constants ============

const PERMIT2 = CONTRACTS.PERMIT2;
const POSITION_MANAGER = CONTRACTS.POSITION_MANAGER;
const CAMELOT_NFT_MANAGER = CONTRACTS.CAMELOT_NFT_MANAGER;

// V4 WETH/USDC pool key (hooks = zero address until hook is deployed)
const V4_POOL_KEY: PoolKey = {
  currency0: CONTRACTS.WETH,
  currency1: CONTRACTS.USDC,
  fee: 3000,
  tickSpacing: 60,
  hooks: '0x0000000000000000000000000000000000000000',
};

// Far future expiration for Permit2 approvals
const MAX_EXPIRATION = BigInt('281474976710655'); // type(uint48).max

// ============ V4 Hook ============

export function useAddLiquidityV4() {
  const { address } = useAccount();

  // Read balances
  const { data: wethBalance, refetch: refetchWethBalance } = useReadContract({
    address: CONTRACTS.WETH,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: arbitrumSepolia.id,
    query: { enabled: !!address },
  });

  const { data: usdcBalance, refetch: refetchUsdcBalance } = useReadContract({
    address: CONTRACTS.USDC,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: arbitrumSepolia.id,
    query: { enabled: !!address },
  });

  // Read ERC20 allowances to Permit2
  const { data: wethPermit2Allowance, refetch: refetchWethPermit2 } = useReadContract({
    address: CONTRACTS.WETH,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, PERMIT2] : undefined,
    chainId: arbitrumSepolia.id,
    query: { enabled: !!address },
  });

  const { data: usdcPermit2Allowance, refetch: refetchUsdcPermit2 } = useReadContract({
    address: CONTRACTS.USDC,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, PERMIT2] : undefined,
    chainId: arbitrumSepolia.id,
    query: { enabled: !!address },
  });

  // Read Permit2 allowances to PositionManager
  const { data: wethPositionAllowance, refetch: refetchWethPosition } = useReadContract({
    address: PERMIT2,
    abi: PERMIT2_ABI,
    functionName: 'allowance',
    args: address ? [address, CONTRACTS.WETH, POSITION_MANAGER] : undefined,
    chainId: arbitrumSepolia.id,
    query: { enabled: !!address },
  });

  const { data: usdcPositionAllowance, refetch: refetchUsdcPosition } = useReadContract({
    address: PERMIT2,
    abi: PERMIT2_ABI,
    functionName: 'allowance',
    args: address ? [address, CONTRACTS.USDC, POSITION_MANAGER] : undefined,
    chainId: arbitrumSepolia.id,
    query: { enabled: !!address },
  });

  // Write contracts
  const {
    writeContract: writeApprove,
    data: approveHash,
    isPending: approvePending,
    error: approveError,
    reset: resetApprove,
  } = useWriteContract();

  const { isLoading: approveConfirming, isSuccess: approveSuccess } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  const {
    writeContract: writeMint,
    data: mintHash,
    isPending: mintPending,
    error: mintError,
    reset: resetMint,
  } = useWriteContract();

  const { isLoading: mintConfirming, isSuccess: mintSuccess } = useWaitForTransactionReceipt({
    hash: mintHash,
  });

  // Approval state checks
  const needsWethPermit2Approval = !wethPermit2Allowance || (wethPermit2Allowance as bigint) === 0n;
  const needsUsdcPermit2Approval = !usdcPermit2Allowance || (usdcPermit2Allowance as bigint) === 0n;

  // Permit2 allowance returns [amount, expiration, nonce]
  const wethPosAmount = wethPositionAllowance ? (wethPositionAllowance as [bigint, bigint, bigint])[0] : 0n;
  const usdcPosAmount = usdcPositionAllowance ? (usdcPositionAllowance as [bigint, bigint, bigint])[0] : 0n;
  const needsWethPositionApproval = wethPosAmount === 0n;
  const needsUsdcPositionApproval = usdcPosAmount === 0n;

  // Step 1: Approve token to Permit2
  const approveToPermit2 = (token: Address) => {
    resetApprove();
    writeApprove({
      address: token,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [PERMIT2, maxUint256],
      chainId: arbitrumSepolia.id,
    });
  };

  // Step 2: Approve via Permit2 to PositionManager
  const approveViaPermit2 = (token: Address) => {
    resetApprove();
    writeApprove({
      address: PERMIT2,
      abi: PERMIT2_ABI,
      functionName: 'approve',
      args: [token, POSITION_MANAGER, maxUint160, MAX_EXPIRATION],
      chainId: arbitrumSepolia.id,
    });
  };

  // Step 3: Mint position
  const mintPosition = (
    tickLower: number,
    tickUpper: number,
    amount0Max: bigint,
    amount1Max: bigint,
  ) => {
    if (!address) return;
    resetMint();

    // Use amount0Max as liquidity approximation (V4 will compute actual)
    const liquidity = amount0Max;

    const unlockData = encodeMintPosition({
      poolKey: V4_POOL_KEY,
      tickLower,
      tickUpper,
      liquidity,
      amount0Max,
      amount1Max,
      recipient: address,
    });

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800); // 30 min

    writeMint({
      address: POSITION_MANAGER,
      abi: POSITION_MANAGER_MINT_ABI,
      functionName: 'modifyLiquidities',
      args: [unlockData, deadline],
      chainId: arbitrumSepolia.id,
    });
  };

  const refetchAll = () => {
    refetchWethBalance();
    refetchUsdcBalance();
    refetchWethPermit2();
    refetchUsdcPermit2();
    refetchWethPosition();
    refetchUsdcPosition();
  };

  return {
    // Balances
    wethBalance: (wethBalance as bigint) ?? 0n,
    usdcBalance: (usdcBalance as bigint) ?? 0n,
    // Approval states
    needsWethPermit2Approval,
    needsUsdcPermit2Approval,
    needsWethPositionApproval,
    needsUsdcPositionApproval,
    // Actions
    approveToPermit2,
    approveViaPermit2,
    mintPosition,
    // Tx state
    approveHash,
    approvePending,
    approveConfirming,
    approveSuccess,
    approveError,
    mintHash,
    mintPending,
    mintConfirming,
    mintSuccess,
    mintError,
    // Helpers
    refetchAll,
    resetApprove,
    resetMint,
  };
}

// ============ Camelot Hook ============

export function useAddLiquidityCamelot() {
  const { address } = useAccount();

  // Read balances
  const { data: wethBalance, refetch: refetchWethBalance } = useReadContract({
    address: CONTRACTS.WETH,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: arbitrumSepolia.id,
    query: { enabled: !!address },
  });

  const { data: usdcBalance, refetch: refetchUsdcBalance } = useReadContract({
    address: CONTRACTS.USDC,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: arbitrumSepolia.id,
    query: { enabled: !!address },
  });

  // Read allowances to Camelot NFT Manager
  const { data: wethAllowance, refetch: refetchWethAllowance } = useReadContract({
    address: CONTRACTS.WETH,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, CAMELOT_NFT_MANAGER] : undefined,
    chainId: arbitrumSepolia.id,
    query: { enabled: !!address },
  });

  const { data: usdcAllowance, refetch: refetchUsdcAllowance } = useReadContract({
    address: CONTRACTS.USDC,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, CAMELOT_NFT_MANAGER] : undefined,
    chainId: arbitrumSepolia.id,
    query: { enabled: !!address },
  });

  // Write contracts
  const {
    writeContract: writeApprove,
    data: approveHash,
    isPending: approvePending,
    error: approveError,
    reset: resetApprove,
  } = useWriteContract();

  const { isLoading: approveConfirming, isSuccess: approveSuccess } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  const {
    writeContract: writeMint,
    data: mintHash,
    isPending: mintPending,
    error: mintError,
    reset: resetMint,
  } = useWriteContract();

  const { isLoading: mintConfirming, isSuccess: mintSuccess } = useWaitForTransactionReceipt({
    hash: mintHash,
  });

  // Approval state checks
  const needsWethApproval = !wethAllowance || (wethAllowance as bigint) === 0n;
  const needsUsdcApproval = !usdcAllowance || (usdcAllowance as bigint) === 0n;

  // Step 1: Approve token to Camelot NFT Manager
  const approveToken = (token: Address) => {
    resetApprove();
    writeApprove({
      address: token,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [CAMELOT_NFT_MANAGER, maxUint256],
      chainId: arbitrumSepolia.id,
    });
  };

  // Step 2: Mint position on Camelot
  const mintPosition = (
    tickLower: number,
    tickUpper: number,
    amount0Desired: bigint,
    amount1Desired: bigint,
  ) => {
    if (!address) return;
    resetMint();

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800); // 30 min

    writeMint({
      address: CAMELOT_NFT_MANAGER,
      abi: CAMELOT_NFT_MANAGER_ABI,
      functionName: 'mint',
      args: [
        {
          token0: CONTRACTS.WETH,
          token1: CONTRACTS.USDC,
          tickLower,
          tickUpper,
          amount0Desired,
          amount1Desired,
          amount0Min: 0n,
          amount1Min: 0n,
          recipient: address,
          deadline,
        },
      ],
      chainId: arbitrumSepolia.id,
    });
  };

  const refetchAll = () => {
    refetchWethBalance();
    refetchUsdcBalance();
    refetchWethAllowance();
    refetchUsdcAllowance();
  };

  return {
    // Balances
    wethBalance: (wethBalance as bigint) ?? 0n,
    usdcBalance: (usdcBalance as bigint) ?? 0n,
    // Approval states
    needsWethApproval,
    needsUsdcApproval,
    // Actions
    approveToken,
    mintPosition,
    // Tx state
    approveHash,
    approvePending,
    approveConfirming,
    approveSuccess,
    approveError,
    mintHash,
    mintPending,
    mintConfirming,
    mintSuccess,
    mintError,
    // Helpers
    refetchAll,
    resetApprove,
    resetMint,
  };
}
