import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { BattleAgent } from './BattleAgent.js';
import { logger } from './utils/logger.js';
import { txCollector } from './utils/txCollector.js';
import { config } from './config.js';

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
      cycleCount: agent.getCycleCount(),
      isRunning: agent.getIsRunning(),
      startedAt: agent.getStartedAt(),
      uptime: Date.now() - agent.getStartedAt(),
    });
  });

  // Vault data
  app.get('/api/vaults', async (c) => {
    const [rangeActive, feeActive] = await Promise.all([
      agent.getActiveBattles('range'),
      agent.getActiveBattles('fee'),
    ]);

    // Get battle details for active battles
    const rangeBattles = await Promise.all(
      rangeActive.map(async (id) => {
        const battle = await agent.getBattle(id, 'range');
        const timeRemaining = await agent.getTimeRemaining(id, 'range');
        return battle ? { ...battle, timeRemaining } : null;
      })
    );
    const feeBattles = await Promise.all(
      feeActive.map(async (id) => {
        const battle = await agent.getBattle(id, 'fee');
        const timeRemaining = await agent.getTimeRemaining(id, 'fee');
        return battle ? { ...battle, timeRemaining } : null;
      })
    );

    // Get pending from last monitor if available
    const monitor = agent.getLastMonitorResult();

    return jsonResponse(c, {
      range: {
        active: rangeActive.length,
        pending: monitor?.pendingBattles.range.length ?? 0,
        battles: rangeBattles.filter(Boolean),
      },
      fee: {
        active: feeActive.length,
        pending: monitor?.pendingBattles.fee.length ?? 0,
        battles: feeBattles.filter(Boolean),
      },
    });
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

  serve({ fetch: app.fetch, port });
  logger.info(`API server running on http://localhost:${port}`);

  return app;
}
