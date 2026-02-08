// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ============ Uniswap V4 Interfaces ============

import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {StateLibrary} from "v4-core/libraries/StateLibrary.sol";

// ============ Chainlink Interface ============

interface AggregatorV3Interface {
    function decimals() external view returns (uint8);
    function description() external view returns (string memory);
    function version() external view returns (uint256);
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
}

// ============ Position Manager Interface (V4) ============

import {PositionInfo} from "v4-periphery/src/libraries/PositionInfoLibrary.sol";

interface IPositionManager {
    function getPoolAndPositionInfo(uint256 tokenId) external view returns (PoolKey memory poolKey, PositionInfo info);
    function getPositionLiquidity(uint256 tokenId) external view returns (uint128 liquidity);
    function ownerOf(uint256 tokenId) external view returns (address);
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
    function modifyLiquidities(bytes calldata unlockData, uint256 deadline) external payable;
}

// ============ Battle Vault Interface ============

interface ILPBattleVault {
    enum BattleStatus {
        CREATED,
        MATCHED,
        ONGOING,
        OVERTIME,
        RESOLVED
    }

    struct Position {
        address owner;
        PoolKey poolKey;
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
        uint256 usdValue;
        uint256 tokenId;
    }

    struct Battle {
        uint256 id;
        Position creator;
        Position opponent;
        BattleStatus status;
        uint256 startTime;
        uint256 duration;
        uint256 creatorInRangeTime;
        uint256 opponentInRangeTime;
        address winner;
        bool isResolved;
    }

    event BattleCreated(uint256 indexed battleId, address indexed creator, uint256 tokenId, uint256 duration, uint256 valueUSD);
    event BattleMatched(uint256 indexed battleId, address indexed opponent, uint256 tokenId, uint256 startTime);
    event BattleResolved(uint256 indexed battleId, address indexed winner, address indexed resolver, uint256 resolverReward);
    event InRangeStatusUpdated(uint256 indexed battleId, bool creatorInRange, bool opponentInRange);

    function createBattle(uint256 tokenId, uint256 duration) external returns (uint256 battleId);
    function joinBattle(uint256 battleId, uint256 tokenId) external;
    function resolveBattle(uint256 battleId) external;
    function getBattle(uint256 battleId) external view returns (Battle memory);
}

// ============ Battle Hook Interface ============

interface IBattleVaultHook {
    function registerBattle(uint256 battleId, PoolKey calldata poolKey) external;
    function updateInRangeStatus(uint256 battleId) external;
    function isPositionInRange(PoolKey calldata poolKey, int24 tickLower, int24 tickUpper) external view returns (bool);
}

// ============ Custom Errors ============

error NotOwner();
error ZeroAddress();
error InvalidOwner();
error NotLPOwner();
error BattleAlreadyResolved();
error BattleAlreadyJoined();
error BattleNotStarted();
error BattleNotEnded();
error BattleDoesNotExist();
error AlreadyResolved();
error NoOpponentJoined();
error PoolNotFound();
error PriceFeedNotSet();
error LPValueNotWithinTolerance();
error InvalidCreatorPool();
error InvalidOpponentPool();
error BattleDurationTooShort(uint256 provided, uint256 minimum);
error BattleDurationTooLong(uint256 provided, uint256 maximum);
error BattleNotExpiredForEmergencyWithdrawal();
error PositionLockedInBattle();
error InvalidHookCaller();
error HookNotAuthorized();
