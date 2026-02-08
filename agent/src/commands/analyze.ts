/**
 * Analyze Command
 *
 * Analyzes specific battles or all active battles across both vaults.
 */

import { BattleAgent } from '../BattleAgent.js';
import { logger } from '../utils/logger.js';

const C = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  gray: '\x1b[90m',
  blue: '\x1b[34m',
};

export async function runAnalyze(agent: BattleAgent, battleIdArg?: string, vaultType?: string) {
  console.log(`\n${C.cyan}${'='.repeat(70)}${C.reset}`);
  console.log(`${C.cyan}  BATTLE ANALYZER - Uniswap V4 Pool Analysis${C.reset}`);
  console.log(`${C.cyan}${'='.repeat(70)}${C.reset}\n`);

  const analyzer = agent.getPoolAnalyzer();

  if (battleIdArg) {
    // Analyze specific battle
    const battleId = BigInt(battleIdArg);
    const vault = (vaultType || 'range') as 'range' | 'fee';

    console.log(`${C.blue}Analyzing battle #${battleId} on ${vault} vault...${C.reset}\n`);

    const analysis = vault === 'range'
      ? await analyzer.analyzeRangeBattle(battleId)
      : await analyzer.analyzeFeeBattle(battleId);

    if (analysis) {
      analyzer.printBattleAnalysis(analysis);

      const score = analyzer.scoreBattleForEntry(analysis);
      console.log(`\n  ${C.yellow}Entry Score: ${score}/100${C.reset}`);
      if (score > 60) {
        console.log(`  ${C.green}>> Worth considering for entry${C.reset}`);
      } else if (score > 30) {
        console.log(`  ${C.yellow}>> Moderate opportunity${C.reset}`);
      } else {
        console.log(`  ${C.gray}>> Not recommended for entry${C.reset}`);
      }
    } else {
      console.log(`  ${C.yellow}Battle not found or analysis failed${C.reset}`);
    }
  } else {
    // Analyze all active battles
    console.log(`${C.blue}Analyzing all active battles...${C.reset}\n`);

    const [rangeActive, feeActive] = await Promise.all([
      agent.getActiveBattles('range'),
      agent.getActiveBattles('fee'),
    ]);

    if (rangeActive.length === 0 && feeActive.length === 0) {
      console.log(`  ${C.gray}No active battles found${C.reset}\n`);
      return;
    }

    if (rangeActive.length > 0) {
      console.log(`${C.blue}Range Vault (${rangeActive.length} active):${C.reset}`);
      for (const id of rangeActive) {
        const analysis = await analyzer.analyzeRangeBattle(id);
        if (analysis) analyzer.printBattleAnalysis(analysis);
      }
    }

    if (feeActive.length > 0) {
      console.log(`\n${C.blue}Fee Vault (${feeActive.length} active):${C.reset}`);
      for (const id of feeActive) {
        const analysis = await analyzer.analyzeFeeBattle(id);
        if (analysis) analyzer.printBattleAnalysis(analysis);
      }
    }

    // Show pending battles
    const pending = await analyzer.getPendingBattles();
    if (pending.range.length > 0 || pending.fee.length > 0) {
      console.log(`\n${C.green}Joinable Battles:${C.reset}`);
      if (pending.range.length > 0) console.log(`  Range: ${pending.range.map(String).join(', ')}`);
      if (pending.fee.length > 0) console.log(`  Fee: ${pending.fee.map(String).join(', ')}`);
    }
  }

  console.log();
}
