/**
 * LI.FI Integration for LP BattleVault
 *
 * Enables cross-chain swaps and bridges for seamless battle entry
 * from any EVM chain with any token.
 */

import { createConfig, getQuote, getRoutes, executeRoute, getStatus } from '@lifi/sdk';
import type { Route, RoutesRequest, QuoteRequest, ExtendedChain } from '@lifi/sdk';
import { logger } from '../utils/logger.js';

// Supported chains for LP BattleVault
export const SUPPORTED_CHAINS = {
  ETHEREUM: 1,
  ARBITRUM: 42161,
  OPTIMISM: 10,
  BASE: 8453,
  POLYGON: 137,
  // Testnets
  SEPOLIA: 11155111,
  ARBITRUM_SEPOLIA: 421614,
  BASE_SEPOLIA: 84532,
} as const;

// Common token addresses
export const TOKENS = {
  // Mainnet
  USDC: {
    [SUPPORTED_CHAINS.ETHEREUM]: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    [SUPPORTED_CHAINS.ARBITRUM]: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    [SUPPORTED_CHAINS.BASE]: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    [SUPPORTED_CHAINS.POLYGON]: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    [SUPPORTED_CHAINS.OPTIMISM]: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
  },
  WETH: {
    [SUPPORTED_CHAINS.ETHEREUM]: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    [SUPPORTED_CHAINS.ARBITRUM]: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    [SUPPORTED_CHAINS.BASE]: '0x4200000000000000000000000000000000000006',
    [SUPPORTED_CHAINS.POLYGON]: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    [SUPPORTED_CHAINS.OPTIMISM]: '0x4200000000000000000000000000000000000006',
  },
  // Sepolia Testnet
  USDC_SEPOLIA: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
} as const;

export interface SwapQuote {
  fromChain: number;
  toChain: number;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  estimatedGas: string;
  route: Route;
}

export interface CrossChainEntryParams {
  fromChainId: number;
  toChainId: number;
  fromToken: string;
  toToken0: string;  // First token of LP pair
  toToken1: string;  // Second token of LP pair
  amount: string;
  slippage: number;  // e.g., 0.03 for 3%
  userAddress: string;
}

export class LiFiIntegration {
  private integrator: string = 'lp-battlevault';

  constructor() {
    // Initialize LI.FI SDK with our integrator ID
    createConfig({
      integrator: this.integrator,
    });

    logger.info('LI.FI Integration initialized');
  }

  /**
   * Get a quote for a cross-chain swap
   */
  async getSwapQuote(
    fromChainId: number,
    toChainId: number,
    fromToken: string,
    toToken: string,
    fromAmount: string,
    userAddress: string
  ): Promise<SwapQuote | null> {
    try {
      const quoteRequest: QuoteRequest = {
        fromChain: fromChainId,
        toChain: toChainId,
        fromToken,
        toToken,
        fromAmount,
        fromAddress: userAddress,
        toAddress: userAddress,
        slippage: 0.03, // 3% default slippage
      };

      logger.debug('Requesting LI.FI quote', quoteRequest);

      const quote = await getQuote(quoteRequest);

      logger.info(`LI.FI Quote received: ${fromAmount} → ${quote.estimate.toAmount}`);

      return {
        fromChain: fromChainId,
        toChain: toChainId,
        fromToken,
        toToken,
        fromAmount,
        toAmount: quote.estimate.toAmount,
        estimatedGas: quote.estimate.gasCosts?.[0]?.amount || '0',
        route: quote as unknown as Route,
      };
    } catch (error) {
      logger.error('Failed to get LI.FI quote', error);
      return null;
    }
  }

  /**
   * Get multiple routes for a swap (for comparison)
   */
  async getSwapRoutes(
    fromChainId: number,
    toChainId: number,
    fromToken: string,
    toToken: string,
    fromAmount: string,
    userAddress: string
  ): Promise<Route[]> {
    try {
      const routesRequest: RoutesRequest = {
        fromChainId,
        toChainId,
        fromTokenAddress: fromToken,
        toTokenAddress: toToken,
        fromAmount,
        fromAddress: userAddress,
        toAddress: userAddress,
        options: {
          slippage: 0.03,
          order: 'RECOMMENDED',
        },
      };

      logger.debug('Requesting LI.FI routes', routesRequest);

      const result = await getRoutes(routesRequest);

      logger.info(`Found ${result.routes.length} routes`);

      return result.routes;
    } catch (error) {
      logger.error('Failed to get LI.FI routes', error);
      return [];
    }
  }

  /**
   * Calculate optimal token split for LP position
   * Based on current pool price, calculates how much of each token needed
   */
  calculateLPSplit(
    totalAmountUSD: bigint,
    token0PriceUSD: bigint,
    token1PriceUSD: bigint,
    currentTick: number,
    tickLower: number,
    tickUpper: number
  ): { amount0: bigint; amount1: bigint } {
    // For concentrated liquidity, the ratio depends on current tick position
    // If current tick is in the middle of the range, roughly 50/50
    // If tick is at lower bound, need more token0
    // If tick is at upper bound, need more token1

    const rangeMid = (tickLower + tickUpper) / 2;
    const rangeWidth = tickUpper - tickLower;

    // Calculate position within range (0 = at lower, 1 = at upper)
    let positionInRange = (currentTick - tickLower) / rangeWidth;
    positionInRange = Math.max(0, Math.min(1, positionInRange));

    // token1 ratio increases as tick moves up
    const token1Ratio = positionInRange;
    const token0Ratio = 1 - token1Ratio;

    const amount0USD = (totalAmountUSD * BigInt(Math.floor(token0Ratio * 1000))) / 1000n;
    const amount1USD = totalAmountUSD - amount0USD;

    // Convert USD amounts to token amounts
    const amount0 = (amount0USD * BigInt(1e18)) / token0PriceUSD;
    const amount1 = (amount1USD * BigInt(1e18)) / token1PriceUSD;

    return { amount0, amount1 };
  }

  /**
   * Get quotes for both tokens needed for LP position
   */
  async getLPEntryQuotes(
    params: CrossChainEntryParams
  ): Promise<{ quote0: SwapQuote | null; quote1: SwapQuote | null }> {
    // For simplicity, assume 50/50 split (can be optimized based on tick range)
    const halfAmount = (BigInt(params.amount) / 2n).toString();

    const [quote0, quote1] = await Promise.all([
      // Quote for first token of LP pair
      this.getSwapQuote(
        params.fromChainId,
        params.toChainId,
        params.fromToken,
        params.toToken0,
        halfAmount,
        params.userAddress
      ),
      // Quote for second token of LP pair
      this.getSwapQuote(
        params.fromChainId,
        params.toChainId,
        params.fromToken,
        params.toToken1,
        halfAmount,
        params.userAddress
      ),
    ]);

    return { quote0, quote1 };
  }

  /**
   * Execute a swap route
   * Note: This requires wallet integration - returns the route for frontend execution
   */
  async prepareSwapExecution(route: Route): Promise<{
    route: Route;
    transactionRequest: unknown;
  }> {
    logger.logAction({
      timestamp: new Date().toISOString(),
      action: 'LIFI_PREPARE_SWAP',
      reasoning: `Preparing LI.FI swap: ${route.fromChainId} → ${route.toChainId}`,
      inputs: {
        fromChain: route.fromChainId,
        toChain: route.toChainId,
        fromToken: route.fromToken.symbol,
        toToken: route.toToken.symbol,
        fromAmount: route.fromAmount,
      },
      status: 'pending',
    });

    // The actual execution would be done by the frontend with user's wallet
    // Here we just prepare and return the route
    return {
      route,
      transactionRequest: route.steps[0]?.transactionRequest || null,
    };
  }

  /**
   * Check status of an ongoing transaction
   */
  async checkTransactionStatus(txHash: string, fromChainId: number, toChainId: number) {
    try {
      const status = await getStatus({
        txHash,
        fromChain: fromChainId,
        toChain: toChainId,
      });

      logger.debug(`Transaction ${txHash} status: ${status.status}`);

      return status;
    } catch (error) {
      logger.error(`Failed to check transaction status: ${txHash}`, error);
      return null;
    }
  }

  /**
   * Get supported chains
   */
  getSupportedChains(): typeof SUPPORTED_CHAINS {
    return SUPPORTED_CHAINS;
  }

  /**
   * Format amount for display
   */
  formatAmount(amount: string, decimals: number = 18): string {
    const value = BigInt(amount);
    const divisor = BigInt(10 ** decimals);
    const integerPart = value / divisor;
    const fractionalPart = value % divisor;

    return `${integerPart}.${fractionalPart.toString().padStart(decimals, '0').slice(0, 4)}`;
  }

  /**
   * Print a summary of available routes
   */
  printRoutesSummary(routes: Route[]): void {
    console.log('\n' + '='.repeat(60));
    console.log('LI.FI ROUTES SUMMARY');
    console.log('='.repeat(60));

    routes.forEach((route, index) => {
      console.log(`\nRoute ${index + 1}:`);
      console.log(`  From: ${route.fromToken.symbol} on ${route.fromChainId}`);
      console.log(`  To: ${route.toToken.symbol} on ${route.toChainId}`);
      console.log(`  Amount In: ${this.formatAmount(route.fromAmount, route.fromToken.decimals)}`);
      console.log(`  Amount Out: ${this.formatAmount(route.toAmount, route.toToken.decimals)}`);
      console.log(`  Steps: ${route.steps.length}`);
      route.steps.forEach((step, stepIndex) => {
        console.log(`    ${stepIndex + 1}. ${step.type}: ${step.tool}`);
      });
    });

    console.log('\n' + '='.repeat(60));
  }
}

export const lifiIntegration = new LiFiIntegration();
