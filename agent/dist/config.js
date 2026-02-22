import { config as dotenvConfig } from 'dotenv';
import { arbitrumSepolia } from 'viem/chains';
dotenvConfig();
export const config = {
    // Network
    chain: arbitrumSepolia,
    chainId: parseInt(process.env.CHAIN_ID || '421614'),
    rpcUrl: process.env.RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc',
    // Agent Wallet
    privateKey: process.env.PRIVATE_KEY,
    // Contract Addresses
    battleArenaAddress: process.env.BATTLE_ARENA_ADDRESS,
    poolManager: process.env.POOL_MANAGER,
    // Agent Settings
    pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '30000'),
    logLevel: process.env.LOG_LEVEL || 'info',
};
// Validate required config
export function validateConfig() {
    const required = [
        'privateKey',
        'battleArenaAddress',
        'rpcUrl'
    ];
    for (const key of required) {
        if (!config[key]) {
            throw new Error(`Missing required config: ${key}`);
        }
    }
    console.log('Config validated successfully');
    console.log(`  Chain: ${config.chain.name} (${config.chainId})`);
    console.log(`  BattleArena: ${config.battleArenaAddress}`);
    console.log(`  Poll Interval: ${config.pollIntervalMs}ms`);
}
