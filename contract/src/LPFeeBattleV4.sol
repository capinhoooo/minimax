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
import {IPositionManager, AggregatorV3Interface} from "./interfaces/IShared.sol";
import {PositionInfo} from "v4-periphery/src/libraries/PositionInfoLibrary.sol";
import {PoolUtilsV4} from "./libraries/PoolUtilsV4.sol";
import {TransferUtils} from "./libraries/TransferUtils.sol";
import {StringUtils} from "./libraries/StringUtils.sol";

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
    LPValueNotWithinTolerance
} from "./interfaces/IShared.sol";

/// @title LP Fee Battle V4
/// @notice Enables PvP battles between Uniswap V4 LP positions based on fee accumulation rates
/// @dev Winner is determined by which position accumulates more fees relative to LP value
/// @author LP BattleVault Team
contract LPFeeBattleV4 is IERC721Receiver, ReentrancyGuard, Pausable {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;
    using CurrencyLibrary for Currency;

    // ============ State Variables ============

    /// @notice Uniswap V4 PoolManager
    IPoolManager public immutable poolManager;

    /// @notice V4 Position Manager for LP NFTs
    IPositionManager public positionManager;

    /// @notice Contract owner
    address public owner;

    /// @notice Stablecoin whitelist
    mapping(address => bool) public stablecoins;

    /// @notice Chainlink price feeds
    mapping(address => address) public priceFeeds;

    /// @notice Token decimals cache
    mapping(address => uint8) private tokenDecimals;

    // ============ Sepolia Chainlink Price Feeds ============
    address constant BTC_USD_FEED = 0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43;
    address constant ETH_USD_FEED = 0x694AA1769357215DE4FAC081bf1f309aDC325306;
    address constant DAI_USD_FEED = 0x14866185B1962B63C3Ea9E03Bc1da838bab34C19;
    address constant LINK_USD_FEED = 0xc59E3633BAAC79493d908e63626716e204A45EdF;
    address constant USDC_USD_FEED = 0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E;

    // ============ Battle Structs ============

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
        uint256 creatorStartFeeGrowth0;
        uint256 creatorStartFeeGrowth1;
        uint256 opponentStartFeeGrowth0;
        uint256 opponentStartFeeGrowth1;
        uint256 creatorLPValue;
        uint256 opponentLPValue;
        bool isResolved;
    }

    // ============ Battle Storage ============

    uint256 public battleIdCounter;
    mapping(uint256 => Battle) public battles;
    mapping(uint256 => uint256) public battleEndTime;

    // ============ Constants ============

    uint256 public constant RESOLVER_REWARD_BPS = 100; // 1%
    uint256 public constant MIN_BATTLE_DURATION = 1 hours;
    uint256 public constant MAX_BATTLE_DURATION = 7 days;
    uint256 public constant LP_VALUE_TOLERANCE_BPS = 500; // 5%
    uint256 public constant PRICE_STALENESS_THRESHOLD = 18000; // 5 hours

    // ============ Events ============

    event BattleCreated(
        uint256 indexed battleId,
        address indexed creator,
        uint256 tokenId,
        uint256 duration,
        uint256 lpValueUSD
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
        uint256 creatorFeeRate,
        uint256 opponentFeeRate
    );
    event StablecoinSet(address indexed token, bool isStablecoin);
    event PriceFeedSet(address indexed token, address indexed priceFeed);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

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
    }

    /// @notice Set stablecoin status
    function setStablecoin(address token, bool isStablecoin) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        stablecoins[token] = isStablecoin;
        emit StablecoinSet(token, isStablecoin);
    }

    /// @notice Set Chainlink price feed
    function setPriceFeed(address token, address priceFeed) external onlyOwner {
        if (priceFeed == address(0)) revert ZeroAddress();
        priceFeeds[token] = priceFeed;
        emit PriceFeedSet(token, priceFeed);
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

    /// @notice Create a new fee battle with a V4 LP position
    /// @param tokenId The position NFT token ID
    /// @param duration Battle duration in seconds
    /// @return battleId The created battle ID
    function createBattle(
        uint256 tokenId,
        uint256 duration
    ) external nonReentrant whenNotPaused returns (uint256 battleId) {
        // Validate duration
        if (duration > MAX_BATTLE_DURATION) {
            revert();
        }

        // Verify ownership
        if (positionManager.ownerOf(tokenId) != msg.sender) {
            revert NotLPOwner();
        }

        // Transfer NFT to vault
        positionManager.safeTransferFrom(msg.sender, address(this), tokenId);

        // Get position data from V4 PositionManager
        (PoolKey memory poolKey, PositionInfo info) = positionManager.getPoolAndPositionInfo(tokenId);
        int24 tickLower = info.tickLower();
        int24 tickUpper = info.tickUpper();
        uint128 liquidity = positionManager.getPositionLiquidity(tokenId);

        // Get current fee growth for this position
        (uint256 feeGrowth0, uint256 feeGrowth1) = _getPositionFeeGrowth(tokenId, poolKey, tickLower, tickUpper);

        // Calculate USD value
        uint256 lpValue = _calculatePositionUSDValue(poolKey, tickLower, tickUpper, liquidity);

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
        battle.creatorStartFeeGrowth0 = feeGrowth0;
        battle.creatorStartFeeGrowth1 = feeGrowth1;
        battle.creatorLPValue = lpValue;

        emit BattleCreated(battleId, msg.sender, tokenId, duration, lpValue);
    }

    /// @notice Join an existing fee battle
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

        // Get position data from V4 PositionManager
        (PoolKey memory poolKey, PositionInfo info) = positionManager.getPoolAndPositionInfo(tokenId);
        int24 tickLower = info.tickLower();
        int24 tickUpper = info.tickUpper();
        uint128 liquidity = positionManager.getPositionLiquidity(tokenId);

        // Calculate USD value
        uint256 opponentLPValue = _calculatePositionUSDValue(poolKey, tickLower, tickUpper, liquidity);

        // Check value tolerance (within 5%)
        uint256 minValue = (battle.creatorLPValue * 95) / 100;
        uint256 maxValue = (battle.creatorLPValue * 105) / 100;
        if (opponentLPValue < minValue || opponentLPValue > maxValue) {
            revert LPValueNotWithinTolerance();
        }

        // Transfer NFT to vault
        positionManager.safeTransferFrom(msg.sender, address(this), tokenId);

        // Get current fee growth for this position
        (uint256 feeGrowth0, uint256 feeGrowth1) = _getPositionFeeGrowth(tokenId, poolKey, tickLower, tickUpper);

        // Update battle state
        battle.opponent = msg.sender;
        battle.opponentTokenId = tokenId;
        battle.opponentPoolKey = poolKey;
        battle.opponentTickLower = tickLower;
        battle.opponentTickUpper = tickUpper;
        battle.opponentLiquidity = liquidity;
        battle.opponentStartFeeGrowth0 = feeGrowth0;
        battle.opponentStartFeeGrowth1 = feeGrowth1;
        battle.opponentLPValue = opponentLPValue;
        battle.startTime = block.timestamp;
        battleEndTime[battleId] = block.timestamp + battle.duration;

        emit BattleJoined(battleId, msg.sender, tokenId, block.timestamp);
    }

    /// @notice Resolve a completed fee battle
    /// @param battleId The battle to resolve
    function resolveBattle(uint256 battleId) external nonReentrant {
        Battle storage battle = battles[battleId];

        // Validations
        if (battle.isResolved) revert AlreadyResolved();
        if (battle.opponent == address(0)) revert NoOpponentJoined();
        if (block.timestamp < battleEndTime[battleId]) revert BattleNotEnded();

        // Get current fee growth for creator
        (uint256 creatorCurrentFG0, uint256 creatorCurrentFG1) = _getPositionFeeGrowth(
            battle.creatorTokenId, battle.creatorPoolKey, battle.creatorTickLower, battle.creatorTickUpper
        );

        // Get current fee growth for opponent
        (uint256 opponentCurrentFG0, uint256 opponentCurrentFG1) = _getPositionFeeGrowth(
            battle.opponentTokenId, battle.opponentPoolKey, battle.opponentTickLower, battle.opponentTickUpper
        );

        // Calculate fee growth delta (feeGrowthInside is X128 fixed point)
        uint256 creatorFGDelta0 = creatorCurrentFG0 >= battle.creatorStartFeeGrowth0
            ? creatorCurrentFG0 - battle.creatorStartFeeGrowth0 : 0;
        uint256 creatorFGDelta1 = creatorCurrentFG1 >= battle.creatorStartFeeGrowth1
            ? creatorCurrentFG1 - battle.creatorStartFeeGrowth1 : 0;

        uint256 opponentFGDelta0 = opponentCurrentFG0 >= battle.opponentStartFeeGrowth0
            ? opponentCurrentFG0 - battle.opponentStartFeeGrowth0 : 0;
        uint256 opponentFGDelta1 = opponentCurrentFG1 >= battle.opponentStartFeeGrowth1
            ? opponentCurrentFG1 - battle.opponentStartFeeGrowth1 : 0;

        // Convert feeGrowthInside deltas to actual token amounts: amount = delta * liquidity / 2^128
        uint256 creatorFeeAmt0 = (creatorFGDelta0 * uint256(battle.creatorLiquidity)) >> 128;
        uint256 creatorFeeAmt1 = (creatorFGDelta1 * uint256(battle.creatorLiquidity)) >> 128;
        uint256 opponentFeeAmt0 = (opponentFGDelta0 * uint256(battle.opponentLiquidity)) >> 128;
        uint256 opponentFeeAmt1 = (opponentFGDelta1 * uint256(battle.opponentLiquidity)) >> 128;

        // Convert to USD
        uint256 creatorFeeGrowthUSD = _convertFeesToUSD(
            creatorFeeAmt0, creatorFeeAmt1,
            Currency.unwrap(battle.creatorPoolKey.currency0),
            Currency.unwrap(battle.creatorPoolKey.currency1)
        );

        uint256 opponentFeeGrowthUSD = _convertFeesToUSD(
            opponentFeeAmt0, opponentFeeAmt1,
            Currency.unwrap(battle.opponentPoolKey.currency0),
            Currency.unwrap(battle.opponentPoolKey.currency1)
        );

        // Calculate fee rates (fee growth / LP value) for fair comparison
        uint256 creatorFeeRate = battle.creatorLPValue > 0
            ? (creatorFeeGrowthUSD * 1e24) / battle.creatorLPValue : 0;
        uint256 opponentFeeRate = battle.opponentLPValue > 0
            ? (opponentFeeGrowthUSD * 1e24) / battle.opponentLPValue : 0;

        // Determine winner based on fee rate
        address winner = creatorFeeRate >= opponentFeeRate ? battle.creator : battle.opponent;

        // Update state
        battle.isResolved = true;
        battle.winner = winner;

        // Return NFTs to original owners
        positionManager.safeTransferFrom(address(this), battle.creator, battle.creatorTokenId);
        positionManager.safeTransferFrom(address(this), battle.opponent, battle.opponentTokenId);

        emit BattleResolved(battleId, winner, msg.sender, creatorFeeRate, opponentFeeRate);
    }

    // ============ Internal Functions ============

    function _calculatePositionUSDValue(
        PoolKey memory poolKey,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity
    ) internal view returns (uint256) {
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
        address token0 = Currency.unwrap(poolKey.currency0);
        address token1 = Currency.unwrap(poolKey.currency1);

        uint256 value0 = _getTokenUSDValue(token0, amount0);
        uint256 value1 = _getTokenUSDValue(token1, amount1);

        return value0 + value1;
    }

    function _convertFeesToUSD(
        uint256 amount0,
        uint256 amount1,
        address token0,
        address token1
    ) internal view returns (uint256) {
        uint256 value0 = _getTokenUSDValue(token0, amount0);
        uint256 value1 = _getTokenUSDValue(token1, amount1);
        return value0 + value1;
    }

    function _getTokenUSDValue(address token, uint256 amount) internal view returns (uint256) {
        if (amount == 0) return 0;

        // Handle native ETH
        if (token == address(0)) {
            address ethFeed = priceFeeds[address(0)];
            if (ethFeed == address(0)) return 0;
            return _getPriceFromFeed(ethFeed, amount, 18);
        }

        // Handle stablecoins
        if (stablecoins[token]) {
            uint8 stableDec = _getTokenDecimals(token);
            if (stableDec < 8) {
                return amount * (10 ** (8 - stableDec));
            } else if (stableDec > 8) {
                return amount / (10 ** (stableDec - 8));
            }
            return amount;
        }

        // Use Chainlink price feed
        address tokenFeed = priceFeeds[token];
        if (tokenFeed == address(0)) return 0;

        uint8 tokenDec = _getTokenDecimals(token);
        return _getPriceFromFeed(tokenFeed, amount, tokenDec);
    }

    function _getPriceFromFeed(
        address feed,
        uint256 amount,
        uint8 tokenDec
    ) internal view returns (uint256) {
        (, int256 price, , uint256 updatedAt, ) = AggregatorV3Interface(feed).latestRoundData();

        if (price <= 0) return 0;
        if (block.timestamp - updatedAt > PRICE_STALENESS_THRESHOLD) return 0;

        uint8 feedDecimals = AggregatorV3Interface(feed).decimals();

        // Normalize to 8 decimals
        if (feedDecimals <= 8) {
            return (amount * uint256(price) * (10 ** (8 - feedDecimals))) / (10 ** tokenDec);
        } else {
            return (amount * uint256(price)) / ((10 ** tokenDec) * (10 ** (feedDecimals - 8)));
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

    /// @notice Get feeGrowthInside for a V4 position via StateLibrary
    function _getPositionFeeGrowth(
        uint256 tokenId,
        PoolKey memory poolKey,
        int24 tickLower,
        int24 tickUpper
    ) internal view returns (uint256 feeGrowthInside0, uint256 feeGrowthInside1) {
        // V4 position ID is keccak256(owner, tickLower, tickUpper, salt)
        // where owner = positionManager and salt = bytes32(tokenId)
        bytes32 positionId = keccak256(
            abi.encodePacked(address(positionManager), tickLower, tickUpper, bytes32(tokenId))
        );
        PoolId poolId = poolKey.toId();
        (, feeGrowthInside0, feeGrowthInside1) = poolManager.getPositionInfo(poolId, positionId);
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
            uint256 creatorLPValue,
            uint256 opponentLPValue,
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
        creatorLPValue = b.creatorLPValue;
        opponentLPValue = b.opponentLPValue;
        isResolved = b.isResolved;
        status = _getBattleStatus(b, battleId);
    }

    /// @notice Get current fee performance
    function getCurrentFeePerformance(uint256 battleId)
        external
        view
        returns (
            uint256 creatorFeeGrowthUSD,
            uint256 opponentFeeGrowthUSD,
            uint256 creatorFeeRate,
            uint256 opponentFeeRate,
            address currentLeader
        )
    {
        Battle storage b = battles[battleId];
        if (b.opponent == address(0)) revert BattleNotStarted();
        if (b.isResolved) return (0, 0, 0, 0, b.winner);

        // Get current fee growth for creator
        (uint256 creatorCurrentFG0, uint256 creatorCurrentFG1) = _getPositionFeeGrowth(
            b.creatorTokenId, b.creatorPoolKey, b.creatorTickLower, b.creatorTickUpper
        );

        // Get current fee growth for opponent
        (uint256 opponentCurrentFG0, uint256 opponentCurrentFG1) = _getPositionFeeGrowth(
            b.opponentTokenId, b.opponentPoolKey, b.opponentTickLower, b.opponentTickUpper
        );

        // Calculate fee growth deltas
        uint256 creatorFGDelta0 = creatorCurrentFG0 >= b.creatorStartFeeGrowth0
            ? creatorCurrentFG0 - b.creatorStartFeeGrowth0 : 0;
        uint256 creatorFGDelta1 = creatorCurrentFG1 >= b.creatorStartFeeGrowth1
            ? creatorCurrentFG1 - b.creatorStartFeeGrowth1 : 0;

        uint256 opponentFGDelta0 = opponentCurrentFG0 >= b.opponentStartFeeGrowth0
            ? opponentCurrentFG0 - b.opponentStartFeeGrowth0 : 0;
        uint256 opponentFGDelta1 = opponentCurrentFG1 >= b.opponentStartFeeGrowth1
            ? opponentCurrentFG1 - b.opponentStartFeeGrowth1 : 0;

        // Convert to actual token amounts: amount = delta * liquidity / 2^128
        uint256 creatorFeeAmt0 = (creatorFGDelta0 * uint256(b.creatorLiquidity)) >> 128;
        uint256 creatorFeeAmt1 = (creatorFGDelta1 * uint256(b.creatorLiquidity)) >> 128;
        uint256 opponentFeeAmt0 = (opponentFGDelta0 * uint256(b.opponentLiquidity)) >> 128;
        uint256 opponentFeeAmt1 = (opponentFGDelta1 * uint256(b.opponentLiquidity)) >> 128;

        creatorFeeGrowthUSD = _convertFeesToUSD(
            creatorFeeAmt0, creatorFeeAmt1,
            Currency.unwrap(b.creatorPoolKey.currency0),
            Currency.unwrap(b.creatorPoolKey.currency1)
        );

        opponentFeeGrowthUSD = _convertFeesToUSD(
            opponentFeeAmt0, opponentFeeAmt1,
            Currency.unwrap(b.opponentPoolKey.currency0),
            Currency.unwrap(b.opponentPoolKey.currency1)
        );

        creatorFeeRate = b.creatorLPValue > 0
            ? (creatorFeeGrowthUSD * 1e24) / b.creatorLPValue : 0;
        opponentFeeRate = b.opponentLPValue > 0
            ? (opponentFeeGrowthUSD * 1e24) / b.opponentLPValue : 0;

        currentLeader = creatorFeeRate >= opponentFeeRate ? b.creator : b.opponent;
    }

    /// @notice Get battle status string
    function getBattleStatus(uint256 battleId) external view returns (string memory) {
        return _getBattleStatus(battles[battleId], battleId);
    }

    function _getBattleStatus(Battle storage b, uint256 battleId) internal view returns (string memory) {
        if (b.isResolved) return "resolved";
        if (b.opponent == address(0)) return "waiting_for_opponent";
        if (block.timestamp >= battleEndTime[battleId]) return "ready_to_resolve";
        return "ongoing";
    }

    /// @notice Get time remaining
    function getTimeRemaining(uint256 battleId) external view returns (uint256) {
        Battle storage b = battles[battleId];
        if (b.isResolved || b.opponent == address(0)) return 0;

        uint256 endTime = battleEndTime[battleId];
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
        return StringUtils.formatUSDValue(battles[battleId].creatorLPValue);
    }
}
