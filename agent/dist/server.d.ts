import { Hono } from 'hono';
import { BattleAgent } from './BattleAgent.js';
export declare function startServer(agent: BattleAgent, port?: number): Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
