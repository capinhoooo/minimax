import { type Address } from 'viem';

// ============ BattleArena Contract (Arbitrum Sepolia) ============

export const CONTRACTS = {
  BATTLE_ARENA: '0x478505eb07B3C8943A642E51F066bcF8aC8ed51d' as Address,
  UNISWAP_V4_ADAPTER: '0x244C49E7986feC5BaD7C567d588B9262eF5e0604' as Address,
  CAMELOT_ADAPTER: '0x5442068A4Cd117F26047c89f0A87D635112c886E' as Address,
  SCORING_ENGINE: '0xd34ffbe6d046cb1a3450768664caf97106d18204' as Address,
  LEADERBOARD: '0x7feb2cf23797fd950380cd9ad4b7d4cad4b3c85b' as Address,
  POOL_MANAGER: '0xFB3e0C6F74eB1a21CC1Da29aeC80D2Dfe6C9a317' as Address,
  POSITION_MANAGER: '0xAc631556d3d4019C95769033B5E719dD77124BAc' as Address,
  WETH: '0x980B62Da83eFf3D4576C647993b0c1D7faf17c73' as Address,
  USDC: '0xb893E3334D4Bd6C5ba8277Fd559e99Ed683A9FC7' as Address,
  PERMIT2: '0x000000000022D473030F116dDEE9F6B43aC78BA3' as Address,
  CAMELOT_NFT_MANAGER: '0x79EA6cB3889fe1FC7490A1C69C7861761d882D4A' as Address,
  CAMELOT_FACTORY: '0xaA37Bea711D585478E1c04b04707cCb0f10D762a' as Address,
} as const;

// ============ BattleArena ABI ============

export const BATTLE_ARENA_ABI = [
  // Read functions
  {
    name: 'getBattleCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'battleCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'activeBattleCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'getBattlesByStatus',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'status', type: 'uint8' }],
    outputs: [{ name: '', type: 'uint256[]' }],
  },
  {
    name: 'getPlayerBattles',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'player', type: 'address' }],
    outputs: [{ name: '', type: 'uint256[]' }],
  },
  {
    name: 'getBattle',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'battleId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'creator', type: 'address' },
          { name: 'opponent', type: 'address' },
          { name: 'winner', type: 'address' },
          { name: 'creatorDex', type: 'uint8' },
          { name: 'opponentDex', type: 'uint8' },
          { name: 'creatorTokenId', type: 'uint256' },
          { name: 'opponentTokenId', type: 'uint256' },
          { name: 'creatorValueUSD', type: 'uint256' },
          { name: 'opponentValueUSD', type: 'uint256' },
          { name: 'battleType', type: 'uint8' },
          { name: 'status', type: 'uint8' },
          { name: 'startTime', type: 'uint256' },
          { name: 'duration', type: 'uint256' },
          { name: 'token0', type: 'address' },
          { name: 'token1', type: 'address' },
          { name: 'creatorInRangeTime', type: 'uint256' },
          { name: 'opponentInRangeTime', type: 'uint256' },
          { name: 'lastUpdateTime', type: 'uint256' },
          { name: 'creatorStartFeeGrowth0', type: 'uint256' },
          { name: 'creatorStartFeeGrowth1', type: 'uint256' },
          { name: 'opponentStartFeeGrowth0', type: 'uint256' },
          { name: 'opponentStartFeeGrowth1', type: 'uint256' },
          { name: 'creatorLiquidity', type: 'uint128' },
          { name: 'opponentLiquidity', type: 'uint128' },
        ],
      },
    ],
  },
  {
    name: 'isBattleExpired',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'battleId', type: 'uint256' }],
    outputs: [{ type: 'bool' }],
  },
  // Write functions
  {
    name: 'createBattle',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'dexType', type: 'uint8' },
      { name: 'tokenId', type: 'uint256' },
      { name: 'duration', type: 'uint256' },
      { name: 'battleType', type: 'uint8' },
    ],
    outputs: [{ name: 'battleId', type: 'uint256' }],
  },
  {
    name: 'joinBattle',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'battleId', type: 'uint256' },
      { name: 'dexType', type: 'uint8' },
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
  {
    name: 'emergencyWithdraw',
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
      { name: 'dexType', type: 'uint8', indexed: false },
      { name: 'battleType', type: 'uint8', indexed: false },
      { name: 'tokenId', type: 'uint256', indexed: false },
      { name: 'duration', type: 'uint256', indexed: false },
      { name: 'valueUSD', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'BattleJoined',
    type: 'event',
    inputs: [
      { name: 'battleId', type: 'uint256', indexed: true },
      { name: 'opponent', type: 'address', indexed: true },
      { name: 'dexType', type: 'uint8', indexed: false },
      { name: 'tokenId', type: 'uint256', indexed: false },
      { name: 'valueUSD', type: 'uint256', indexed: false },
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
      { name: 'winnerReward', type: 'uint256', indexed: false },
      { name: 'resolverReward', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'BattleStatusUpdated',
    type: 'event',
    inputs: [
      { name: 'battleId', type: 'uint256', indexed: true },
      { name: 'creatorInRange', type: 'bool', indexed: false },
      { name: 'opponentInRange', type: 'bool', indexed: false },
      { name: 'creatorInRangeTime', type: 'uint256', indexed: false },
      { name: 'opponentInRangeTime', type: 'uint256', indexed: false },
    ],
  },
] as const;

// ============ Stylus ScoringEngine ABI ============

export const SCORING_ENGINE_ABI = [
  {
    name: 'calculateRangeScore',
    type: 'function',
    stateMutability: 'pure',
    inputs: [
      { name: 'inRangeTime', type: 'uint256' },
      { name: 'totalTime', type: 'uint256' },
      { name: 'tickDistance', type: 'uint256' },
    ],
    outputs: [{ name: 'score', type: 'uint256' }],
  },
  {
    name: 'calculateFeeScore',
    type: 'function',
    stateMutability: 'pure',
    inputs: [
      { name: 'feesUSD', type: 'uint256' },
      { name: 'lpValueUSD', type: 'uint256' },
      { name: 'duration', type: 'uint256' },
    ],
    outputs: [{ name: 'score', type: 'uint256' }],
  },
  {
    name: 'calculateRewards',
    type: 'function',
    stateMutability: 'pure',
    inputs: [
      { name: 'totalFees', type: 'uint256' },
      { name: 'resolverBps', type: 'uint256' },
    ],
    outputs: [
      { name: 'winnerAmount', type: 'uint256' },
      { name: 'resolverAmount', type: 'uint256' },
    ],
  },
  {
    name: 'determineWinner',
    type: 'function',
    stateMutability: 'pure',
    inputs: [
      { name: 'scoreA', type: 'uint256' },
      { name: 'scoreB', type: 'uint256' },
    ],
    outputs: [{ name: 'winner', type: 'uint8' }],
  },
  {
    name: 'normalizeCrossDex',
    type: 'function',
    stateMutability: 'pure',
    inputs: [
      { name: 'rawScore', type: 'uint256' },
      { name: 'dexType', type: 'uint8' },
    ],
    outputs: [{ name: 'normalizedScore', type: 'uint256' }],
  },
] as const;

// ============ Stylus Leaderboard ABI ============

export const LEADERBOARD_ABI = [
  {
    name: 'getPlayerStats',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'player', type: 'address' }],
    outputs: [
      { name: 'elo', type: 'uint256' },
      { name: 'wins', type: 'uint256' },
      { name: 'losses', type: 'uint256' },
      { name: 'totalBattles', type: 'uint256' },
      { name: 'totalValueWon', type: 'uint256' },
    ],
  },
  {
    name: 'recordResult',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'winner', type: 'address' },
      { name: 'loser', type: 'address' },
      { name: 'battleValueUSD', type: 'uint256' },
    ],
    outputs: [],
  },
] as const;

// ============ ERC20 ABI (minimal) ============

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

// ============ ERC721 ABI (for LP positions) ============

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

// ============ Permit2 ABI ============

export const PERMIT2_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint160' },
      { name: 'expiration', type: 'uint48' },
    ],
    outputs: [],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [
      { name: 'amount', type: 'uint160' },
      { name: 'expiration', type: 'uint48' },
      { name: 'nonce', type: 'uint48' },
    ],
  },
] as const;

// ============ V4 PositionManager Mint ABI ============

export const POSITION_MANAGER_MINT_ABI = [
  {
    name: 'modifyLiquidities',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'unlockData', type: 'bytes' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'nextTokenId',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const;

// ============ Camelot NFT Position Manager ABI ============

export const CAMELOT_NFT_MANAGER_ABI = [
  {
    name: 'mint',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'token0', type: 'address' },
          { name: 'token1', type: 'address' },
          { name: 'tickLower', type: 'int24' },
          { name: 'tickUpper', type: 'int24' },
          { name: 'amount0Desired', type: 'uint256' },
          { name: 'amount1Desired', type: 'uint256' },
          { name: 'amount0Min', type: 'uint256' },
          { name: 'amount1Min', type: 'uint256' },
          { name: 'recipient', type: 'address' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
    ],
    outputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'liquidity', type: 'uint128' },
      { name: 'amount0', type: 'uint256' },
      { name: 'amount1', type: 'uint256' },
    ],
  },
] as const;
