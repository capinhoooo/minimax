/**
 * Demo Command
 *
 * Runs the full agent demo flow for hackathon submission:
 * 1. Show agent status
 * 2. Run MONITOR -> DECIDE -> ACT strategy cycle
 * 3. Analyze cross-chain routes via LI.FI
 * 4. Print all transaction evidence
 */
import { BattleAgent } from '../BattleAgent.js';
export declare function runDemo(agent: BattleAgent): Promise<void>;
