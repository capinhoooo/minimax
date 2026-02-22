import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { Loader2 } from 'lucide-react';
import { useCreateBattle } from '../../hooks/useBattleVault';
import { useUserPositions, useIsApprovedForAll, useSetApprovalForAll } from '../../hooks/usePositionManager';
import { CONTRACTS } from '../../lib/contracts';
import { BattleType, DexType, battleTypeName, dexTypeName } from '../../types';

const durationUnits = [
  { label: 'SEC', unit: 'seconds', multiplier: 1 },
  { label: 'MIN', unit: 'minutes', multiplier: 60 },
  { label: 'HRS', unit: 'hours', multiplier: 3600 },
  { label: 'DAYS', unit: 'days', multiplier: 86400 },
  { label: 'MON', unit: 'months', multiplier: 2592000 },
  { label: 'YRS', unit: 'years', multiplier: 31536000 },
] as const;

export default function CreateBattle() {
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();

  const [battleType, setBattleType] = useState<BattleType>(BattleType.RANGE);
  const [dexType, setDexType] = useState<DexType>(DexType.UNISWAP_V4);
  const [tokenId, setTokenId] = useState<bigint | null>(null);
  const [durationAmount, setDurationAmount] = useState('1');
  const [durationUnit, setDurationUnit] = useState<typeof durationUnits[number]>(durationUnits[2]); // default: hours

  const durationSeconds = Math.floor(Number(durationAmount || 0) * durationUnit.multiplier);

  // Pick the correct NFT contract and adapter based on selected DEX
  const nftContract = dexType === DexType.CAMELOT_V3 ? CONTRACTS.CAMELOT_NFT_MANAGER : CONTRACTS.POSITION_MANAGER;
  const adapterContract = dexType === DexType.CAMELOT_V3 ? CONTRACTS.CAMELOT_ADAPTER : CONTRACTS.UNISWAP_V4_ADAPTER;

  // Fetch user's LP positions from the correct DEX
  const { tokenIds: userPositions, isLoading: loadingPositions } = useUserPositions(address, nftContract);

  // Check approval status: adapter needs approval on the NFT contract (adapter calls safeTransferFrom)
  const { data: isApproved, refetch: refetchApproval } = useIsApprovedForAll(address, adapterContract, nftContract);

  // Write hooks
  const { setApprovalForAll, isPending: approvePending, isSuccess: approveSuccess, error: approveError } = useSetApprovalForAll();
  const { createBattle, isPending: createPending, isSuccess: createSuccess, error: createError } = useCreateBattle();

  // Refetch approval after approve succeeds
  useMemo(() => {
    if (approveSuccess) refetchApproval();
  }, [approveSuccess, refetchApproval]);

  // Navigate after successful creation
  useMemo(() => {
    if (createSuccess) {
      navigate('/battle');
    }
  }, [createSuccess, navigate]);

  const handleApprove = () => {
    setApprovalForAll(adapterContract, true, nftContract);
  };

  const handleCreate = () => {
    if (tokenId === null) return;
    createBattle(dexType, tokenId, BigInt(durationSeconds), battleType);
  };

  const needsApproval = !isApproved;

  return (
    <div className="min-h-screen grid-bg">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Title */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black mb-3 tracking-tight">
          <span className="gradient-text-magenta italic">INITIALIZE BATTLE</span>
        </h1>
        <p className="text-xs sm:text-sm tracking-[0.2em] text-gray-500 mb-12 uppercase font-mono">
          Configure your position parameters and challenge the market
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
              {/* Battle Type Selection */}
              <div>
                <label className="block text-xs font-mono font-bold tracking-wider mb-2" style={{ color: '#42c7e6' }}>
                  BATTLE TYPE
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {([BattleType.RANGE, BattleType.FEE] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setBattleType(type)}
                      className="px-4 py-3 rounded-lg text-sm font-mono font-bold tracking-wider transition-all"
                      style={{
                        background: battleType === type ? 'rgba(66, 199, 230, 0.15)' : 'rgba(15, 15, 15, 0.9)',
                        border: battleType === type ? '1px solid rgba(66, 199, 230, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
                        color: battleType === type ? '#42c7e6' : '#6b7280',
                      }}
                    >
                      {battleTypeName(type).toUpperCase()}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] font-mono text-gray-600 mt-2 tracking-wider">
                  {battleType === BattleType.RANGE
                    ? 'Win by staying in-range longer than your opponent'
                    : 'Win by earning a higher fee rate than your opponent'}
                </p>
              </div>

              {/* DEX Type Selection */}
              <div>
                <label className="block text-xs font-mono font-bold tracking-wider mb-2" style={{ color: '#42c7e6' }}>
                  DEX PLATFORM
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {([DexType.UNISWAP_V4, DexType.CAMELOT_V3] as const).map((dex) => (
                    <button
                      key={dex}
                      onClick={() => { setDexType(dex); setTokenId(null); }}
                      className="px-4 py-3 rounded-lg text-sm font-mono font-bold tracking-wider transition-all"
                      style={{
                        background: dexType === dex ? 'rgba(66, 199, 230, 0.15)' : 'rgba(15, 15, 15, 0.9)',
                        border: dexType === dex ? '1px solid rgba(66, 199, 230, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
                        color: dexType === dex ? '#42c7e6' : '#6b7280',
                      }}
                    >
                      {dexTypeName(dex).toUpperCase()}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] font-mono text-gray-600 mt-2 tracking-wider">
                  Cross-DEX battles: your opponent can use a different DEX
                </p>
              </div>

              {/* LP Position Selector */}
              <div>
                <label className="block text-xs font-mono font-bold tracking-wider mb-2" style={{ color: '#42c7e6' }}>
                  SELECT LP POSITION
                </label>
                {!isConnected ? (
                  <div
                    className="w-full px-4 py-3 rounded-lg text-sm font-mono text-gray-600 tracking-wider"
                    style={{
                      background: 'rgba(15, 15, 15, 0.9)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    CONNECT WALLET TO VIEW POSITIONS
                  </div>
                ) : loadingPositions ? (
                  <div
                    className="w-full px-4 py-3 rounded-lg text-sm font-mono text-gray-500 tracking-wider flex items-center gap-2"
                    style={{
                      background: 'rgba(15, 15, 15, 0.9)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    <Loader2 className="h-4 w-4 animate-spin" /> SCANNING POSITIONS...
                  </div>
                ) : userPositions.length === 0 ? (
                  <div
                    className="w-full px-4 py-3 rounded-lg text-sm font-mono text-gray-500 tracking-wider"
                    style={{
                      background: 'rgba(15, 15, 15, 0.9)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    NO LP POSITIONS FOUND
                  </div>
                ) : (
                  <div className="space-y-2">
                    {userPositions.map((id) => (
                      <button
                        key={id.toString()}
                        onClick={() => setTokenId(id)}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-mono font-bold tracking-wider transition-all"
                        style={{
                          background: tokenId === id ? 'rgba(66, 199, 230, 0.15)' : 'rgba(15, 15, 15, 0.9)',
                          border: tokenId === id ? '1px solid rgba(66, 199, 230, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
                          color: tokenId === id ? '#42c7e6' : '#6b7280',
                        }}
                      >
                        <span>POSITION #{id.toString()}</span>
                        {tokenId === id && (
                          <span className="text-[10px] tracking-widest" style={{ color: '#22c55e' }}>SELECTED</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {address && userPositions.length > 0 && (
                  <p className="text-[10px] font-mono text-gray-600 mt-2 tracking-wider">
                    {userPositions.length} POSITION{userPositions.length !== 1 ? 'S' : ''} AVAILABLE
                  </p>
                )}
              </div>

              {/* Battle Duration */}
              <div>
                <label className="block text-xs font-mono font-bold tracking-wider mb-2" style={{ color: '#42c7e6' }}>
                  BATTLE DURATION
                </label>
                <div className="flex gap-3 mb-3">
                  <input
                    type="number"
                    min="1"
                    value={durationAmount}
                    onChange={(e) => setDurationAmount(e.target.value)}
                    className="flex-1 px-4 py-3 rounded-lg text-sm font-mono text-gray-300 outline-none"
                    style={{
                      background: 'rgba(15, 15, 15, 0.9)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                    }}
                  />
                  <select
                    value={durationUnit.unit}
                    onChange={(e) => setDurationUnit(durationUnits.find((u) => u.unit === e.target.value)!)}
                    className="px-4 py-3 rounded-lg text-sm font-mono font-bold tracking-wider outline-none appearance-none cursor-pointer"
                    style={{
                      background: 'rgba(15, 15, 15, 0.9)',
                      border: '1px solid rgba(66, 199, 230, 0.5)',
                      color: '#42c7e6',
                    }}
                  >
                    {durationUnits.map((u) => (
                      <option key={u.unit} value={u.unit}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>
                {durationSeconds > 0 && (
                  <p className="text-[10px] font-mono text-gray-600 tracking-wider">
                    TOTAL: {durationSeconds.toLocaleString()} SECONDS
                  </p>
                )}
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
                    background: 'linear-gradient(90deg, #c026d3, #a855f7)',
                    color: 'white',
                  }}
                >
                  {battleType === BattleType.RANGE ? 'RANGE' : 'FEE'}
                </div>
              </div>

              <div className="p-6">
                <h3 className="text-xl font-black text-center mb-1 tracking-wide" style={{ color: '#42c7e6' }}>
                  {battleTypeName(battleType).toUpperCase()} ARENA
                </h3>
                <div className="w-12 h-0.5 mx-auto mb-6" style={{ background: '#42c7e6' }} />

                {/* Token & Duration */}
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="text-[10px] font-mono tracking-wider text-gray-500 mb-1">TOKEN ID</p>
                    <p className="text-lg font-black" style={{ color: '#42c7e6' }}>
                      #{tokenId !== null ? tokenId.toString() : '---'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-mono tracking-wider text-gray-500 mb-1">DURATION</p>
                    <p className="text-lg font-black text-white">
                      {durationAmount || '0'} {durationUnit.label}
                    </p>
                  </div>
                </div>

                {/* Info Box */}
                <div
                  className="rounded-lg p-4 mb-6"
                  style={{
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    background: 'rgba(10, 10, 10, 0.8)',
                  }}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-mono text-gray-500 tracking-wider">BATTLE_TYPE:</span>
                    <span className="text-sm font-mono text-white">{battleTypeName(battleType).toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-mono text-gray-500 tracking-wider">DEX_PLATFORM:</span>
                    <span className="text-sm font-mono text-white">{dexTypeName(dexType).toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-mono text-gray-500 tracking-wider">MATCH_TOLERANCE:</span>
                    <span className="text-sm font-mono text-white">5%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-mono text-gray-500 tracking-wider">RESOLVER_REWARD:</span>
                    <span className="text-sm font-mono text-white">1%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Error Display */}
            {(approveError || createError) && (
              <div
                className="rounded-lg p-4"
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                }}
              >
                <p className="text-xs font-mono text-red-400">
                  ERROR: {(approveError || createError)!.message.slice(0, 200)}
                </p>
              </div>
            )}

            {/* Action Buttons */}
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
            ) : needsApproval ? (
              <button
                onClick={handleApprove}
                disabled={approvePending}
                className="w-full py-4 rounded-lg text-center font-black text-lg tracking-widest transition-all hover:opacity-90 disabled:opacity-50"
                style={{
                  background: 'transparent',
                  border: '2px solid rgba(66, 199, 230, 0.6)',
                  color: '#42c7e6',
                  boxShadow: '0 0 20px rgba(66, 199, 230, 0.15)',
                }}
              >
                {approvePending ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" /> APPROVING...
                  </span>
                ) : (
                  'STEP 1: APPROVE POSITION'
                )}
              </button>
            ) : (
              <button
                onClick={handleCreate}
                disabled={createPending || tokenId === null || durationSeconds <= 0}
                className="w-full py-4 rounded-lg text-center font-black text-lg tracking-widest transition-all hover:opacity-90 disabled:opacity-50"
                style={{
                  background: 'transparent',
                  border: '2px solid rgba(237, 127, 47, 0.6)',
                  color: '#ed7f2f',
                  boxShadow: '0 0 20px rgba(237, 127, 47, 0.15)',
                }}
              >
                {createPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" /> CREATING...
                  </span>
                ) : (
                  'ENTER ARENA'
                )}
              </button>
            )}

            {/* Warning */}
            <p className="text-center text-[10px] font-mono tracking-wider text-gray-600 leading-relaxed">
              WARNING: YOUR LP NFT WILL BE TRANSFERRED TO THE BATTLEARENA CONTRACT. IT WILL BE RETURNED WHEN THE BATTLE RESOLVES.
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
