import { http, createConfig } from 'wagmi';
import { sepolia, base, arbitrum, polygon, optimism, mainnet } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';

// WalletConnect project ID (get one at https://cloud.walletconnect.com)
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'demo';

export const config = createConfig({
  chains: [sepolia, base, arbitrum, polygon, optimism, mainnet],
  connectors: [
    injected(),
    walletConnect({ projectId }),
  ],
  transports: {
    [sepolia.id]: http(import.meta.env.VITE_SEPOLIA_RPC || 'https://eth-sepolia.g.alchemy.com/v2/demo'),
    [base.id]: http('https://mainnet.base.org'),
    [arbitrum.id]: http('https://arb1.arbitrum.io/rpc'),
    [polygon.id]: http('https://polygon-rpc.com'),
    [optimism.id]: http('https://mainnet.optimism.io'),
    [mainnet.id]: http('https://eth.llamarpc.com'),
  },
});

// Declare module for TypeScript
declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}
