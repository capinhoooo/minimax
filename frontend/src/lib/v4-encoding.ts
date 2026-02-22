/**
 * V4 PositionManager Action Encoding
 *
 * Encodes MINT_POSITION + CLOSE_CURRENCY actions for
 * the V4 PositionManager.modifyLiquidities() call.
 */

import {
  type Address,
  encodeAbiParameters,
  encodePacked,
  concat,
} from 'viem';

// ============ Action Constants ============

export const V4_ACTIONS = {
  INCREASE_LIQUIDITY: 0x00,
  DECREASE_LIQUIDITY: 0x01,
  MINT_POSITION: 0x02,
  BURN_POSITION: 0x03,
  SETTLE_PAIR: 0x0d,
  CLOSE_CURRENCY: 0x11,
} as const;

// ============ Types ============

export interface PoolKey {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}

export interface MintPositionParams {
  poolKey: PoolKey;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  amount0Max: bigint;
  amount1Max: bigint;
  recipient: Address;
  hookData?: `0x${string}`;
}

// ============ ABI Parameter Types ============

const POOL_KEY_ABI = {
  type: 'tuple',
  components: [
    { name: 'currency0', type: 'address' },
    { name: 'currency1', type: 'address' },
    { name: 'fee', type: 'uint24' },
    { name: 'tickSpacing', type: 'int24' },
    { name: 'hooks', type: 'address' },
  ],
} as const;

const MINT_PARAMS_ABI = [
  POOL_KEY_ABI,
  { name: 'tickLower', type: 'int24' },
  { name: 'tickUpper', type: 'int24' },
  { name: 'liquidity', type: 'uint256' },
  { name: 'amount0Max', type: 'uint128' },
  { name: 'amount1Max', type: 'uint128' },
  { name: 'recipient', type: 'address' },
  { name: 'hookData', type: 'bytes' },
] as const;

const CURRENCY_ABI = [
  { name: 'currency', type: 'address' },
] as const;

// ============ Encoding Functions ============

/**
 * Encode a MINT_POSITION action with two CLOSE_CURRENCY actions.
 * Returns the full encoded bytes for modifyLiquidities(unlockData, deadline).
 */
export function encodeMintPosition(params: MintPositionParams): `0x${string}` {
  const { poolKey, tickLower, tickUpper, liquidity, amount0Max, amount1Max, recipient, hookData } = params;

  // Build actions bytes: MINT_POSITION + CLOSE_CURRENCY + CLOSE_CURRENCY
  const actions = encodePacked(
    ['uint8', 'uint8', 'uint8'],
    [V4_ACTIONS.MINT_POSITION, V4_ACTIONS.CLOSE_CURRENCY, V4_ACTIONS.CLOSE_CURRENCY]
  );

  // Encode MINT_POSITION params
  const mintParams = encodeAbiParameters(MINT_PARAMS_ABI, [
    {
      currency0: poolKey.currency0,
      currency1: poolKey.currency1,
      fee: poolKey.fee,
      tickSpacing: poolKey.tickSpacing,
      hooks: poolKey.hooks,
    },
    tickLower,
    tickUpper,
    liquidity,
    amount0Max,
    amount1Max,
    recipient,
    hookData ?? '0x',
  ]);

  // Encode CLOSE_CURRENCY params (one per currency)
  const closeCurrency0 = encodeAbiParameters(CURRENCY_ABI, [poolKey.currency0]);
  const closeCurrency1 = encodeAbiParameters(CURRENCY_ABI, [poolKey.currency1]);

  // Final encoding: abi.encode(actions, params[])
  const unlockData = encodeAbiParameters(
    [
      { name: 'actions', type: 'bytes' },
      { name: 'params', type: 'bytes[]' },
    ],
    [actions, [mintParams, closeCurrency0, closeCurrency1]]
  );

  return unlockData;
}
