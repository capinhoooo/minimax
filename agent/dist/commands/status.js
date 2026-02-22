import { BattleAgent } from '../BattleAgent.js';
import { validateConfig } from '../config.js';
import { logger } from '../utils/logger.js';
import { formatUnits } from 'viem';
import { statusName, battleTypeName, dexTypeName } from '../BattleAgent.js';
async function main() {
    console.log('Minimax LP BattleVault - Status Command\n');
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
            const activeBattles = await agent.getActiveBattles();
            const pendingBattles = await agent.getPendingBattles();
            if (activeBattles.length > 0) {
                console.log('Active Battles:');
                for (const id of activeBattles) {
                    const battle = await agent.getBattle(id);
                    if (battle) {
                        const timeRemaining = agent.getTimeRemaining(battle);
                        console.log(`\n  Battle #${id}:`);
                        console.log(`    Type:           ${battleTypeName(battle.battleType)}`);
                        console.log(`    Creator:        ${battle.creator}`);
                        console.log(`    Creator DEX:    ${dexTypeName(battle.creatorDex)}`);
                        console.log(`    Opponent:       ${battle.opponent}`);
                        console.log(`    Opponent DEX:   ${dexTypeName(battle.opponentDex)}`);
                        console.log(`    Creator Token:  ${battle.creatorTokenId}`);
                        console.log(`    Opponent Token: ${battle.opponentTokenId}`);
                        console.log(`    Start Time:     ${new Date(Number(battle.startTime) * 1000).toISOString()}`);
                        console.log(`    Duration:       ${battle.duration}s`);
                        console.log(`    Time Remaining: ${timeRemaining}s`);
                        console.log(`    Creator Value:  $${formatUnits(battle.creatorValueUSD, 8)}`);
                        console.log(`    Opponent Value: $${formatUnits(battle.opponentValueUSD, 8)}`);
                        console.log(`    Status:         ${statusName(battle.status)}`);
                        if (battle.winner !== '0x0000000000000000000000000000000000000000') {
                            console.log(`    Winner:         ${battle.winner}`);
                        }
                    }
                }
            }
            if (pendingBattles.length > 0) {
                console.log('\nPending Battles:');
                for (const id of pendingBattles) {
                    const battle = await agent.getBattle(id);
                    if (battle) {
                        console.log(`\n  Battle #${id}:`);
                        console.log(`    Type:           ${battleTypeName(battle.battleType)}`);
                        console.log(`    Creator:        ${battle.creator}`);
                        console.log(`    Creator DEX:    ${dexTypeName(battle.creatorDex)}`);
                        console.log(`    Duration:       ${battle.duration}s`);
                        console.log(`    Creator Value:  $${formatUnits(battle.creatorValueUSD, 8)}`);
                    }
                }
            }
            if (activeBattles.length === 0 && pendingBattles.length === 0) {
                console.log('No active or pending battles found.');
            }
        }
    }
    catch (error) {
        logger.error('Status command failed', error);
        process.exit(1);
    }
}
main();
