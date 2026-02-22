import { http, createConfig } from 'wagmi';
import { arbitrumSepolia } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';
import { defineChain, parseGwei } from 'viem';

// WalletConnect project ID (get one at https://cloud.walletconnect.com)
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'demo';

// Override Arbitrum Sepolia with explicit fee estimation
// The public RPC returns stale/low gas estimates causing "maxFeePerGas < baseFee" errors
const arbSepolia = defineChain({
  ...arbitrumSepolia,
  fees: {
    async estimateFeesPerGas() {
      return {
        maxFeePerGas: parseGwei('0.3'),
        maxPriorityFeePerGas: parseGwei('0.01'),
      };
    },
  },
});

export const config = createConfig({
  chains: [arbSepolia],
  connectors: [
    injected(),
    walletConnect({ projectId }),
  ],
  transports: {
    [arbSepolia.id]: http('https://sepolia-rollup.arbitrum.io/rpc'),
  },
});

// Declare module for TypeScript
declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}
