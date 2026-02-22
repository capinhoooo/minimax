import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { BattleAgent } from './BattleAgent.js';
import { logger } from './utils/logger.js';
import { txCollector } from './utils/txCollector.js';
import { config } from './config.js';

import LeaderboardABI from './abis/Leaderboard.json' assert { type: 'json' };

// Inline ABIs for Camelot Algebra contracts
const AlgebraFactoryABI = [
  {
    type: 'function',
    name: 'poolByPair',
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
    ],
    outputs: [{ name: 'pool', type: 'address' }],
    stateMutability: 'view',
  },
] as const;

const AlgebraPoolABI = [
  {
    type: 'function',
    name: 'globalState',
    inputs: [],
    outputs: [
      { name: 'price', type: 'uint160' },
      { name: 'tick', type: 'int24' },
      { name: 'fee', type: 'uint16' },
      { name: 'timepointIndex', type: 'uint16' },
      { name: 'communityFeeToken0', type: 'uint8' },
      { name: 'communityFeeToken1', type: 'uint8' },
      { name: 'unlocked', type: 'bool' },
    ],
    stateMutability: 'view',
  },
] as const;

// Custom JSON replacer to handle BigInt serialization
function serializeBigInt(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  return value;
}

function jsonResponse(c: { json: (data: unknown) => Response }, data: unknown) {
  return new Response(JSON.stringify(data, serializeBigInt), {
    headers: { 'Content-Type': 'application/json' },
  });
}

export function startServer(agent: BattleAgent, port = 3001) {
  const app = new Hono();

  app.use('/*', cors());

  // Agent status
  app.get('/api/status', async (c) => {
    const balance = await agent.getBalance();
    return jsonResponse(c, {
      address: agent.getAddress(),
      balance,
      network: config.chain.name,
      chainId: config.chainId,
      battleArena: config.battleArenaAddress,
      cycleCount: agent.getCycleCount(),
      isRunning: agent.getIsRunning(),
      startedAt: agent.getStartedAt(),
      uptime: Date.now() - agent.getStartedAt(),
    });
  });

  // Battle data
  app.get('/api/battles', async (c) => {
    const [activeBattles, pendingBattles] = await Promise.all([
      agent.getActiveBattles(),
      agent.getPendingBattles(),
    ]);

    const activeBattleDetails = await Promise.all(
      activeBattles.map(async (id) => {
        const battle = await agent.getBattle(id);
        if (!battle) return null;
        const timeRemaining = agent.getTimeRemaining(battle);
        return { ...battle, timeRemaining };
      })
    );

    const pendingBattleDetails = await Promise.all(
      pendingBattles.map(async (id) => {
        const battle = await agent.getBattle(id);
        return battle ?? null;
      })
    );

    const monitor = agent.getLastMonitorResult();

    return jsonResponse(c, {
      active: {
        count: activeBattles.length,
        battles: activeBattleDetails.filter(Boolean),
      },
      pending: {
        count: pendingBattles.length,
        battles: pendingBattleDetails.filter(Boolean),
      },
      expired: {
        count: monitor?.expiredBattles.length ?? 0,
      },
    });
  });

  // Legacy /api/vaults endpoint redirects to /api/battles
  app.get('/api/vaults', async (c) => {
    return c.redirect('/api/battles');
  });

  // Agent action logs
  app.get('/api/logs', (c) => {
    const limit = parseInt(c.req.query('limit') || '50');
    const logs = logger.getRecentLogs(limit);
    return jsonResponse(c, logs);
  });

  // Last cycle decisions
  app.get('/api/decisions', (c) => {
    const decisions = agent.getLastDecisions();
    return jsonResponse(c, decisions);
  });

  // Last LI.FI routes
  app.get('/api/routes', (c) => {
    const routes = agent.getLastRoutes();
    return jsonResponse(c, routes);
  });

  // Transaction evidence
  app.get('/api/transactions', (c) => {
    const txs = txCollector.getAll();
    return jsonResponse(c, txs);
  });

  // Trigger manual strategy cycle
  app.post('/api/cycle', async (c) => {
    try {
      await agent.runStrategyCycle();
      return jsonResponse(c, {
        success: true,
        cycleCount: agent.getCycleCount(),
        decisions: agent.getLastDecisions(),
      });
    } catch (error) {
      return jsonResponse(c, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // ============ Advisory Intelligence Endpoints ============

  // Route 1: GET /api/battles/:id - Single battle detail with analysis
  app.get('/api/battles/:id', async (c) => {
    try {
      const id = BigInt(c.req.param('id'));
      const battle = await agent.getBattle(id);
      if (!battle) return c.json({ error: 'Battle not found' }, 404);
      const analysis = await agent.getPoolAnalyzer().analyzeBattle(id);
      return jsonResponse(c, { battle, analysis });
    } catch (e) {
      return c.json({ error: 'Invalid battle ID' }, 400);
    }
  });

  // Route 2: GET /api/battles/:id/probability - Win probability
  app.get('/api/battles/:id/probability', async (c) => {
    try {
      const id = BigInt(c.req.param('id'));
      const battle = await agent.getBattle(id);
      if (!battle) return c.json({ error: 'Battle not found' }, 404);
      const probability = agent.getPoolAnalyzer().calculateWinProbability(battle);
      return jsonResponse(c, probability);
    } catch (e) {
      return c.json({ error: 'Invalid battle ID' }, 400);
    }
  });

  // Route 3: GET /api/recommendations - Score pending battles for entry
  app.get('/api/recommendations', async (c) => {
    try {
      const pendingIds = await agent.getPendingBattles();
      const recommendations: {
        battleId: bigint;
        battle: unknown;
        analysis: unknown;
        entryScore: number;
      }[] = [];

      for (const id of pendingIds) {
        const analysis = await agent.getPoolAnalyzer().analyzeBattle(id);
        if (!analysis) continue;
        const score = agent.getPoolAnalyzer().scoreBattleForEntry(analysis);
        const battle = await agent.getBattle(id);
        recommendations.push({ battleId: id, battle, analysis, entryScore: score });
      }

      recommendations.sort((a, b) => b.entryScore - a.entryScore);
      return jsonResponse(c, { recommendations });
    } catch (e) {
      return c.json({ error: 'Failed to compute recommendations' }, 500);
    }
  });

  // Route 4: GET /api/pools - Compare V4 and Camelot pool states
  app.get('/api/pools', async (c) => {
    try {
      const client = agent.getPublicClient();

      let camelotPool: unknown = null;
      try {
        const poolAddress = await client.readContract({
          address: config.camelotFactory,
          abi: AlgebraFactoryABI,
          functionName: 'poolByPair',
          args: [config.weth, config.usdc],
        }) as `0x${string}`;

        if (poolAddress && poolAddress !== '0x0000000000000000000000000000000000000000') {
          const globalState = await client.readContract({
            address: poolAddress,
            abi: AlgebraPoolABI,
            functionName: 'globalState',
          }) as [bigint, number, number, number, number, number, boolean];

          camelotPool = {
            poolAddress,
            price: globalState[0],
            tick: globalState[1],
            fee: globalState[2],
            timepointIndex: globalState[3],
            communityFeeToken0: globalState[4],
            communityFeeToken1: globalState[5],
            unlocked: globalState[6],
          };
        }
      } catch {
        camelotPool = { error: 'Failed to read Camelot pool state' };
      }

      return jsonResponse(c, {
        camelot: camelotPool,
        tokens: { weth: config.weth, usdc: config.usdc },
      });
    } catch (e) {
      return c.json({ error: 'Failed to read pool states' }, 500);
    }
  });

  // Route 5: GET /api/players/:address - Player stats from Stylus Leaderboard
  app.get('/api/players/:address', async (c) => {
    try {
      const address = c.req.param('address') as `0x${string}`;
      const client = agent.getPublicClient();

      const result = await client.readContract({
        address: config.leaderboardAddress,
        abi: LeaderboardABI,
        functionName: 'getPlayerStats',
        args: [address],
      }) as [bigint, bigint, bigint, bigint, bigint];

      const [elo, wins, losses, totalBattles, totalValueWon] = result;
      return jsonResponse(c, { address, elo, wins, losses, totalBattles, totalValueWon });
    } catch (e) {
      return c.json({ error: 'Failed to read player stats' }, 500);
    }
  });

  // Route 6: GET /api/leaderboard - All players ranked by ELO
  app.get('/api/leaderboard', async (c) => {
    try {
      const client = agent.getPublicClient();
      const battleCount = await agent.getBattleCount();

      const players = new Set<string>();
      const limit = battleCount < 100n ? battleCount : 100n;
      for (let i = 0n; i < limit; i++) {
        const battle = await agent.getBattle(i);
        if (battle) {
          if (battle.creator !== '0x0000000000000000000000000000000000000000') {
            players.add(battle.creator);
          }
          if (battle.opponent !== '0x0000000000000000000000000000000000000000') {
            players.add(battle.opponent);
          }
        }
      }

      const playerStats = await Promise.all(
        Array.from(players).map(async (addr) => {
          try {
            const [elo, wins, losses, totalBattles, totalValueWon] = await client.readContract({
              address: config.leaderboardAddress,
              abi: LeaderboardABI,
              functionName: 'getPlayerStats',
              args: [addr as `0x${string}`],
            }) as [bigint, bigint, bigint, bigint, bigint];
            return { address: addr, elo, wins, losses, totalBattles, totalValueWon };
          } catch {
            return { address: addr, elo: 0n, wins: 0n, losses: 0n, totalBattles: 0n, totalValueWon: 0n };
          }
        })
      );

      playerStats.sort((a, b) => Number(b.elo - a.elo));
      return jsonResponse(c, { players: playerStats });
    } catch (e) {
      return c.json({ error: 'Failed to build leaderboard' }, 500);
    }
  });

  serve({ fetch: app.fetch, port });
  logger.info(`API server running on http://localhost:${port}`);

  return app;
}
