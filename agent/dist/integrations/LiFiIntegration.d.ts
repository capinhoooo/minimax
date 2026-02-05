/**
 * LI.FI Integration for LP BattleVault
 *
 * Enables cross-chain swaps and bridges for seamless battle entry
 * from any EVM chain with any token.
 */
import type { Route } from '@lifi/sdk';
export declare const SUPPORTED_CHAINS: {
    readonly ETHEREUM: 1;
    readonly ARBITRUM: 42161;
    readonly OPTIMISM: 10;
    readonly BASE: 8453;
    readonly POLYGON: 137;
    readonly SEPOLIA: 11155111;
    readonly ARBITRUM_SEPOLIA: 421614;
    readonly BASE_SEPOLIA: 84532;
};
export declare const TOKENS: {
    readonly USDC: {
        readonly 1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
        readonly 42161: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
        readonly 8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
        readonly 137: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";
        readonly 10: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85";
    };
    readonly WETH: {
        readonly 1: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
        readonly 42161: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
        readonly 8453: "0x4200000000000000000000000000000000000006";
        readonly 137: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619";
        readonly 10: "0x4200000000000000000000000000000000000006";
    };
    readonly USDC_SEPOLIA: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
};
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
    toToken0: string;
    toToken1: string;
    amount: string;
    slippage: number;
    userAddress: string;
}
export declare class LiFiIntegration {
    private integrator;
    constructor();
    /**
     * Get a quote for a cross-chain swap
     */
    getSwapQuote(fromChainId: number, toChainId: number, fromToken: string, toToken: string, fromAmount: string, userAddress: string): Promise<SwapQuote | null>;
    /**
     * Get multiple routes for a swap (for comparison)
     */
    getSwapRoutes(fromChainId: number, toChainId: number, fromToken: string, toToken: string, fromAmount: string, userAddress: string): Promise<Route[]>;
    /**
     * Calculate optimal token split for LP position
     * Based on current pool price, calculates how much of each token needed
     */
    calculateLPSplit(totalAmountUSD: bigint, token0PriceUSD: bigint, token1PriceUSD: bigint, currentTick: number, tickLower: number, tickUpper: number): {
        amount0: bigint;
        amount1: bigint;
    };
    /**
     * Get quotes for both tokens needed for LP position
     */
    getLPEntryQuotes(params: CrossChainEntryParams): Promise<{
        quote0: SwapQuote | null;
        quote1: SwapQuote | null;
    }>;
    /**
     * Execute a swap route
     * Note: This requires wallet integration - returns the route for frontend execution
     */
    prepareSwapExecution(route: Route): Promise<{
        route: Route;
        transactionRequest: unknown;
    }>;
    /**
     * Check status of an ongoing transaction
     */
    checkTransactionStatus(txHash: string, fromChainId: number, toChainId: number): Promise<import("@lifi/types").StatusData | import("@lifi/types").FailedStatusData | null>;
    /**
     * Get supported chains
     */
    getSupportedChains(): typeof SUPPORTED_CHAINS;
    /**
     * Format amount for display
     */
    formatAmount(amount: string, decimals?: number): string;
    /**
     * Print a summary of available routes
     */
    printRoutesSummary(routes: Route[]): void;
}
export declare const lifiIntegration: LiFiIntegration;
