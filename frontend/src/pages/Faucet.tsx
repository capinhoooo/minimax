import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useBalance } from 'wagmi';
import { arbitrumSepolia } from 'wagmi/chains';
import { parseEther, parseUnits, formatEther, formatUnits } from 'viem';
import { Loader2, Droplets, Check, AlertCircle } from 'lucide-react';
import { CONTRACTS, ERC20_ABI } from '../lib/contracts';

const WETH_DEPOSIT_ABI = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'payable',
    inputs: [],
    outputs: [],
  },
] as const;

const USDC_MINT_ABI = [
  {
    name: 'mint',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
] as const;

export default function Faucet() {
  const { address, isConnected } = useAccount();

  const [ethAmount, setEthAmount] = useState('0.02');
  const [usdcAmount, setUsdcAmount] = useState('500');

  // Balances
  const { data: ethBalance } = useBalance({
    address,
    chainId: arbitrumSepolia.id,
  });

  const { data: wethBalance, refetch: refetchWeth } = useReadContract({
    address: CONTRACTS.WETH,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: arbitrumSepolia.id,
    query: { enabled: !!address },
  });

  const { data: usdcBalance, refetch: refetchUsdc } = useReadContract({
    address: CONTRACTS.USDC,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: arbitrumSepolia.id,
    query: { enabled: !!address },
  });

  // Wrap ETH → WETH
  const {
    writeContract: writeWrap,
    data: wrapHash,
    isPending: wrapPending,
    error: wrapError,
    reset: resetWrap,
  } = useWriteContract();

  const { isLoading: wrapConfirming, isSuccess: wrapSuccess } = useWaitForTransactionReceipt({
    hash: wrapHash,
  });

  // Mint USDC
  const {
    writeContract: writeMintUsdc,
    data: mintHash,
    isPending: mintPending,
    error: mintError,
    reset: resetMint,
  } = useWriteContract();

  const { isLoading: mintConfirming, isSuccess: mintSuccess } = useWaitForTransactionReceipt({
    hash: mintHash,
  });

  // Refetch balances on success
  useEffect(() => {
    if (wrapSuccess) { refetchWeth(); }
  }, [wrapSuccess, refetchWeth]);

  useEffect(() => {
    if (mintSuccess) { refetchUsdc(); }
  }, [mintSuccess, refetchUsdc]);

  const handleWrap = () => {
    if (!address) return;
    resetWrap();
    writeWrap({
      address: CONTRACTS.WETH,
      abi: WETH_DEPOSIT_ABI,
      functionName: 'deposit',
      value: parseEther(ethAmount || '0'),
      chainId: arbitrumSepolia.id,
    });
  };

  const handleMintUsdc = () => {
    if (!address) return;
    resetMint();
    writeMintUsdc({
      address: CONTRACTS.USDC,
      abi: USDC_MINT_ABI,
      functionName: 'mint',
      args: [address, parseUnits(usdcAmount || '0', 6)],
      chainId: arbitrumSepolia.id,
    });
  };

  const currentError = wrapError || mintError;

  return (
    <div className="min-h-screen grid-bg">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Title */}
        <div className="flex items-center gap-3 mb-3">
          <Droplets className="h-8 w-8" style={{ color: '#a855f7' }} />
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight">
            <span className="gradient-text-magenta italic">GET TOKENS</span>
          </h1>
        </div>
        <p className="text-xs sm:text-sm tracking-[0.2em] text-gray-500 mb-12 uppercase font-mono">
          Wrap ETH to WETH and mint testnet USDC for battle
        </p>

        {/* Balances Card */}
        <div
          className="rounded-xl p-6 mb-8"
          style={{
            background: 'rgba(5, 5, 5, 0.95)',
            border: '1px solid rgba(168, 85, 247, 0.3)',
            boxShadow: '0 0 30px rgba(168, 85, 247, 0.1)',
          }}
        >
          <h3 className="text-xs font-mono font-bold tracking-widest mb-4" style={{ color: '#a855f7' }}>
            YOUR BALANCES
          </h3>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <p className="text-[10px] font-mono text-gray-500 tracking-wider mb-1">ETH</p>
              <p className="text-xl font-bold font-mono text-white">
                {isConnected && ethBalance ? Number(formatEther(ethBalance.value)).toFixed(4) : '---'}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-mono text-gray-500 tracking-wider mb-1">WETH</p>
              <p className="text-xl font-bold font-mono" style={{ color: '#42c7e6' }}>
                {isConnected && wethBalance !== undefined ? Number(formatEther(wethBalance as bigint)).toFixed(4) : '---'}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-mono text-gray-500 tracking-wider mb-1">USDC</p>
              <p className="text-xl font-bold font-mono" style={{ color: '#22c55e' }}>
                {isConnected && usdcBalance !== undefined ? Number(formatUnits(usdcBalance as bigint, 6)).toFixed(2) : '---'}
              </p>
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Wrap ETH → WETH */}
          <div
            className="rounded-xl overflow-hidden"
            style={{
              border: '1px solid rgba(66, 199, 230, 0.3)',
              boxShadow: '0 0 30px rgba(66, 199, 230, 0.1)',
            }}
          >
            <div className="p-6 space-y-5" style={{ background: 'rgba(5, 5, 5, 0.95)' }}>
              <div>
                <h3 className="text-lg font-black tracking-wide mb-1" style={{ color: '#42c7e6' }}>
                  WRAP ETH
                </h3>
                <p className="text-[10px] font-mono text-gray-500 tracking-wider">
                  Convert your ETH to WETH for LP positions
                </p>
              </div>

              <div>
                <label className="block text-xs font-mono font-bold tracking-wider mb-2" style={{ color: '#42c7e6' }}>
                  ETH AMOUNT
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={ethAmount}
                  onChange={(e) => setEthAmount(e.target.value)}
                  placeholder="0.02"
                  className="w-full px-4 py-3 rounded-lg text-sm font-mono text-gray-300 outline-none"
                  style={{
                    background: 'rgba(15, 15, 15, 0.9)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                  }}
                />
              </div>

              {wrapSuccess && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                  <Check className="h-4 w-4" style={{ color: '#22c55e' }} />
                  <span className="text-xs font-mono" style={{ color: '#22c55e' }}>WRAPPED SUCCESSFULLY</span>
                </div>
              )}

              <button
                onClick={handleWrap}
                disabled={!isConnected || wrapPending || wrapConfirming}
                className="w-full py-4 rounded-lg text-center font-black text-lg tracking-widest transition-all hover:opacity-90 disabled:opacity-50"
                style={{
                  background: 'transparent',
                  border: '2px solid rgba(66, 199, 230, 0.6)',
                  color: '#42c7e6',
                  boxShadow: '0 0 20px rgba(66, 199, 230, 0.15)',
                }}
              >
                {wrapPending || wrapConfirming ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" /> WRAPPING...
                  </span>
                ) : (
                  'WRAP ETH → WETH'
                )}
              </button>
            </div>
          </div>

          {/* Mint USDC */}
          <div
            className="rounded-xl overflow-hidden"
            style={{
              border: '1px solid rgba(34, 197, 94, 0.3)',
              boxShadow: '0 0 30px rgba(34, 197, 94, 0.1)',
            }}
          >
            <div className="p-6 space-y-5" style={{ background: 'rgba(5, 5, 5, 0.95)' }}>
              <div>
                <h3 className="text-lg font-black tracking-wide mb-1" style={{ color: '#22c55e' }}>
                  MINT USDC
                </h3>
                <p className="text-[10px] font-mono text-gray-500 tracking-wider">
                  Mint testnet USDC for LP positions
                </p>
              </div>

              <div>
                <label className="block text-xs font-mono font-bold tracking-wider mb-2" style={{ color: '#22c55e' }}>
                  USDC AMOUNT
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={usdcAmount}
                  onChange={(e) => setUsdcAmount(e.target.value)}
                  placeholder="500"
                  className="w-full px-4 py-3 rounded-lg text-sm font-mono text-gray-300 outline-none"
                  style={{
                    background: 'rgba(15, 15, 15, 0.9)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                  }}
                />
              </div>

              {mintSuccess && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                  <Check className="h-4 w-4" style={{ color: '#22c55e' }} />
                  <span className="text-xs font-mono" style={{ color: '#22c55e' }}>MINTED SUCCESSFULLY</span>
                </div>
              )}

              <button
                onClick={handleMintUsdc}
                disabled={!isConnected || mintPending || mintConfirming}
                className="w-full py-4 rounded-lg text-center font-black text-lg tracking-widest transition-all hover:opacity-90 disabled:opacity-50"
                style={{
                  background: 'transparent',
                  border: '2px solid rgba(34, 197, 94, 0.6)',
                  color: '#22c55e',
                  boxShadow: '0 0 20px rgba(34, 197, 94, 0.15)',
                }}
              >
                {mintPending || mintConfirming ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" /> MINTING...
                  </span>
                ) : (
                  'MINT USDC'
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {currentError && (
          <div
            className="rounded-lg p-4 flex items-start gap-3 mt-8"
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
            }}
          >
            <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs font-mono text-red-400">
              ERROR: {currentError.message.slice(0, 200)}
            </p>
          </div>
        )}

        {/* Terminal Status Footer */}
        <div className="mt-16 text-center">
          <p className="text-xs font-mono text-gray-600 tracking-wider">
            TERMINAL STATUS: <span style={{ color: '#22c55e' }}>ONLINE</span> // TESTNET FAUCET // ARBITRUM_SEPOLIA
          </p>
        </div>
      </div>
    </div>
  );
}
