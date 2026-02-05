import { BattleAgent } from '../BattleAgent.js';
import { validateConfig, config } from '../config.js';
import { logger } from '../utils/logger.js';
import { formatUnits } from 'viem';

async function main() {
  console.log('LP BattleVault - Status Command\n');

  try {
    validateConfig();
    const agent = new BattleAgent();

    // Check for verbose flag
    const verbose = process.argv.includes('-v') || process.argv.includes('--verbose');

    // Print basic status
    await agent.printStatus();

    if (verbose) {
      // Print detailed battle information
      console.log('\n--- Detailed Battle Information ---\n');

      // Range Vault battles
      const rangeActive = await agent.getActiveBattles('range');
      if (rangeActive.length > 0) {
        console.log('Range Vault Battles:');
        for (const id of rangeActive) {
          const battle = await agent.getBattle(id, 'range');
          const timeRemaining = await agent.getTimeRemaining(id, 'range');

          if (battle) {
            console.log(`\n  Battle #${id}:`);
            console.log(`    Creator:        ${battle.creator}`);
            console.log(`    Opponent:       ${battle.opponent}`);
            console.log(`    Creator Token:  ${battle.creatorTokenId}`);
            console.log(`    Opponent Token: ${battle.opponentTokenId}`);
            console.log(`    Start Time:     ${new Date(Number(battle.startTime) * 1000).toISOString()}`);
            console.log(`    Duration:       ${battle.duration}s`);
            console.log(`    Time Remaining: ${timeRemaining}s`);
            console.log(`    Total Value:    $${formatUnits(battle.totalValueUSD, 8)}`);
            console.log(`    Status:         ${battle.status}`);
            console.log(`    Resolved:       ${battle.isResolved}`);
            if (battle.winner !== '0x0000000000000000000000000000000000000000') {
              console.log(`    Winner:         ${battle.winner}`);
            }
          }
        }
      }

      // Fee Vault battles
      const feeActive = await agent.getActiveBattles('fee');
      if (feeActive.length > 0) {
        console.log('\nFee Vault Battles:');
        for (const id of feeActive) {
          const battle = await agent.getBattle(id, 'fee');
          const timeRemaining = await agent.getTimeRemaining(id, 'fee');

          if (battle) {
            console.log(`\n  Battle #${id}:`);
            console.log(`    Creator:        ${battle.creator}`);
            console.log(`    Opponent:       ${battle.opponent}`);
            console.log(`    Start Time:     ${new Date(Number(battle.startTime) * 1000).toISOString()}`);
            console.log(`    Duration:       ${battle.duration}s`);
            console.log(`    Time Remaining: ${timeRemaining}s`);
            console.log(`    Status:         ${battle.status}`);
            console.log(`    Resolved:       ${battle.isResolved}`);
          }
        }
      }

      if (rangeActive.length === 0 && feeActive.length === 0) {
        console.log('No active battles found.');
      }
    }

  } catch (error) {
    logger.error('Status command failed', error);
    process.exit(1);
  }
}

main();
