import { useState, useMemo } from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import { formatUnits } from 'viem';
import { CCTP_CHAINS, type CctpChain } from '../lib/contracts';
import { useCCTPBridge } from '../hooks/useCCTPBridge';
import { formatAddress, getExplorerUrl } from '../lib/utils';

// Default destination is Sepolia (where battles live)
const DEFAULT_DEST_CHAIN_ID = 11155111;

function ChainSelect({
  label,
  chains,
  selected,
  onChange,
  disabled,
}: {
  label: string;
  chains: CctpChain[];
  selected: CctpChain | undefined;
  onChange: (chain: CctpChain) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-[10px] font-mono text-gray-500 tracking-widest mb-2">
        {label}
      </label>
      <select
        value={selected?.chainId ?? ''}
        onChange={(e) => {
          const chain = chains.find((c) => c.chainId === Number(e.target.value));
          if (chain) onChange(chain);
        }}
        disabled={disabled}
        className="w-full px-4 py-3 rounded-lg font-mono text-sm bg-[#0a0a0a] text-white border border-gray-800 focus:border-violet-500 focus:outline-none disabled:opacity-50 appearance-none cursor-pointer"
        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%236b7280\' d=\'M6 8L1 3h10z\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
      >
        <option value="" disabled>Select chain</option>
        {chains.map((c) => (
          <option key={c.chainId} value={c.chainId}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function StepIndicator({ step, currentStep }: { step: string; currentStep: string }) {
  const steps = ['approve', 'burn', 'attest', 'mint'];
  const stepLabels: Record<string, string> = {
    approve: 'APPROVE',
    burn: 'BURN',
    attest: 'ATTEST',
    mint: 'MINT',
  };
  const stepMap: Record<string, number> = {
    idle: -1,
    approving: 0,
    burning: 1,
    attesting: 2,
    minting: 3,
    completed: 4,
    error: -1,
  };

  const currentIndex = stepMap[currentStep] ?? -1;

  return (
    <div className="flex items-center gap-1 justify-between mb-6">
      {steps.map((s, i) => {
        const isActive = i === currentIndex;
        const isDone = i < currentIndex;
        return (
          <div key={s} className="flex items-center gap-1 flex-1">
            <div
              className="flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-mono font-bold shrink-0"
              style={{
                background: isDone
                  ? 'rgba(139, 92, 246, 0.3)'
                  : isActive
                  ? 'rgba(139, 92, 246, 0.15)'
                  : 'rgba(30, 30, 30, 0.8)',
                border: isDone
                  ? '1px solid rgba(139, 92, 246, 0.6)'
                  : isActive
                  ? '1px solid rgba(139, 92, 246, 0.4)'
                  : '1px solid rgba(75, 75, 75, 0.4)',
                color: isDone || isActive ? '#a78bfa' : '#4b5563',
              }}
            >
              {isDone ? '✓' : i + 1}
            </div>
            <span
              className="text-[9px] font-mono tracking-wider"
              style={{ color: isDone || isActive ? '#a78bfa' : '#4b5563' }}
            >
              {stepLabels[s]}
            </span>
            {i < steps.length - 1 && (
              <div
                className="flex-1 h-px mx-1"
                style={{
                  background: isDone
                    ? 'rgba(139, 92, 246, 0.4)'
                    : 'rgba(75, 75, 75, 0.3)',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function CctpBridge() {
  const { address, chain, isConnected } = useAccount();
  const { switchChainAsync } = useSwitchChain();

  const [sourceChain, setSourceChain] = useState<CctpChain | undefined>(undefined);
  const [destChain, setDestChain] = useState<CctpChain | undefined>(
    CCTP_CHAINS.find((c) => c.chainId === DEFAULT_DEST_CHAIN_ID)
  );

  // Filter out dest chain from source options and vice versa
  const sourceOptions = useMemo(
    () => CCTP_CHAINS.filter((c) => c.chainId !== destChain?.chainId),
    [destChain]
  );
  const destOptions = useMemo(
    () => CCTP_CHAINS.filter((c) => c.chainId !== sourceChain?.chainId),
    [sourceChain]
  );

  const bridge = useCCTPBridge(sourceChain, destChain);

  const formattedBalance = bridge.balance !== undefined
    ? formatUnits(bridge.balance, 6)
    : '—';

  const canBridge =
    isConnected &&
    sourceChain &&
    destChain &&
    bridge.amount &&
    parseFloat(bridge.amount) > 0 &&
    bridge.balance !== undefined &&
    bridge.balance >= BigInt(Math.floor(parseFloat(bridge.amount) * 1e6));

  const isProcessing =
    bridge.isApproving || bridge.isBurning || bridge.isAttesting || bridge.isMinting;

  const handleSwitchToSource = async () => {
    if (sourceChain) {
      await switchChainAsync({ chainId: sourceChain.chainId });
    }
  };

  const handleBridge = () => {
    if (bridge.needsApproval) {
      bridge.approve();
    } else {
      bridge.burn();
    }
  };

  return (
    <div
      className="rounded-2xl p-6"
      style={{
        background: '#0a0a0a',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        boxShadow: '0 0 30px rgba(139, 92, 246, 0.1)',
      }}
    >
      {/* Step indicator */}
      {bridge.step !== 'idle' && bridge.step !== 'error' && (
        <StepIndicator step="" currentStep={bridge.step} />
      )}

      {/* Chain selectors */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <ChainSelect
          label="FROM"
          chains={sourceOptions}
          selected={sourceChain}
          onChange={setSourceChain}
          disabled={isProcessing}
        />
        <ChainSelect
          label="TO"
          chains={destOptions}
          selected={destChain}
          onChange={setDestChain}
          disabled={isProcessing}
        />
      </div>

      {/* Amount input */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <label className="text-[10px] font-mono text-gray-500 tracking-widest">
            AMOUNT (USDC)
          </label>
          <button
            onClick={() => {
              if (bridge.balance !== undefined) {
                bridge.setAmount(formatUnits(bridge.balance, 6));
              }
            }}
            className="text-[10px] font-mono tracking-wider text-violet-400 hover:text-violet-300"
            disabled={!bridge.balance || isProcessing}
          >
            BAL: {formattedBalance} USDC
          </button>
        </div>
        <div
          className="flex items-center rounded-lg overflow-hidden"
          style={{
            background: '#050505',
            border: '1px solid rgba(139, 92, 246, 0.2)',
          }}
        >
          <input
            type="number"
            placeholder="0.00"
            value={bridge.amount}
            onChange={(e) => bridge.setAmount(e.target.value)}
            disabled={isProcessing}
            className="flex-1 px-4 py-3.5 bg-transparent text-white font-mono text-lg focus:outline-none disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <div className="px-4 py-3.5 text-xs font-mono font-bold text-violet-400 tracking-wider">
            USDC
          </div>
        </div>
      </div>

      {/* Wrong chain warning */}
      {isConnected && sourceChain && !bridge.isOnSourceChain && bridge.step === 'idle' && (
        <button
          onClick={handleSwitchToSource}
          className="w-full py-3.5 rounded-xl font-mono font-bold text-xs tracking-widest mb-4"
          style={{
            background: 'rgba(234, 179, 8, 0.15)',
            border: '1px solid rgba(234, 179, 8, 0.4)',
            color: '#eab308',
          }}
        >
          SWITCH TO {sourceChain.name.toUpperCase()}
        </button>
      )}

      {/* Action button */}
      {bridge.step === 'idle' && (
        <button
          onClick={handleBridge}
          disabled={!canBridge || (!bridge.isOnSourceChain && !!sourceChain)}
          className="w-full py-3.5 rounded-xl font-mono font-bold text-xs tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          style={{
            background: canBridge
              ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(88, 28, 135, 0.3))'
              : 'rgba(30, 30, 30, 0.5)',
            border: canBridge
              ? '1px solid rgba(139, 92, 246, 0.5)'
              : '1px solid rgba(75, 75, 75, 0.3)',
            color: canBridge ? '#a78bfa' : '#4b5563',
          }}
        >
          {!isConnected
            ? 'CONNECT WALLET'
            : !sourceChain || !destChain
            ? 'SELECT CHAINS'
            : !bridge.amount || parseFloat(bridge.amount) === 0
            ? 'ENTER AMOUNT'
            : bridge.needsApproval
            ? 'APPROVE USDC'
            : 'BRIDGE USDC'}
        </button>
      )}

      {/* Processing states */}
      {bridge.isApproving && (
        <StatusCard color="violet" label="APPROVING USDC" detail="Waiting for approval confirmation..." />
      )}
      {bridge.isBurning && (
        <StatusCard color="violet" label="BURNING USDC" detail="Depositing USDC for cross-chain transfer..." />
      )}
      {bridge.isAttesting && (
        <StatusCard color="yellow" label="WAITING FOR ATTESTATION" detail="Circle is signing the message. This may take 1-5 minutes..." pulse />
      )}
      {bridge.isMinting && (
        <StatusCard color="violet" label="MINTING ON DESTINATION" detail="Receiving USDC on destination chain..." />
      )}

      {/* Completed */}
      {bridge.isCompleted && (
        <div
          className="p-4 rounded-xl text-center"
          style={{
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
          }}
        >
          <p className="text-sm font-mono font-bold text-green-400 tracking-wider mb-2">
            BRIDGE COMPLETE
          </p>
          <p className="text-xs font-mono text-gray-400 mb-3">
            USDC has been minted on {destChain?.name}
          </p>
          <button
            onClick={bridge.reset}
            className="px-6 py-2 rounded-lg text-[10px] font-mono font-bold tracking-widest text-violet-400 hover:text-violet-300"
            style={{
              background: 'rgba(139, 92, 246, 0.1)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
            }}
          >
            BRIDGE AGAIN
          </button>
        </div>
      )}

      {/* Error */}
      {bridge.step === 'error' && bridge.error && (
        <div
          className="p-4 rounded-xl"
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
          }}
        >
          <p className="text-xs font-mono font-bold text-red-400 tracking-wider mb-1">
            ERROR
          </p>
          <p className="text-xs font-mono text-gray-400 break-all mb-3">
            {bridge.error.length > 200
              ? bridge.error.slice(0, 200) + '...'
              : bridge.error}
          </p>
          <button
            onClick={bridge.reset}
            className="px-4 py-2 rounded-lg text-[10px] font-mono font-bold tracking-widest text-red-400 hover:text-red-300"
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
            }}
          >
            TRY AGAIN
          </button>
        </div>
      )}

      {/* Transaction links */}
      {(bridge.burnTxHash || bridge.mintTxHash) && (
        <div className="mt-4 space-y-2">
          {bridge.burnTxHash && sourceChain && (
            <TxLink
              label="BURN TX"
              hash={bridge.burnTxHash}
              chainId={sourceChain.chainId}
              chainName={sourceChain.name}
            />
          )}
          {bridge.mintTxHash && destChain && (
            <TxLink
              label="MINT TX"
              hash={bridge.mintTxHash}
              chainId={destChain.chainId}
              chainName={destChain.name}
            />
          )}
        </div>
      )}
    </div>
  );
}

function StatusCard({
  color,
  label,
  detail,
  pulse,
}: {
  color: 'violet' | 'yellow' | 'green';
  label: string;
  detail: string;
  pulse?: boolean;
}) {
  const colors = {
    violet: { bg: 'rgba(139, 92, 246, 0.1)', border: 'rgba(139, 92, 246, 0.3)', text: '#a78bfa' },
    yellow: { bg: 'rgba(234, 179, 8, 0.1)', border: 'rgba(234, 179, 8, 0.3)', text: '#eab308' },
    green: { bg: 'rgba(34, 197, 94, 0.1)', border: 'rgba(34, 197, 94, 0.3)', text: '#22c55e' },
  };
  const c = colors[color];

  return (
    <div
      className={`p-4 rounded-xl ${pulse ? 'animate-pulse' : ''}`}
      style={{ background: c.bg, border: `1px solid ${c.border}` }}
    >
      <div className="flex items-center gap-2 mb-1">
        <div
          className="w-2 h-2 rounded-full animate-pulse"
          style={{ background: c.text }}
        />
        <p className="text-xs font-mono font-bold tracking-wider" style={{ color: c.text }}>
          {label}
        </p>
      </div>
      <p className="text-xs font-mono text-gray-500 tracking-wider">
        {detail}
      </p>
    </div>
  );
}

function TxLink({
  label,
  hash,
  chainId,
  chainName,
}: {
  label: string;
  hash: string;
  chainId: number;
  chainName: string;
}) {
  return (
    <a
      href={getExplorerUrl(hash, 'tx', chainId)}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between px-3 py-2 rounded-lg text-[10px] font-mono tracking-wider hover:opacity-80 transition-opacity"
      style={{
        background: 'rgba(139, 92, 246, 0.05)',
        border: '1px solid rgba(139, 92, 246, 0.15)',
      }}
    >
      <span className="text-gray-500">
        {label} ({chainName})
      </span>
      <span className="text-violet-400">
        {formatAddress(hash, 6)} ↗
      </span>
    </a>
  );
}
