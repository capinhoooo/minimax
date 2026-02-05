import { config as dotenvConfig } from 'dotenv';
import { sepolia } from 'viem/chains';
dotenvConfig();
export const config = {
    // Network
    chain: sepolia,
    chainId: parseInt(process.env.CHAIN_ID || '11155111'),
    rpcUrl: process.env.RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/agIiKWAxj7cysONiQRJ7M',
    // Agent Wallet
    privateKey: process.env.PRIVATE_KEY,
    // Contract Addresses
    rangeVaultAddress: process.env.RANGE_VAULT_ADDRESS,
    feeVaultAddress: process.env.FEE_VAULT_ADDRESS,
    poolManager: process.env.POOL_MANAGER,
    positionManager: process.env.POSITION_MANAGER,
    // Agent Settings
    pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '30000'),
    logLevel: process.env.LOG_LEVEL || 'info',
};
// Validate required config
export function validateConfig() {
    const required = [
        'privateKey',
        'rangeVaultAddress',
        'feeVaultAddress',
        'rpcUrl'
    ];
    for (const key of required) {
        if (!config[key]) {
            throw new Error(`Missing required config: ${key}`);
        }
    }
    console.log('Config validated successfully');
    console.log(`  Chain: ${config.chain.name} (${config.chainId})`);
    console.log(`  Range Vault: ${config.rangeVaultAddress}`);
    console.log(`  Fee Vault: ${config.feeVaultAddress}`);
    console.log(`  Poll Interval: ${config.pollIntervalMs}ms`);
}
