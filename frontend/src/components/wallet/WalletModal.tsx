import { useEffect } from 'react';
import { useConnect } from 'wagmi';
import { Wallet, X } from 'lucide-react';
import { useWalletModal } from '../../context/WalletModalContext';

export default function WalletModal() {
  const { isOpen, close } = useWalletModal();
  const { connect, connectors } = useConnect();

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, close]);

  // Filter connectors: hide generic "Injected" when real wallets are detected,
  // deduplicate by name, and put WalletConnect last
  const uniqueConnectors = (() => {
    const deduped = connectors.filter(
      (c, i, arr) => arr.findIndex((x) => x.name === c.name) === i
    );
    const hasNamedWallets = deduped.some(
      (c) => c.name !== 'Injected' && c.name !== 'WalletConnect'
    );
    return deduped
      .filter((c) => !(c.name === 'Injected' && hasNamedWallets))
      .sort((a, b) => {
        if (a.name === 'WalletConnect') return 1;
        if (b.name === 'WalletConnect') return -1;
        return 0;
      });
  })();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      onClick={close}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-md rounded-2xl p-6"
        style={{
          background: 'linear-gradient(180deg, #111111 0%, #0a0a0a 100%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white tracking-wide">
            Select a wallet
          </h2>
          <button
            onClick={close}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Wallet List */}
        <div className="space-y-2">
          {uniqueConnectors.map((connector) => (
            <button
              key={connector.id}
              onClick={() => {
                connect({ connector });
                close();
              }}
              className="w-full flex items-center gap-4 px-4 py-4 rounded-xl transition-all hover:scale-[1.01]"
              style={{
                background: 'rgba(20, 20, 20, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.border = '1px solid rgba(66, 199, 230, 0.3)';
                e.currentTarget.style.background = 'rgba(30, 30, 30, 0.8)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.background = 'rgba(20, 20, 20, 0.8)';
              }}
            >
              {/* Connector Icon */}
              {connector.icon ? (
                <img
                  src={connector.icon}
                  alt={connector.name}
                  className="w-10 h-10 rounded-xl"
                />
              ) : (
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, rgba(66, 199, 230, 0.2), rgba(14, 77, 157, 0.2))',
                    border: '1px solid rgba(66, 199, 230, 0.3)',
                  }}
                >
                  <Wallet className="w-5 h-5 text-cyan-400" />
                </div>
              )}

              {/* Name */}
              <span className="flex-1 text-left text-sm font-semibold text-white">
                {connector.name}
              </span>

              {/* Installed Badge */}
              <span
                className="px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider"
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#9ca3af',
                }}
              >
                Installed
              </span>
            </button>
          ))}
        </div>

        {/* Footer */}
        <p className="text-[10px] font-mono text-gray-600 tracking-wider text-center mt-5">
          POWERED BY WAGMI // EVM COMPATIBLE
        </p>
      </div>
    </div>
  );
}
