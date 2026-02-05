import { BattleAgent } from '../BattleAgent.js';
import { validateConfig } from '../config.js';
import { logger } from '../utils/logger.js';

async function main() {
  console.log('LP BattleVault - Settle Command\n');

  try {
    validateConfig();
    const agent = new BattleAgent();

    const battleIdArg = process.argv[2];
    const contractType = (process.argv[3] || 'range') as 'range' | 'fee';

    if (!battleIdArg) {
      // Settle all ready battles
      logger.info('Checking for battles ready to settle...');

      const rangeReady = await agent.getBattlesReadyToResolve('range');
      const feeReady = await agent.getBattlesReadyToResolve('fee');

      logger.info(`Found ${rangeReady.length} range battles and ${feeReady.length} fee battles ready to settle`);

      for (const battleId of rangeReady) {
        await agent.settleBattle(battleId, 'range');
      }

      for (const battleId of feeReady) {
        await agent.settleBattle(battleId, 'fee');
      }

      logger.printSummary();
    } else {
      // Settle specific battle
      const battleId = BigInt(battleIdArg);

      // Check if battle exists and is ready
      const battle = await agent.getBattle(battleId, contractType);
      if (!battle) {
        logger.error(`Battle ${battleId} not found in ${contractType} vault`);
        process.exit(1);
      }

      if (battle.status !== 'ready_to_resolve') {
        logger.warn(`Battle ${battleId} status is "${battle.status}", not ready to resolve`);
        const proceed = process.argv[4] === '--force';
        if (!proceed) {
          logger.info('Use --force to attempt settlement anyway');
          process.exit(1);
        }
      }

      const txHash = await agent.settleBattle(battleId, contractType);
      if (txHash) {
        logger.success(`Battle ${battleId} settled successfully!`);
        logger.info(`Transaction: https://sepolia.etherscan.io/tx/${txHash}`);
      } else {
        logger.error('Failed to settle battle');
        process.exit(1);
      }
    }
  } catch (error) {
    logger.error('Settle command failed', error);
    process.exit(1);
  }
}

main();
