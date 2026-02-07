import { useAccount, useDisconnect, useBalance } from 'wagmi';
import { useState, useEffect } from 'react';
import { Wallet, ChevronDown, LogOut, Copy, ExternalLink } from 'lucide-react';
import { formatAddress, formatTokenAmount, getExplorerUrl, copyToClipboard } from '../../lib/utils';
import { useWalletModal } from '../../context/WalletModalContext';

export default function ConnectButton() {
  const { address, isConnected, chain } = useAccount();
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({ address });
  const { open: openWalletModal } = useWalletModal();
  const [showDropdown, setShowDropdown] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowDropdown(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const handleCopy = async () => {
    if (address) {
      await copyToClipboard(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isConnected) {
    return (
      <button
        onClick={openWalletModal}
        className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-xs tracking-wider transition-all hover:opacity-90"
        style={{
          background: 'linear-gradient(135deg, rgba(66, 199, 230, 0.15), rgba(14, 77, 157, 0.15))',
          border: '1px solid rgba(66, 199, 230, 0.3)',
          color: '#42c7e6',
        }}
      >
        <span className="hidden sm:inline">CONNECT WALLET</span>
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-xs tracking-wider transition-all"
        style={{
          background: 'rgba(10, 10, 10, 0.8)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          color: '#22c55e',
        }}
      >
        <span className="hidden sm:inline font-mono">{formatAddress(address || '')}</span>
        <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
      </button>

      {showDropdown && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDropdown(false)}
          />
          <div
            className="absolute right-0 mt-2 w-72 rounded-xl shadow-xl z-50"
            style={{
              background: 'linear-gradient(180deg, #111111 0%, #0a0a0a 100%)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <div className="p-4 border-b border-white/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono text-gray-500 tracking-widest">CONNECTED</span>
                <span
                  className="text-[10px] font-mono px-2 py-0.5 rounded-full tracking-wider"
                  style={{
                    background: 'rgba(66, 199, 230, 0.1)',
                    color: '#42c7e6',
                    border: '1px solid rgba(66, 199, 230, 0.2)',
                  }}
                >
                  {chain?.name || 'Unknown'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-white">{formatAddress(address || '', 6)}</span>
                <button
                  onClick={handleCopy}
                  className="p-1 rounded hover:bg-white/10 transition-colors"
                  title="Copy address"
                >
                  <Copy className="h-3.5 w-3.5 text-gray-500" />
                </button>
                <a
                  href={getExplorerUrl(address || '', 'address', chain?.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 rounded hover:bg-white/10 transition-colors"
                  title="View on explorer"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-gray-500" />
                </a>
              </div>
              {copied && (
                <span className="text-[10px] font-mono text-green-400 tracking-wider">COPIED!</span>
              )}
            </div>

            {balance && (
              <div className="p-4 border-b border-white/5">
                <span className="text-[10px] font-mono text-gray-500 tracking-widest">BALANCE</span>
                <p className="font-mono text-sm text-white mt-1">
                  {formatTokenAmount(balance.value, balance.decimals)} {balance.symbol}
                </p>
              </div>
            )}

            <div className="p-2">
              <button
                onClick={() => {
                  disconnect();
                  setShowDropdown(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors hover:bg-red-500/10"
                style={{ color: '#ef4444' }}
              >
                <LogOut className="h-4 w-4" />
                <span className="font-mono text-xs font-bold tracking-wider">DISCONNECT</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
