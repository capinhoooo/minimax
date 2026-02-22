import { config as dotenvConfig } from 'dotenv';
import { arbitrumSepolia } from 'viem/chains';

dotenvConfig();

export const config = {
  // Network
  chain: arbitrumSepolia,
  chainId: parseInt(process.env.CHAIN_ID || '421614'),
  rpcUrl: process.env.RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc',

  // Agent Wallet
  privateKey: process.env.PRIVATE_KEY as `0x${string}`,

  // Contract Addresses
  battleArenaAddress: process.env.BATTLE_ARENA_ADDRESS as `0x${string}`,
  poolManager: process.env.POOL_MANAGER as `0x${string}`,

  // Stylus Leaderboard & Scoring
  leaderboardAddress: (process.env.LEADERBOARD_ADDRESS || '0x7feb2cf23797fd950380cd9ad4b7d4cad4b3c85b') as `0x${string}`,
  scoringEngineAddress: (process.env.SCORING_ENGINE_ADDRESS || '0xd34ffbe6d046cb1a3450768664caf97106d18204') as `0x${string}`,

  // Camelot DEX
  camelotFactory: (process.env.CAMELOT_FACTORY || '0xaA37Bea711D585478E1c04b04707cCb0f10D762a') as `0x${string}`,

  // Token Addresses
  weth: (process.env.WETH_ADDRESS || '0x980B62Da83eFf3D4576C647993b0c1D7faf17c73') as `0x${string}`,
  usdc: (process.env.USDC_ADDRESS || '0xb893E3334D4Bd6C5ba8277Fd559e99Ed683A9FC7') as `0x${string}`,

  // Agent Settings
  pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '30000'),
  logLevel: process.env.LOG_LEVEL || 'info',
};

// Validate required config
export function validateConfig(): void {
  const required = [
    'privateKey',
    'battleArenaAddress',
    'rpcUrl'
  ];

  for (const key of required) {
    if (!config[key as keyof typeof config]) {
      throw new Error(`Missing required config: ${key}`);
    }
  }

  console.log('Config validated successfully');
  console.log(`  Chain: ${config.chain.name} (${config.chainId})`);
  console.log(`  BattleArena: ${config.battleArenaAddress}`);
  console.log(`  Poll Interval: ${config.pollIntervalMs}ms`);
}
