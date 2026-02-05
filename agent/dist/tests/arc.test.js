/**
 * Arc/Circle CCTP Integration Tests
 *
 * Tests the Arc CCTP integration for cross-chain USDC bridging.
 * Run: npm run test:arc
 */
import { ArcIntegration, CCTP_CONTRACTS } from '../integrations/ArcIntegration.js';
// Test wallet address (public - for testing only)
const TEST_ADDRESS = '0x564323aE0D8473103F3763814c5121Ca9e48004B';
async function testArcIntegration() {
    console.log('\n' + '='.repeat(60));
    console.log('ARC/CCTP INTEGRATION TESTS');
    console.log('='.repeat(60) + '\n');
    const arc = new ArcIntegration();
    let passed = 0;
    let failed = 0;
    // Test 1: Verify CCTP contract addresses
    console.log('Test 1: Verify CCTP contract addresses');
    try {
        const chains = ['ETHEREUM', 'ARBITRUM', 'BASE', 'POLYGON', 'OPTIMISM'];
        let allValid = true;
        for (const chain of chains) {
            const contracts = arc.getContractAddresses(chain);
            if (!contracts.tokenMessenger || !contracts.messageTransmitter || !contracts.usdc) {
                console.log(`  ❌ Missing contracts for ${chain}`);
                allValid = false;
            }
        }
        if (allValid) {
            console.log(`  ✅ All CCTP contract addresses configured for ${chains.length} chains`);
            passed++;
        }
        else {
            failed++;
        }
    }
    catch (error) {
        console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
        failed++;
    }
    // Test 2: Prepare approve transaction data
    console.log('\nTest 2: Prepare approve transaction data');
    try {
        const amount = BigInt(1000e6); // 1000 USDC
        const approveData = arc.prepareApproveData('ARBITRUM', amount);
        if (approveData.to && approveData.data.startsWith('0x')) {
            console.log(`  ✅ Approve transaction prepared:`);
            console.log(`     To: ${approveData.to}`);
            console.log(`     Data: ${approveData.data.slice(0, 66)}...`);
            passed++;
        }
        else {
            console.log('  ❌ Invalid approve transaction data');
            failed++;
        }
    }
    catch (error) {
        console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
        failed++;
    }
    // Test 3: Prepare depositForBurn transaction data
    console.log('\nTest 3: Prepare depositForBurn transaction data');
    try {
        const request = {
            sourceChain: 'ARBITRUM',
            destChain: 'BASE',
            amount: BigInt(500e6), // 500 USDC
            recipient: TEST_ADDRESS,
        };
        const burnData = arc.prepareDepositForBurnData(request);
        if (burnData.to && burnData.data.startsWith('0x')) {
            console.log(`  ✅ DepositForBurn transaction prepared:`);
            console.log(`     To: ${burnData.to}`);
            console.log(`     Data: ${burnData.data.slice(0, 66)}...`);
            passed++;
        }
        else {
            console.log('  ❌ Invalid burn transaction data');
            failed++;
        }
    }
    catch (error) {
        console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
        failed++;
    }
    // Test 4: Get bridge instructions
    console.log('\nTest 4: Get complete bridge instructions');
    try {
        const request = {
            sourceChain: 'POLYGON',
            destChain: 'BASE',
            amount: BigInt(2000e6), // 2000 USDC
            recipient: TEST_ADDRESS,
        };
        const instructions = arc.getBridgeInstructions(request);
        if (instructions.steps.length === 4) {
            console.log(`  ✅ Bridge instructions generated (${instructions.steps.length} steps):`);
            instructions.steps.forEach((step) => {
                console.log(`     ${step.step}. ${step.action}: ${step.description.slice(0, 50)}...`);
            });
            passed++;
        }
        else {
            console.log('  ❌ Unexpected number of steps');
            failed++;
        }
    }
    catch (error) {
        console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
        failed++;
    }
    // Test 5: Domain IDs are correct
    console.log('\nTest 5: Verify CCTP domain IDs');
    try {
        const expectedDomains = {
            ETHEREUM: 0,
            ARBITRUM: 3,
            BASE: 6,
            POLYGON: 7,
            OPTIMISM: 2,
        };
        let allCorrect = true;
        for (const [chain, expectedDomain] of Object.entries(expectedDomains)) {
            const contracts = CCTP_CONTRACTS[chain];
            if (contracts.domain !== expectedDomain) {
                console.log(`  ❌ Wrong domain for ${chain}: expected ${expectedDomain}, got ${contracts.domain}`);
                allCorrect = false;
            }
        }
        if (allCorrect) {
            console.log(`  ✅ All CCTP domain IDs are correct`);
            passed++;
        }
        else {
            failed++;
        }
    }
    catch (error) {
        console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
        failed++;
    }
    // Test 6: Format USDC amount
    console.log('\nTest 6: Format USDC amounts');
    try {
        const testCases = [
            { amount: BigInt(1000000), expected: '1.00 USDC' },
            { amount: BigInt(1500000), expected: '1.50 USDC' },
            { amount: BigInt(12345678), expected: '12.34 USDC' },
        ];
        let allCorrect = true;
        for (const { amount, expected } of testCases) {
            const formatted = arc.formatUSDC(amount);
            if (formatted !== expected) {
                console.log(`  ❌ Format mismatch: ${amount} → ${formatted} (expected ${expected})`);
                allCorrect = false;
            }
        }
        if (allCorrect) {
            console.log(`  ✅ USDC formatting correct for all test cases`);
            passed++;
        }
        else {
            failed++;
        }
    }
    catch (error) {
        console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
        failed++;
    }
    // Test 7: Get supported chains
    console.log('\nTest 7: Verify supported chains');
    try {
        const chains = arc.getSupportedChains();
        const requiredChains = ['ETHEREUM', 'ARBITRUM', 'BASE', 'POLYGON', 'OPTIMISM'];
        const hasAll = requiredChains.every(c => chains.includes(c));
        if (hasAll) {
            console.log(`  ✅ All required chains supported: ${requiredChains.join(', ')}`);
            passed++;
        }
        else {
            console.log('  ❌ Missing required chains');
            failed++;
        }
    }
    catch (error) {
        console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
        failed++;
    }
    // Test 8: Print bridge flow summary
    console.log('\nTest 8: Bridge flow summary output');
    try {
        arc.printBridgeFlowSummary({
            sourceChain: 'ARBITRUM',
            destChain: 'BASE',
            amount: BigInt(1000e6),
            recipient: TEST_ADDRESS,
        });
        console.log('  ✅ Bridge flow summary printed successfully');
        passed++;
    }
    catch (error) {
        console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
        failed++;
    }
    // Test 9: Check USDC balance (may fail without proper RPC)
    console.log('\nTest 9: Get USDC balance (requires RPC connection)');
    try {
        const balance = await arc.getUSDCBalance('ARBITRUM', TEST_ADDRESS);
        console.log(`  ✅ USDC balance on Arbitrum: ${arc.formatUSDC(balance)}`);
        passed++;
    }
    catch (error) {
        console.log(`  ⚠️  Skipped (RPC error): ${error instanceof Error ? error.message : 'Unknown'}`);
        // Don't count as failure - RPC might not be available
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
testArcIntegration()
    .then(({ passed, failed }) => {
    process.exit(failed > 0 ? 1 : 0);
})
    .catch((error) => {
    console.error('Test runner failed:', error);
    process.exit(1);
});
