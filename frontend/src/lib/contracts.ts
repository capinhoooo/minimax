import { type Address } from 'viem';

// Deployed contract addresses (Sepolia Testnet)
export const CONTRACTS = {
  RANGE_VAULT: '0x3363363702f98e8CE93871996c5163b79238cE5a' as Address,
  FEE_VAULT: '0x4b188E84c7946Acd21aeB3F718E42C0f1b558950' as Address,
  POOL_MANAGER: '0x8C4BcBE6b9eF47855f97E675296FA3F6fafa5F1A' as Address,
  POSITION_MANAGER: '0x1B1C77B606d13b09C84d1c7394B96b147bC03147' as Address,
  USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as Address,
} as const;

// Battle Vault ABI (partial - key functions)
export const BATTLE_VAULT_ABI = [
  // Read functions
  {
    name: 'getActiveBattles',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256[]' }],
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
    name: 'battleCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
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
    ],
  },
  {
    name: 'BattleJoined',
    type: 'event',
    inputs: [
      { name: 'battleId', type: 'uint256', indexed: true },
      { name: 'opponent', type: 'address', indexed: true },
      { name: 'tokenId', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'BattleResolved',
    type: 'event',
    inputs: [
      { name: 'battleId', type: 'uint256', indexed: true },
      { name: 'winner', type: 'address', indexed: true },
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
