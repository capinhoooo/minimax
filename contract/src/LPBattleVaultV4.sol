// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {Currency, CurrencyLibrary} from "v4-core/types/Currency.sol";
import {StateLibrary} from "v4-core/libraries/StateLibrary.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";

import {IPositionManager, AggregatorV3Interface} from "./interfaces/IShared.sol";
import {PoolUtilsV4} from "./libraries/PoolUtilsV4.sol";
import {TransferUtils} from "./libraries/TransferUtils.sol";
import {StringUtils} from "./libraries/StringUtils.sol";
import {BattleVaultHook} from "./hooks/BattleVaultHook.sol";

import {
    NotOwner,
    ZeroAddress,
    InvalidOwner,
    NotLPOwner,
    BattleAlreadyResolved,
    BattleAlreadyJoined,
    BattleNotStarted,
    BattleNotEnded,
    BattleDoesNotExist,
    AlreadyResolved,
    NoOpponentJoined,
    PoolNotFound,
    PriceFeedNotSet,
    LPValueNotWithinTolerance,
    InvalidCreatorPool,
    InvalidOpponentPool,
    BattleDurationTooShort,
    BattleDurationTooLong,
    BattleNotExpiredForEmergencyWithdrawal
} from "./interfaces/IShared.sol";

/// @title LP BattleVault V4
/// @notice Enables PvP battles between Uniswap V4 LP positions based on price range validity
/// @dev Integrates with V4 PoolManager and custom BattleVaultHook
/// @author LP BattleVault Team
contract LPBattleVaultV4 is IERC721Receiver, Pausable, ReentrancyGuard {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;
    using CurrencyLibrary for Currency;
    using PoolUtilsV4 for IPoolManager;

    // ============ State Variables ============

    /// @notice Uniswap V4 PoolManager
    IPoolManager public immutable poolManager;

    /// @notice V4 Position Manager for LP NFTs
    IPositionManager public positionManager;

    /// @notice Battle Vault Hook
    BattleVaultHook public battleHook;

    /// @notice Contract owner
    address public owner;

    /// @notice Stablecoin whitelist
    mapping(address => bool) public stablecoins;

    /// @notice Chainlink price feeds
    mapping(address => address) public priceFeeds;

    /// @notice Token decimals cache
    mapping(address => uint8) private tokenDecimals;

    // ============ Battle Structs ============

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
        address creator;
        address opponent;
        address winner;
        uint256 creatorTokenId;
        uint256 opponentTokenId;
        PoolKey creatorPoolKey;
        PoolKey opponentPoolKey;
        int24 creatorTickLower;
        int24 creatorTickUpper;
        int24 opponentTickLower;
        int24 opponentTickUpper;
        uint128 creatorLiquidity;
        uint128 opponentLiquidity;
        uint256 startTime;
        uint256 duration;
        uint256 totalValueUSD;
        uint256 creatorInRangeTime;
        uint256 opponentInRangeTime;
        uint256 lastUpdateTime;
        bool isResolved;
    }

    // ============ Battle Storage ============

    uint256 public battleIdCounter;
    mapping(uint256 => Battle) public battles;

    // ============ Constants ============

    uint256 public constant RESOLVER_REWARD_BPS = 100; // 1%
    uint256 public constant MIN_BATTLE_DURATION = 5 minutes;
    uint256 public constant MAX_BATTLE_DURATION = 7 days;
    uint256 public constant LP_VALUE_TOLERANCE_BPS = 500; // 5%
    uint256 public constant PRICE_STALENESS_THRESHOLD = 18000; // 5 hours

    // ============ Events ============

    event BattleCreated(
        uint256 indexed battleId,
        address indexed creator,
        uint256 tokenId,
        uint256 duration,
        uint256 totalValueUSD
    );
    event BattleJoined(
        uint256 indexed battleId,
        address indexed opponent,
        uint256 tokenId,
        uint256 startTime
    );
    event BattleResolved(
        uint256 indexed battleId,
        address indexed winner,
        address indexed resolver,
        uint256 resolverReward
    );
    event InRangeUpdated(
        uint256 indexed battleId,
        bool creatorInRange,
        bool opponentInRange,
        uint256 timestamp
    );
    event StablecoinSet(address indexed token, bool isStablecoin);
    event PriceFeedSet(address indexed token, address indexed priceFeed);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event HookSet(address indexed hook);
    event PositionManagerSet(address indexed positionManager);

    // ============ Constructor ============

    constructor(address _poolManager) {
        poolManager = IPoolManager(_poolManager);
        owner = msg.sender;
    }

    // ============ Modifiers ============

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // ============ Setup Functions ============

    /// @notice Set the position manager address
    function setPositionManager(address _positionManager) external onlyOwner {
        if (_positionManager == address(0)) revert ZeroAddress();
        positionManager = IPositionManager(_positionManager);
        emit PositionManagerSet(_positionManager);
    }

    /// @notice Set the battle hook address
    function setBattleHook(address _hook) external onlyOwner {
        if (_hook == address(0)) revert ZeroAddress();
        battleHook = BattleVaultHook(_hook);
        emit HookSet(_hook);
    }

    /// @notice Set stablecoin status
    function setStablecoin(address token, bool isStablecoin) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        stablecoins[token] = isStablecoin;
        emit StablecoinSet(token, isStablecoin);
    }

    /// @notice Set Chainlink price feed
    function setPriceFeed(address token, address priceFeed) external onlyOwner {
        if (token == address(0) || priceFeed == address(0)) revert ZeroAddress();
        priceFeeds[token] = priceFeed;
        emit PriceFeedSet(token, priceFeed);
    }

    /// @notice Set token decimals cache
    function setTokenDecimals(address token, uint8 decimals) external onlyOwner {
        tokenDecimals[token] = decimals;
    }

    /// @notice Transfer ownership
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidOwner();
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    /// @notice Pause contract
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause contract
    function unpause() external onlyOwner {
        _unpause();
    }

    // ============ ERC721 Receiver ============

    function onERC721Received(address, address, uint256, bytes calldata)
        external
        pure
        override
        returns (bytes4)
    {
        return IERC721Receiver.onERC721Received.selector;
    }

    // ============ Core Battle Functions ============

    /// @notice Create a new battle with a V4 LP position
    /// @param tokenId The position NFT token ID
    /// @param duration Battle duration in seconds
    /// @return battleId The created battle ID
    function createBattle(
        uint256 tokenId,
        uint256 duration
    ) external nonReentrant whenNotPaused returns (uint256 battleId) {
        // Validate duration
        if (duration > MAX_BATTLE_DURATION) {
            revert BattleDurationTooLong(duration, MAX_BATTLE_DURATION);
        }

        // Verify ownership
        if (positionManager.ownerOf(tokenId) != msg.sender) {
            revert NotLPOwner();
        }

        // Transfer NFT to vault
        positionManager.safeTransferFrom(msg.sender, address(this), tokenId);

        // Get position data
        (
            ,
            ,
            Currency currency0,
            Currency currency1,
            uint24 fee,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity,
            ,
            ,
            ,
        ) = positionManager.positions(tokenId);

        // Calculate USD value
        uint256 usdValue = _calculatePositionUSDValue(
            currency0,
            currency1,
            fee,
            tickLower,
            tickUpper,
            liquidity
        );

        // Create pool key
        PoolKey memory poolKey = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: fee,
            tickSpacing: _getTickSpacing(fee),
            hooks: IHooks(address(battleHook))
        });

        // Create battle
        battleId = battleIdCounter++;
        Battle storage battle = battles[battleId];
        battle.creator = msg.sender;
        battle.creatorTokenId = tokenId;
        battle.creatorPoolKey = poolKey;
        battle.creatorTickLower = tickLower;
        battle.creatorTickUpper = tickUpper;
        battle.creatorLiquidity = liquidity;
        battle.duration = duration;
        battle.totalValueUSD = usdValue;

        // Register with hook
        if (address(battleHook) != address(0)) {
            battleHook.registerBattle(battleId, poolKey);
            battleHook.lockPosition(poolKey, tickLower, tickUpper);
        }

        emit BattleCreated(battleId, msg.sender, tokenId, duration, usdValue);
    }

    /// @notice Join an existing battle
    /// @param battleId The battle to join
    /// @param tokenId The position NFT token ID
    function joinBattle(
        uint256 battleId,
        uint256 tokenId
    ) external nonReentrant whenNotPaused {
        Battle storage battle = battles[battleId];

        // Validations
        if (battle.creator == address(0)) revert BattleDoesNotExist();
        if (battle.isResolved) revert BattleAlreadyResolved();
        if (battle.opponent != address(0)) revert BattleAlreadyJoined();
        if (positionManager.ownerOf(tokenId) != msg.sender) revert NotLPOwner();

        // Get position data
        (
            ,
            ,
            Currency currency0,
            Currency currency1,
            uint24 fee,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity,
            ,
            ,
            ,
        ) = positionManager.positions(tokenId);

        // Calculate USD value
        uint256 opponentValueUSD = _calculatePositionUSDValue(
            currency0,
            currency1,
            fee,
            tickLower,
            tickUpper,
            liquidity
        );

        // Check value tolerance (within 5%)
        uint256 minValue = (battle.totalValueUSD * 95) / 100;
        uint256 maxValue = (battle.totalValueUSD * 105) / 100;
        if (opponentValueUSD < minValue || opponentValueUSD > maxValue) {
            revert LPValueNotWithinTolerance();
        }

        // Transfer NFT to vault
        positionManager.safeTransferFrom(msg.sender, address(this), tokenId);

        // Create pool key
        PoolKey memory poolKey = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: fee,
            tickSpacing: _getTickSpacing(fee),
            hooks: IHooks(address(battleHook))
        });

        // Update battle state
        battle.opponent = msg.sender;
        battle.opponentTokenId = tokenId;
        battle.opponentPoolKey = poolKey;
        battle.opponentTickLower = tickLower;
        battle.opponentTickUpper = tickUpper;
        battle.opponentLiquidity = liquidity;
        battle.startTime = block.timestamp;
        battle.lastUpdateTime = block.timestamp;

        // Lock position with hook
        if (address(battleHook) != address(0)) {
            battleHook.lockPosition(poolKey, tickLower, tickUpper);
        }

        emit BattleJoined(battleId, msg.sender, tokenId, block.timestamp);
    }

    /// @notice Resolve a completed battle
    /// @param battleId The battle to resolve
    function resolveBattle(uint256 battleId) external nonReentrant {
        Battle storage battle = battles[battleId];

        // Validations
        if (battle.isResolved) revert AlreadyResolved();
        if (battle.opponent == address(0)) revert NoOpponentJoined();
        if (block.timestamp < battle.startTime + battle.duration) revert BattleNotEnded();

        // Update in-range times one final time
        _updateInRangeTimes(battleId);

        // Determine winner
        bool creatorInRange = _isPositionInRange(
            battle.creatorPoolKey,
            battle.creatorTickLower,
            battle.creatorTickUpper
        );
        bool opponentInRange = _isPositionInRange(
            battle.opponentPoolKey,
            battle.opponentTickLower,
            battle.opponentTickUpper
        );

        address winner = _determineWinner(battle, creatorInRange, opponentInRange);

        // Update state
        battle.isResolved = true;
        battle.winner = winner;

        // Unlock positions
        if (address(battleHook) != address(0)) {
            battleHook.unlockPosition(
                battle.creatorPoolKey,
                battle.creatorTickLower,
                battle.creatorTickUpper
            );
            battleHook.unlockPosition(
                battle.opponentPoolKey,
                battle.opponentTickLower,
                battle.opponentTickUpper
            );
        }

        // Transfer NFTs back to original owners
        positionManager.safeTransferFrom(address(this), battle.creator, battle.creatorTokenId);
        positionManager.safeTransferFrom(address(this), battle.opponent, battle.opponentTokenId);

        // Note: Fee collection and distribution would be handled here
        // For V4, this requires interacting with the PoolManager's unlock mechanism

        emit BattleResolved(battleId, winner, msg.sender, 0);
    }

    /// @notice Update in-range tracking for a battle
    /// @param battleId The battle to update
    function updateBattleStatus(uint256 battleId) external {
        Battle storage battle = battles[battleId];

        if (battle.isResolved) revert AlreadyResolved();
        if (battle.opponent == address(0)) revert BattleNotStarted();

        _updateInRangeTimes(battleId);
    }

    // ============ Internal Functions ============

    function _updateInRangeTimes(uint256 battleId) internal {
        Battle storage battle = battles[battleId];

        uint256 elapsed = block.timestamp - battle.lastUpdateTime;
        if (elapsed == 0) return;

        bool creatorInRange = _isPositionInRange(
            battle.creatorPoolKey,
            battle.creatorTickLower,
            battle.creatorTickUpper
        );
        bool opponentInRange = _isPositionInRange(
            battle.opponentPoolKey,
            battle.opponentTickLower,
            battle.opponentTickUpper
        );

        if (creatorInRange) {
            battle.creatorInRangeTime += elapsed;
        }
        if (opponentInRange) {
            battle.opponentInRangeTime += elapsed;
        }

        battle.lastUpdateTime = block.timestamp;

        emit InRangeUpdated(battleId, creatorInRange, opponentInRange, block.timestamp);
    }

    function _isPositionInRange(
        PoolKey memory poolKey,
        int24 tickLower,
        int24 tickUpper
    ) internal view returns (bool) {
        if (address(battleHook) != address(0)) {
            return battleHook.isPositionInRange(poolKey, tickLower, tickUpper);
        }

        // Fallback: query PoolManager directly
        PoolId poolId = poolKey.toId();
        (, int24 currentTick, , ) = poolManager.getSlot0(poolId);
        return currentTick >= tickLower && currentTick < tickUpper;
    }

    function _determineWinner(
        Battle storage battle,
        bool creatorInRange,
        bool opponentInRange
    ) internal view returns (address) {
        // If one is in range and the other isn't
        if (creatorInRange && !opponentInRange) {
            return battle.creator;
        }
        if (!creatorInRange && opponentInRange) {
            return battle.opponent;
        }

        // Both in range or both out - compare total in-range time
        if (battle.creatorInRangeTime > battle.opponentInRangeTime) {
            return battle.creator;
        }
        if (battle.opponentInRangeTime > battle.creatorInRangeTime) {
            return battle.opponent;
        }

        // Tie - creator advantage
        return battle.creator;
    }

    function _calculatePositionUSDValue(
        Currency currency0,
        Currency currency1,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity
    ) internal view returns (uint256) {
        // Get current sqrt price
        PoolKey memory poolKey = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: fee,
            tickSpacing: _getTickSpacing(fee),
            hooks: IHooks(address(battleHook))
        });

        PoolId poolId = poolKey.toId();
        (uint160 sqrtPriceX96, , , ) = poolManager.getSlot0(poolId);

        // Calculate token amounts
        (uint256 amount0, uint256 amount1) = PoolUtilsV4.getAmountsForLiquidity(
            sqrtPriceX96,
            tickLower,
            tickUpper,
            liquidity
        );

        // Get USD values
        address token0 = Currency.unwrap(currency0);
        address token1 = Currency.unwrap(currency1);

        uint256 value0 = _getTokenUSDValue(token0, amount0);
        uint256 value1 = _getTokenUSDValue(token1, amount1);

        return value0 + value1;
    }

    function _getTokenUSDValue(address token, uint256 amount) internal view returns (uint256) {
        // Handle native ETH
        if (token == address(0)) {
            address wethFeed = priceFeeds[address(0)];
            if (wethFeed == address(0)) return 0;
            return _getPriceFromFeed(wethFeed, amount, 18);
        }

        // Handle stablecoins
        if (stablecoins[token]) {
            uint8 stableDecimals = _getTokenDecimals(token);
            if (stableDecimals < 8) {
                return amount * (10 ** (8 - stableDecimals));
            } else if (stableDecimals > 8) {
                return amount / (10 ** (stableDecimals - 8));
            }
            return amount;
        }

        // Use Chainlink price feed
        address feed = priceFeeds[token];
        if (feed == address(0)) return 0;

        uint8 tokenDec = _getTokenDecimals(token);
        return _getPriceFromFeed(feed, amount, tokenDec);
    }

    function _getPriceFromFeed(
        address feed,
        uint256 amount,
        uint8 tokenDecimals_
    ) internal view returns (uint256) {
        (, int256 price, , uint256 updatedAt, ) = AggregatorV3Interface(feed).latestRoundData();

        if (price <= 0) return 0;
        if (block.timestamp - updatedAt > PRICE_STALENESS_THRESHOLD) return 0;

        uint8 feedDecimals = AggregatorV3Interface(feed).decimals();

        // Normalize to 8 decimals
        if (feedDecimals <= 8) {
            return (amount * uint256(price) * (10 ** (8 - feedDecimals))) / (10 ** tokenDecimals_);
        } else {
            return (amount * uint256(price)) / ((10 ** tokenDecimals_) * (10 ** (feedDecimals - 8)));
        }
    }

    function _getTokenDecimals(address token) internal view returns (uint8) {
        uint8 cached = tokenDecimals[token];
        if (cached > 0) return cached;

        try IERC20Metadata(token).decimals() returns (uint8 decimals) {
            return decimals;
        } catch {
            return 18;
        }
    }

    function _getTickSpacing(uint24 fee) internal pure returns (int24) {
        if (fee == 500) return 10;
        if (fee == 3000) return 60;
        if (fee == 10000) return 200;
        return 60; // Default
    }

    // ============ View Functions ============

    /// @notice Get battle details
    function getBattle(uint256 battleId)
        external
        view
        returns (
            address creator,
            address opponent,
            address winner,
            uint256 creatorTokenId,
            uint256 opponentTokenId,
            uint256 startTime,
            uint256 duration,
            uint256 totalValueUSD,
            bool isResolved,
            string memory status
        )
    {
        Battle storage b = battles[battleId];
        creator = b.creator;
        opponent = b.opponent;
        winner = b.winner;
        creatorTokenId = b.creatorTokenId;
        opponentTokenId = b.opponentTokenId;
        startTime = b.startTime;
        duration = b.duration;
        totalValueUSD = b.totalValueUSD;
        isResolved = b.isResolved;
        status = _getBattleStatus(b);
    }

    /// @notice Get battle status string
    function getBattleStatus(uint256 battleId) external view returns (string memory) {
        return _getBattleStatus(battles[battleId]);
    }

    function _getBattleStatus(Battle storage b) internal view returns (string memory) {
        if (b.isResolved) return "resolved";
        if (b.opponent == address(0)) return "pending";
        if (block.timestamp < b.startTime + b.duration) return "ongoing";
        return "ready_to_resolve";
    }

    /// @notice Get current battle performance
    function getCurrentPerformance(uint256 battleId)
        external
        view
        returns (
            bool creatorInRange,
            bool opponentInRange,
            uint256 creatorInRangeTime,
            uint256 opponentInRangeTime,
            address currentLeader
        )
    {
        Battle storage b = battles[battleId];
        if (b.opponent == address(0)) revert BattleNotStarted();

        creatorInRange = _isPositionInRange(
            b.creatorPoolKey,
            b.creatorTickLower,
            b.creatorTickUpper
        );
        opponentInRange = _isPositionInRange(
            b.opponentPoolKey,
            b.opponentTickLower,
            b.opponentTickUpper
        );

        creatorInRangeTime = b.creatorInRangeTime;
        opponentInRangeTime = b.opponentInRangeTime;

        // Calculate pending time
        uint256 elapsed = block.timestamp - b.lastUpdateTime;
        if (creatorInRange) creatorInRangeTime += elapsed;
        if (opponentInRange) opponentInRangeTime += elapsed;

        // Determine current leader
        if (creatorInRange && !opponentInRange) {
            currentLeader = b.creator;
        } else if (!creatorInRange && opponentInRange) {
            currentLeader = b.opponent;
        } else if (creatorInRangeTime > opponentInRangeTime) {
            currentLeader = b.creator;
        } else if (opponentInRangeTime > creatorInRangeTime) {
            currentLeader = b.opponent;
        } else {
            currentLeader = b.creator; // Tie goes to creator
        }
    }

    /// @notice Get time remaining in battle
    function getTimeRemaining(uint256 battleId) external view returns (uint256) {
        Battle storage b = battles[battleId];
        if (b.isResolved || b.opponent == address(0)) return 0;

        uint256 endTime = b.startTime + b.duration;
        if (block.timestamp >= endTime) return 0;

        return endTime - block.timestamp;
    }

    /// @notice Get all active battles
    function getActiveBattles() external view returns (uint256[] memory battleIds) {
        uint256 count = 0;
        for (uint256 i = 0; i < battleIdCounter; i++) {
            if (!battles[i].isResolved) count++;
        }

        battleIds = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < battleIdCounter; i++) {
            if (!battles[i].isResolved) {
                battleIds[index++] = i;
            }
        }
    }

    /// @notice Get battles waiting for opponent
    function getPendingBattles() external view returns (uint256[] memory battleIds) {
        uint256 count = 0;
        for (uint256 i = 0; i < battleIdCounter; i++) {
            if (!battles[i].isResolved && battles[i].opponent == address(0)) count++;
        }

        battleIds = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < battleIdCounter; i++) {
            if (!battles[i].isResolved && battles[i].opponent == address(0)) {
                battleIds[index++] = i;
            }
        }
    }

    /// @notice Get user's battles
    function getUserBattles(address user)
        external
        view
        returns (uint256[] memory battleIds, bool[] memory isCreator)
    {
        uint256 count = 0;
        for (uint256 i = 0; i < battleIdCounter; i++) {
            if (battles[i].creator == user || battles[i].opponent == user) count++;
        }

        battleIds = new uint256[](count);
        isCreator = new bool[](count);

        uint256 index = 0;
        for (uint256 i = 0; i < battleIdCounter; i++) {
            if (battles[i].creator == user || battles[i].opponent == user) {
                battleIds[index] = i;
                isCreator[index] = (battles[i].creator == user);
                index++;
            }
        }
    }

    /// @notice Get formatted USD value
    function getBattleUSDValue(uint256 battleId) external view returns (string memory) {
        return StringUtils.formatUSDValue(battles[battleId].totalValueUSD);
    }

    // ============ Emergency Functions ============

    /// @notice Emergency withdraw stuck NFT
    function emergencyWithdraw(uint256 battleId, address to, uint256 tokenId) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();

        Battle storage b = battles[battleId];
        if (!b.isResolved && b.startTime > 0) {
            if (block.timestamp < b.startTime + b.duration + 7 days) {
                revert BattleNotExpiredForEmergencyWithdrawal();
            }
        }

        positionManager.safeTransferFrom(address(this), to, tokenId);
    }
}
