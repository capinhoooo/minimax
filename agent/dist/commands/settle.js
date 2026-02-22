import { BattleAgent } from '../BattleAgent.js';
import { validateConfig } from '../config.js';
import { logger } from '../utils/logger.js';
async function main() {
    console.log('Minimax LP BattleVault - Settle Command\n');
    try {
        validateConfig();
        const agent = new BattleAgent();
        const battleIdArg = process.argv[2];
        if (!battleIdArg) {
            // Settle all ready battles
            logger.info('Checking for battles ready to settle...');
            const readyBattles = await agent.getBattlesReadyToResolve();
            logger.info(`Found ${readyBattles.length} battles ready to settle`);
            for (const battleId of readyBattles) {
                await agent.settleBattle(battleId);
            }
            logger.printSummary();
        }
        else {
            // Settle specific battle
            const battleId = BigInt(battleIdArg);
            const battle = await agent.getBattle(battleId);
            if (!battle) {
                logger.error(`Battle ${battleId} not found`);
                process.exit(1);
            }
            const txHash = await agent.settleBattle(battleId);
            if (txHash) {
                logger.success(`Battle ${battleId} settled successfully!`);
                logger.info(`Transaction: https://sepolia.arbiscan.io/tx/${txHash}`);
            }
            else {
                logger.error('Failed to settle battle');
                process.exit(1);
            }
        }
    }
    catch (error) {
        logger.error('Settle command failed', error);
        process.exit(1);
    }
}
main();
