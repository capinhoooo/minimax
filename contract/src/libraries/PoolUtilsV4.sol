// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {StateLibrary} from "v4-core/libraries/StateLibrary.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";
import {FullMath} from "v4-core/libraries/FullMath.sol";
import {FixedPoint96} from "v4-core/libraries/FixedPoint96.sol";
import {Currency} from "v4-core/types/Currency.sol";

/// @title Pool Utilities for Uniswap V4
/// @notice Helper functions for interacting with V4 pools
library PoolUtilsV4 {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;

    struct PoolData {
        PoolId poolId;
        uint160 sqrtPriceX96;
        int24 currentTick;
        uint24 protocolFee;
        uint24 lpFee;
        bool initialized;
    }

    struct PositionData {
        uint128 liquidity;
        uint256 feeGrowthInside0LastX128;
        uint256 feeGrowthInside1LastX128;
    }

    /// @notice Get current pool state from V4 PoolManager
    /// @param poolManager The V4 PoolManager contract
    /// @param key The pool key
    /// @return data The pool data struct
    function getPoolData(
        IPoolManager poolManager,
        PoolKey memory key
    ) internal view returns (PoolData memory data) {
        PoolId poolId = key.toId();
        data.poolId = poolId;

        // Get slot0 data using StateLibrary
        (data.sqrtPriceX96, data.currentTick, data.protocolFee, data.lpFee) = poolManager.getSlot0(poolId);
        data.initialized = data.sqrtPriceX96 != 0;
    }

    /// @notice Check if a position is currently in range
    /// @param currentTick The current tick of the pool
    /// @param tickLower The lower tick of the position
    /// @param tickUpper The upper tick of the position
    /// @return True if position is in range
    function isInRange(
        int24 currentTick,
        int24 tickLower,
        int24 tickUpper
    ) internal pure returns (bool) {
        return currentTick >= tickLower && currentTick < tickUpper;
    }

    /// @notice Calculate token amounts from liquidity
    /// @param sqrtPriceX96 Current sqrt price
    /// @param tickLower Lower tick
    /// @param tickUpper Upper tick
    /// @param liquidity Position liquidity
    /// @return amount0 Token0 amount
    /// @return amount1 Token1 amount
    function getAmountsForLiquidity(
        uint160 sqrtPriceX96,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity
    ) internal pure returns (uint256 amount0, uint256 amount1) {
        uint160 sqrtPriceLowerX96 = TickMath.getSqrtPriceAtTick(tickLower);
        uint160 sqrtPriceUpperX96 = TickMath.getSqrtPriceAtTick(tickUpper);

        if (sqrtPriceX96 <= sqrtPriceLowerX96) {
            // Current price below range - all token0
            amount0 = getAmount0ForLiquidity(sqrtPriceLowerX96, sqrtPriceUpperX96, liquidity);
        } else if (sqrtPriceX96 < sqrtPriceUpperX96) {
            // Current price within range
            amount0 = getAmount0ForLiquidity(sqrtPriceX96, sqrtPriceUpperX96, liquidity);
            amount1 = getAmount1ForLiquidity(sqrtPriceLowerX96, sqrtPriceX96, liquidity);
        } else {
            // Current price above range - all token1
            amount1 = getAmount1ForLiquidity(sqrtPriceLowerX96, sqrtPriceUpperX96, liquidity);
        }
    }

    /// @notice Calculate amount0 for a given liquidity
    function getAmount0ForLiquidity(
        uint160 sqrtPriceAX96,
        uint160 sqrtPriceBX96,
        uint128 liquidity
    ) internal pure returns (uint256 amount0) {
        if (sqrtPriceAX96 > sqrtPriceBX96) {
            (sqrtPriceAX96, sqrtPriceBX96) = (sqrtPriceBX96, sqrtPriceAX96);
        }

        return FullMath.mulDiv(
            uint256(liquidity) << FixedPoint96.RESOLUTION,
            sqrtPriceBX96 - sqrtPriceAX96,
            sqrtPriceBX96
        ) / sqrtPriceAX96;
    }

    /// @notice Calculate amount1 for a given liquidity
    function getAmount1ForLiquidity(
        uint160 sqrtPriceAX96,
        uint160 sqrtPriceBX96,
        uint128 liquidity
    ) internal pure returns (uint256 amount1) {
        if (sqrtPriceAX96 > sqrtPriceBX96) {
            (sqrtPriceAX96, sqrtPriceBX96) = (sqrtPriceBX96, sqrtPriceAX96);
        }

        return FullMath.mulDiv(liquidity, sqrtPriceBX96 - sqrtPriceAX96, FixedPoint96.Q96);
    }

    /// @notice Calculate resolver reward (1% of fees)
    /// @param amount The fee amount
    /// @param bps Basis points for reward
    /// @return The reward amount
    function calculateResolverReward(uint256 amount, uint256 bps) internal pure returns (uint256) {
        return (amount * bps) / 10000;
    }

    /// @notice Get total fees (simplified - sum of both tokens)
    /// @param fee0 Fee amount for token0
    /// @param fee1 Fee amount for token1
    /// @return Total fees
    function getTotalFees(uint128 fee0, uint128 fee1) internal pure returns (uint256) {
        return uint256(fee0) + uint256(fee1);
    }
}
