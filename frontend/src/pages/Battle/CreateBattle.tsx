import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { Loader2 } from 'lucide-react';
import { useCreateBattle } from '../../hooks/useBattleVault';
import { usePositionBalance, useIsApprovedForAll, useSetApprovalForAll } from '../../hooks/usePositionManager';
import { CONTRACTS, getVaultAddress } from '../../lib/contracts';
import type { VaultType } from '../../types';

const durationOptions = [
  { label: '1 HOUR', value: 3600 },
  { label: '24 HOURS', value: 86400 },
  { label: '3 DAYS', value: 259200 },
  { label: '7 DAYS', value: 604800 },
];

export default function CreateBattle() {
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();

  const [vaultType, setVaultType] = useState<VaultType>('range');
  const [tokenId, setTokenId] = useState('');
  const [duration, setDuration] = useState(86400);

  // Check if user has LP positions
  const { data: positionBalance } = usePositionBalance(address);
  const hasPositions = positionBalance !== undefined && (positionBalance as bigint) > 0n;

  // Check approval status
  const vaultAddress = getVaultAddress(vaultType);
  const { data: isApproved, refetch: refetchApproval } = useIsApprovedForAll(address, vaultAddress);

  // Write hooks
  const { setApprovalForAll, isPending: approvePending, isSuccess: approveSuccess } = useSetApprovalForAll();
  const { createBattle, isPending: createPending, isSuccess: createSuccess, error: createError } = useCreateBattle(vaultType);

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
    setApprovalForAll(vaultAddress, true);
  };

  const handleCreate = () => {
    if (!tokenId) return;
    createBattle(BigInt(tokenId), BigInt(duration));
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
                  {(['range', 'fee'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setVaultType(type)}
                      className="px-4 py-3 rounded-lg text-sm font-mono font-bold tracking-wider transition-all"
                      style={{
                        background: vaultType === type ? 'rgba(66, 199, 230, 0.15)' : 'rgba(15, 15, 15, 0.9)',
                        border: vaultType === type ? '1px solid rgba(66, 199, 230, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
                        color: vaultType === type ? '#42c7e6' : '#6b7280',
                      }}
                    >
                      {type === 'range' ? 'RANGE BATTLE' : 'FEE BATTLE'}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] font-mono text-gray-600 mt-2 tracking-wider">
                  {vaultType === 'range'
                    ? 'Win by staying in-range longer than your opponent'
                    : 'Win by earning a higher fee rate than your opponent'}
                </p>
              </div>

              {/* LP Position Token ID */}
              <div>
                <label className="block text-xs font-mono font-bold tracking-wider mb-2" style={{ color: '#42c7e6' }}>
                  LP POSITION TOKEN ID
                </label>
                <input
                  type="number"
                  value={tokenId}
                  onChange={(e) => setTokenId(e.target.value)}
                  placeholder="Enter your V4 position NFT token ID"
                  className="w-full px-4 py-3 rounded-lg text-sm font-mono text-gray-300 outline-none placeholder-gray-600"
                  style={{
                    background: 'rgba(15, 15, 15, 0.9)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                  }}
                />
                {address && (
                  <p className="text-[10px] font-mono text-gray-600 mt-2 tracking-wider">
                    YOUR POSITIONS: {positionBalance !== undefined ? (positionBalance as bigint).toString() : '...'} NFTs found
                  </p>
                )}
              </div>

              {/* Battle Duration */}
              <div>
                <label className="block text-xs font-mono font-bold tracking-wider mb-2" style={{ color: '#42c7e6' }}>
                  BATTLE DURATION
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {durationOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setDuration(opt.value)}
                      className="px-3 py-2.5 rounded-lg text-xs font-mono font-bold tracking-wider transition-all"
                      style={{
                        background: duration === opt.value
                          ? 'rgba(66, 199, 230, 0.15)'
                          : 'rgba(15, 15, 15, 0.9)',
                        border: duration === opt.value
                          ? '1px solid rgba(66, 199, 230, 0.5)'
                          : '1px solid rgba(255, 255, 255, 0.1)',
                        color: duration === opt.value ? '#42c7e6' : '#6b7280',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
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
                  {vaultType === 'range' ? 'RANGE' : 'FEE'}
                </div>
              </div>

              <div className="p-6">
                <h3 className="text-xl font-black text-center mb-1 tracking-wide" style={{ color: '#42c7e6' }}>
                  {vaultType === 'range' ? 'RANGE BATTLE' : 'FEE BATTLE'} ARENA
                </h3>
                <div className="w-12 h-0.5 mx-auto mb-6" style={{ background: '#42c7e6' }} />

                {/* Token & Duration */}
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="text-[10px] font-mono tracking-wider text-gray-500 mb-1">TOKEN ID</p>
                    <p className="text-lg font-black" style={{ color: '#42c7e6' }}>
                      #{tokenId || '---'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-mono tracking-wider text-gray-500 mb-1">DURATION</p>
                    <p className="text-lg font-black text-white">
                      {durationOptions.find((d) => d.value === duration)?.label}
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
                    <span className="text-xs font-mono text-gray-500 tracking-wider">VAULT_TYPE:</span>
                    <span className="text-sm font-mono text-white">{vaultType.toUpperCase()}</span>
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
            {createError && (
              <div
                className="rounded-lg p-4"
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                }}
              >
                <p className="text-xs font-mono text-red-400">
                  ERROR: {createError.message.slice(0, 100)}
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
                disabled={createPending || !tokenId}
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
              WARNING: YOUR LP NFT WILL BE TRANSFERRED TO THE VAULT CONTRACT. IT WILL BE RETURNED WHEN THE BATTLE RESOLVES.
            </p>
          </div>
        </div>

        {/* Terminal Status Footer */}
        <div className="mt-16 text-center">
          <p className="text-xs font-mono text-gray-600 tracking-wider">
            TERMINAL STATUS: <span style={{ color: '#22c55e' }}>ONLINE</span> // BLOCK: LATEST // BATTLE_INIT_V4
          </p>
        </div>
      </div>
    </div>
  );
}
