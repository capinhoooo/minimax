/**
 * Integration Module Exports
 *
 * Provides unified access to cross-chain integrations:
 * - LI.FI: Cross-chain swaps and routing
 * - Arc: Circle CCTP USDC bridging
 */
export { LiFiIntegration, lifiIntegration, SUPPORTED_CHAINS, TOKENS } from './LiFiIntegration.js';
export { ArcIntegration, arcIntegration, CCTP_CONTRACTS } from './ArcIntegration.js';
export { CrossChainEntryAgent } from './CrossChainEntryAgent.js';
