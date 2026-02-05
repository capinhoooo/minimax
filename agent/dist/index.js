#!/usr/bin/env node
import { BattleAgent } from './BattleAgent.js';
import { config, validateConfig } from './config.js';
import { logger } from './utils/logger.js';
async function main() {
    console.log(`
  ╔═══════════════════════════════════════════════════════════╗
  ║          LP BATTLEVAULT AUTONOMOUS AGENT                  ║
  ║                                                           ║
  ║  Auto-settles LP position battles when duration expires   ║
  ║  Monitors both Range Vault and Fee Vault contracts        ║
  ╚═══════════════════════════════════════════════════════════╝
  `);
    try {
        // Validate configuration
        validateConfig();
        // Set log level
        logger.setLevel(config.logLevel);
        // Create agent
        const agent = new BattleAgent();
        // Handle shutdown
        const shutdown = () => {
            console.log('\nShutdown signal received...');
            agent.stopMonitoring();
            process.exit(0);
        };
        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
        // Parse command
        const command = process.argv[2] || 'monitor';
        switch (command) {
            case 'monitor':
                // Print initial status
                await agent.printStatus();
                // Start monitoring loop
                await agent.startMonitoring();
                break;
            case 'status':
                await agent.printStatus();
                break;
            case 'settle':
                const battleIdArg = process.argv[3];
                const contractType = (process.argv[4] || 'range');
                if (!battleIdArg) {
                    // Settle all ready battles
                    logger.info('Checking for battles ready to settle...');
                    await agent.checkAndSettleBattles();
                }
                else {
                    // Settle specific battle
                    const battleId = BigInt(battleIdArg);
                    logger.info(`Settling battle ${battleId} on ${contractType} vault...`);
                    const txHash = await agent.settleBattle(battleId, contractType);
                    if (txHash) {
                        logger.success(`Battle settled! TX: ${txHash}`);
                    }
                    else {
                        logger.error('Failed to settle battle');
                        process.exit(1);
                    }
                }
                break;
            case 'battles':
                const vaultType = (process.argv[3] || 'range');
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
            case 'help':
            default:
                console.log(`
Usage: npx ts-node src/index.ts <command> [options]

Commands:
  monitor              Start the monitoring loop (default)
  status               Print current agent and battle status
  settle [id] [type]   Settle a specific battle or all ready battles
  battles [type]       List active battles (type: range|fee)
  help                 Show this help message

Examples:
  npx ts-node src/index.ts monitor
  npx ts-node src/index.ts status
  npx ts-node src/index.ts settle 1 range
  npx ts-node src/index.ts battles fee
        `);
                break;
        }
    }
    catch (error) {
        logger.error('Agent failed to start', error);
        process.exit(1);
    }
}
main();
