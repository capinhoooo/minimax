#!/usr/bin/env node
import { BattleAgent } from './BattleAgent.js';
import { config, validateConfig } from './config.js';
import { logger } from './utils/logger.js';
import { txCollector } from './utils/txCollector.js';
import { runDemo } from './commands/demo.js';
import { runAnalyze } from './commands/analyze.js';

async function main() {
  console.log(`
  \x1b[36m╔═══════════════════════════════════════════════════════════════╗
  ║       LP BATTLEVAULT - AUTONOMOUS AGENT                       ║
  ║                                                               ║
  ║  Strategy Loop: MONITOR -> DECIDE -> ACT                      ║
  ║  Uniswap V4 Pool Analysis + LI.FI Cross-Chain Execution      ║
  ║  Monitors Range Vault & Fee Vault on Sepolia                  ║
  ╚═══════════════════════════════════════════════════════════════╝\x1b[0m
  `);

  try {
    validateConfig();
    logger.setLevel(config.logLevel as 'debug' | 'info' | 'warn' | 'error');

    const agent = new BattleAgent();

    // Graceful shutdown
    const shutdown = () => {
      console.log('\nShutdown signal received...');
      agent.stopMonitoring();
      process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    const command = process.argv[2] || 'monitor';

    switch (command) {
      case 'monitor':
        await agent.printStatus();
        await agent.startMonitoring();
        break;

      case 'status':
        await agent.printStatus();
        break;

      case 'settle': {
        const battleIdArg = process.argv[3];
        const contractType = (process.argv[4] || 'range') as 'range' | 'fee';

        if (!battleIdArg) {
          logger.info('Running strategy cycle to find and settle ready battles...');
          await agent.runStrategyCycle();
        } else {
          const battleId = BigInt(battleIdArg);
          logger.info(`Settling battle ${battleId} on ${contractType} vault...`);
          const txHash = await agent.settleBattle(battleId, contractType);
          if (txHash) {
            logger.success(`Battle settled! TX: ${txHash}`);
          } else {
            logger.error('Failed to settle battle');
            process.exit(1);
          }
        }
        txCollector.printSummary();
        break;
      }

      case 'battles': {
        const vaultType = (process.argv[3] || 'range') as 'range' | 'fee';
        const battles = await agent.getActiveBattles(vaultType);
        console.log(`\nActive battles in ${vaultType} vault: ${battles.length}`);
        for (const id of battles) {
          const battle = await agent.getBattle(id, vaultType);
          if (battle) {
            const timeRemaining = await agent.getTimeRemaining(id, vaultType);
            console.log(`  Battle #${id}:`);
            console.log(`    Status: ${battle.status}`);
            console.log(`    Creator: ${battle.creator}`);
            console.log(`    Opponent: ${battle.opponent}`);
            console.log(`    Time Remaining: ${timeRemaining}s`);
          }
        }
        break;
      }

      case 'analyze':
        await runAnalyze(agent, process.argv[3], process.argv[4]);
        break;

      case 'demo':
        await runDemo(agent);
        break;

      case 'routes': {
        // Quick LI.FI route check (mainnet chain IDs for real data)
        const lifi = agent.getLiFi();
        const fromChain = parseInt(process.argv[3] || '8453');  // Base default
        const toChain = parseInt(process.argv[4] || '1');       // Ethereum default
        const amount = process.argv[5] || '50000000'; // 50 USDC

        console.log(`\nQuerying LI.FI routes: Chain ${fromChain} -> ${toChain}, Amount: ${amount}\n`);

        try {
          const routes = await lifi.getSwapRoutes(
            fromChain,
            toChain,
            '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
            '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC on Ethereum
            amount,
            agent.getAddress()
          );

          if (routes.length > 0) {
            lifi.printRoutesSummary(routes);
          } else {
            console.log('  No routes found (expected for testnets - LI.FI works on mainnet)');
          }
        } catch (error) {
          console.log(`  Route query failed: ${error instanceof Error ? error.message : 'Unknown'}`);
        }
        break;
      }

      case 'help':
      default:
        console.log(`
\x1b[36mUsage:\x1b[0m npx tsx src/index.ts <command> [options]

\x1b[36mCore Commands:\x1b[0m
  monitor              Start autonomous MONITOR->DECIDE->ACT loop (default)
  status               Print agent status and vault overview
  settle [id] [type]   Settle a specific battle or run strategy cycle
  battles [type]       List active battles (type: range|fee)

\x1b[36mAnalysis Commands:\x1b[0m
  analyze              Analyze all active battles across both vaults
  analyze [id] [type]  Analyze a specific battle
  routes [from] [to]   Query LI.FI cross-chain routes

\x1b[36mDemo:\x1b[0m
  demo                 Run full demo flow (status + strategy + LI.FI + evidence)

\x1b[36mExamples:\x1b[0m
  npx tsx src/index.ts monitor
  npx tsx src/index.ts demo
  npx tsx src/index.ts analyze 0 range
  npx tsx src/index.ts settle 1 fee
  npx tsx src/index.ts routes 84532 11155111
        `);
        break;
    }
  } catch (error) {
    logger.error('Agent failed to start', error);
    process.exit(1);
  }
}

main();
