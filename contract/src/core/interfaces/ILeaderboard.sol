// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ILeaderboard - Interface for Stylus-powered ELO leaderboard
/// @notice On-chain player rankings and statistics powered by Stylus (Rust/WASM)
/// @dev Called by BattleArena.sol after battle resolution
interface ILeaderboard {
    /// @notice Record a battle result and update ELO ratings
    /// @param winner The winning player address
    /// @param loser The losing player address
    /// @param battleValueUSD The battle value in USD (8 decimals)
    function recordResult(
        address winner,
        address loser,
        uint256 battleValueUSD
    ) external;

    /// @notice Get player statistics
    /// @param player The player address
    /// @return elo Current ELO rating
    /// @return wins Total wins
    /// @return losses Total losses
    /// @return totalBattles Total battles participated in
    /// @return totalValueWon Total USD value won (8 decimals)
    function getPlayerStats(address player)
        external
        view
        returns (
            uint256 elo,
            uint256 wins,
            uint256 losses,
            uint256 totalBattles,
            uint256 totalValueWon
        );
}
