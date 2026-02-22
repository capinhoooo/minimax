// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IDEXAdapter - Unified interface for reading LP positions across DEXs
/// @notice Each DEX adapter implements this to normalize position data for cross-DEX battles
/// @dev Adapters abstract away DEX-specific position management (V4 vs Camelot Algebra)
interface IDEXAdapter {
    /// @notice Normalized position data shared across all DEXs
    struct PositionData {
        address owner;
        address token0;
        address token1;
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
        uint256 usdValue; // 8 decimals (Chainlink standard)
    }

    /// @notice Get normalized position data from any DEX
    /// @param tokenId The NFT token ID representing the LP position
    /// @return data The normalized position data
    function getPosition(uint256 tokenId) external view returns (PositionData memory data);

    /// @notice Check if position is currently in-range
    /// @param tokenId The NFT token ID
    /// @return True if the pool's current tick is within [tickLower, tickUpper)
    function isInRange(uint256 tokenId) external view returns (bool);

    /// @notice Get current tick of the pool this position belongs to
    /// @param tokenId The NFT token ID
    /// @return currentTick The pool's current tick
    function getCurrentTick(uint256 tokenId) external view returns (int24 currentTick);

    /// @notice Get accumulated uncollected fees in token amounts
    /// @param tokenId The NFT token ID
    /// @return fees0 Uncollected fees in token0
    /// @return fees1 Uncollected fees in token1
    function getAccumulatedFees(uint256 tokenId) external view returns (uint256 fees0, uint256 fees1);

    /// @notice Get accumulated uncollected fees converted to USD
    /// @param tokenId The NFT token ID
    /// @return feesUSD Total fees in USD (8 decimals)
    function getAccumulatedFeesUSD(uint256 tokenId) external view returns (uint256 feesUSD);

    /// @notice Get the fee growth snapshot for fee battle tracking
    /// @param tokenId The NFT token ID
    /// @return feeGrowthInside0 Current feeGrowthInside0LastX128
    /// @return feeGrowthInside1 Current feeGrowthInside1LastX128
    function getFeeGrowthInside(uint256 tokenId)
        external
        view
        returns (uint256 feeGrowthInside0, uint256 feeGrowthInside1);

    /// @notice Lock position to prevent modification during battle
    /// @dev V4 uses hook-based locking, Camelot uses escrow (vault holds NFT)
    /// @param tokenId The NFT token ID
    function lockPosition(uint256 tokenId) external;

    /// @notice Unlock position after battle resolution
    /// @param tokenId The NFT token ID
    function unlockPosition(uint256 tokenId) external;

    /// @notice Collect accumulated fees and send to recipient
    /// @param tokenId The NFT token ID
    /// @param recipient Address to receive collected fees
    /// @return collected0 Amount of token0 collected
    /// @return collected1 Amount of token1 collected
    function collectFees(uint256 tokenId, address recipient)
        external
        returns (uint256 collected0, uint256 collected1);

    /// @notice Transfer position NFT into the vault (for battle deposit)
    /// @param from The current owner
    /// @param to The vault address
    /// @param tokenId The NFT token ID
    function transferPositionIn(address from, address to, uint256 tokenId) external;

    /// @notice Transfer position NFT out of the vault (after battle)
    /// @param to The recipient (original owner)
    /// @param tokenId The NFT token ID
    function transferPositionOut(address to, uint256 tokenId) external;

    /// @notice Get the NFT contract address for this DEX
    /// @return The address of the position NFT contract
    function positionNFT() external view returns (address);

    /// @notice Identifier for this DEX
    /// @return Human-readable DEX identifier (e.g., "uniswap_v4", "camelot_v3")
    function dexId() external pure returns (string memory);
}
