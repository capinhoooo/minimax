// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IBattleArena - Interface for the Multi-DEX LP Battle Arena
/// @notice Defines the battle lifecycle: create, join, update, resolve
interface IBattleArena {
    // ============ Enums ============

    enum BattleType {
        RANGE, // Winner = more cumulative in-range time
        FEE // Winner = higher fee accumulation rate
    }

    enum DexType {
        UNISWAP_V4, // Uniswap V4 PositionManager NFT
        CAMELOT_V3 // Camelot Algebra NonfungiblePositionManager NFT
    }

    enum BattleStatus {
        PENDING, // Created, waiting for opponent
        ACTIVE, // Both players joined, battle in progress
        EXPIRED, // Duration passed, ready to resolve
        RESOLVED // Winner determined, fees distributed
    }

    // ============ Structs ============

    struct Battle {
        // Players
        address creator;
        address opponent;
        address winner;
        // Positions
        DexType creatorDex;
        DexType opponentDex;
        uint256 creatorTokenId;
        uint256 opponentTokenId;
        uint256 creatorValueUSD; // 8 decimals
        uint256 opponentValueUSD; // 8 decimals
        // Config
        BattleType battleType;
        BattleStatus status;
        uint256 startTime;
        uint256 duration;
        // Token pair (both positions must match)
        address token0;
        address token1;
        // Range battle tracking
        uint256 creatorInRangeTime;
        uint256 opponentInRangeTime;
        uint256 lastUpdateTime;
        // Fee battle tracking
        uint256 creatorStartFeeGrowth0;
        uint256 creatorStartFeeGrowth1;
        uint256 opponentStartFeeGrowth0;
        uint256 opponentStartFeeGrowth1;
        uint128 creatorLiquidity;
        uint128 opponentLiquidity;
    }

    // ============ Events ============

    event BattleCreated(
        uint256 indexed battleId,
        address indexed creator,
        DexType dexType,
        BattleType battleType,
        uint256 tokenId,
        uint256 duration,
        uint256 valueUSD
    );

    event BattleJoined(
        uint256 indexed battleId,
        address indexed opponent,
        DexType dexType,
        uint256 tokenId,
        uint256 valueUSD,
        uint256 startTime
    );

    event BattleStatusUpdated(
        uint256 indexed battleId,
        bool creatorInRange,
        bool opponentInRange,
        uint256 creatorInRangeTime,
        uint256 opponentInRangeTime
    );

    event BattleResolved(
        uint256 indexed battleId,
        address indexed winner,
        address indexed resolver,
        uint256 winnerReward,
        uint256 resolverReward
    );

    event EmergencyWithdrawal(uint256 indexed battleId, address indexed player, uint256 tokenId);

    event AdapterRegistered(DexType indexed dexType, address adapter);

    event ScoringEngineUpdated(address indexed oldEngine, address indexed newEngine);
    event LeaderboardUpdated(address indexed oldLeaderboard, address indexed newLeaderboard);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ============ Functions ============

    function createBattle(
        DexType dexType,
        uint256 tokenId,
        uint256 duration,
        BattleType battleType
    ) external returns (uint256 battleId);

    function joinBattle(uint256 battleId, DexType dexType, uint256 tokenId) external;

    function updateBattleStatus(uint256 battleId) external;

    function resolveBattle(uint256 battleId) external;

    function emergencyWithdraw(uint256 battleId) external;

    function getBattle(uint256 battleId) external view returns (Battle memory);

    function getBattleCount() external view returns (uint256);
}
