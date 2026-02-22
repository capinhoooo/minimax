// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

import {IBattleArena} from "./interfaces/IBattleArena.sol";
import {IDEXAdapter} from "./interfaces/IDEXAdapter.sol";
import {IScoringEngine} from "./interfaces/IScoringEngine.sol";
import {ILeaderboard} from "./interfaces/ILeaderboard.sol";

/// @title BattleArena - Multi-DEX LP PvP Battle Arena
/// @notice Enables cross-DEX battles between Uniswap V4 and Camelot LP positions on Arbitrum
/// @dev Uses adapter pattern to normalize position data across DEXs.
///      Scoring is delegated to Stylus (Rust/WASM) contracts for gas efficiency.
/// @author Minimax Team
contract BattleArena is IBattleArena, IERC721Receiver, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    uint256 public constant MIN_BATTLE_DURATION = 5 minutes;
    uint256 public constant MAX_BATTLE_DURATION = 7 days;
    uint256 public constant LP_VALUE_TOLERANCE_BPS = 500; // 5%
    uint256 public constant RESOLVER_REWARD_BPS = 100; // 1%
    uint256 public constant EMERGENCY_WITHDRAW_BUFFER = 1 days;

    // ============ State Variables ============

    /// @notice Contract owner
    address public owner;

    /// @notice DEX adapters: DexType => adapter contract
    mapping(DexType => IDEXAdapter) public adapters;

    /// @notice Stylus scoring engine
    IScoringEngine public scoringEngine;

    /// @notice Stylus leaderboard
    ILeaderboard public leaderboard;

    /// @notice All battles
    mapping(uint256 => Battle) public battles;

    /// @notice Total number of battles created
    uint256 public battleCount;

    /// @notice Number of currently active (unresolved) battles
    uint256 public activeBattleCount;

    // ============ Errors ============

    error NotOwner();
    error ZeroAddress();
    error BattleDoesNotExist();
    error BattleNotPending();
    error BattleNotActive();
    error BattleNotExpired();
    error BattleAlreadyResolved();
    error NoOpponentJoined();
    error CannotJoinOwnBattle();
    error AdapterNotRegistered();
    error TokenPairMismatch();
    error LPValueNotWithinTolerance();
    error BattleDurationTooShort();
    error BattleDurationTooLong();
    error NotBattleParticipant();
    error BattleNotExpiredForEmergency();
    error PositionHasNoLiquidity();
    error ActiveBattlesExist();

    // ============ Modifiers ============

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier battleExists(uint256 battleId) {
        if (battleId >= battleCount) revert BattleDoesNotExist();
        _;
    }

    // ============ Constructor ============

    constructor(address _scoringEngine, address _leaderboard) {
        owner = msg.sender;
        scoringEngine = IScoringEngine(_scoringEngine);
        leaderboard = ILeaderboard(_leaderboard);
    }

    // ============ Admin Functions ============

    /// @notice Register a DEX adapter
    /// @param dexType The DEX type enum
    /// @param adapter The adapter contract address
    function registerAdapter(DexType dexType, address adapter) external onlyOwner {
        if (adapter == address(0)) revert ZeroAddress();
        adapters[dexType] = IDEXAdapter(adapter);
        emit AdapterRegistered(dexType, adapter);
    }

    /// @notice Update the scoring engine address (only when no active battles)
    function setScoringEngine(address _scoringEngine) external onlyOwner {
        if (activeBattleCount > 0) revert ActiveBattlesExist();
        address old = address(scoringEngine);
        scoringEngine = IScoringEngine(_scoringEngine);
        emit ScoringEngineUpdated(old, _scoringEngine);
    }

    /// @notice Update the leaderboard address (only when no active battles)
    function setLeaderboard(address _leaderboard) external onlyOwner {
        if (activeBattleCount > 0) revert ActiveBattlesExist();
        address old = address(leaderboard);
        leaderboard = ILeaderboard(_leaderboard);
        emit LeaderboardUpdated(old, _leaderboard);
    }

    /// @notice Transfer ownership to a new address
    /// @param newOwner The new owner address
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        address old = owner;
        owner = newOwner;
        emit OwnershipTransferred(old, newOwner);
    }

    /// @notice Pause the contract
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause the contract
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Approve an adapter to manage NFTs held by the arena
    /// @param nft The NFT contract (e.g. PositionManager)
    /// @param operator The adapter to approve
    /// @param approved Whether to approve or revoke
    function approveAdapterForNFT(address nft, address operator, bool approved) external onlyOwner {
        IERC721(nft).setApprovalForAll(operator, approved);
    }

    // ============ Battle Lifecycle ============

    /// @notice Create a new battle by depositing an LP position
    /// @param dexType Which DEX the position is from
    /// @param tokenId The LP NFT token ID
    /// @param duration Battle duration in seconds
    /// @param battleType RANGE or FEE battle
    /// @return battleId The new battle's ID
    function createBattle(
        DexType dexType,
        uint256 tokenId,
        uint256 duration,
        BattleType battleType
    ) external override nonReentrant whenNotPaused returns (uint256 battleId) {
        if (duration < MIN_BATTLE_DURATION) revert BattleDurationTooShort();
        if (duration > MAX_BATTLE_DURATION) revert BattleDurationTooLong();

        IDEXAdapter adapter = _getAdapter(dexType);

        // Get position data
        IDEXAdapter.PositionData memory pos = adapter.getPosition(tokenId);
        if (pos.liquidity == 0) revert PositionHasNoLiquidity();

        // Transfer NFT into the arena
        adapter.transferPositionIn(msg.sender, address(this), tokenId);

        // Lock position to prevent modification
        adapter.lockPosition(tokenId);

        // Create battle
        battleId = battleCount++;
        Battle storage battle = battles[battleId];
        battle.creator = msg.sender;
        battle.creatorDex = dexType;
        battle.creatorTokenId = tokenId;
        battle.creatorValueUSD = pos.usdValue;
        battle.battleType = battleType;
        battle.status = BattleStatus.PENDING;
        battle.duration = duration;
        battle.token0 = pos.token0;
        battle.token1 = pos.token1;

        // Snapshot fee growth for fee battles
        if (battleType == BattleType.FEE) {
            (battle.creatorStartFeeGrowth0, battle.creatorStartFeeGrowth1) =
                adapter.getFeeGrowthInside(tokenId);
            battle.creatorLiquidity = pos.liquidity;
        }

        emit BattleCreated(battleId, msg.sender, dexType, battleType, tokenId, duration, pos.usdValue);
    }

    /// @notice Join an existing battle by depositing a matching LP position
    /// @param battleId The battle to join
    /// @param dexType Which DEX the opponent's position is from
    /// @param tokenId The LP NFT token ID
    function joinBattle(
        uint256 battleId,
        DexType dexType,
        uint256 tokenId
    ) external override nonReentrant whenNotPaused battleExists(battleId) {
        Battle storage battle = battles[battleId];
        if (battle.status != BattleStatus.PENDING) revert BattleNotPending();
        if (msg.sender == battle.creator) revert CannotJoinOwnBattle();

        IDEXAdapter adapter = _getAdapter(dexType);

        // Get position data
        IDEXAdapter.PositionData memory pos = adapter.getPosition(tokenId);
        if (pos.liquidity == 0) revert PositionHasNoLiquidity();

        // Validate same token pair
        if (pos.token0 != battle.token0 || pos.token1 != battle.token1) {
            revert TokenPairMismatch();
        }

        // Validate LP value within tolerance
        _validateValueTolerance(battle.creatorValueUSD, pos.usdValue);

        // Transfer NFT into the arena
        adapter.transferPositionIn(msg.sender, address(this), tokenId);

        // Lock position
        adapter.lockPosition(tokenId);

        // Update battle state
        battle.opponent = msg.sender;
        battle.opponentDex = dexType;
        battle.opponentTokenId = tokenId;
        battle.opponentValueUSD = pos.usdValue;
        battle.status = BattleStatus.ACTIVE;
        battle.startTime = block.timestamp;
        battle.lastUpdateTime = block.timestamp;
        activeBattleCount++;

        // Snapshot fee growth for fee battles
        if (battle.battleType == BattleType.FEE) {
            (battle.opponentStartFeeGrowth0, battle.opponentStartFeeGrowth1) =
                adapter.getFeeGrowthInside(tokenId);
            battle.opponentLiquidity = pos.liquidity;
        }

        emit BattleJoined(battleId, msg.sender, dexType, tokenId, pos.usdValue, block.timestamp);
    }

    /// @notice Update in-range status for an active range battle
    /// @dev Called periodically by the agent or anyone to track in-range time
    /// @param battleId The battle to update
    function updateBattleStatus(
        uint256 battleId
    ) external override battleExists(battleId) {
        Battle storage battle = battles[battleId];
        if (battle.status != BattleStatus.ACTIVE) revert BattleNotActive();
        if (battle.battleType != BattleType.RANGE) return; // Only range battles need updates

        // Cap elapsed time at battle end
        uint256 battleEndTime = battle.startTime + battle.duration;

        // Guard: if last update already reached battle end, nothing to do
        if (battle.lastUpdateTime >= battleEndTime) return;

        uint256 elapsed = block.timestamp - battle.lastUpdateTime;
        if (elapsed == 0) return;

        if (block.timestamp > battleEndTime) {
            elapsed = battleEndTime - battle.lastUpdateTime;
            battle.status = BattleStatus.EXPIRED;
        }

        // Check in-range status for both positions via their adapters
        IDEXAdapter creatorAdapter = adapters[battle.creatorDex];
        IDEXAdapter opponentAdapter = adapters[battle.opponentDex];

        bool creatorInRange = creatorAdapter.isInRange(battle.creatorTokenId);
        bool opponentInRange = opponentAdapter.isInRange(battle.opponentTokenId);

        // Accumulate in-range time
        if (creatorInRange) {
            battle.creatorInRangeTime += elapsed;
        }
        if (opponentInRange) {
            battle.opponentInRangeTime += elapsed;
        }

        battle.lastUpdateTime = block.timestamp;

        emit BattleStatusUpdated(
            battleId,
            creatorInRange,
            opponentInRange,
            battle.creatorInRangeTime,
            battle.opponentInRangeTime
        );
    }

    /// @notice Resolve a battle after its duration has passed
    /// @dev Anyone can call this (resolver earns 1% of fees). Triggers Stylus scoring.
    /// @param battleId The battle to resolve
    function resolveBattle(
        uint256 battleId
    ) external override nonReentrant battleExists(battleId) {
        Battle storage battle = battles[battleId];
        if (battle.status == BattleStatus.RESOLVED) revert BattleAlreadyResolved();
        if (battle.opponent == address(0)) revert NoOpponentJoined();

        uint256 battleEndTime = battle.startTime + battle.duration;
        if (block.timestamp < battleEndTime) revert BattleNotExpired();

        // Final in-range update for range battles
        if (battle.battleType == BattleType.RANGE && battle.lastUpdateTime < battleEndTime) {
            _finalRangeUpdate(battle, battleEndTime);
        }

        // Determine winner via Stylus scoring engine
        address winner = _determineWinner(battle);
        address loser = winner == battle.creator ? battle.opponent : battle.creator;

        battle.winner = winner;
        battle.status = BattleStatus.RESOLVED;
        activeBattleCount--;

        // Collect fees from both positions and distribute
        uint256 winnerReward;
        uint256 resolverReward;
        (winnerReward, resolverReward) = _collectAndDistribute(battle, winner, msg.sender);

        // Unlock and return NFTs to original owners
        _returnPositions(battle);

        // Update leaderboard (Stylus) — wrapped in try-catch so a revert doesn't block resolution
        if (address(leaderboard) != address(0)) {
            uint256 battleValueUSD = (battle.creatorValueUSD + battle.opponentValueUSD) / 2;
            try leaderboard.recordResult(winner, loser, battleValueUSD) {} catch {}
        }

        emit BattleResolved(battleId, winner, msg.sender, winnerReward, resolverReward);
    }

    /// @notice Emergency withdraw if battle is stuck (after duration + buffer)
    /// @param battleId The battle to withdraw from
    function emergencyWithdraw(
        uint256 battleId
    ) external override nonReentrant battleExists(battleId) {
        Battle storage battle = battles[battleId];
        if (battle.status == BattleStatus.RESOLVED) revert BattleAlreadyResolved();

        bool isCreator = msg.sender == battle.creator;
        bool isOpponent = msg.sender == battle.opponent;
        if (!isCreator && !isOpponent) revert NotBattleParticipant();

        // For pending battles (no opponent), creator can withdraw anytime
        if (battle.status == BattleStatus.PENDING && isCreator) {
            _emergencyReturnPosition(battle, true);
            battle.status = BattleStatus.RESOLVED;
            emit EmergencyWithdrawal(battleId, msg.sender, battle.creatorTokenId);
            return;
        }

        // For active/expired battles, need to wait for emergency buffer
        uint256 emergencyTime = battle.startTime + battle.duration + EMERGENCY_WITHDRAW_BUFFER;
        if (block.timestamp < emergencyTime) revert BattleNotExpiredForEmergency();

        // Attempt to collect and return fees to each player (best-effort, no winner)
        _emergencyCollectFees(battle);

        // Return both positions
        _returnPositions(battle);
        battle.status = BattleStatus.RESOLVED;
        activeBattleCount--;

        uint256 tokenId = isCreator ? battle.creatorTokenId : battle.opponentTokenId;
        emit EmergencyWithdrawal(battleId, msg.sender, tokenId);
    }

    // ============ View Functions ============

    /// @notice Get battle data
    function getBattle(uint256 battleId) external view override returns (Battle memory) {
        return battles[battleId];
    }

    /// @notice Get total battle count
    function getBattleCount() external view override returns (uint256) {
        return battleCount;
    }

    /// @notice Get battles by status
    /// @param status The status to filter by
    /// @return battleIds Array of matching battle IDs
    function getBattlesByStatus(BattleStatus status) external view returns (uint256[] memory) {
        uint256 count;
        for (uint256 i; i < battleCount; i++) {
            if (battles[i].status == status) count++;
        }

        uint256[] memory result = new uint256[](count);
        uint256 idx;
        for (uint256 i; i < battleCount; i++) {
            if (battles[i].status == status) {
                result[idx++] = i;
            }
        }
        return result;
    }

    /// @notice Get active battles for a specific player
    /// @param player The player address
    /// @return battleIds Array of battle IDs the player is in
    function getPlayerBattles(address player) external view returns (uint256[] memory) {
        uint256 count;
        for (uint256 i; i < battleCount; i++) {
            if (battles[i].creator == player || battles[i].opponent == player) count++;
        }

        uint256[] memory result = new uint256[](count);
        uint256 idx;
        for (uint256 i; i < battleCount; i++) {
            if (battles[i].creator == player || battles[i].opponent == player) {
                result[idx++] = i;
            }
        }
        return result;
    }

    /// @notice Check if a battle is ready to resolve
    function isBattleExpired(uint256 battleId) external view battleExists(battleId) returns (bool) {
        Battle storage battle = battles[battleId];
        if (battle.status != BattleStatus.ACTIVE && battle.status != BattleStatus.EXPIRED) {
            return false;
        }
        return block.timestamp >= battle.startTime + battle.duration;
    }

    // ============ Internal Functions ============

    /// @notice Get adapter for a DEX type, reverting if not registered
    function _getAdapter(DexType dexType) internal view returns (IDEXAdapter) {
        IDEXAdapter adapter = adapters[dexType];
        if (address(adapter) == address(0)) revert AdapterNotRegistered();
        return adapter;
    }

    /// @notice Validate that two LP values are within tolerance
    function _validateValueTolerance(uint256 valueA, uint256 valueB) internal pure {
        uint256 maxVal = valueA > valueB ? valueA : valueB;
        if (maxVal == 0) return;

        uint256 diff = valueA > valueB ? valueA - valueB : valueB - valueA;
        uint256 toleranceAmount = (maxVal * LP_VALUE_TOLERANCE_BPS) / 10000;

        if (diff > toleranceAmount) revert LPValueNotWithinTolerance();
    }

    /// @notice Final range update capping at battle end time
    function _finalRangeUpdate(Battle storage battle, uint256 battleEndTime) internal {
        uint256 elapsed = battleEndTime - battle.lastUpdateTime;
        if (elapsed == 0) return;

        IDEXAdapter creatorAdapter = adapters[battle.creatorDex];
        IDEXAdapter opponentAdapter = adapters[battle.opponentDex];

        if (creatorAdapter.isInRange(battle.creatorTokenId)) {
            battle.creatorInRangeTime += elapsed;
        }
        if (opponentAdapter.isInRange(battle.opponentTokenId)) {
            battle.opponentInRangeTime += elapsed;
        }

        battle.lastUpdateTime = battleEndTime;
    }

    /// @notice Determine the winner using the Stylus scoring engine
    function _determineWinner(Battle storage battle) internal view returns (address) {
        uint256 creatorScore;
        uint256 opponentScore;

        if (battle.battleType == BattleType.RANGE) {
            uint256 totalTime = battle.duration;

            // Get tick distances from position data for scoring bonus
            IDEXAdapter creatorAdapter = adapters[battle.creatorDex];
            IDEXAdapter opponentAdapter = adapters[battle.opponentDex];

            IDEXAdapter.PositionData memory creatorPos = creatorAdapter.getPosition(battle.creatorTokenId);
            IDEXAdapter.PositionData memory opponentPos = opponentAdapter.getPosition(battle.opponentTokenId);

            uint256 creatorTickDist = uint256(int256(creatorPos.tickUpper - creatorPos.tickLower));
            uint256 opponentTickDist = uint256(int256(opponentPos.tickUpper - opponentPos.tickLower));

            creatorScore = scoringEngine.calculateRangeScore(
                battle.creatorInRangeTime,
                totalTime,
                creatorTickDist
            );
            opponentScore = scoringEngine.calculateRangeScore(
                battle.opponentInRangeTime,
                totalTime,
                opponentTickDist
            );
        } else {
            // FEE battle
            IDEXAdapter creatorAdapter = adapters[battle.creatorDex];
            IDEXAdapter opponentAdapter = adapters[battle.opponentDex];

            uint256 creatorFeesUSD = creatorAdapter.getAccumulatedFeesUSD(battle.creatorTokenId);
            uint256 opponentFeesUSD = opponentAdapter.getAccumulatedFeesUSD(battle.opponentTokenId);

            creatorScore = scoringEngine.calculateFeeScore(
                creatorFeesUSD,
                battle.creatorValueUSD,
                battle.duration
            );
            opponentScore = scoringEngine.calculateFeeScore(
                opponentFeesUSD,
                battle.opponentValueUSD,
                battle.duration
            );
        }

        // Normalize for cross-DEX fairness
        creatorScore = scoringEngine.normalizeCrossDex(creatorScore, uint8(battle.creatorDex));
        opponentScore = scoringEngine.normalizeCrossDex(opponentScore, uint8(battle.opponentDex));

        // Determine winner (1 = creator, 2 = opponent, tie goes to creator)
        uint8 winnerFlag = scoringEngine.determineWinner(creatorScore, opponentScore);

        return winnerFlag == 1 ? battle.creator : battle.opponent;
    }

    /// @notice Collect fees from both positions and distribute to winner + resolver
    function _collectAndDistribute(
        Battle storage battle,
        address winner,
        address resolver
    ) internal returns (uint256 winnerReward, uint256 resolverReward) {
        IDEXAdapter creatorAdapter = adapters[battle.creatorDex];
        IDEXAdapter opponentAdapter = adapters[battle.opponentDex];

        // Collect fees from both positions into this contract
        // Wrapped in try-catch so adapter failures don't block battle resolution
        uint256 creator0;
        uint256 creator1;
        uint256 opponent0;
        uint256 opponent1;

        try creatorAdapter.collectFees(battle.creatorTokenId, address(this))
            returns (uint256 c0, uint256 c1)
        {
            creator0 = c0;
            creator1 = c1;
        } catch {}

        try opponentAdapter.collectFees(battle.opponentTokenId, address(this))
            returns (uint256 o0, uint256 o1)
        {
            opponent0 = o0;
            opponent1 = o1;
        } catch {}

        // Distribute token0 fees
        uint256 totalFees0 = creator0 + opponent0;
        if (totalFees0 > 0) {
            uint256 resolverFee0 = (totalFees0 * RESOLVER_REWARD_BPS) / 10000;
            uint256 winnerFee0 = totalFees0 - resolverFee0;

            address token0 = battle.token0;
            if (winnerFee0 > 0) {
                IERC20(token0).safeTransfer(winner, winnerFee0);
            }
            if (resolverFee0 > 0) {
                IERC20(token0).safeTransfer(resolver, resolverFee0);
            }

            winnerReward += winnerFee0;
            resolverReward += resolverFee0;
        }

        // Distribute token1 fees
        uint256 totalFees1 = creator1 + opponent1;
        if (totalFees1 > 0) {
            uint256 resolverFee1 = (totalFees1 * RESOLVER_REWARD_BPS) / 10000;
            uint256 winnerFee1 = totalFees1 - resolverFee1;

            address token1 = battle.token1;
            if (winnerFee1 > 0) {
                IERC20(token1).safeTransfer(winner, winnerFee1);
            }
            if (resolverFee1 > 0) {
                IERC20(token1).safeTransfer(resolver, resolverFee1);
            }

            winnerReward += winnerFee1;
            resolverReward += resolverFee1;
        }
    }

    /// @notice Unlock and return positions to original owners
    function _returnPositions(Battle storage battle) internal {
        IDEXAdapter creatorAdapter = adapters[battle.creatorDex];
        IDEXAdapter opponentAdapter = adapters[battle.opponentDex];

        // Unlock positions
        creatorAdapter.unlockPosition(battle.creatorTokenId);
        if (battle.opponent != address(0)) {
            opponentAdapter.unlockPosition(battle.opponentTokenId);
        }

        // Return NFTs to original owners
        creatorAdapter.transferPositionOut(battle.creator, battle.creatorTokenId);
        if (battle.opponent != address(0)) {
            opponentAdapter.transferPositionOut(battle.opponent, battle.opponentTokenId);
        }
    }

    /// @notice Return a single position in emergency
    function _emergencyReturnPosition(Battle storage battle, bool isCreator) internal {
        if (isCreator) {
            IDEXAdapter adapter = adapters[battle.creatorDex];
            adapter.unlockPosition(battle.creatorTokenId);
            adapter.transferPositionOut(battle.creator, battle.creatorTokenId);
        } else {
            IDEXAdapter adapter = adapters[battle.opponentDex];
            adapter.unlockPosition(battle.opponentTokenId);
            adapter.transferPositionOut(battle.opponent, battle.opponentTokenId);
        }
    }

    /// @notice Best-effort fee collection during emergency — returns each player's fees to them
    function _emergencyCollectFees(Battle storage battle) internal {
        IDEXAdapter creatorAdapter = adapters[battle.creatorDex];
        IDEXAdapter opponentAdapter = adapters[battle.opponentDex];

        // Collect creator's fees and send directly to creator
        try creatorAdapter.collectFees(battle.creatorTokenId, battle.creator) {} catch {}

        // Collect opponent's fees and send directly to opponent
        if (battle.opponent != address(0)) {
            try opponentAdapter.collectFees(battle.opponentTokenId, battle.opponent) {} catch {}
        }
    }

    // ============ ERC721 Receiver ============

    function onERC721Received(address, address, uint256, bytes calldata) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}
