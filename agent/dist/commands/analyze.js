/**
 * Analyze Command
 *
 * Analyzes specific battles or all active battles in the BattleArena.
 */
const C = {
    reset: '\x1b[0m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    gray: '\x1b[90m',
    blue: '\x1b[34m',
};
export async function runAnalyze(agent, battleIdArg) {
    console.log(`\n${C.cyan}${'='.repeat(70)}${C.reset}`);
    console.log(`${C.cyan}  BATTLE ANALYZER - Multi-DEX LP Battle Analysis${C.reset}`);
    console.log(`${C.cyan}${'='.repeat(70)}${C.reset}\n`);
    const analyzer = agent.getPoolAnalyzer();
    if (battleIdArg) {
        // Analyze specific battle
        const battleId = BigInt(battleIdArg);
        console.log(`${C.blue}Analyzing battle #${battleId}...${C.reset}\n`);
        const analysis = await analyzer.analyzeBattle(battleId);
        if (analysis) {
            analyzer.printBattleAnalysis(analysis);
            const score = analyzer.scoreBattleForEntry(analysis);
            console.log(`\n  ${C.yellow}Entry Score: ${score}/100${C.reset}`);
            if (score > 60) {
                console.log(`  ${C.green}>> Worth considering for entry${C.reset}`);
            }
            else if (score > 30) {
                console.log(`  ${C.yellow}>> Moderate opportunity${C.reset}`);
            }
            else {
                console.log(`  ${C.gray}>> Not recommended for entry${C.reset}`);
            }
        }
        else {
            console.log(`  ${C.yellow}Battle not found or analysis failed${C.reset}`);
        }
    }
    else {
        // Analyze all active battles
        console.log(`${C.blue}Analyzing all active battles...${C.reset}\n`);
        const [activeBattles, pendingBattles, expiredBattles] = await Promise.all([
            agent.getActiveBattles(),
            agent.getPendingBattles(),
            agent.getExpiredBattles(),
        ]);
        if (activeBattles.length === 0 && pendingBattles.length === 0 && expiredBattles.length === 0) {
            console.log(`  ${C.gray}No battles found${C.reset}\n`);
            return;
        }
        const allBattleIds = [...activeBattles, ...expiredBattles];
        if (allBattleIds.length > 0) {
            console.log(`${C.blue}Active/Expired Battles (${allBattleIds.length}):${C.reset}`);
            for (const id of allBattleIds) {
                const analysis = await analyzer.analyzeBattle(id);
                if (analysis)
                    analyzer.printBattleAnalysis(analysis);
            }
        }
        // Show pending battles
        if (pendingBattles.length > 0) {
            console.log(`\n${C.green}Joinable Battles: ${pendingBattles.map(String).join(', ')}${C.reset}`);
        }
    }
    console.log();
}
