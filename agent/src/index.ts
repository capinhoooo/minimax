#!/usr/bin/env node
import { BattleAgent } from './BattleAgent.js';
import { config, validateConfig } from './config.js';
import { logger } from './utils/logger.js';
import { txCollector } from './utils/txCollector.js';
import { runDemo } from './commands/demo.js';
import { runAnalyze } from './commands/analyze.js';
import { startServer } from './server.js';

async function main() {
  console.log(`
  \x1b[36m╔═══════════════════════════════════════════════════════════════╗
  ║       MINIMAX LP BATTLEVAULT - AUTONOMOUS AGENT             ║
  ║                                                               ║
  ║  Strategy Loop: MONITOR -> DECIDE -> ACT                      ║
  ║  Multi-DEX LP Battles (Uniswap V4 + Camelot) on Arbitrum     ║
  ║  Stylus (Rust/WASM) Scoring Engine + ELO Leaderboard          ║
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

        if (!battleIdArg) {
          logger.info('Running strategy cycle to find and settle ready battles...');
          await agent.runStrategyCycle();
        } else {
          const battleId = BigInt(battleIdArg);
          logger.info(`Settling battle ${battleId}...`);
          const txHash = await agent.settleBattle(battleId);
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
        const activeBattles = await agent.getActiveBattles();
        const pendingBattles = await agent.getPendingBattles();
        const battleCount = await agent.getBattleCount();

        console.log(`\nBattleArena: ${battleCount} total battles`);
        console.log(`Active: ${activeBattles.length} | Pending: ${pendingBattles.length}\n`);

        for (const id of activeBattles) {
          const battle = await agent.getBattle(id);
          if (battle) {
            const timeRem = agent.getTimeRemaining(battle);
            console.log(`  Battle #${id}: ACTIVE`);
            console.log(`    Creator: ${battle.creator}`);
            console.log(`    Opponent: ${battle.opponent}`);
            console.log(`    Time Remaining: ${timeRem}s`);
          }
        }
        for (const id of pendingBattles) {
          const battle = await agent.getBattle(id);
          if (battle) {
            console.log(`  Battle #${id}: PENDING`);
            console.log(`    Creator: ${battle.creator}`);
            console.log(`    Duration: ${battle.duration}s`);
          }
        }
        break;
      }

      case 'analyze':
        await runAnalyze(agent, process.argv[3]);
        break;

      case 'demo':
        await runDemo(agent);
        break;

      case 'serve': {
        const port = parseInt(process.env.API_PORT || '3001');
        startServer(agent, port);
        // Also query initial LI.FI routes for API exposure
        try {
          const lifi = agent.getLiFi();
          const routes = await lifi.getSwapRoutes(
            8453, 1,
            '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            '50000000',
            agent.getAddress()
          );
          agent.setLastRoutes(routes);
        } catch {
          logger.warn('Initial LI.FI route query failed (will retry in strategy loop)');
        }
        // Start strategy loop (runs alongside server)
        await agent.startMonitoring();
        break;
      }

      case 'routes': {
        // Quick LI.FI route check (mainnet chain IDs for real data)
        const lifi = agent.getLiFi();
        const fromChain = parseInt(process.argv[3] || '8453');
        const toChain = parseInt(process.argv[4] || '42161'); // Arbitrum default
        const amount = process.argv[5] || '50000000';

        console.log(`\nQuerying LI.FI routes: Chain ${fromChain} -> ${toChain}, Amount: ${amount}\n`);

        try {
          const routes = await lifi.getSwapRoutes(
            fromChain,
            toChain,
            '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // USDC on Arbitrum
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
  serve                Start API server (port 3001) + strategy loop
  status               Print agent status and arena overview
  settle [id]          Settle a specific battle or run strategy cycle
  battles              List active and pending battles

\x1b[36mAnalysis Commands:\x1b[0m
  analyze              Analyze all active battles
  analyze [id]         Analyze a specific battle
  routes [from] [to]   Query LI.FI cross-chain routes

\x1b[36mDemo:\x1b[0m
  demo                 Run full demo flow (status + strategy + LI.FI + evidence)

\x1b[36mExamples:\x1b[0m
  npx tsx src/index.ts monitor
  npx tsx src/index.ts demo
  npx tsx src/index.ts analyze 0
  npx tsx src/index.ts settle 1
  npx tsx src/index.ts routes 8453 42161
        `);
        break;
    }
  } catch (error) {
    logger.error('Agent failed to start', error);
    process.exit(1);
  }
}

main();
