/**
 * LI.FI Integration Tests
 *
 * Tests the LI.FI SDK integration for cross-chain swaps and LP entry flows.
 * Run: npm run test:lifi
 */

import { LiFiIntegration, SUPPORTED_CHAINS, TOKENS } from '../integrations/LiFiIntegration.js';
import { logger } from '../utils/logger.js';

// Test wallet address (public - for quote testing only)
const TEST_ADDRESS = '0x564323aE0D8473103F3763814c5121Ca9e48004B';

async function testLiFiIntegration() {
  console.log('\n' + '='.repeat(60));
  console.log('LI.FI INTEGRATION TESTS');
  console.log('='.repeat(60) + '\n');

  const lifi = new LiFiIntegration();
  let passed = 0;
  let failed = 0;

  // Test 1: Get swap quote (same chain)
  console.log('Test 1: Get swap quote (USDC → WETH on Arbitrum)');
  try {
    const quote = await lifi.getSwapQuote(
      SUPPORTED_CHAINS.ARBITRUM,
      SUPPORTED_CHAINS.ARBITRUM,
      TOKENS.USDC[SUPPORTED_CHAINS.ARBITRUM],
      TOKENS.WETH[SUPPORTED_CHAINS.ARBITRUM],
      '1000000000', // 1000 USDC (6 decimals)
      TEST_ADDRESS
    );

    if (quote && BigInt(quote.toAmount) > 0n) {
      console.log(`  ✅ Quote received: 1000 USDC → ${lifi.formatAmount(quote.toAmount, 18)} WETH`);
      passed++;
    } else {
      console.log('  ❌ Failed to get quote');
      failed++;
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    failed++;
  }

  // Test 2: Get cross-chain swap quote
  console.log('\nTest 2: Get cross-chain quote (USDC Arbitrum → WETH Base)');
  try {
    const quote = await lifi.getSwapQuote(
      SUPPORTED_CHAINS.ARBITRUM,
      SUPPORTED_CHAINS.BASE,
      TOKENS.USDC[SUPPORTED_CHAINS.ARBITRUM],
      TOKENS.WETH[SUPPORTED_CHAINS.BASE],
      '500000000', // 500 USDC
      TEST_ADDRESS
    );

    if (quote && BigInt(quote.toAmount) > 0n) {
      console.log(`  ✅ Cross-chain quote: 500 USDC (Arb) → ${lifi.formatAmount(quote.toAmount, 18)} WETH (Base)`);
      passed++;
    } else {
      console.log('  ❌ Failed to get cross-chain quote');
      failed++;
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    failed++;
  }

  // Test 3: Get multiple routes
  console.log('\nTest 3: Get multiple routes (for comparison)');
  try {
    const routes = await lifi.getSwapRoutes(
      SUPPORTED_CHAINS.ARBITRUM,
      SUPPORTED_CHAINS.BASE,
      TOKENS.USDC[SUPPORTED_CHAINS.ARBITRUM],
      TOKENS.USDC[SUPPORTED_CHAINS.BASE],
      '100000000', // 100 USDC
      TEST_ADDRESS
    );

    if (routes.length > 0) {
      console.log(`  ✅ Found ${routes.length} routes`);
      routes.slice(0, 3).forEach((route, i) => {
        console.log(`     Route ${i + 1}: ${route.steps.length} steps, ${route.steps.map(s => s.tool).join(' → ')}`);
      });
      passed++;
    } else {
      console.log('  ❌ No routes found');
      failed++;
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    failed++;
  }

  // Test 4: LP Entry quotes (both tokens)
  console.log('\nTest 4: Get LP entry quotes (for WETH/USDC pool)');
  try {
    const { quote0, quote1 } = await lifi.getLPEntryQuotes({
      fromChainId: SUPPORTED_CHAINS.POLYGON,
      toChainId: SUPPORTED_CHAINS.BASE,
      fromToken: TOKENS.USDC[SUPPORTED_CHAINS.POLYGON],
      toToken0: TOKENS.WETH[SUPPORTED_CHAINS.BASE],
      toToken1: TOKENS.USDC[SUPPORTED_CHAINS.BASE],
      amount: '2000000000', // 2000 USDC total
      slippage: 0.03,
      userAddress: TEST_ADDRESS,
    });

    if (quote0 && quote1) {
      console.log(`  ✅ LP Entry quotes received:`);
      console.log(`     Token0 (WETH): 1000 USDC → ${lifi.formatAmount(quote0.toAmount, 18)} WETH`);
      console.log(`     Token1 (USDC): 1000 USDC → ${lifi.formatAmount(quote1.toAmount, 6)} USDC`);
      passed++;
    } else {
      console.log(`  ⚠️  Partial quotes: Token0=${!!quote0}, Token1=${!!quote1}`);
      failed++;
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    failed++;
  }

  // Test 5: Calculate LP split
  console.log('\nTest 5: Calculate optimal LP split');
  try {
    const split = lifi.calculateLPSplit(
      BigInt(2000e8),      // 2000 USD (8 decimals for consistency)
      BigInt(3000e8),      // ETH price: $3000
      BigInt(1e8),         // USDC price: $1
      200000,              // Current tick
      199000,              // Lower tick
      201000               // Upper tick
    );

    console.log(`  ✅ LP Split calculated:`);
    console.log(`     Token0 (WETH): ${split.amount0.toString()} wei`);
    console.log(`     Token1 (USDC): ${split.amount1.toString()} wei`);
    passed++;
  } catch (error) {
    console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    failed++;
  }

  // Test 6: Supported chains
  console.log('\nTest 6: Verify supported chains');
  const chains = lifi.getSupportedChains();
  const expectedChains = ['ETHEREUM', 'ARBITRUM', 'BASE', 'POLYGON', 'OPTIMISM'];
  const hasAllChains = expectedChains.every(c => c in chains);

  if (hasAllChains) {
    console.log(`  ✅ All expected chains supported: ${expectedChains.join(', ')}`);
    passed++;
  } else {
    console.log('  ❌ Missing some expected chains');
    failed++;
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  Total: ${passed + failed}`);
  console.log('='.repeat(60) + '\n');

  return { passed, failed };
}

// Run tests
testLiFiIntegration()
  .then(({ passed, failed }) => {
    process.exit(failed > 0 ? 1 : 0);
  })
  .catch((error) => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
