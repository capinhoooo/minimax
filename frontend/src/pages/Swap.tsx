import { useState, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { LiFiWidget } from '@lifi/widget';
import type { WidgetConfig } from '@lifi/widget';
import CctpBridge from '../components/CctpBridge';

type TabType = 'swap' | 'bridge' | 'cctp';

// Chain IDs for LI.FI config (mainnet — LI.FI only supports mainnet)
// Solana uses LI.FI's internal chain ID
const SOLANA_CHAIN_ID = 1151111081099710;

// All CCTP V2 chains that LI.FI supports (EVM + Solana)
// USDC on these chains auto-routes through Circle CCTP
const LIFI_CCTP_CHAINS = [
  1,                  // Ethereum
  10,                 // Optimism
  137,                // Polygon PoS
  42161,              // Arbitrum
  8453,               // Base
  43114,              // Avalanche
  56,                 // BNB Smart Chain
  59144,              // Linea
  146,                // Sonic
  SOLANA_CHAIN_ID,    // Solana
];

// Broader set for bridge: CCTP chains + other popular L2s
const BRIDGE_CHAINS = [
  ...LIFI_CCTP_CHAINS,
  324,                // zkSync Era
  534352,             // Scroll
  81457,              // Blast
  252,                // Fraxtal
  34443,              // Mode
  7777777,            // Zora
];

// Shared theme for the arena aesthetic
const baseTheme = {
  palette: {
    primary: { main: '#ed7f2f' },
    secondary: { main: '#42c7e6' },
    background: {
      default: '#050505',
      paper: '#0a0a0a',
    },
    text: {
      primary: '#ffffff',
      secondary: '#9ca3af',
    },
    grey: {
      200: '#1a1a1a',
      300: '#252525',
      700: '#6b7280',
      800: '#9ca3af',
    },
  },
  shape: {
    borderRadius: 12,
    borderRadiusSecondary: 12,
    borderRadiusTertiary: 24,
  },
  typography: {
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  },
  container: {
    border: '1px solid rgba(237, 127, 47, 0.3)',
    borderRadius: '16px',
    boxShadow: '0 0 30px rgba(237, 127, 47, 0.1)',
    maxHeight: 700,
  },
};

const swapConfig: WidgetConfig = {
  integrator: 'lp-battlevault',
  appearance: 'dark',
  variant: 'compact',
  subvariant: 'split',
  subvariantOptions: { split: 'swap' },
  theme: baseTheme,
  hiddenUI: ['appearance', 'language', 'poweredBy'],
  slippage: 0.005,
  routePriority: 'CHEAPEST',
};

const bridgeConfig: WidgetConfig = {
  integrator: 'lp-battlevault',
  appearance: 'dark',
  variant: 'compact',
  subvariant: 'split',
  subvariantOptions: { split: 'bridge' },
  theme: {
    ...baseTheme,
    palette: {
      ...baseTheme.palette,
      primary: { main: '#42c7e6' },
    },
    container: {
      ...baseTheme.container,
      border: '1px solid rgba(66, 199, 230, 0.3)',
      boxShadow: '0 0 30px rgba(66, 199, 230, 0.1)',
    },
  },
  chains: {
    allow: BRIDGE_CHAINS,
  },
  hiddenUI: ['appearance', 'language', 'poweredBy'],
  slippage: 0.005,
  routePriority: 'CHEAPEST',
};

const HEADERS: Record<TabType, { title: string; subtitle: string }> = {
  swap: {
    title: 'ARENA SWAP',
    subtitle: 'SWAP ANY TOKEN ON ANY CHAIN TO PREPARE FOR BATTLE',
  },
  bridge: {
    title: 'ARENA BRIDGE',
    subtitle: 'BRIDGE ACROSS 20+ CHAINS // USDC VIA CIRCLE CCTP',
  },
  cctp: {
    title: 'TESTNET CCTP',
    subtitle: 'BRIDGE USDC ACROSS TESTNETS VIA CIRCLE CCTP V2',
  },
};

const INFO: Record<TabType, { label: string; desc: string }> = {
  swap: {
    label: 'POWERED BY LI.FI',
    desc: 'LI.FI aggregates 15+ DEXs to find you the best swap route on any chain.',
  },
  bridge: {
    label: 'POWERED BY LI.FI + CIRCLE CCTP',
    desc: 'USDC auto-routes through Circle CCTP across 20+ chains including Solana — native tokens, zero slippage. Other tokens bridge via the best available route.',
  },
  cctp: {
    label: 'POWERED BY CIRCLE CCTP V2',
    desc: 'Bridge USDC directly between 7 testnet chains (Sepolia, Base Sepolia, Arbitrum Sepolia, OP Sepolia, Polygon Amoy, Avalanche Fuji, Linea Sepolia). Native burn-and-mint, zero slippage.',
  },
};

const FOOTER: Record<TabType, string> = {
  swap: 'SWAP_ENGINE_V4',
  bridge: 'BRIDGE_CCTP_V4',
  cctp: 'CCTP_TESTNET_V2',
};

const TAB_COLORS: Record<TabType, { active: string; activeBorder: string; gradient: string }> = {
  swap: {
    active: '#ed7f2f',
    activeBorder: 'rgba(237, 127, 47, 0.5)',
    gradient: 'linear-gradient(135deg, rgba(237, 127, 47, 0.2), rgba(138, 56, 21, 0.2))',
  },
  bridge: {
    active: '#42c7e6',
    activeBorder: 'rgba(66, 199, 230, 0.5)',
    gradient: 'linear-gradient(135deg, rgba(66, 199, 230, 0.2), rgba(33, 100, 115, 0.2))',
  },
  cctp: {
    active: '#a78bfa',
    activeBorder: 'rgba(139, 92, 246, 0.5)',
    gradient: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(88, 28, 135, 0.2))',
  },
};

const INFO_COLORS: Record<TabType, { bg: string; border: string; text: string }> = {
  swap: {
    bg: 'rgba(237, 127, 47, 0.08)',
    border: '1px solid rgba(237, 127, 47, 0.2)',
    text: '#ed7f2f',
  },
  bridge: {
    bg: 'rgba(66, 199, 230, 0.08)',
    border: '1px solid rgba(66, 199, 230, 0.2)',
    text: '#42c7e6',
  },
  cctp: {
    bg: 'rgba(139, 92, 246, 0.08)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    text: '#a78bfa',
  },
};

export default function Swap() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const isBridgeRoute = location.pathname === '/bridge';
  const initialTab: TabType = isBridgeRoute || searchParams.get('tab') === 'bridge'
    ? 'bridge'
    : searchParams.get('tab') === 'cctp'
    ? 'cctp'
    : 'swap';
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  useEffect(() => {
    if (location.pathname === '/bridge') {
      setActiveTab('bridge');
    } else if (searchParams.get('tab') === 'bridge') {
      setActiveTab('bridge');
    } else if (searchParams.get('tab') === 'cctp') {
      setActiveTab('cctp');
    } else if (location.pathname === '/swap') {
      setActiveTab('swap');
    }
  }, [searchParams, location.pathname]);

  const header = HEADERS[activeTab];
  const info = INFO[activeTab];
  const infoColor = INFO_COLORS[activeTab];

  return (
    <div className="min-h-screen grid-bg py-12 px-4">
      <div className="mx-auto max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2">
            <span className="gradient-text-magenta italic">
              {header.title}
            </span>
          </h1>
          <p className="text-xs font-mono text-gray-500 tracking-[0.2em]">
            {header.subtitle}
          </p>
        </div>

        {/* Tabs */}
        <div
          className="flex p-1.5 gap-1.5 rounded-xl mb-6"
          style={{
            background: 'rgba(10, 10, 10, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          {(['swap', 'bridge', 'cctp'] as TabType[]).map((tab) => {
            const isActive = activeTab === tab;
            const colors = TAB_COLORS[tab];
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="flex-1 py-3 px-4 rounded-lg font-bold text-xs tracking-widest font-mono transition-all"
                style={{
                  background: isActive ? colors.gradient : 'transparent',
                  border: isActive ? `1px solid ${colors.activeBorder}` : '1px solid transparent',
                  color: isActive ? colors.active : '#6b7280',
                }}
              >
                {tab.toUpperCase()}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="lifi-widget-container">
          {activeTab === 'swap' && (
            <LiFiWidget integrator="lp-battlevault" config={swapConfig} />
          )}
          {activeTab === 'bridge' && (
            <LiFiWidget integrator="lp-battlevault" config={bridgeConfig} />
          )}
          {activeTab === 'cctp' && (
            <CctpBridge />
          )}
        </div>

        {/* Info Box */}
        <div
          className="mt-6 p-4 rounded-xl"
          style={{
            background: infoColor.bg,
            border: infoColor.border,
          }}
        >
          <p
            className="text-xs font-mono font-bold tracking-wider"
            style={{ color: infoColor.text }}
          >
            {info.label}
          </p>
          <p className="text-xs text-gray-500 mt-1.5 font-mono tracking-wider leading-relaxed">
            {info.desc}
          </p>
        </div>

        {/* Terminal Footer */}
        <div className="mt-8 text-center">
          <p className="text-[10px] font-mono text-gray-700 tracking-widest">
            TERMINAL STATUS: <span style={{ color: '#22c55e' }}>ONLINE</span> // {FOOTER[activeTab]}
          </p>
        </div>
      </div>
    </div>
  );
}
