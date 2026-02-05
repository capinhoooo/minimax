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
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";

import {IPositionManager, AggregatorV3Interface} from "./interfaces/IShared.sol";
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
        uint256 startTime;
        uint256 duration;
        uint256 creatorStartFee0;
        uint256 creatorStartFee1;
        uint256 opponentStartFee0;
        uint256 opponentStartFee1;
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
        if (token == address(0) || priceFeed == address(0)) revert ZeroAddress();
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
            uint128 tokensOwed0,
            uint128 tokensOwed1
        ) = positionManager.positions(tokenId);

        // Calculate USD value
        uint256 lpValue = _calculatePositionUSDValue(
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
            hooks: IHooks(address(0))
        });

        // Create battle
        battleId = battleIdCounter++;
        Battle storage battle = battles[battleId];
        battle.creator = msg.sender;
        battle.creatorTokenId = tokenId;
        battle.creatorPoolKey = poolKey;
        battle.duration = duration;
        battle.creatorStartFee0 = tokensOwed0;
        battle.creatorStartFee1 = tokensOwed1;
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
            uint128 tokensOwed0,
            uint128 tokensOwed1
        ) = positionManager.positions(tokenId);

        // Calculate USD value
        uint256 opponentLPValue = _calculatePositionUSDValue(
            currency0,
            currency1,
            fee,
            tickLower,
            tickUpper,
            liquidity
        );

        // Check value tolerance (within 5%)
        uint256 minValue = (battle.creatorLPValue * 95) / 100;
        uint256 maxValue = (battle.creatorLPValue * 105) / 100;
        if (opponentLPValue < minValue || opponentLPValue > maxValue) {
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
            hooks: IHooks(address(0))
        });

        // Update battle state
        battle.opponent = msg.sender;
        battle.opponentTokenId = tokenId;
        battle.opponentPoolKey = poolKey;
        battle.opponentStartFee0 = tokensOwed0;
        battle.opponentStartFee1 = tokensOwed1;
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

        // Get current fees for creator
        (
            ,
            ,
            Currency creatorCurrency0,
            Currency creatorCurrency1,
            ,
            ,
            ,
            ,
            ,
            ,
            uint128 creatorCurrentFee0,
            uint128 creatorCurrentFee1
        ) = positionManager.positions(battle.creatorTokenId);

        // Get current fees for opponent
        (
            ,
            ,
            Currency opponentCurrency0,
            Currency opponentCurrency1,
            ,
            ,
            ,
            ,
            ,
            ,
            uint128 opponentCurrentFee0,
            uint128 opponentCurrentFee1
        ) = positionManager.positions(battle.opponentTokenId);

        // Calculate fee growth in USD
        uint256 creatorFeeGrowth0 = creatorCurrentFee0 > battle.creatorStartFee0
            ? creatorCurrentFee0 - uint128(battle.creatorStartFee0) : 0;
        uint256 creatorFeeGrowth1 = creatorCurrentFee1 > battle.creatorStartFee1
            ? creatorCurrentFee1 - uint128(battle.creatorStartFee1) : 0;

        uint256 opponentFeeGrowth0 = opponentCurrentFee0 > battle.opponentStartFee0
            ? opponentCurrentFee0 - uint128(battle.opponentStartFee0) : 0;
        uint256 opponentFeeGrowth1 = opponentCurrentFee1 > battle.opponentStartFee1
            ? opponentCurrentFee1 - uint128(battle.opponentStartFee1) : 0;

        uint256 creatorFeeGrowthUSD = _convertFeesToUSD(
            creatorFeeGrowth0,
            creatorFeeGrowth1,
            Currency.unwrap(creatorCurrency0),
            Currency.unwrap(creatorCurrency1)
        );

        uint256 opponentFeeGrowthUSD = _convertFeesToUSD(
            opponentFeeGrowth0,
            opponentFeeGrowth1,
            Currency.unwrap(opponentCurrency0),
            Currency.unwrap(opponentCurrency1)
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
            hooks: IHooks(address(0))
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

    function _getTickSpacing(uint24 fee) internal pure returns (int24) {
        if (fee == 500) return 10;
        if (fee == 3000) return 60;
        if (fee == 10000) return 200;
        return 60;
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

        // Get current fees
        (
            ,
            ,
            Currency creatorCurrency0,
            Currency creatorCurrency1,
            ,
            ,
            ,
            ,
            ,
            ,
            uint128 creatorCurrentFee0,
            uint128 creatorCurrentFee1
        ) = positionManager.positions(b.creatorTokenId);

        (
            ,
            ,
            Currency opponentCurrency0,
            Currency opponentCurrency1,
            ,
            ,
            ,
            ,
            ,
            ,
            uint128 opponentCurrentFee0,
            uint128 opponentCurrentFee1
        ) = positionManager.positions(b.opponentTokenId);

        // Calculate fee growth
        uint256 creatorFeeGrowth0 = creatorCurrentFee0 > b.creatorStartFee0
            ? creatorCurrentFee0 - uint128(b.creatorStartFee0) : 0;
        uint256 creatorFeeGrowth1 = creatorCurrentFee1 > b.creatorStartFee1
            ? creatorCurrentFee1 - uint128(b.creatorStartFee1) : 0;

        uint256 opponentFeeGrowth0 = opponentCurrentFee0 > b.opponentStartFee0
            ? opponentCurrentFee0 - uint128(b.opponentStartFee0) : 0;
        uint256 opponentFeeGrowth1 = opponentCurrentFee1 > b.opponentStartFee1
            ? opponentCurrentFee1 - uint128(b.opponentStartFee1) : 0;

        creatorFeeGrowthUSD = _convertFeesToUSD(
            creatorFeeGrowth0,
            creatorFeeGrowth1,
            Currency.unwrap(creatorCurrency0),
            Currency.unwrap(creatorCurrency1)
        );

        opponentFeeGrowthUSD = _convertFeesToUSD(
            opponentFeeGrowth0,
            opponentFeeGrowth1,
            Currency.unwrap(opponentCurrency0),
            Currency.unwrap(opponentCurrency1)
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
