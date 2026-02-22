import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { logger } from './utils/logger.js';
import { txCollector } from './utils/txCollector.js';
import { config } from './config.js';
// Custom JSON replacer to handle BigInt serialization
function serializeBigInt(_key, value) {
    if (typeof value === 'bigint')
        return value.toString();
    return value;
}
function jsonResponse(c, data) {
    return new Response(JSON.stringify(data, serializeBigInt), {
        headers: { 'Content-Type': 'application/json' },
    });
}
export function startServer(agent, port = 3001) {
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
        const activeBattleDetails = await Promise.all(activeBattles.map(async (id) => {
            const battle = await agent.getBattle(id);
            if (!battle)
                return null;
            const timeRemaining = agent.getTimeRemaining(battle);
            return { ...battle, timeRemaining };
        }));
        const pendingBattleDetails = await Promise.all(pendingBattles.map(async (id) => {
            const battle = await agent.getBattle(id);
            return battle ?? null;
        }));
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
        }
        catch (error) {
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
