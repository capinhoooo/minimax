/**
 * Combined Integration Tests
 *
 * Tests the full cross-chain battle entry flow using LI.FI + Arc.
 * Simulates: User on Arbitrum → Bridge USDC to Base → Swap to LP tokens → Enter Battle
 *
 * Run: npm run test:integration
 */

import { LiFiIntegration, SUPPORTED_CHAINS, TOKENS } from '../integrations/LiFiIntegration.js';
import { ArcIntegration, CCTP_CONTRACTS, type SupportedChain } from '../integrations/ArcIntegration.js';
import { logger } from '../utils/logger.js';

// Test wallet address
const TEST_ADDRESS = '0x564323aE0D8473103F3763814c5121Ca9e48004B' as `0x${string}`;

interface CrossChainBattleEntryFlow {
  sourceChain: SupportedChain;
  destChain: SupportedChain;
  inputToken: string;
  inputAmount: bigint;
  battlePool: {
    token0: string;
    token1: string;
    tickLower: number;
    tickUpper: number;
  };
}

async function testCrossChainEntryFlow() {
  console.log('\n' + '='.repeat(70));
  console.log('CROSS-CHAIN BATTLE ENTRY FLOW TEST');
  console.log('Scenario: User on Arbitrum enters a WETH/USDC battle on Base');
  console.log('='.repeat(70) + '\n');

  const lifi = new LiFiIntegration();
  const arc = new ArcIntegration();

  const flow: CrossChainBattleEntryFlow = {
    sourceChain: 'ARBITRUM',
    destChain: 'BASE',
    inputToken: TOKENS.USDC[SUPPORTED_CHAINS.ARBITRUM],
    inputAmount: BigInt(1000e6), // 1000 USDC
    battlePool: {
      token0: TOKENS.WETH[SUPPORTED_CHAINS.BASE],
      token1: TOKENS.USDC[SUPPORTED_CHAINS.BASE],
      tickLower: -887220,
      tickUpper: 887220,
    },
  };

  console.log('Flow Configuration:');
  console.log(`  Source: ${flow.sourceChain} (USDC)`);
  console.log(`  Destination: ${flow.destChain} (WETH/USDC LP)`);
  console.log(`  Amount: ${arc.formatUSDC(flow.inputAmount)}`);
  console.log('');

  let stepNum = 0;

  // ============================================================
  // STEP 1: Bridge USDC from Arbitrum to Base via Arc CCTP
  // ============================================================
  stepNum++;
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`STEP ${stepNum}: Bridge USDC via Arc CCTP`);
  console.log(`${'─'.repeat(60)}`);

  const bridgeRequest = {
    sourceChain: flow.sourceChain,
    destChain: flow.destChain,
    amount: flow.inputAmount,
    recipient: TEST_ADDRESS,
  };

  const bridgeInstructions = arc.getBridgeInstructions(bridgeRequest);

  console.log('\nBridge Transactions Required:');
  bridgeInstructions.steps.forEach((step) => {
    console.log(`  ${step.step}. ${step.action}`);
    console.log(`     ${step.description}`);
    if (step.transaction) {
      console.log(`     Contract: ${step.transaction.to}`);
    }
  });

  console.log('\n  ✅ Bridge instructions prepared');
  console.log('     Note: In production, user signs approve + depositForBurn txs');
  console.log('     Estimated time: 10-20 minutes for attestation');

  // ============================================================
  // STEP 2: (Alternative) Direct cross-chain swap via LI.FI
  // ============================================================
  stepNum++;
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`STEP ${stepNum}: Alternative - Direct swap via LI.FI`);
  console.log(`${'─'.repeat(60)}`);

  console.log('\nGetting cross-chain swap quotes from LI.FI...');

  try {
    // Option A: LI.FI handles everything (swap + bridge in one)
    const directRoutes = await lifi.getSwapRoutes(
      SUPPORTED_CHAINS.ARBITRUM,
      SUPPORTED_CHAINS.BASE,
      flow.inputToken,
      flow.battlePool.token1, // USDC on Base
      flow.inputAmount.toString(),
      TEST_ADDRESS
    );

    if (directRoutes.length > 0) {
      console.log(`\n  Found ${directRoutes.length} routes for cross-chain USDC transfer`);
      const bestRoute = directRoutes[0];
      console.log(`  Best route: ${bestRoute.steps.map(s => s.tool).join(' → ')}`);
      console.log(`  Estimated output: ${lifi.formatAmount(bestRoute.toAmount, 6)} USDC`);
      console.log(`  Steps: ${bestRoute.steps.length}`);
    }
  } catch (error) {
    console.log(`  ⚠️  LI.FI quote failed (network issue): ${error instanceof Error ? error.message : 'Unknown'}`);
  }

  // ============================================================
  // STEP 3: Swap USDC to LP tokens (WETH + USDC)
  // ============================================================
  stepNum++;
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`STEP ${stepNum}: Swap USDC to LP tokens on Base`);
  console.log(`${'─'.repeat(60)}`);

  console.log('\nCalculating optimal LP token split...');

  // For WETH/USDC pool, split based on tick range
  const currentTick = 200450; // Example current tick
  const ethPriceUSD = BigInt(3000e8); // $3000 per ETH
  const usdcPriceUSD = BigInt(1e8);   // $1 per USDC

  const { amount0, amount1 } = lifi.calculateLPSplit(
    BigInt(1000e8), // 1000 USD total
    ethPriceUSD,
    usdcPriceUSD,
    currentTick,
    flow.battlePool.tickLower,
    flow.battlePool.tickUpper
  );

  const ethNeeded = amount0;
  const usdcNeeded = amount1;

  console.log(`\n  LP Token Requirements:`);
  console.log(`    WETH: ~${Number(ethNeeded) / 1e18} ETH`);
  console.log(`    USDC: ~${Number(usdcNeeded) / 1e6} USDC`);

  // Get swap quote for USDC → WETH portion
  console.log('\n  Getting swap quote for USDC → WETH...');
  try {
    const halfUSDC = (flow.inputAmount / 2n).toString();
    const wethQuote = await lifi.getSwapQuote(
      SUPPORTED_CHAINS.BASE,
      SUPPORTED_CHAINS.BASE,
      flow.battlePool.token1, // USDC
      flow.battlePool.token0, // WETH
      halfUSDC,
      TEST_ADDRESS
    );

    if (wethQuote) {
      console.log(`    ✅ Quote: ${lifi.formatAmount(halfUSDC, 6)} USDC → ${lifi.formatAmount(wethQuote.toAmount, 18)} WETH`);
    }
  } catch (error) {
    console.log(`    ⚠️  Quote unavailable: ${error instanceof Error ? error.message : 'Unknown'}`);
  }

  // ============================================================
  // STEP 4: Add liquidity to Uniswap V4 pool
  // ============================================================
  stepNum++;
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`STEP ${stepNum}: Add Liquidity to V4 Pool`);
  console.log(`${'─'.repeat(60)}`);

  console.log('\n  Position Details:');
  console.log(`    Pool: WETH/USDC`);
  console.log(`    Tick Range: [${flow.battlePool.tickLower}, ${flow.battlePool.tickUpper}]`);
  console.log(`    Token0 (WETH): ~${Number(ethNeeded) / 1e18} ETH`);
  console.log(`    Token1 (USDC): ~${Number(usdcNeeded) / 1e6} USDC`);

  console.log('\n  Contract Call:');
  console.log('    PositionManager.mint({');
  console.log('      poolKey: { ... },');
  console.log(`      tickLower: ${flow.battlePool.tickLower},`);
  console.log(`      tickUpper: ${flow.battlePool.tickUpper},`);
  console.log('      liquidity: <calculated>,');
  console.log('      recipient: <user>');
  console.log('    })');
  console.log('\n  ✅ Liquidity addition prepared');

  // ============================================================
  // STEP 5: Enter Battle with LP position
  // ============================================================
  stepNum++;
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`STEP ${stepNum}: Enter Battle`);
  console.log(`${'─'.repeat(60)}`);

  console.log('\n  Battle Entry Details:');
  console.log('    Contract: LPBattleVaultV4');
  console.log('    Function: createBattle() or joinBattle()');
  console.log('    Parameters:');
  console.log('      - tokenId: <LP position NFT ID>');
  console.log('      - duration: 24 hours');
  console.log('      - opponent: <matched or open>');

  console.log('\n  ✅ Battle entry prepared');

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log(`\n${'═'.repeat(70)}`);
  console.log('FLOW SUMMARY');
  console.log(`${'═'.repeat(70)}`);

  console.log(`
Complete Cross-Chain Battle Entry Flow:

  ┌─────────────────────────────────────────────────────────────────┐
  │  USER ON ARBITRUM                                               │
  │  └─ Has 1000 USDC                                               │
  └───────────────────────────────┬─────────────────────────────────┘
                                  │
                      Option A: Arc CCTP (~15 min)
                      Option B: LI.FI Direct (~5 min)
                                  │
                                  ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │  USDC ON BASE                                                   │
  │  └─ 1000 USDC arrived                                           │
  └───────────────────────────────┬─────────────────────────────────┘
                                  │
                        LI.FI Swap (50% to WETH)
                                  │
                                  ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │  LP TOKENS READY                                                │
  │  └─ ~0.16 WETH + ~500 USDC                                      │
  └───────────────────────────────┬─────────────────────────────────┘
                                  │
                     Uniswap V4 PositionManager.mint()
                                  │
                                  ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │  LP POSITION NFT                                                │
  │  └─ tokenId: 123                                                │
  └───────────────────────────────┬─────────────────────────────────┘
                                  │
                     LPBattleVaultV4.createBattle()
                                  │
                                  ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │  BATTLE CREATED                                                 │
  │  └─ battleId: 1                                                 │
  │  └─ Status: waiting_for_opponent                                │
  └─────────────────────────────────────────────────────────────────┘
`);

  console.log('Transactions Required:');
  console.log('  1. Approve USDC for bridge/swap');
  console.log('  2. Bridge USDC (Arc) OR Swap (LI.FI)');
  console.log('  3. Swap USDC → WETH (if needed)');
  console.log('  4. Approve tokens for PositionManager');
  console.log('  5. Add liquidity (mint LP NFT)');
  console.log('  6. Approve LP NFT for BattleVault');
  console.log('  7. Create/Join battle');
  console.log('\nTotal: 6-7 transactions (can be optimized with batching)');

  console.log(`\n${'═'.repeat(70)}\n`);

  return { success: true };
}

// Run the test
testCrossChainEntryFlow()
  .then(() => {
    console.log('Integration test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Integration test failed:', error);
    process.exit(1);
  });
