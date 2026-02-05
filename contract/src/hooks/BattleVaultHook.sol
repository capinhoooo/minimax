// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseHook} from "v4-periphery/src/utils/BaseHook.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/types/BeforeSwapDelta.sol";
import {StateLibrary} from "v4-core/libraries/StateLibrary.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {ModifyLiquidityParams, SwapParams} from "v4-core/types/PoolOperation.sol";

import {IBattleVaultHook, PositionLockedInBattle, InvalidHookCaller} from "../interfaces/IShared.sol";

/// @title Battle Vault Hook for Uniswap V4
/// @notice Integrates LP BattleVault with Uniswap V4 hook system
/// @dev Monitors swaps to track in-range status of battling positions
contract BattleVaultHook is BaseHook, IBattleVaultHook {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;

    // ============ State ============

    /// @notice The LP Battle Vault contract
    address public immutable battleVault;

    /// @notice Mapping of battle ID to pool key
    mapping(uint256 => PoolKey) public battlePools;

    /// @notice Mapping of pool ID to active battle IDs
    mapping(PoolId => uint256[]) public poolBattles;

    /// @notice Position lock status (poolId => tickLower => tickUpper => locked)
    mapping(PoolId => mapping(int24 => mapping(int24 => bool))) public positionLocked;

    /// @notice Battle position data
    struct BattlePosition {
        uint256 battleId;
        address owner;
        int24 tickLower;
        int24 tickUpper;
        bool isCreator;
    }

    /// @notice Mapping of pool ID to battle positions
    mapping(PoolId => BattlePosition[]) public battlePositions;

    // ============ Events ============

    event BattleRegistered(uint256 indexed battleId, PoolId indexed poolId);
    event PositionLocked(PoolId indexed poolId, int24 tickLower, int24 tickUpper);
    event PositionUnlocked(PoolId indexed poolId, int24 tickLower, int24 tickUpper);
    event SwapProcessed(PoolId indexed poolId, int24 newTick);

    // ============ Constructor ============

    constructor(IPoolManager _poolManager, address _battleVault) BaseHook(_poolManager) {
        battleVault = _battleVault;
    }

    // ============ Hook Permissions ============

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: true,      // Check if position can be modified
            afterAddLiquidity: false,
            beforeRemoveLiquidity: true,   // Prevent removal if in active battle
            afterRemoveLiquidity: false,
            beforeSwap: false,
            afterSwap: true,               // Update in-range status after swaps
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    // ============ Hook Callbacks (Internal) ============

    /// @notice Called before adding liquidity - check if position is locked
    function _beforeAddLiquidity(
        address,
        PoolKey calldata key,
        ModifyLiquidityParams calldata params,
        bytes calldata
    ) internal view override returns (bytes4) {
        PoolId poolId = key.toId();

        // Check if this position range is locked in a battle
        if (positionLocked[poolId][params.tickLower][params.tickUpper]) {
            revert PositionLockedInBattle();
        }

        return this.beforeAddLiquidity.selector;
    }

    /// @notice Called before removing liquidity - prevent if in active battle
    function _beforeRemoveLiquidity(
        address,
        PoolKey calldata key,
        ModifyLiquidityParams calldata params,
        bytes calldata
    ) internal view override returns (bytes4) {
        PoolId poolId = key.toId();

        // Check if this position range is locked in a battle
        if (positionLocked[poolId][params.tickLower][params.tickUpper]) {
            revert PositionLockedInBattle();
        }

        return this.beforeRemoveLiquidity.selector;
    }

    /// @notice Called after every swap - track price changes for battles
    function _afterSwap(
        address,
        PoolKey calldata key,
        SwapParams calldata,
        BalanceDelta,
        bytes calldata
    ) internal override returns (bytes4, int128) {
        PoolId poolId = key.toId();

        // Get current tick after swap
        (, int24 currentTick, , ) = poolManager.getSlot0(poolId);

        emit SwapProcessed(poolId, currentTick);

        // Note: The actual in-range tracking is done by the BattleVault contract
        // which queries this hook for current tick. This is more gas efficient
        // than updating state on every swap.

        return (this.afterSwap.selector, 0);
    }

    // ============ Battle Vault Functions ============

    /// @notice Register a battle with this hook
    /// @param battleId The battle ID
    /// @param poolKey The pool key for the battle
    function registerBattle(uint256 battleId, PoolKey calldata poolKey) external override {
        if (msg.sender != battleVault) {
            revert InvalidHookCaller();
        }

        PoolId poolId = poolKey.toId();
        battlePools[battleId] = poolKey;
        poolBattles[poolId].push(battleId);

        emit BattleRegistered(battleId, poolId);
    }

    /// @notice Lock a position for a battle
    /// @param poolKey The pool key
    /// @param tickLower Lower tick of the position
    /// @param tickUpper Upper tick of the position
    function lockPosition(
        PoolKey calldata poolKey,
        int24 tickLower,
        int24 tickUpper
    ) external {
        if (msg.sender != battleVault) {
            revert InvalidHookCaller();
        }

        PoolId poolId = poolKey.toId();
        positionLocked[poolId][tickLower][tickUpper] = true;

        emit PositionLocked(poolId, tickLower, tickUpper);
    }

    /// @notice Unlock a position after battle resolution
    /// @param poolKey The pool key
    /// @param tickLower Lower tick of the position
    /// @param tickUpper Upper tick of the position
    function unlockPosition(
        PoolKey calldata poolKey,
        int24 tickLower,
        int24 tickUpper
    ) external {
        if (msg.sender != battleVault) {
            revert InvalidHookCaller();
        }

        PoolId poolId = poolKey.toId();
        positionLocked[poolId][tickLower][tickUpper] = false;

        emit PositionUnlocked(poolId, tickLower, tickUpper);
    }

    /// @notice Update in-range status for a battle
    /// @param battleId The battle ID to update
    function updateInRangeStatus(uint256 battleId) external override {
        // This function is called by BattleVault to trigger status updates
        // The actual logic is in BattleVault which reads current tick from here
    }

    // ============ View Functions ============

    /// @notice Check if a position is currently in range
    /// @param poolKey The pool key
    /// @param tickLower Lower tick of the position
    /// @param tickUpper Upper tick of the position
    /// @return True if position is in range
    function isPositionInRange(
        PoolKey calldata poolKey,
        int24 tickLower,
        int24 tickUpper
    ) external view override returns (bool) {
        PoolId poolId = poolKey.toId();
        (, int24 currentTick, , ) = poolManager.getSlot0(poolId);

        return currentTick >= tickLower && currentTick < tickUpper;
    }

    /// @notice Get current tick for a pool
    /// @param poolKey The pool key
    /// @return currentTick The current tick
    function getCurrentTick(PoolKey calldata poolKey) external view returns (int24 currentTick) {
        PoolId poolId = poolKey.toId();
        (, currentTick, , ) = poolManager.getSlot0(poolId);
    }

    /// @notice Get current sqrt price for a pool
    /// @param poolKey The pool key
    /// @return sqrtPriceX96 The current sqrt price
    function getSqrtPriceX96(PoolKey calldata poolKey) external view returns (uint160 sqrtPriceX96) {
        PoolId poolId = poolKey.toId();
        (sqrtPriceX96, , , ) = poolManager.getSlot0(poolId);
    }

    /// @notice Check if a position is locked
    /// @param poolKey The pool key
    /// @param tickLower Lower tick
    /// @param tickUpper Upper tick
    /// @return True if position is locked in a battle
    function isPositionLocked(
        PoolKey calldata poolKey,
        int24 tickLower,
        int24 tickUpper
    ) external view returns (bool) {
        PoolId poolId = poolKey.toId();
        return positionLocked[poolId][tickLower][tickUpper];
    }

    /// @notice Get all active battles for a pool
    /// @param poolKey The pool key
    /// @return battleIds Array of active battle IDs
    function getPoolBattles(PoolKey calldata poolKey) external view returns (uint256[] memory) {
        PoolId poolId = poolKey.toId();
        return poolBattles[poolId];
    }
}
