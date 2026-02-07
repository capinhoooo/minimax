import { http, createConfig } from 'wagmi';
import {
  sepolia,
  base,
  arbitrum,
  polygon,
  optimism,
  mainnet,
  baseSepolia,
  arbitrumSepolia,
  optimismSepolia,
  avalancheFuji,
  polygonAmoy,
  lineaSepolia,
} from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';

// WalletConnect project ID (get one at https://cloud.walletconnect.com)
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'demo';

export const config = createConfig({
  chains: [
    // Testnets (for battles + CCTP bridge)
    sepolia,
    baseSepolia,
    arbitrumSepolia,
    optimismSepolia,
    avalancheFuji,
    polygonAmoy,
    lineaSepolia,
    // Mainnets (for LI.FI swap/bridge)
    base,
    arbitrum,
    polygon,
    optimism,
    mainnet,
  ],
  connectors: [
    injected(),
    walletConnect({ projectId }),
  ],
  transports: {
    // Testnets
    [sepolia.id]: http(import.meta.env.VITE_SEPOLIA_RPC || 'https://eth-sepolia.g.alchemy.com/v2/demo'),
    [baseSepolia.id]: http('https://sepolia.base.org'),
    [arbitrumSepolia.id]: http('https://sepolia-rollup.arbitrum.io/rpc'),
    [optimismSepolia.id]: http('https://sepolia.optimism.io'),
    [avalancheFuji.id]: http('https://api.avax-test.network/ext/bc/C/rpc'),
    [polygonAmoy.id]: http('https://rpc-amoy.polygon.technology'),
    [lineaSepolia.id]: http('https://rpc.sepolia.linea.build'),
    // Mainnets
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
