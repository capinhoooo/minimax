/**
 * Tick Math Utilities for Uniswap V3/V4 Concentrated Liquidity
 *
 * Converts between human-readable prices and ticks.
 * For WETH(18)/USDC(6) pools: price in USDC per WETH.
 */

/**
 * Convert a tick to a human-readable price.
 *
 * Formula: price = 1.0001^tick * 10^(decimals0 - decimals1)
 *
 * For WETH(18)/USDC(6): price = 1.0001^tick * 10^12
 * At tick -197520: price ≈ 2600 USDC per WETH
 */
export function tickToPrice(tick: number, decimals0: number, decimals1: number): number {
  const rawPrice = Math.pow(1.0001, tick);
  // Adjust for decimal difference: price of token1 in terms of token0
  // For WETH/USDC where WETH=currency0(18dec), USDC=currency1(6dec):
  // We want USDC per WETH = 1/rawPrice * 10^(decimals1 - decimals0)
  // But since sqrtPrice is token1/token0, rawPrice = token1/token0
  // So price in human terms (USDC per WETH) = rawPrice * 10^(decimals0 - decimals1)
  return rawPrice * Math.pow(10, decimals0 - decimals1);
}

/**
 * Convert a human-readable price to a tick.
 *
 * Formula: tick = log(price / 10^(decimals0 - decimals1)) / log(1.0001)
 */
export function priceToTick(price: number, decimals0: number, decimals1: number): number {
  const adjustedPrice = price / Math.pow(10, decimals0 - decimals1);
  return Math.round(Math.log(adjustedPrice) / Math.log(1.0001));
}

/**
 * Round a tick to the nearest usable tick based on tick spacing.
 */
export function nearestUsableTick(tick: number, tickSpacing: number): number {
  return Math.round(tick / tickSpacing) * tickSpacing;
}
