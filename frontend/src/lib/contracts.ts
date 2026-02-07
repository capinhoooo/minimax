import { type Address } from 'viem';

// ============ CCTP V2 Testnet Config ============

export interface CctpChain {
  chainId: number;
  name: string;
  domain: number;
  usdc: Address;
  tokenMessenger: Address;
  messageTransmitter: Address;
  rpcUrl: string;
}

// All CCTP V2 EVM testnets share the same contract addresses
const CCTP_TOKEN_MESSENGER = '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA' as Address;
const CCTP_MESSAGE_TRANSMITTER = '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275' as Address;

export const CCTP_CHAINS: CctpChain[] = [
  {
    chainId: 11155111,
    name: 'Ethereum Sepolia',
    domain: 0,
    usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as Address,
    tokenMessenger: CCTP_TOKEN_MESSENGER,
    messageTransmitter: CCTP_MESSAGE_TRANSMITTER,
    rpcUrl: 'https://eth-sepolia.g.alchemy.com/v2/demo',
  },
  {
    chainId: 43113,
    name: 'Avalanche Fuji',
    domain: 1,
    usdc: '0x5425890298aed601595a70AB815c96711a31Bc65' as Address,
    tokenMessenger: CCTP_TOKEN_MESSENGER,
    messageTransmitter: CCTP_MESSAGE_TRANSMITTER,
    rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
  },
  {
    chainId: 11155420,
    name: 'OP Sepolia',
    domain: 2,
    usdc: '0x5fd84259d66Cd46123540766Be93DFE6D43130D7' as Address,
    tokenMessenger: CCTP_TOKEN_MESSENGER,
    messageTransmitter: CCTP_MESSAGE_TRANSMITTER,
    rpcUrl: 'https://sepolia.optimism.io',
  },
  {
    chainId: 421614,
    name: 'Arbitrum Sepolia',
    domain: 3,
    usdc: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d' as Address,
    tokenMessenger: CCTP_TOKEN_MESSENGER,
    messageTransmitter: CCTP_MESSAGE_TRANSMITTER,
    rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
  },
  {
    chainId: 84532,
    name: 'Base Sepolia',
    domain: 6,
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as Address,
    tokenMessenger: CCTP_TOKEN_MESSENGER,
    messageTransmitter: CCTP_MESSAGE_TRANSMITTER,
    rpcUrl: 'https://sepolia.base.org',
  },
  {
    chainId: 80002,
    name: 'Polygon Amoy',
    domain: 7,
    usdc: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582' as Address,
    tokenMessenger: CCTP_TOKEN_MESSENGER,
    messageTransmitter: CCTP_MESSAGE_TRANSMITTER,
    rpcUrl: 'https://rpc-amoy.polygon.technology',
  },
  {
    chainId: 59141,
    name: 'Linea Sepolia',
    domain: 11,
    usdc: '0xFEce4462D57bD51A6A552365A011b95f0E16d9B7' as Address,
    tokenMessenger: CCTP_TOKEN_MESSENGER,
    messageTransmitter: CCTP_MESSAGE_TRANSMITTER,
    rpcUrl: 'https://rpc.sepolia.linea.build',
  },
];

export const CCTP_ATTESTATION_API = 'https://iris-api-sandbox.circle.com/v1/attestations';

export function getCctpChain(chainId: number): CctpChain | undefined {
  return CCTP_CHAINS.find((c) => c.chainId === chainId);
}

// ============ CCTP ABIs ============

export const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const;

export const TOKEN_MESSENGER_ABI = [
  {
    name: 'depositForBurn',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'destinationDomain', type: 'uint32' },
      { name: 'mintRecipient', type: 'bytes32' },
      { name: 'burnToken', type: 'address' },
    ],
    outputs: [{ name: '_nonce', type: 'uint64' }],
  },
] as const;

export const MESSAGE_TRANSMITTER_ABI = [
  {
    name: 'receiveMessage',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'message', type: 'bytes' },
      { name: 'attestation', type: 'bytes' },
    ],
    outputs: [{ name: 'success', type: 'bool' }],
  },
  {
    name: 'MessageSent',
    type: 'event',
    inputs: [
      { name: 'message', type: 'bytes', indexed: false },
    ],
  },
] as const;

// ============ Battle Vault Contracts ============

// Deployed contract addresses (Sepolia Testnet)
export const CONTRACTS = {
  RANGE_VAULT: '0x3363363702f98e8CE93871996c5163b79238cE5a' as Address,
  FEE_VAULT: '0x4b188E84c7946Acd21aeB3F718E42C0f1b558950' as Address,
  POOL_MANAGER: '0x8C4BcBE6b9eF47855f97E675296FA3F6fafa5F1A' as Address,
  POSITION_MANAGER: '0x1B1C77B606d13b09C84d1c7394B96b147bC03147' as Address,
  USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as Address,
} as const;

// Helper to get vault address by type
export function getVaultAddress(type: 'range' | 'fee'): Address {
  return type === 'range' ? CONTRACTS.RANGE_VAULT : CONTRACTS.FEE_VAULT;
}

// ============ Range Vault ABI ============
export const RANGE_VAULT_ABI = [
  // Read functions
  {
    name: 'battleIdCounter',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'getActiveBattles',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: 'battleIds', type: 'uint256[]' }],
  },
  {
    name: 'getPendingBattles',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: 'battleIds', type: 'uint256[]' }],
  },
  {
    name: 'getBattle',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'battleId', type: 'uint256' }],
    outputs: [
      { name: 'creator', type: 'address' },
      { name: 'opponent', type: 'address' },
      { name: 'winner', type: 'address' },
      { name: 'creatorTokenId', type: 'uint256' },
      { name: 'opponentTokenId', type: 'uint256' },
      { name: 'startTime', type: 'uint256' },
      { name: 'duration', type: 'uint256' },
      { name: 'totalValueUSD', type: 'uint256' },
      { name: 'isResolved', type: 'bool' },
      { name: 'status', type: 'string' },
    ],
  },
  {
    name: 'getBattleStatus',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'battleId', type: 'uint256' }],
    outputs: [{ type: 'string' }],
  },
  {
    name: 'getTimeRemaining',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'battleId', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'getCurrentPerformance',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'battleId', type: 'uint256' }],
    outputs: [
      { name: 'creatorInRange', type: 'bool' },
      { name: 'opponentInRange', type: 'bool' },
      { name: 'creatorInRangeTime', type: 'uint256' },
      { name: 'opponentInRangeTime', type: 'uint256' },
      { name: 'currentLeader', type: 'address' },
    ],
  },
  {
    name: 'getUserBattles',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [
      { name: 'battleIds', type: 'uint256[]' },
      { name: 'isCreator', type: 'bool[]' },
    ],
  },
  {
    name: 'getBattleUSDValue',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'battleId', type: 'uint256' }],
    outputs: [{ type: 'string' }],
  },
  // Write functions
  {
    name: 'createBattle',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'duration', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'joinBattle',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'battleId', type: 'uint256' },
      { name: 'tokenId', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'resolveBattle',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'battleId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'updateBattleStatus',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'battleId', type: 'uint256' }],
    outputs: [],
  },
  // Events
  {
    name: 'BattleCreated',
    type: 'event',
    inputs: [
      { name: 'battleId', type: 'uint256', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'tokenId', type: 'uint256', indexed: false },
      { name: 'duration', type: 'uint256', indexed: false },
      { name: 'totalValueUSD', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'BattleJoined',
    type: 'event',
    inputs: [
      { name: 'battleId', type: 'uint256', indexed: true },
      { name: 'opponent', type: 'address', indexed: true },
      { name: 'tokenId', type: 'uint256', indexed: false },
      { name: 'startTime', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'BattleResolved',
    type: 'event',
    inputs: [
      { name: 'battleId', type: 'uint256', indexed: true },
      { name: 'winner', type: 'address', indexed: true },
      { name: 'resolver', type: 'address', indexed: true },
      { name: 'resolverReward', type: 'uint256', indexed: false },
    ],
  },
] as const;

// ============ Fee Vault ABI ============
export const FEE_VAULT_ABI = [
  // Read functions
  {
    name: 'battleIdCounter',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'getActiveBattles',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: 'battleIds', type: 'uint256[]' }],
  },
  {
    name: 'getPendingBattles',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: 'battleIds', type: 'uint256[]' }],
  },
  {
    name: 'getBattle',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'battleId', type: 'uint256' }],
    outputs: [
      { name: 'creator', type: 'address' },
      { name: 'opponent', type: 'address' },
      { name: 'winner', type: 'address' },
      { name: 'creatorTokenId', type: 'uint256' },
      { name: 'opponentTokenId', type: 'uint256' },
      { name: 'startTime', type: 'uint256' },
      { name: 'duration', type: 'uint256' },
      { name: 'creatorLPValue', type: 'uint256' },
      { name: 'opponentLPValue', type: 'uint256' },
      { name: 'isResolved', type: 'bool' },
      { name: 'status', type: 'string' },
    ],
  },
  {
    name: 'getBattleStatus',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'battleId', type: 'uint256' }],
    outputs: [{ type: 'string' }],
  },
  {
    name: 'getTimeRemaining',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'battleId', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'getCurrentFeePerformance',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'battleId', type: 'uint256' }],
    outputs: [
      { name: 'creatorFeeGrowthUSD', type: 'uint256' },
      { name: 'opponentFeeGrowthUSD', type: 'uint256' },
      { name: 'creatorFeeRate', type: 'uint256' },
      { name: 'opponentFeeRate', type: 'uint256' },
      { name: 'currentLeader', type: 'address' },
    ],
  },
  {
    name: 'getUserBattles',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [
      { name: 'battleIds', type: 'uint256[]' },
      { name: 'isCreator', type: 'bool[]' },
    ],
  },
  {
    name: 'getBattleUSDValue',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'battleId', type: 'uint256' }],
    outputs: [{ type: 'string' }],
  },
  // Write functions
  {
    name: 'createBattle',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'duration', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'joinBattle',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'battleId', type: 'uint256' },
      { name: 'tokenId', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'resolveBattle',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'battleId', type: 'uint256' }],
    outputs: [],
  },
  // Events
  {
    name: 'BattleCreated',
    type: 'event',
    inputs: [
      { name: 'battleId', type: 'uint256', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'tokenId', type: 'uint256', indexed: false },
      { name: 'duration', type: 'uint256', indexed: false },
      { name: 'lpValueUSD', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'BattleJoined',
    type: 'event',
    inputs: [
      { name: 'battleId', type: 'uint256', indexed: true },
      { name: 'opponent', type: 'address', indexed: true },
      { name: 'tokenId', type: 'uint256', indexed: false },
      { name: 'startTime', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'BattleResolved',
    type: 'event',
    inputs: [
      { name: 'battleId', type: 'uint256', indexed: true },
      { name: 'winner', type: 'address', indexed: true },
      { name: 'resolver', type: 'address', indexed: true },
      { name: 'creatorFeeRate', type: 'uint256', indexed: false },
      { name: 'opponentFeeRate', type: 'uint256', indexed: false },
    ],
  },
] as const;

// ERC721 ABI (for LP positions)
export const ERC721_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'ownerOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ type: 'address' }],
  },
  {
    name: 'tokenOfOwnerByIndex',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'index', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'setApprovalForAll',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'operator', type: 'address' },
      { name: 'approved', type: 'bool' },
    ],
    outputs: [],
  },
  {
    name: 'getApproved',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ type: 'address' }],
  },
  {
    name: 'isApprovedForAll',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'operator', type: 'address' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const;
