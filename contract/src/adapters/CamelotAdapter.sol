// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

import {IDEXAdapter} from "../core/interfaces/IDEXAdapter.sol";
import {AggregatorV3Interface} from "../interfaces/IShared.sol";
import {PoolUtilsV4} from "../libraries/PoolUtilsV4.sol";

// ============ Camelot / Algebra Interfaces ============

/// @notice Camelot NonfungiblePositionManager (Algebra-based)
interface ICamelotNFTManager {
    function positions(uint256 tokenId)
        external
        view
        returns (
            uint96 nonce,
            address operator,
            address token0,
            address token1,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity,
            uint256 feeGrowthInside0LastX128,
            uint256 feeGrowthInside1LastX128,
            uint128 tokensOwed0,
            uint128 tokensOwed1
        );

    function ownerOf(uint256 tokenId) external view returns (address);

    function safeTransferFrom(address from, address to, uint256 tokenId) external;

    struct CollectParams {
        uint256 tokenId;
        address recipient;
        uint128 amount0Max;
        uint128 amount1Max;
    }

    function collect(CollectParams calldata params)
        external
        returns (uint256 amount0, uint256 amount1);
}

/// @notice Camelot Algebra Factory
interface IAlgebraFactory {
    function poolByPair(address tokenA, address tokenB) external view returns (address pool);
}

/// @notice Camelot Algebra Pool
interface IAlgebraPool {
    function globalState()
        external
        view
        returns (
            uint160 price,
            int24 tick,
            uint16 fee,
            uint16 timepointIndex,
            uint16 communityFeeToken0,
            uint16 communityFeeToken1,
            bool unlocked
        );

    function liquidity() external view returns (uint128);
}

/// @title CamelotAdapter - Adapter for Camelot V3 (Algebra) positions
/// @notice Implements IDEXAdapter to normalize Camelot Algebra position data for the BattleArena
/// @dev Camelot uses Algebra protocol (similar to Uniswap V3 concentrated liquidity)
contract CamelotAdapter is IDEXAdapter, IERC721Receiver {
    // ============ Constants ============

    uint256 public constant PRICE_STALENESS_THRESHOLD = 18000; // 5 hours

    // ============ State Variables ============

    /// @notice The BattleArena contract
    address public immutable battleArena;

    /// @notice Camelot NonfungiblePositionManager
    ICamelotNFTManager public immutable nftManager;

    /// @notice Camelot Algebra Factory
    IAlgebraFactory public immutable algebraFactory;

    /// @notice Contract owner for admin
    address public owner;

    /// @notice Chainlink price feeds
    mapping(address => address) public priceFeeds;

    /// @notice Stablecoin whitelist
    mapping(address => bool) public stablecoins;

    /// @notice Token decimals cache
    mapping(address => uint8) private tokenDecimals;

    /// @notice Cached token pair per tokenId
    mapping(uint256 => address) internal cachedToken0;
    mapping(uint256 => address) internal cachedToken1;

    /// @notice Position lock status (for escrow-based locking)
    mapping(uint256 => bool) public positionLocked;

    // ============ Errors ============

    error NotBattleArena();
    error NotOwner();
    error PositionIsLocked();
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
        address _nftManager,
        address _algebraFactory
    ) {
        battleArena = _battleArena;
        nftManager = ICamelotNFTManager(_nftManager);
        algebraFactory = IAlgebraFactory(_algebraFactory);
        owner = msg.sender;
    }

    // ============ Admin ============

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
        (
            ,
            ,
            address token0,
            address token1,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity,
            ,
            ,
            ,
        ) = nftManager.positions(tokenId);

        data.owner = nftManager.ownerOf(tokenId);
        data.token0 = token0;
        data.token1 = token1;
        data.tickLower = tickLower;
        data.tickUpper = tickUpper;
        data.liquidity = liquidity;
        data.usdValue = _calculatePositionUSDValue(token0, token1, tickLower, tickUpper, liquidity);
    }

    /// @inheritdoc IDEXAdapter
    function isInRange(uint256 tokenId) external view override returns (bool) {
        address token0 = cachedToken0[tokenId];
        address token1 = cachedToken1[tokenId];
        address pool = algebraFactory.poolByPair(token0, token1);

        (, int24 currentTick,,,,,) = IAlgebraPool(pool).globalState();

        (,,,,int24 tickLower, int24 tickUpper,,,,,) = nftManager.positions(tokenId);

        return currentTick >= tickLower && currentTick < tickUpper;
    }

    /// @inheritdoc IDEXAdapter
    function getCurrentTick(uint256 tokenId) external view override returns (int24 currentTick) {
        address token0 = cachedToken0[tokenId];
        address token1 = cachedToken1[tokenId];
        address pool = algebraFactory.poolByPair(token0, token1);

        (, currentTick,,,,,) = IAlgebraPool(pool).globalState();
    }

    /// @inheritdoc IDEXAdapter
    function getAccumulatedFees(uint256 tokenId)
        external
        view
        override
        returns (uint256 fees0, uint256 fees1)
    {
        (,,,,,,, ,, uint128 tokensOwed0, uint128 tokensOwed1) = nftManager.positions(tokenId);
        fees0 = uint256(tokensOwed0);
        fees1 = uint256(tokensOwed1);
    }

    /// @inheritdoc IDEXAdapter
    function getAccumulatedFeesUSD(uint256 tokenId) external view override returns (uint256) {
        (,,address token0, address token1,,,,,,uint128 tokensOwed0, uint128 tokensOwed1) =
            nftManager.positions(tokenId);

        return _getTokenUSDValue(token0, uint256(tokensOwed0))
            + _getTokenUSDValue(token1, uint256(tokensOwed1));
    }

    /// @inheritdoc IDEXAdapter
    function getFeeGrowthInside(uint256 tokenId)
        external
        view
        override
        returns (uint256 feeGrowthInside0, uint256 feeGrowthInside1)
    {
        (,,,,,,,
            feeGrowthInside0,
            feeGrowthInside1,
            ,
        ) = nftManager.positions(tokenId);
    }

    /// @inheritdoc IDEXAdapter
    function lockPosition(uint256 tokenId) external override onlyArena {
        // Camelot uses escrow-based locking — the vault holds the NFT.
        // This flag prevents any operations while locked.
        positionLocked[tokenId] = true;
    }

    /// @inheritdoc IDEXAdapter
    function unlockPosition(uint256 tokenId) external override onlyArena {
        positionLocked[tokenId] = false;
    }

    /// @inheritdoc IDEXAdapter
    function collectFees(uint256 tokenId, address recipient)
        external
        override
        onlyArena
        returns (uint256 collected0, uint256 collected1)
    {
        // Standard V3-style fee collection
        (collected0, collected1) = nftManager.collect(
            ICamelotNFTManager.CollectParams({
                tokenId: tokenId,
                recipient: recipient,
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            })
        );
    }

    /// @inheritdoc IDEXAdapter
    function transferPositionIn(address from, address to, uint256 tokenId) external override onlyArena {
        // Cache token pair for pool lookups
        (,,address token0, address token1,,,,,,,) = nftManager.positions(tokenId);
        cachedToken0[tokenId] = token0;
        cachedToken1[tokenId] = token1;

        nftManager.safeTransferFrom(from, to, tokenId);
    }

    /// @inheritdoc IDEXAdapter
    function transferPositionOut(address to, uint256 tokenId) external override onlyArena {
        if (positionLocked[tokenId]) revert PositionIsLocked();

        nftManager.safeTransferFrom(address(battleArena), to, tokenId);

        // Clean up cache
        delete cachedToken0[tokenId];
        delete cachedToken1[tokenId];
    }

    /// @inheritdoc IDEXAdapter
    function positionNFT() external view override returns (address) {
        return address(nftManager);
    }

    /// @inheritdoc IDEXAdapter
    function dexId() external pure override returns (string memory) {
        return "camelot_v3";
    }

    // ============ Internal Price Functions ============

    function _calculatePositionUSDValue(
        address token0,
        address token1,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity
    ) internal view returns (uint256) {
        address pool = algebraFactory.poolByPair(token0, token1);
        if (pool == address(0)) return 0;

        (uint160 sqrtPriceX96,,,,,,) = IAlgebraPool(pool).globalState();

        // Use same tick math as V4 (Algebra uses identical concentrated liquidity math)
        (uint256 amount0, uint256 amount1) = _getAmountsForLiquidity(
            sqrtPriceX96, tickLower, tickUpper, liquidity
        );

        return _getTokenUSDValue(token0, amount0) + _getTokenUSDValue(token1, amount1);
    }

    /// @notice Calculate token amounts from liquidity (same math as Uniswap V3/V4)
    function _getAmountsForLiquidity(
        uint160 sqrtPriceX96,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity
    ) internal pure returns (uint256 amount0, uint256 amount1) {
        // Use the same PoolUtilsV4 math since Algebra uses identical tick/liquidity math
        return PoolUtilsV4.getAmountsForLiquidity(sqrtPriceX96, tickLower, tickUpper, liquidity);
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
}
