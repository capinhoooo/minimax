/**
 * Analyze Command
 *
 * Analyzes specific battles or all active battles in the BattleArena.
 */
import { BattleAgent } from '../BattleAgent.js';
export declare function runAnalyze(agent: BattleAgent, battleIdArg?: string): Promise<void>;
