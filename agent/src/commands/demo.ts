/**
 * Demo Command
 *
 * Runs the full agent demo flow for hackathon submission:
 * 1. Show agent status
 * 2. Run MONITOR -> DECIDE -> ACT strategy cycle
 * 3. Analyze cross-chain routes via LI.FI
 * 4. Print all transaction evidence
 */

import { BattleAgent } from '../BattleAgent.js';
import { logger } from '../utils/logger.js';
import { txCollector } from '../utils/txCollector.js';
import { SUPPORTED_CHAINS, TOKENS } from '../integrations/LiFiIntegration.js';

const C = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
  blue: '\x1b[34m',
  bold: '\x1b[1m',
};

function banner(text: string) {
  console.log(`\n${C.cyan}${'='.repeat(70)}${C.reset}`);
  console.log(`${C.cyan}${C.bold}  ${text}${C.reset}`);
  console.log(`${C.cyan}${'='.repeat(70)}${C.reset}\n`);
}

function section(text: string) {
  console.log(`\n${C.blue}--- ${text} ---${C.reset}\n`);
}

export async function runDemo(agent: BattleAgent) {
  banner('MINIMAX LP BATTLEVAULT - AUTONOMOUS AGENT DEMO');

  console.log(`${C.gray}  This demo showcases the full agent strategy loop:${C.reset}`);
  console.log(`${C.gray}  1. MONITOR - Scan BattleArena on Arbitrum Sepolia${C.reset}`);
  console.log(`${C.gray}  2. DECIDE  - Evaluate actions (resolve, update, entry)${C.reset}`);
  console.log(`${C.gray}  3. ACT     - Execute decisions on-chain${C.reset}`);
  console.log(`${C.gray}  4. LI.FI   - Cross-chain route analysis${C.reset}`);
  console.log();

  // ============ Step 1: Agent Status ============
  section('STEP 1: Agent Status');
  await agent.printStatus();

  // ============ Step 2: Strategy Cycle ============
  section('STEP 2: Strategy Cycle (MONITOR -> DECIDE -> ACT)');
  await agent.runStrategyCycle();

  // ============ Step 3: Cross-Chain Route Analysis via LI.FI ============
  section('STEP 3: Cross-Chain Route Analysis via LI.FI');

  console.log(`${C.yellow}  Simulating cross-chain battle entry from Base → Arbitrum...${C.reset}\n`);
  console.log(`${C.gray}  (Using mainnet chain IDs for real LI.FI route data)${C.reset}\n`);

  const intent = {
    userAddress: agent.getAddress(),
    sourceChain: SUPPORTED_CHAINS.BASE,
    sourceToken: TOKENS.USDC[SUPPORTED_CHAINS.BASE],
    amount: BigInt(50e6),
    targetPool: {
      chainId: SUPPORTED_CHAINS.ARBITRUM,
      token0: '0x0000000000000000000000000000000000000000',
      token1: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // USDC on Arbitrum
      tickLower: -887220,
      tickUpper: 887220,
    },
  };

  try {
    const validation = await agent.getCrossChainAgent().analyzeIntent(intent);
    console.log(`  Intent Valid: ${validation.isValid ? C.green + 'YES' : C.red + 'NO'}${C.reset}`);
    if (validation.recommendations.length > 0) {
      console.log(`  Recommendations:`);
      validation.recommendations.forEach(r => console.log(`    - ${r}`));
    }

    console.log(`\n${C.yellow}  Querying LI.FI for cross-chain routes...${C.reset}`);
    const routes = await agent.getCrossChainAgent().getRouteOptions(intent);

    if (routes.length > 0) {
      console.log(`\n  ${C.green}Found ${routes.length} route options:${C.reset}`);
      routes.forEach((r, i) => {
        const tag = r.recommended ? ` ${C.green}(RECOMMENDED)${C.reset}` : '';
        console.log(`    ${i + 1}. ${r.method}${tag}`);
        console.log(`       Time: ${r.estimatedTime} | Fees: ${r.fees} | Steps: ${r.steps}`);
      });

      const recommended = routes.find(r => r.recommended) || routes[0];
      const plan = await agent.getCrossChainAgent().createExecutionPlan(intent, recommended);
      agent.getCrossChainAgent().printExecutionPlan(plan);
    } else {
      console.log(`  ${C.yellow}No LI.FI routes available for testnet (expected - LI.FI primarily supports mainnet)${C.reset}`);
      console.log(`  ${C.gray}On mainnet, routes would be available for: Ethereum, Arbitrum, Base, Polygon, Optimism${C.reset}`);

      console.log(`\n  ${C.blue}Mainnet Route Preview:${C.reset}`);
      console.log(`    Source: USDC on Base (chain 8453)`);
      console.log(`    Destination: ETH + USDC on Arbitrum (chain 42161)`);
      console.log(`    Method: LI.FI bridge + swap`);
      console.log(`    Steps: Bridge USDC -> Swap 50% to ETH -> Add LP Liquidity -> Enter Battle`);
    }
  } catch (error) {
    console.log(`  ${C.yellow}LI.FI route query: ${error instanceof Error ? error.message : 'Service unavailable for testnets'}${C.reset}`);
    console.log(`  ${C.gray}This is expected for testnet - LI.FI works on mainnet chains${C.reset}`);
  }

  // ============ Step 4: Arc/CCTP Bridge Analysis ============
  section('STEP 4: CCTP Bridge Route (Alternative)');

  console.log(`  ${C.blue}Circle CCTP Bridge (for USDC transfers):${C.reset}`);
  console.log(`    Supported chains: Ethereum, Arbitrum, Base, Polygon, Optimism`);
  console.log(`    Method: Native USDC burn on source -> attestation -> mint on destination`);
  console.log(`    Time: ~15-20 minutes`);
  console.log(`    Fees: Gas only (no bridge fee)`);

  // ============ Step 5: Transaction Evidence ============
  section('STEP 5: Transaction Evidence');
  txCollector.printSummary();

  // ============ Summary ============
  banner('DEMO COMPLETE');

  console.log(`  ${C.blue}What this agent does:${C.reset}`);
  console.log(`    1. Monitors BattleArena on Arbitrum Sepolia (Uniswap V4 + Camelot)`);
  console.log(`    2. Analyzes battle state: in-range status, fee growth, time remaining`);
  console.log(`    3. Auto-resolves expired battles for resolver rewards`);
  console.log(`    4. Uses LI.FI SDK for cross-chain battle entry routing`);
  console.log(`    5. Supports CCTP bridging for native USDC transfers`);
  console.log(`    6. Transparent logging of all decisions and actions`);

  console.log(`\n  ${C.blue}Architecture:${C.reset}`);
  console.log(`    ${C.green}BattleArena:${C.reset}       Multi-DEX LP battle management (Solidity)`);
  console.log(`    ${C.green}Scoring Engine:${C.reset}    Range & fee scoring via Stylus (Rust/WASM)`);
  console.log(`    ${C.green}Leaderboard:${C.reset}       ELO ratings via Stylus (Rust/WASM)`);
  console.log(`    ${C.green}DEX Adapters:${C.reset}      Uniswap V4 + Camelot position normalization`);
  console.log(`    ${C.green}LI.FI:${C.reset}             Cross-chain routing via SDK`);

  console.log(`\n  ${C.blue}Contracts (Arbitrum Sepolia):${C.reset}`);
  console.log(`    BattleArena:     0x6cfFE36cC727A649bC8D269CbD675552d0A550F6`);
  console.log(`    UniswapV4Adapter:0xca6118BD65778C454B67B11DE39B9BB881915b40`);
  console.log(`    CamelotAdapter:  0x5442068A4Cd117F26047c89f0A87D635112c886E`);
  console.log(`    ScoringEngine:   0xd34ffbe6d046cb1a3450768664caf97106d18204 (Stylus)`);
  console.log(`    Leaderboard:     0x7feb2cf23797fd950380cd9ad4b7d4cad4b3c85b (Stylus)`);
  console.log();
}
