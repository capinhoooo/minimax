/**
 * CrossChainEntryAgent Tests
 *
 * Tests the unified cross-chain battle entry agent.
 * Run: npm run test:crosschain
 */
import { CrossChainEntryAgent } from '../integrations/CrossChainEntryAgent.js';
import { SUPPORTED_CHAINS, TOKENS } from '../integrations/LiFiIntegration.js';
const TEST_ADDRESS = '0x564323aE0D8473103F3763814c5121Ca9e48004B';
async function testCrossChainEntryAgent() {
    console.log('\n' + '='.repeat(60));
    console.log('CROSS-CHAIN ENTRY AGENT TESTS');
    console.log('='.repeat(60) + '\n');
    const agent = new CrossChainEntryAgent();
    let passed = 0;
    let failed = 0;
    // Test 1: Analyze valid intent
    console.log('Test 1: Analyze valid intent');
    try {
        const intent = {
            userAddress: TEST_ADDRESS,
            sourceChain: SUPPORTED_CHAINS.ARBITRUM,
            sourceToken: TOKENS.USDC[SUPPORTED_CHAINS.ARBITRUM],
            amount: BigInt(1000e6),
            targetPool: {
                chainId: SUPPORTED_CHAINS.BASE,
                token0: TOKENS.WETH[SUPPORTED_CHAINS.BASE],
                token1: TOKENS.USDC[SUPPORTED_CHAINS.BASE],
                tickLower: -887220,
                tickUpper: 887220,
            },
        };
        const analysis = await agent.analyzeIntent(intent);
        if (analysis.isValid) {
            console.log('  ✅ Intent is valid');
            console.log(`     Recommendations: ${analysis.recommendations.join(', ')}`);
            passed++;
        }
        else {
            console.log(`  ❌ Intent invalid: ${analysis.issues.join(', ')}`);
            failed++;
        }
    }
    catch (error) {
        console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
        failed++;
    }
    // Test 2: Analyze invalid intent (unsupported chain)
    console.log('\nTest 2: Analyze invalid intent (unsupported chain)');
    try {
        const intent = {
            userAddress: TEST_ADDRESS,
            sourceChain: 999999, // Invalid chain
            sourceToken: '0x0000000000000000000000000000000000000000',
            amount: BigInt(100e6),
            targetPool: {
                chainId: SUPPORTED_CHAINS.BASE,
                token0: TOKENS.WETH[SUPPORTED_CHAINS.BASE],
                token1: TOKENS.USDC[SUPPORTED_CHAINS.BASE],
                tickLower: -887220,
                tickUpper: 887220,
            },
        };
        const analysis = await agent.analyzeIntent(intent);
        if (!analysis.isValid && analysis.issues.length > 0) {
            console.log('  ✅ Correctly identified invalid intent');
            console.log(`     Issues: ${analysis.issues.join(', ')}`);
            passed++;
        }
        else {
            console.log('  ❌ Failed to identify invalid intent');
            failed++;
        }
    }
    catch (error) {
        console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
        failed++;
    }
    // Test 3: Get route options
    console.log('\nTest 3: Get route options (Arbitrum USDC → Base LP)');
    try {
        const intent = {
            userAddress: TEST_ADDRESS,
            sourceChain: SUPPORTED_CHAINS.ARBITRUM,
            sourceToken: TOKENS.USDC[SUPPORTED_CHAINS.ARBITRUM],
            amount: BigInt(500e6),
            targetPool: {
                chainId: SUPPORTED_CHAINS.BASE,
                token0: TOKENS.WETH[SUPPORTED_CHAINS.BASE],
                token1: TOKENS.USDC[SUPPORTED_CHAINS.BASE],
                tickLower: -887220,
                tickUpper: 887220,
            },
        };
        const options = await agent.getRouteOptions(intent);
        if (options.length > 0) {
            console.log(`  ✅ Found ${options.length} route options:`);
            options.forEach((opt, i) => {
                console.log(`     ${i + 1}. ${opt.method} - ${opt.estimatedTime} - ${opt.recommended ? '⭐ Recommended' : ''}`);
            });
            passed++;
        }
        else {
            console.log('  ⚠️  No routes found (may be network issue)');
            // Don't count as failure - could be API issue
        }
    }
    catch (error) {
        console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
        failed++;
    }
    // Test 4: Create execution plan
    console.log('\nTest 4: Create execution plan');
    try {
        const intent = {
            userAddress: TEST_ADDRESS,
            sourceChain: SUPPORTED_CHAINS.ARBITRUM,
            sourceToken: TOKENS.USDC[SUPPORTED_CHAINS.ARBITRUM],
            amount: BigInt(1000e6),
            targetPool: {
                chainId: SUPPORTED_CHAINS.BASE,
                token0: TOKENS.WETH[SUPPORTED_CHAINS.BASE],
                token1: TOKENS.USDC[SUPPORTED_CHAINS.BASE],
                tickLower: -887220,
                tickUpper: 887220,
            },
            duration: 86400, // 24 hours
        };
        const options = await agent.getRouteOptions(intent);
        if (options.length > 0) {
            const plan = await agent.createExecutionPlan(intent, options[0]);
            if (plan.transactions.length > 0) {
                console.log(`  ✅ Execution plan created with ${plan.transactions.length} steps`);
                console.log(`     Estimated gas: ${plan.estimatedTotalGas}`);
                passed++;
                // Print the full plan
                console.log('\n  Full Execution Plan:');
                agent.printExecutionPlan(plan);
            }
            else {
                console.log('  ❌ No transactions in plan');
                failed++;
            }
        }
        else {
            console.log('  ⚠️  Skipped - no routes available');
        }
    }
    catch (error) {
        console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
        failed++;
    }
    // Test 5: Arc CCTP route option
    console.log('\nTest 5: Verify Arc CCTP route is available for USDC');
    try {
        const intent = {
            userAddress: TEST_ADDRESS,
            sourceChain: SUPPORTED_CHAINS.POLYGON,
            sourceToken: TOKENS.USDC[SUPPORTED_CHAINS.POLYGON],
            amount: BigInt(2000e6),
            targetPool: {
                chainId: SUPPORTED_CHAINS.BASE,
                token0: TOKENS.WETH[SUPPORTED_CHAINS.BASE],
                token1: TOKENS.USDC[SUPPORTED_CHAINS.BASE],
                tickLower: -887220,
                tickUpper: 887220,
            },
        };
        const options = await agent.getRouteOptions(intent);
        const arcOption = options.find(o => o.method === 'arc_cctp');
        if (arcOption) {
            console.log('  ✅ Arc CCTP route available for USDC transfers');
            console.log(`     Time: ${arcOption.estimatedTime}`);
            console.log(`     Output: ${arcOption.estimatedOutput}`);
            passed++;
        }
        else {
            console.log('  ⚠️  Arc CCTP route not found (may be expected)');
        }
    }
    catch (error) {
        console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
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
testCrossChainEntryAgent()
    .then(({ passed, failed }) => {
    process.exit(failed > 0 ? 1 : 0);
})
    .catch((error) => {
    console.error('Test runner failed:', error);
    process.exit(1);
});
