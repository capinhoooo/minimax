// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IScoringEngine - Interface for Stylus-powered battle scoring
/// @notice Scoring computations run in Stylus (Rust/WASM) for gas efficiency
/// @dev Called by BattleArena.sol via standard ABI encoding (Stylus is ABI-compatible)
interface IScoringEngine {
    /// @notice Calculate score for a range battle
    /// @param inRangeTime Seconds the position was in range
    /// @param totalTime Total battle duration in seconds
    /// @param tickDistance Average distance from center of range (tighter = bonus)
    /// @return score Normalized score (18 decimals)
    function calculateRangeScore(
        uint256 inRangeTime,
        uint256 totalTime,
        uint256 tickDistance
    ) external pure returns (uint256 score);

    /// @notice Calculate score for a fee battle
    /// @param feesUSD Fees earned in USD (8 decimals)
    /// @param lpValueUSD LP position value in USD (8 decimals)
    /// @param duration Battle duration in seconds
    /// @return score Normalized score (18 decimals)
    function calculateFeeScore(
        uint256 feesUSD,
        uint256 lpValueUSD,
        uint256 duration
    ) external pure returns (uint256 score);

    /// @notice Determine winner from two scores
    /// @param scoreA Player A (creator) score
    /// @param scoreB Player B (opponent) score
    /// @return winner 1 = player A wins, 2 = player B wins (tie goes to A)
    function determineWinner(
        uint256 scoreA,
        uint256 scoreB
    ) external pure returns (uint8 winner);

    /// @notice Calculate reward distribution amounts
    /// @param totalFees Total collected fees to distribute
    /// @param resolverBps Resolver reward in basis points (e.g., 100 = 1%)
    /// @return winnerAmount Amount allocated to the winner
    /// @return resolverAmount Amount allocated to the resolver
    function calculateRewards(
        uint256 totalFees,
        uint256 resolverBps
    ) external pure returns (uint256 winnerAmount, uint256 resolverAmount);

    /// @notice Normalize a score for cross-DEX fairness
    /// @param rawScore The raw score from calculateRangeScore or calculateFeeScore
    /// @param dexType 0 = Uniswap V4, 1 = Camelot V3
    /// @return normalizedScore The DEX-adjusted score
    function normalizeCrossDex(
        uint256 rawScore,
        uint8 dexType
    ) external pure returns (uint256 normalizedScore);
}
