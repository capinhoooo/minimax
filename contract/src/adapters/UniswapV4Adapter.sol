// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {Currency, CurrencyLibrary} from "v4-core/types/Currency.sol";
import {StateLibrary} from "v4-core/libraries/StateLibrary.sol";

import {PositionInfo} from "v4-periphery/src/libraries/PositionInfoLibrary.sol";
import {Actions} from "v4-periphery/src/libraries/Actions.sol";

import {IDEXAdapter} from "../core/interfaces/IDEXAdapter.sol";
import {IPositionManager, AggregatorV3Interface} from "../interfaces/IShared.sol";
import {BattleVaultHook} from "../hooks/BattleVaultHook.sol";
import {PoolUtilsV4} from "../libraries/PoolUtilsV4.sol";

/// @title UniswapV4Adapter - Adapter for Uniswap V4 positions
/// @notice Implements IDEXAdapter to normalize V4 position data for the BattleArena
/// @dev Ported from LPBattleVaultV4.sol into the adapter pattern
contract UniswapV4Adapter is IDEXAdapter, IERC721Receiver {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;
    using CurrencyLibrary for Currency;
    using SafeERC20 for IERC20;

    // ============ Constants ============

    uint256 public constant PRICE_STALENESS_THRESHOLD = 18000; // 5 hours

    // ============ State Variables ============

    /// @notice The BattleArena contract (only caller for mutating functions)
    address public immutable battleArena;

    /// @notice Uniswap V4 PoolManager
    IPoolManager public immutable poolManager;

    /// @notice V4 PositionManager for LP NFTs
    IPositionManager public immutable positionManager;

    /// @notice Battle Vault Hook for position locking
    BattleVaultHook public battleHook;

    /// @notice Contract owner for admin functions
    address public owner;

    /// @notice Chainlink price feeds: token address => feed address
    mapping(address => address) public priceFeeds;

    /// @notice Stablecoin whitelist
    mapping(address => bool) public stablecoins;

    /// @notice Token decimals cache
    mapping(address => uint8) private tokenDecimals;

    /// @notice Cached pool keys per tokenId (set on transferPositionIn)
    mapping(uint256 => PoolKey) internal cachedPoolKeys;
    mapping(uint256 => int24) internal cachedTickLower;
    mapping(uint256 => int24) internal cachedTickUpper;

    // ============ Errors ============

    error NotBattleArena();
    error NotOwner();
    error ZeroAddress();
    error StalePrice(address feed);

    // ============ Modifiers ============

    modifier onlyArena() {
        if (msg.sender != battleArena) revert NotBattleArena();
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // ============ Constructor ============

    constructor(
        address _battleArena,
        address _poolManager,
        address _positionManager
    ) {
        battleArena = _battleArena;
        poolManager = IPoolManager(_poolManager);
        positionManager = IPositionManager(_positionManager);
        owner = msg.sender;
    }

    // ============ Admin ============

    function setBattleHook(address _hook) external onlyOwner {
        battleHook = BattleVaultHook(_hook);
    }

    function setPriceFeed(address token, address feed) external onlyOwner {
        priceFeeds[token] = feed;
    }

    function setStablecoin(address token, bool isStable) external onlyOwner {
        stablecoins[token] = isStable;
    }

    function setTokenDecimals(address token, uint8 decimals_) external onlyOwner {
        tokenDecimals[token] = decimals_;
    }

    // ============ IDEXAdapter Implementation ============

    /// @inheritdoc IDEXAdapter
    function getPosition(uint256 tokenId) external view override returns (PositionData memory data) {
        (PoolKey memory poolKey, PositionInfo info) = positionManager.getPoolAndPositionInfo(tokenId);
        int24 tickLower = info.tickLower();
        int24 tickUpper = info.tickUpper();
        uint128 liquidity = positionManager.getPositionLiquidity(tokenId);

        data.owner = positionManager.ownerOf(tokenId);
        data.token0 = Currency.unwrap(poolKey.currency0);
        data.token1 = Currency.unwrap(poolKey.currency1);
        data.tickLower = tickLower;
        data.tickUpper = tickUpper;
        data.liquidity = liquidity;
        data.usdValue = _calculatePositionUSDValue(poolKey, tickLower, tickUpper, liquidity);
    }

    /// @inheritdoc IDEXAdapter
    function isInRange(uint256 tokenId) external view override returns (bool) {
        PoolKey memory poolKey = cachedPoolKeys[tokenId];
        PoolId poolId = poolKey.toId();
        (, int24 currentTick,,) = poolManager.getSlot0(poolId);

        int24 tickLower = cachedTickLower[tokenId];
        int24 tickUpper = cachedTickUpper[tokenId];

        return currentTick >= tickLower && currentTick < tickUpper;
    }

    /// @inheritdoc IDEXAdapter
    function getCurrentTick(uint256 tokenId) external view override returns (int24 currentTick) {
        PoolKey memory poolKey = cachedPoolKeys[tokenId];
        PoolId poolId = poolKey.toId();
        (, currentTick,,) = poolManager.getSlot0(poolId);
    }

    /// @inheritdoc IDEXAdapter
    function getAccumulatedFees(uint256 /* tokenId */)
        external
        pure
        override
        returns (uint256 fees0, uint256 fees1)
    {
        // V4 doesn't expose uncollected fees via a simple view function.
        // We return 0 here — actual fee collection happens in collectFees().
        // For fee battle scoring, we use getFeeGrowthInside delta instead.
        return (0, 0);
    }

    /// @inheritdoc IDEXAdapter
    function getAccumulatedFeesUSD(uint256 /* tokenId */) external pure override returns (uint256) {
        // Similar to getAccumulatedFees — V4 requires tx to collect.
        // For fee battles, the BattleArena uses getFeeGrowthInside snapshots.
        return 0;
    }

    /// @inheritdoc IDEXAdapter
    function getFeeGrowthInside(uint256 tokenId)
        external
        view
        override
        returns (uint256 feeGrowthInside0, uint256 feeGrowthInside1)
    {
        PoolKey memory poolKey = cachedPoolKeys[tokenId];
        PoolId poolId = poolKey.toId();

        // Compute the position ID the same way V4 does
        int24 tickLower = cachedTickLower[tokenId];
        int24 tickUpper = cachedTickUpper[tokenId];

        bytes32 positionId = keccak256(
            abi.encodePacked(address(positionManager), tickLower, tickUpper, bytes32(tokenId))
        );

        (, feeGrowthInside0, feeGrowthInside1) = poolManager.getPositionInfo(poolId, positionId);
    }

    /// @inheritdoc IDEXAdapter
    function lockPosition(uint256 tokenId) external override onlyArena {
        if (address(battleHook) != address(0)) {
            PoolKey memory poolKey = cachedPoolKeys[tokenId];
            int24 tickLower = cachedTickLower[tokenId];
            int24 tickUpper = cachedTickUpper[tokenId];
            battleHook.lockPosition(poolKey, tickLower, tickUpper);
        }
    }

    /// @inheritdoc IDEXAdapter
    function unlockPosition(uint256 tokenId) external override onlyArena {
        if (address(battleHook) != address(0)) {
            PoolKey memory poolKey = cachedPoolKeys[tokenId];
            int24 tickLower = cachedTickLower[tokenId];
            int24 tickUpper = cachedTickUpper[tokenId];
            battleHook.unlockPosition(poolKey, tickLower, tickUpper);
        }
    }

    /// @inheritdoc IDEXAdapter
    function collectFees(uint256 tokenId, address recipient)
        external
        override
        onlyArena
        returns (uint256 collected0, uint256 collected1)
    {
        PoolKey memory poolKey = cachedPoolKeys[tokenId];

        // Record balances before collection
        uint256 balance0Before = poolKey.currency0.balanceOfSelf();
        uint256 balance1Before = poolKey.currency1.balanceOfSelf();

        // DECREASE_LIQUIDITY(0) + CLOSE_CURRENCY x2 to collect fees
        bytes memory actions = abi.encodePacked(
            uint8(Actions.DECREASE_LIQUIDITY),
            uint8(Actions.CLOSE_CURRENCY),
            uint8(Actions.CLOSE_CURRENCY)
        );

        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(tokenId, uint256(0), uint128(0), uint128(0), bytes(""));
        params[1] = abi.encode(poolKey.currency0);
        params[2] = abi.encode(poolKey.currency1);

        positionManager.modifyLiquidities(abi.encode(actions, params), block.timestamp);

        // Calculate collected amounts
        collected0 = poolKey.currency0.balanceOfSelf() - balance0Before;
        collected1 = poolKey.currency1.balanceOfSelf() - balance1Before;

        // Transfer to recipient
        address token0 = Currency.unwrap(poolKey.currency0);
        address token1 = Currency.unwrap(poolKey.currency1);

        if (collected0 > 0 && recipient != address(this)) {
            if (token0 == address(0)) {
                (bool success,) = recipient.call{value: collected0}("");
                require(success, "ETH transfer failed");
            } else {
                IERC20(token0).safeTransfer(recipient, collected0);
            }
        }
        if (collected1 > 0 && recipient != address(this)) {
            if (token1 == address(0)) {
                (bool success,) = recipient.call{value: collected1}("");
                require(success, "ETH transfer failed");
            } else {
                IERC20(token1).safeTransfer(recipient, collected1);
            }
        }
    }

    /// @inheritdoc IDEXAdapter
    function transferPositionIn(address from, address to, uint256 tokenId) external override onlyArena {
        // Cache position data before transfer
        (PoolKey memory poolKey, PositionInfo info) = positionManager.getPoolAndPositionInfo(tokenId);
        cachedPoolKeys[tokenId] = poolKey;
        cachedTickLower[tokenId] = info.tickLower();
        cachedTickUpper[tokenId] = info.tickUpper();

        positionManager.safeTransferFrom(from, to, tokenId);
    }

    /// @inheritdoc IDEXAdapter
    function transferPositionOut(address to, uint256 tokenId) external override onlyArena {
        positionManager.safeTransferFrom(address(battleArena), to, tokenId);

        // Clean up cache
        delete cachedPoolKeys[tokenId];
        delete cachedTickLower[tokenId];
        delete cachedTickUpper[tokenId];
    }

    /// @inheritdoc IDEXAdapter
    function positionNFT() external view override returns (address) {
        return address(positionManager);
    }

    /// @inheritdoc IDEXAdapter
    function dexId() external pure override returns (string memory) {
        return "uniswap_v4";
    }

    // ============ Internal Price Functions ============

    function _calculatePositionUSDValue(
        PoolKey memory poolKey,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity
    ) internal view returns (uint256) {
        PoolId poolId = poolKey.toId();
        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(poolId);

        (uint256 amount0, uint256 amount1) = PoolUtilsV4.getAmountsForLiquidity(
            sqrtPriceX96, tickLower, tickUpper, liquidity
        );

        address token0 = Currency.unwrap(poolKey.currency0);
        address token1 = Currency.unwrap(poolKey.currency1);

        return _getTokenUSDValue(token0, amount0) + _getTokenUSDValue(token1, amount1);
    }

    function _getTokenUSDValue(address token, uint256 amount) internal view returns (uint256) {
        if (token == address(0)) {
            address nativeFeed = priceFeeds[address(0)];
            if (nativeFeed == address(0)) return 0;
            return _getPriceFromFeed(nativeFeed, amount, 18);
        }

        if (stablecoins[token]) {
            uint8 dec = _getTokenDecimals(token);
            if (dec < 8) return amount * (10 ** (8 - dec));
            if (dec > 8) return amount / (10 ** (dec - 8));
            return amount;
        }

        address tokenFeed = priceFeeds[token];
        if (tokenFeed == address(0)) return 0;

        return _getPriceFromFeed(tokenFeed, amount, _getTokenDecimals(token));
    }

    function _getPriceFromFeed(
        address feed,
        uint256 amount,
        uint8 tokenDec
    ) internal view returns (uint256) {
        (, int256 price,, uint256 updatedAt,) = AggregatorV3Interface(feed).latestRoundData();
        if (price <= 0) revert StalePrice(feed);
        if (block.timestamp - updatedAt > PRICE_STALENESS_THRESHOLD) revert StalePrice(feed);

        uint8 feedDecimals = AggregatorV3Interface(feed).decimals();

        if (feedDecimals <= 8) {
            return (amount * uint256(price) * (10 ** (8 - feedDecimals))) / (10 ** tokenDec);
        } else {
            return (amount * uint256(price)) / ((10 ** tokenDec) * (10 ** (feedDecimals - 8)));
        }
    }

    function _getTokenDecimals(address token) internal view returns (uint8) {
        uint8 cached = tokenDecimals[token];
        if (cached > 0) return cached;

        try IERC20Metadata(token).decimals() returns (uint8 dec) {
            return dec;
        } catch {
            return 18;
        }
    }

    // ============ ERC721 Receiver ============

    function onERC721Received(address, address, uint256, bytes calldata) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    /// @notice Allow receiving native ETH from fee collection
    receive() external payable {}
}
