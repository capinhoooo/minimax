import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { Loader2, ChevronRight, Check, AlertCircle, Droplets } from 'lucide-react';
import { CONTRACTS } from '../lib/contracts';
import { priceToTick, nearestUsableTick, tickToPrice } from '../lib/tick-math';
import { useAddLiquidityV4, useAddLiquidityCamelot } from '../hooks/useAddLiquidity';

// ============ Types ============

type DexTab = 'v4' | 'camelot';

type ApprovalStep = 'weth_permit2' | 'usdc_permit2' | 'weth_position' | 'usdc_position' | 'mint' | 'done';
type CamelotStep = 'weth_approve' | 'usdc_approve' | 'mint' | 'done';

// ============ Component ============

export default function Liquidity() {
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();

  // DEX tab state
  const [dexTab, setDexTab] = useState<DexTab>('v4');

  // Form inputs
  const [wethAmount, setWethAmount] = useState('0.01');
  const [usdcAmount, setUsdcAmount] = useState('25');
  const [minPrice, setMinPrice] = useState('1800');
  const [maxPrice, setMaxPrice] = useState('3500');

  // V4 hook
  const v4 = useAddLiquidityV4();

  // Camelot hook
  const camelot = useAddLiquidityCamelot();

  // V4 approval step tracking
  const [v4Step, setV4Step] = useState<ApprovalStep>('weth_permit2');

  // Camelot approval step tracking
  const [camelotStep, setCamelotStep] = useState<CamelotStep>('weth_approve');

  // Success state
  const [mintedTokenId, setMintedTokenId] = useState<string | null>(null);

  // Compute ticks from price inputs
  const tickSpacing = 60;
  const wethDecimals = 18;
  const usdcDecimals = 6;

  const computedTickLower = nearestUsableTick(
    priceToTick(Number(minPrice) || 1800, wethDecimals, usdcDecimals),
    tickSpacing
  );
  const computedTickUpper = nearestUsableTick(
    priceToTick(Number(maxPrice) || 3500, wethDecimals, usdcDecimals),
    tickSpacing
  );

  // Display actual prices after tick rounding
  const actualMinPrice = tickToPrice(computedTickLower, wethDecimals, usdcDecimals);
  const actualMaxPrice = tickToPrice(computedTickUpper, wethDecimals, usdcDecimals);

  // Determine V4 current step based on approval states
  useEffect(() => {
    if (v4.needsWethPermit2Approval) {
      setV4Step('weth_permit2');
    } else if (v4.needsUsdcPermit2Approval) {
      setV4Step('usdc_permit2');
    } else if (v4.needsWethPositionApproval) {
      setV4Step('weth_position');
    } else if (v4.needsUsdcPositionApproval) {
      setV4Step('usdc_position');
    } else {
      setV4Step('mint');
    }
  }, [
    v4.needsWethPermit2Approval,
    v4.needsUsdcPermit2Approval,
    v4.needsWethPositionApproval,
    v4.needsUsdcPositionApproval,
  ]);

  // Determine Camelot current step
  useEffect(() => {
    if (camelot.needsWethApproval) {
      setCamelotStep('weth_approve');
    } else if (camelot.needsUsdcApproval) {
      setCamelotStep('usdc_approve');
    } else {
      setCamelotStep('mint');
    }
  }, [camelot.needsWethApproval, camelot.needsUsdcApproval]);

  // Refetch after approval success
  useEffect(() => {
    if (v4.approveSuccess) {
      v4.refetchAll();
    }
  }, [v4.approveSuccess]);

  useEffect(() => {
    if (camelot.approveSuccess) {
      camelot.refetchAll();
    }
  }, [camelot.approveSuccess]);

  // Handle mint success
  useEffect(() => {
    if (v4.mintSuccess && v4.mintHash) {
      setMintedTokenId(v4.mintHash);
      setV4Step('done');
    }
  }, [v4.mintSuccess, v4.mintHash]);

  useEffect(() => {
    if (camelot.mintSuccess && camelot.mintHash) {
      setMintedTokenId(camelot.mintHash);
      setCamelotStep('done');
    }
  }, [camelot.mintSuccess, camelot.mintHash]);

  // ============ V4 Action Handlers ============

  const handleV4Action = () => {
    switch (v4Step) {
      case 'weth_permit2':
        v4.approveToPermit2(CONTRACTS.WETH);
        break;
      case 'usdc_permit2':
        v4.approveToPermit2(CONTRACTS.USDC);
        break;
      case 'weth_position':
        v4.approveViaPermit2(CONTRACTS.WETH);
        break;
      case 'usdc_position':
        v4.approveViaPermit2(CONTRACTS.USDC);
        break;
      case 'mint':
        v4.mintPosition(
          computedTickLower,
          computedTickUpper,
          parseUnits(wethAmount || '0', wethDecimals),
          parseUnits(usdcAmount || '0', usdcDecimals)
        );
        break;
    }
  };

  const getV4ButtonText = (): string => {
    if (v4.approvePending || v4.approveConfirming) return 'APPROVING...';
    if (v4.mintPending || v4.mintConfirming) return 'MINTING...';

    switch (v4Step) {
      case 'weth_permit2':
        return 'STEP 1: APPROVE WETH TO PERMIT2';
      case 'usdc_permit2':
        return 'STEP 2: APPROVE USDC TO PERMIT2';
      case 'weth_position':
        return 'STEP 3: PERMIT2 APPROVE WETH';
      case 'usdc_position':
        return 'STEP 4: PERMIT2 APPROVE USDC';
      case 'mint':
        return 'MINT POSITION';
      case 'done':
        return 'POSITION MINTED';
      default:
        return 'MINT POSITION';
    }
  };

  // ============ Camelot Action Handlers ============

  const handleCamelotAction = () => {
    switch (camelotStep) {
      case 'weth_approve':
        camelot.approveToken(CONTRACTS.WETH);
        break;
      case 'usdc_approve':
        camelot.approveToken(CONTRACTS.USDC);
        break;
      case 'mint':
        camelot.mintPosition(
          computedTickLower,
          computedTickUpper,
          parseUnits(wethAmount || '0', wethDecimals),
          parseUnits(usdcAmount || '0', usdcDecimals)
        );
        break;
    }
  };

  const getCamelotButtonText = (): string => {
    if (camelot.approvePending || camelot.approveConfirming) return 'APPROVING...';
    if (camelot.mintPending || camelot.mintConfirming) return 'MINTING...';

    switch (camelotStep) {
      case 'weth_approve':
        return 'STEP 1: APPROVE WETH';
      case 'usdc_approve':
        return 'STEP 2: APPROVE USDC';
      case 'mint':
        return 'STEP 3: MINT POSITION';
      case 'done':
        return 'POSITION MINTED';
      default:
        return 'MINT POSITION';
    }
  };

  // Current active hook based on tab
  const isV4 = dexTab === 'v4';
  const isPending = isV4
    ? v4.approvePending || v4.approveConfirming || v4.mintPending || v4.mintConfirming
    : camelot.approvePending || camelot.approveConfirming || camelot.mintPending || camelot.mintConfirming;
  const currentError = isV4 ? (v4.approveError || v4.mintError) : (camelot.approveError || camelot.mintError);
  const isDone = isV4 ? v4Step === 'done' : camelotStep === 'done';

  return (
    <div className="min-h-screen grid-bg">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Title */}
        <div className="flex items-center gap-3 mb-3">
          <Droplets className="h-8 w-8" style={{ color: '#42c7e6' }} />
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight">
            <span className="gradient-text-magenta italic">ADD LIQUIDITY</span>
          </h1>
        </div>
        <p className="text-xs sm:text-sm tracking-[0.2em] text-gray-500 mb-12 uppercase font-mono">
          Mint an LP position to use in battles -- no external DEX UI needed
        </p>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Form */}
          <div
            className="rounded-xl overflow-hidden"
            style={{
              border: '1px solid rgba(237, 127, 47, 0.3)',
              boxShadow: '0 0 30px rgba(237, 127, 47, 0.1)',
            }}
          >
            <div
              className="p-6 space-y-6"
              style={{ background: 'rgba(5, 5, 5, 0.95)' }}
            >
              {/* DEX Selector Tabs */}
              <div>
                <label className="block text-xs font-mono font-bold tracking-wider mb-2" style={{ color: '#42c7e6' }}>
                  DEX PLATFORM
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {(['v4', 'camelot'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => {
                        setDexTab(tab);
                        setMintedTokenId(null);
                      }}
                      className="px-4 py-3 rounded-lg text-sm font-mono font-bold tracking-wider transition-all"
                      style={{
                        background: dexTab === tab ? 'rgba(66, 199, 230, 0.15)' : 'rgba(15, 15, 15, 0.9)',
                        border: dexTab === tab ? '1px solid rgba(66, 199, 230, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
                        color: dexTab === tab ? '#42c7e6' : '#6b7280',
                      }}
                    >
                      {tab === 'v4' ? 'UNISWAP V4' : 'CAMELOT V3'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Token Pair Display */}
              <div>
                <label className="block text-xs font-mono font-bold tracking-wider mb-2" style={{ color: '#42c7e6' }}>
                  TOKEN PAIR
                </label>
                <div
                  className="flex items-center justify-between px-4 py-3 rounded-lg"
                  style={{
                    background: 'rgba(15, 15, 15, 0.9)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <span className="text-sm font-mono font-bold text-white tracking-wider">WETH / USDC</span>
                  <span className="text-xs font-mono tracking-wider" style={{ color: '#ed7f2f' }}>
                    {isV4 ? '0.30% FEE | TICK 60' : 'CAMELOT V3'}
                  </span>
                </div>
              </div>

              {/* Token Amount Inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono font-bold tracking-wider mb-2" style={{ color: '#42c7e6' }}>
                    WETH AMOUNT
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={wethAmount}
                    onChange={(e) => setWethAmount(e.target.value)}
                    placeholder="0.0"
                    className="w-full px-4 py-3 rounded-lg text-sm font-mono text-gray-300 outline-none"
                    style={{
                      background: 'rgba(15, 15, 15, 0.9)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                    }}
                  />
                  <p className="text-[10px] font-mono text-gray-600 mt-1 tracking-wider">
                    BAL: {isConnected ? formatUnits(isV4 ? v4.wethBalance : camelot.wethBalance, 18) : '---'}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-mono font-bold tracking-wider mb-2" style={{ color: '#42c7e6' }}>
                    USDC AMOUNT
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={usdcAmount}
                    onChange={(e) => setUsdcAmount(e.target.value)}
                    placeholder="0.0"
                    className="w-full px-4 py-3 rounded-lg text-sm font-mono text-gray-300 outline-none"
                    style={{
                      background: 'rgba(15, 15, 15, 0.9)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                    }}
                  />
                  <p className="text-[10px] font-mono text-gray-600 mt-1 tracking-wider">
                    BAL: {isConnected ? formatUnits(isV4 ? v4.usdcBalance : camelot.usdcBalance, 6) : '---'}
                  </p>
                </div>
              </div>

              {/* Price Range Inputs */}
              <div>
                <label className="block text-xs font-mono font-bold tracking-wider mb-2" style={{ color: '#42c7e6' }}>
                  PRICE RANGE (USDC PER WETH)
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono text-gray-500 tracking-wider mb-1">
                      MIN PRICE
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                      placeholder="1800"
                      className="w-full px-4 py-3 rounded-lg text-sm font-mono text-gray-300 outline-none"
                      style={{
                        background: 'rgba(15, 15, 15, 0.9)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-gray-500 tracking-wider mb-1">
                      MAX PRICE
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      placeholder="3500"
                      className="w-full px-4 py-3 rounded-lg text-sm font-mono text-gray-300 outline-none"
                      style={{
                        background: 'rgba(15, 15, 15, 0.9)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                      }}
                    />
                  </div>
                </div>
                <p className="text-[10px] font-mono text-gray-600 mt-2 tracking-wider">
                  TICKS: [{computedTickLower}, {computedTickUpper}] | ACTUAL RANGE: {actualMinPrice.toFixed(2)} - {actualMaxPrice.toFixed(2)} USDC
                </p>
              </div>
            </div>
          </div>

          {/* Right Column - Preview & Actions */}
          <div className="space-y-6">
            {/* Preview Card */}
            <div
              className="rounded-xl overflow-hidden relative"
              style={{
                border: '1px solid rgba(237, 127, 47, 0.3)',
                boxShadow: '0 0 30px rgba(237, 127, 47, 0.1)',
                background: 'rgba(5, 5, 5, 0.95)',
              }}
            >
              {/* Corner Badge */}
              <div className="absolute top-0 right-0 overflow-hidden w-24 h-24 pointer-events-none">
                <div
                  className="absolute top-3 -right-6 rotate-45 text-[9px] font-mono font-bold tracking-wider py-1 px-8 text-center"
                  style={{
                    background: isV4
                      ? 'linear-gradient(90deg, #c026d3, #a855f7)'
                      : 'linear-gradient(90deg, #ed7f2f, #f59e0b)',
                    color: 'white',
                  }}
                >
                  {isV4 ? 'V4' : 'CAMELOT'}
                </div>
              </div>

              <div className="p-6">
                <h3 className="text-xl font-black text-center mb-1 tracking-wide" style={{ color: '#42c7e6' }}>
                  POSITION PREVIEW
                </h3>
                <div className="w-12 h-0.5 mx-auto mb-6" style={{ background: '#42c7e6' }} />

                {/* Summary */}
                <div
                  className="rounded-lg p-4 mb-4"
                  style={{
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    background: 'rgba(10, 10, 10, 0.8)',
                  }}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-mono text-gray-500 tracking-wider">DEX:</span>
                    <span className="text-sm font-mono text-white">{isV4 ? 'UNISWAP V4' : 'CAMELOT V3'}</span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-mono text-gray-500 tracking-wider">PAIR:</span>
                    <span className="text-sm font-mono text-white">WETH / USDC</span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-mono text-gray-500 tracking-wider">WETH_DEPOSIT:</span>
                    <span className="text-sm font-mono text-white">{wethAmount || '0'}</span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-mono text-gray-500 tracking-wider">USDC_DEPOSIT:</span>
                    <span className="text-sm font-mono text-white">{usdcAmount || '0'}</span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-mono text-gray-500 tracking-wider">MIN_PRICE:</span>
                    <span className="text-sm font-mono text-white">{actualMinPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-mono text-gray-500 tracking-wider">MAX_PRICE:</span>
                    <span className="text-sm font-mono text-white">{actualMaxPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-mono text-gray-500 tracking-wider">TICK_RANGE:</span>
                    <span className="text-sm font-mono text-white">[{computedTickLower}, {computedTickUpper}]</span>
                  </div>
                </div>

                {/* Approval Progress */}
                {isV4 ? (
                  <div className="space-y-2">
                    <StepIndicator label="WETH -> Permit2" done={!v4.needsWethPermit2Approval} active={v4Step === 'weth_permit2'} />
                    <StepIndicator label="USDC -> Permit2" done={!v4.needsUsdcPermit2Approval} active={v4Step === 'usdc_permit2'} />
                    <StepIndicator label="Permit2 -> WETH PosMgr" done={!v4.needsWethPositionApproval} active={v4Step === 'weth_position'} />
                    <StepIndicator label="Permit2 -> USDC PosMgr" done={!v4.needsUsdcPositionApproval} active={v4Step === 'usdc_position'} />
                    <StepIndicator label="Mint Position" done={v4Step === 'done'} active={v4Step === 'mint'} />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <StepIndicator label="Approve WETH" done={!camelot.needsWethApproval} active={camelotStep === 'weth_approve'} />
                    <StepIndicator label="Approve USDC" done={!camelot.needsUsdcApproval} active={camelotStep === 'usdc_approve'} />
                    <StepIndicator label="Mint Position" done={camelotStep === 'done'} active={camelotStep === 'mint'} />
                  </div>
                )}
              </div>
            </div>

            {/* Error Display */}
            {currentError && (
              <div
                className="rounded-lg p-4 flex items-start gap-3"
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

            {/* Success State */}
            {isDone && mintedTokenId && (
              <div
                className="rounded-lg p-4"
                style={{
                  background: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Check className="h-5 w-5" style={{ color: '#22c55e' }} />
                  <span className="text-sm font-mono font-bold tracking-wider" style={{ color: '#22c55e' }}>
                    POSITION MINTED SUCCESSFULLY
                  </span>
                </div>
                <p className="text-[10px] font-mono text-gray-400 tracking-wider mb-3">
                  TX: {mintedTokenId.slice(0, 10)}...{mintedTokenId.slice(-8)}
                </p>
                <button
                  onClick={() => navigate('/battle/create')}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-mono font-bold tracking-wider transition-all hover:opacity-90"
                  style={{
                    background: 'rgba(237, 127, 47, 0.15)',
                    border: '1px solid rgba(237, 127, 47, 0.5)',
                    color: '#ed7f2f',
                  }}
                >
                  USE IN BATTLE <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Action Button */}
            {!isDone && (
              <>
                {!isConnected ? (
                  <button
                    disabled
                    className="w-full py-4 rounded-lg text-center font-black text-lg tracking-widest opacity-50"
                    style={{
                      border: '2px solid rgba(237, 127, 47, 0.3)',
                      color: '#ed7f2f',
                    }}
                  >
                    CONNECT WALLET FIRST
                  </button>
                ) : (
                  <button
                    onClick={isV4 ? handleV4Action : handleCamelotAction}
                    disabled={isPending}
                    className="w-full py-4 rounded-lg text-center font-black text-lg tracking-widest transition-all hover:opacity-90 disabled:opacity-50"
                    style={{
                      background: 'transparent',
                      border: (isV4 ? v4Step === 'mint' : camelotStep === 'mint')
                        ? '2px solid rgba(237, 127, 47, 0.6)'
                        : '2px solid rgba(66, 199, 230, 0.6)',
                      color: (isV4 ? v4Step === 'mint' : camelotStep === 'mint')
                        ? '#ed7f2f'
                        : '#42c7e6',
                      boxShadow: (isV4 ? v4Step === 'mint' : camelotStep === 'mint')
                        ? '0 0 20px rgba(237, 127, 47, 0.15)'
                        : '0 0 20px rgba(66, 199, 230, 0.15)',
                    }}
                  >
                    {isPending ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        {isV4 ? getV4ButtonText() : getCamelotButtonText()}
                      </span>
                    ) : (
                      isV4 ? getV4ButtonText() : getCamelotButtonText()
                    )}
                  </button>
                )}
              </>
            )}

            {/* Warning */}
            <p className="text-center text-[10px] font-mono tracking-wider text-gray-600 leading-relaxed">
              AFTER MINTING, GO TO CREATE BATTLE TO STAKE YOUR LP POSITION IN THE ARENA.
              {isV4 && ' V4 REQUIRES PERMIT2 APPROVALS BEFORE MINTING.'}
            </p>
          </div>
        </div>

        {/* Terminal Status Footer */}
        <div className="mt-16 text-center">
          <p className="text-xs font-mono text-gray-600 tracking-wider">
            TERMINAL STATUS: <span style={{ color: '#22c55e' }}>ONLINE</span> // BLOCK: LATEST // ARBITRUM_SEPOLIA
          </p>
        </div>
      </div>
    </div>
  );
}

// ============ Step Indicator Sub-component ============

function StepIndicator({ label, done, active }: { label: string; done: boolean; active: boolean }) {
  return (
    <div
      className="flex items-center gap-3 px-3 py-2 rounded-lg"
      style={{
        background: active ? 'rgba(66, 199, 230, 0.08)' : 'rgba(10, 10, 10, 0.5)',
        border: active ? '1px solid rgba(66, 199, 230, 0.3)' : '1px solid rgba(255, 255, 255, 0.05)',
      }}
    >
      {done ? (
        <Check className="h-4 w-4 flex-shrink-0" style={{ color: '#22c55e' }} />
      ) : active ? (
        <ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: '#42c7e6' }} />
      ) : (
        <div className="h-4 w-4 flex-shrink-0 rounded-full" style={{ border: '1px solid rgba(255,255,255,0.15)' }} />
      )}
      <span
        className="text-xs font-mono tracking-wider"
        style={{ color: done ? '#22c55e' : active ? '#42c7e6' : '#4b5563' }}
      >
        {label}
      </span>
    </div>
  );
}
