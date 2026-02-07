import { useState, useEffect, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { Loader2, X, Swords } from 'lucide-react';
import { useUserPositions, useIsApprovedForAll, useSetApprovalForAll } from '../../hooks/usePositionManager';
import { useJoinBattle } from '../../hooks/useBattleVault';
import { getVaultAddress } from '../../lib/contracts';
import type { VaultType } from '../../types';

interface JoinBattleModalProps {
  isOpen: boolean;
  onClose: () => void;
  battleId: bigint;
  vaultType: VaultType;
}

export default function JoinBattleModal({ isOpen, onClose, battleId, vaultType }: JoinBattleModalProps) {
  const { address, isConnected } = useAccount();
  const [selectedTokenId, setSelectedTokenId] = useState<bigint | null>(null);

  // Fetch user's LP positions
  const { tokenIds: userPositions, isLoading: loadingPositions } = useUserPositions(address);

  // Check approval
  const vaultAddress = getVaultAddress(vaultType);
  const { data: isApproved, refetch: refetchApproval } = useIsApprovedForAll(address, vaultAddress);

  // Write hooks
  const { setApprovalForAll, isPending: approvePending, isSuccess: approveSuccess } = useSetApprovalForAll();
  const { joinBattle, isPending: joinPending, isSuccess: joinSuccess } = useJoinBattle(vaultType);

  // Refetch approval after approve succeeds
  useMemo(() => {
    if (approveSuccess) refetchApproval();
  }, [approveSuccess, refetchApproval]);

  // Close modal on successful join
  useEffect(() => {
    if (joinSuccess) {
      onClose();
    }
  }, [joinSuccess, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // Reset selection when modal opens
  useEffect(() => {
    if (isOpen) setSelectedTokenId(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const needsApproval = !isApproved;

  const handleApprove = () => {
    setApprovalForAll(vaultAddress, true);
  };

  const handleJoin = () => {
    if (selectedTokenId === null) return;
    joinBattle(battleId, selectedTokenId);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #111111 0%, #0a0a0a 100%)',
          border: '1px solid rgba(237, 127, 47, 0.3)',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5), 0 0 30px rgba(237, 127, 47, 0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4">
          <div className="flex items-center gap-3">
            <Swords className="w-5 h-5" style={{ color: '#ed7f2f' }} />
            <h2 className="text-lg font-black text-white tracking-wide">JOIN BATTLE</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 space-y-5">
          {/* Battle Info */}
          <div
            className="p-3 rounded-lg"
            style={{
              background: 'rgba(237, 127, 47, 0.08)',
              border: '1px solid rgba(237, 127, 47, 0.2)',
            }}
          >
            <p className="text-[10px] font-mono tracking-wider" style={{ color: '#ed7f2f' }}>
              BATTLE #{battleId.toString()} // {vaultType.toUpperCase()} VAULT
            </p>
            <p className="text-xs font-mono text-gray-500 mt-1 tracking-wider">
              Select your LP position to enter this battle
            </p>
          </div>

          {/* Position Selector */}
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
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {userPositions.map((id) => (
                  <button
                    key={id.toString()}
                    onClick={() => setSelectedTokenId(id)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-mono font-bold tracking-wider transition-all"
                    style={{
                      background: selectedTokenId === id ? 'rgba(66, 199, 230, 0.15)' : 'rgba(15, 15, 15, 0.9)',
                      border: selectedTokenId === id ? '1px solid rgba(66, 199, 230, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
                      color: selectedTokenId === id ? '#42c7e6' : '#6b7280',
                    }}
                  >
                    <span>POSITION #{id.toString()}</span>
                    {selectedTokenId === id && (
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

          {/* Action Buttons */}
          {needsApproval ? (
            <button
              onClick={handleApprove}
              disabled={approvePending || selectedTokenId === null}
              className="w-full py-4 rounded-lg text-center font-black text-sm tracking-widest transition-all hover:opacity-90 disabled:opacity-50"
              style={{
                background: 'transparent',
                border: '2px solid rgba(66, 199, 230, 0.6)',
                color: '#42c7e6',
                boxShadow: '0 0 20px rgba(66, 199, 230, 0.15)',
              }}
            >
              {approvePending ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> APPROVING...
                </span>
              ) : (
                'STEP 1: APPROVE POSITION'
              )}
            </button>
          ) : (
            <button
              onClick={handleJoin}
              disabled={joinPending || selectedTokenId === null}
              className="w-full py-4 rounded-lg text-center font-black text-sm tracking-widest transition-all hover:opacity-90 disabled:opacity-50"
              style={{
                background: 'transparent',
                border: '2px solid rgba(237, 127, 47, 0.6)',
                color: '#ed7f2f',
                boxShadow: '0 0 20px rgba(237, 127, 47, 0.15)',
              }}
            >
              {joinPending ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> JOINING...
                </span>
              ) : (
                'ENTER BATTLE'
              )}
            </button>
          )}

          {/* Warning */}
          <p className="text-center text-[10px] font-mono tracking-wider text-gray-600 leading-relaxed">
            YOUR LP NFT WILL BE TRANSFERRED TO THE VAULT. IT WILL BE RETURNED WHEN THE BATTLE RESOLVES.
          </p>
        </div>
      </div>
    </div>
  );
}
