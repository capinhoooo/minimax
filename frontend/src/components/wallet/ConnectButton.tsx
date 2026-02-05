import { useAccount, useConnect, useDisconnect, useBalance } from 'wagmi';
import { useState } from 'react';
import { Wallet, ChevronDown, LogOut, Copy, ExternalLink } from 'lucide-react';
import { formatAddress, formatTokenAmount, getExplorerUrl, copyToClipboard } from '../../lib/utils';

export default function ConnectButton() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({ address });
  const [showDropdown, setShowDropdown] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (address) {
      await copyToClipboard(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isConnected) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          disabled={isPending}
          className="btn-primary flex items-center gap-2"
        >
          <Wallet className="h-4 w-4" />
          {isPending ? 'Connecting...' : 'Connect Wallet'}
        </button>

        {showDropdown && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowDropdown(false)}
            />
            <div className="absolute right-0 mt-2 w-56 rounded-xl bg-background-secondary border border-border shadow-xl z-50">
              <div className="p-2">
                {connectors.map((connector) => (
                  <button
                    key={connector.id}
                    onClick={() => {
                      connect({ connector });
                      setShowDropdown(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left hover:bg-white/5 transition-colors"
                  >
                    <Wallet className="h-5 w-5 text-accent-blue" />
                    <span className="font-medium">{connector.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-background-secondary border border-border hover:border-accent-blue/50 transition-colors"
      >
        <div className="w-2 h-2 rounded-full bg-accent-green" />
        <span className="font-medium">{formatAddress(address || '')}</span>
        <ChevronDown className="h-4 w-4 text-gray-400" />
      </button>

      {showDropdown && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDropdown(false)}
          />
          <div className="absolute right-0 mt-2 w-72 rounded-xl bg-background-secondary border border-border shadow-xl z-50">
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Connected</span>
                <span className="text-xs px-2 py-1 rounded-full bg-accent-blue/20 text-accent-blue">
                  {chain?.name || 'Unknown'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm">{formatAddress(address || '', 6)}</span>
                <button
                  onClick={handleCopy}
                  className="p-1 rounded hover:bg-white/10 transition-colors"
                  title="Copy address"
                >
                  <Copy className="h-4 w-4 text-gray-400" />
                </button>
                <a
                  href={getExplorerUrl(address || '', 'address', chain?.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 rounded hover:bg-white/10 transition-colors"
                  title="View on explorer"
                >
                  <ExternalLink className="h-4 w-4 text-gray-400" />
                </a>
              </div>
              {copied && (
                <span className="text-xs text-accent-green">Copied!</span>
              )}
            </div>

            {balance && (
              <div className="p-4 border-b border-border">
                <span className="text-sm text-gray-400">Balance</span>
                <p className="font-medium">
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
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-accent-red hover:bg-accent-red/10 transition-colors"
              >
                <LogOut className="h-5 w-5" />
                <span className="font-medium">Disconnect</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
