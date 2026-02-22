// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "forge-std/console.sol";

import {BattleArena} from "../src/core/BattleArena.sol";
import {IBattleArena} from "../src/core/interfaces/IBattleArena.sol";
import {IDEXAdapter} from "../src/core/interfaces/IDEXAdapter.sol";
import {IScoringEngine} from "../src/core/interfaces/IScoringEngine.sol";
import {ILeaderboard} from "../src/core/interfaces/ILeaderboard.sol";

/**
 * @title BattleArena Test Suite
 * @notice Comprehensive tests for the multi-DEX BattleArena contract
 * @dev Uses mock adapters, scoring engine, and leaderboard
 */
contract BattleArenaTest is Test {
    // ============ Contracts ============

    BattleArena public arena;
    MockDEXAdapter public v4Adapter;
    MockDEXAdapter public camelotAdapter;
    MockScoringEngine public scoringEngine;
    MockLeaderboard public leaderboardContract;

    // ============ Test Accounts ============

    address public owner = makeAddr("owner");
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public charlie = makeAddr("charlie");
    address public resolver = makeAddr("resolver");

    // ============ Test Tokens ============

    MockERC20 public weth;
    MockERC20 public usdc;
    address public WETH;
    address public USDC;

    // ============ Token IDs ============

    uint256 public constant ALICE_V4_TOKEN = 1001;
    uint256 public constant BOB_V4_TOKEN = 1002;
    uint256 public constant ALICE_CAMELOT_TOKEN = 2001;
    uint256 public constant BOB_CAMELOT_TOKEN = 2002;
    uint256 public constant CHARLIE_V4_TOKEN = 3001; // Different value for tolerance tests

    // ============ Constants ============

    uint256 public constant TEST_DURATION = 1 hours;
    uint256 public constant USD_VALUE = 1000e8; // $1000 in 8 decimals

    // ============ Setup ============

    function setUp() public virtual {
        vm.startPrank(owner);

        // Deploy tokens
        weth = new MockERC20("Wrapped Ether", "WETH", 18);
        usdc = new MockERC20("USD Coin", "USDC", 6);
        WETH = address(weth);
        USDC = address(usdc);

        // Deploy mocks
        scoringEngine = new MockScoringEngine();
        leaderboardContract = new MockLeaderboard();

        // Deploy arena
        arena = new BattleArena(address(scoringEngine), address(leaderboardContract));

        // Deploy adapters
        v4Adapter = new MockDEXAdapter("uniswap_v4", address(arena));
        camelotAdapter = new MockDEXAdapter("camelot_v3", address(arena));

        // Register adapters
        arena.registerAdapter(IBattleArena.DexType.UNISWAP_V4, address(v4Adapter));
        arena.registerAdapter(IBattleArena.DexType.CAMELOT_V3, address(camelotAdapter));

        // Setup positions
        _setupPositions();

        vm.stopPrank();
    }

    function _setupPositions() internal {
        // Alice's V4 position: WETH/USDC, $1000
        v4Adapter.setPosition(ALICE_V4_TOKEN, IDEXAdapter.PositionData({
            owner: alice,
            token0: WETH,
            token1: USDC,
            tickLower: -1000,
            tickUpper: 1000,
            liquidity: 1e18,
            usdValue: USD_VALUE
        }));

        // Bob's V4 position: WETH/USDC, $1000 (within tolerance)
        v4Adapter.setPosition(BOB_V4_TOKEN, IDEXAdapter.PositionData({
            owner: bob,
            token0: WETH,
            token1: USDC,
            tickLower: -800,
            tickUpper: 800,
            liquidity: 1e18,
            usdValue: USD_VALUE
        }));

        // Alice's Camelot position: WETH/USDC, $1000
        camelotAdapter.setPosition(ALICE_CAMELOT_TOKEN, IDEXAdapter.PositionData({
            owner: alice,
            token0: WETH,
            token1: USDC,
            tickLower: -500,
            tickUpper: 500,
            liquidity: 1e18,
            usdValue: USD_VALUE
        }));

        // Bob's Camelot position: WETH/USDC, $1020 (within 5% tolerance)
        camelotAdapter.setPosition(BOB_CAMELOT_TOKEN, IDEXAdapter.PositionData({
            owner: bob,
            token0: WETH,
            token1: USDC,
            tickLower: -600,
            tickUpper: 600,
            liquidity: 1e18,
            usdValue: 1020e8
        }));

        // Charlie's V4 position: much higher value ($3000) — outside tolerance
        v4Adapter.setPosition(CHARLIE_V4_TOKEN, IDEXAdapter.PositionData({
            owner: charlie,
            token0: WETH,
            token1: USDC,
            tickLower: -1000,
            tickUpper: 1000,
            liquidity: 3e18,
            usdValue: 3000e8
        }));

        // Set up fees for collection
        v4Adapter.setFeesToCollect(ALICE_V4_TOKEN, 100e6, 200e6);   // 100 WETH-unit, 200 USDC-unit
        v4Adapter.setFeesToCollect(BOB_V4_TOKEN, 150e6, 180e6);
        camelotAdapter.setFeesToCollect(ALICE_CAMELOT_TOKEN, 80e6, 160e6);
        camelotAdapter.setFeesToCollect(BOB_CAMELOT_TOKEN, 120e6, 140e6);

        // Set in-range status (default true)
        v4Adapter.setInRange(ALICE_V4_TOKEN, true);
        v4Adapter.setInRange(BOB_V4_TOKEN, true);
        camelotAdapter.setInRange(ALICE_CAMELOT_TOKEN, true);
        camelotAdapter.setInRange(BOB_CAMELOT_TOKEN, true);
    }

    // ============ Helper ============

    /// @notice Helper to create a battle and have opponent join
    function _createAndJoinBattle(
        address creator,
        IBattleArena.DexType creatorDex,
        uint256 creatorToken,
        address opponent,
        IBattleArena.DexType opponentDex,
        uint256 opponentToken,
        IBattleArena.BattleType battleType
    ) internal returns (uint256 battleId) {
        vm.prank(creator);
        battleId = arena.createBattle(creatorDex, creatorToken, TEST_DURATION, battleType);

        vm.prank(opponent);
        arena.joinBattle(battleId, opponentDex, opponentToken);
    }

    // ================================================================
    //                      CREATE BATTLE TESTS
    // ================================================================

    function testCreateBattle_Range() public {
        vm.prank(alice);
        uint256 battleId = arena.createBattle(
            IBattleArena.DexType.UNISWAP_V4,
            ALICE_V4_TOKEN,
            TEST_DURATION,
            IBattleArena.BattleType.RANGE
        );

        assertEq(battleId, 0);
        assertEq(arena.getBattleCount(), 1);

        IBattleArena.Battle memory b = arena.getBattle(0);
        assertEq(b.creator, alice);
        assertEq(b.creatorTokenId, ALICE_V4_TOKEN);
        assertEq(b.creatorValueUSD, USD_VALUE);
        assertEq(b.duration, TEST_DURATION);
        assertEq(uint8(b.battleType), uint8(IBattleArena.BattleType.RANGE));
        assertEq(uint8(b.status), uint8(IBattleArena.BattleStatus.PENDING));
        assertEq(b.token0, WETH);
        assertEq(b.token1, USDC);
    }

    function testCreateBattle_Fee() public {
        // Set fee growth for fee battle snapshot
        v4Adapter.setFeeGrowthInside(ALICE_V4_TOKEN, 100e18, 200e18);

        vm.prank(alice);
        uint256 battleId = arena.createBattle(
            IBattleArena.DexType.UNISWAP_V4,
            ALICE_V4_TOKEN,
            TEST_DURATION,
            IBattleArena.BattleType.FEE
        );

        IBattleArena.Battle memory b = arena.getBattle(battleId);
        assertEq(uint8(b.battleType), uint8(IBattleArena.BattleType.FEE));
        assertEq(b.creatorStartFeeGrowth0, 100e18);
        assertEq(b.creatorStartFeeGrowth1, 200e18);
        assertEq(b.creatorLiquidity, 1e18);
    }

    function testCreateBattle_CamelotDex() public {
        vm.prank(alice);
        uint256 battleId = arena.createBattle(
            IBattleArena.DexType.CAMELOT_V3,
            ALICE_CAMELOT_TOKEN,
            TEST_DURATION,
            IBattleArena.BattleType.RANGE
        );

        IBattleArena.Battle memory b = arena.getBattle(battleId);
        assertEq(uint8(b.creatorDex), uint8(IBattleArena.DexType.CAMELOT_V3));
    }

    function testCreateBattle_EmitsBattleCreated() public {
        vm.expectEmit(true, true, false, true);
        emit IBattleArena.BattleCreated(
            0,
            alice,
            IBattleArena.DexType.UNISWAP_V4,
            IBattleArena.BattleType.RANGE,
            ALICE_V4_TOKEN,
            TEST_DURATION,
            USD_VALUE
        );

        vm.prank(alice);
        arena.createBattle(
            IBattleArena.DexType.UNISWAP_V4,
            ALICE_V4_TOKEN,
            TEST_DURATION,
            IBattleArena.BattleType.RANGE
        );
    }

    function testCreateBattle_RevertDurationTooShort() public {
        vm.prank(alice);
        vm.expectRevert(BattleArena.BattleDurationTooShort.selector);
        arena.createBattle(
            IBattleArena.DexType.UNISWAP_V4,
            ALICE_V4_TOKEN,
            1 minutes, // Below 5 min minimum
            IBattleArena.BattleType.RANGE
        );
    }

    function testCreateBattle_RevertDurationTooLong() public {
        vm.prank(alice);
        vm.expectRevert(BattleArena.BattleDurationTooLong.selector);
        arena.createBattle(
            IBattleArena.DexType.UNISWAP_V4,
            ALICE_V4_TOKEN,
            8 days, // Above 7 day maximum
            IBattleArena.BattleType.RANGE
        );
    }

    function testCreateBattle_RevertNoLiquidity() public {
        v4Adapter.setPosition(9999, IDEXAdapter.PositionData({
            owner: alice,
            token0: WETH,
            token1: USDC,
            tickLower: -100,
            tickUpper: 100,
            liquidity: 0,
            usdValue: 0
        }));

        vm.prank(alice);
        vm.expectRevert(BattleArena.PositionHasNoLiquidity.selector);
        arena.createBattle(
            IBattleArena.DexType.UNISWAP_V4,
            9999,
            TEST_DURATION,
            IBattleArena.BattleType.RANGE
        );
    }

    function testCreateBattle_RevertAdapterNotRegistered() public {
        // Deploy a new arena without adapters
        vm.prank(owner);
        BattleArena freshArena = new BattleArena(address(scoringEngine), address(leaderboardContract));

        vm.prank(alice);
        vm.expectRevert(BattleArena.AdapterNotRegistered.selector);
        freshArena.createBattle(
            IBattleArena.DexType.UNISWAP_V4,
            ALICE_V4_TOKEN,
            TEST_DURATION,
            IBattleArena.BattleType.RANGE
        );
    }

    function testCreateBattle_RevertWhenPaused() public {
        vm.prank(owner);
        arena.pause();

        vm.prank(alice);
        vm.expectRevert(); // EnforcedPause
        arena.createBattle(
            IBattleArena.DexType.UNISWAP_V4,
            ALICE_V4_TOKEN,
            TEST_DURATION,
            IBattleArena.BattleType.RANGE
        );
    }

    function testCreateBattle_TransfersAndLocks() public {
        vm.prank(alice);
        arena.createBattle(
            IBattleArena.DexType.UNISWAP_V4,
            ALICE_V4_TOKEN,
            TEST_DURATION,
            IBattleArena.BattleType.RANGE
        );

        // Position should be transferred to arena
        assertTrue(v4Adapter.transferred(ALICE_V4_TOKEN));
        // Position should be locked
        assertTrue(v4Adapter.locked(ALICE_V4_TOKEN));
    }

    // ================================================================
    //                      JOIN BATTLE TESTS
    // ================================================================

    function testJoinBattle_SameDex() public {
        vm.prank(alice);
        uint256 battleId = arena.createBattle(
            IBattleArena.DexType.UNISWAP_V4,
            ALICE_V4_TOKEN,
            TEST_DURATION,
            IBattleArena.BattleType.RANGE
        );

        vm.prank(bob);
        arena.joinBattle(battleId, IBattleArena.DexType.UNISWAP_V4, BOB_V4_TOKEN);

        IBattleArena.Battle memory b = arena.getBattle(battleId);
        assertEq(b.opponent, bob);
        assertEq(b.opponentTokenId, BOB_V4_TOKEN);
        assertEq(uint8(b.status), uint8(IBattleArena.BattleStatus.ACTIVE));
        assertEq(b.startTime, block.timestamp);
    }

    function testJoinBattle_CrossDex() public {
        vm.prank(alice);
        uint256 battleId = arena.createBattle(
            IBattleArena.DexType.UNISWAP_V4,
            ALICE_V4_TOKEN,
            TEST_DURATION,
            IBattleArena.BattleType.RANGE
        );

        vm.prank(bob);
        arena.joinBattle(battleId, IBattleArena.DexType.CAMELOT_V3, BOB_CAMELOT_TOKEN);

        IBattleArena.Battle memory b = arena.getBattle(battleId);
        assertEq(b.opponent, bob);
        assertEq(uint8(b.creatorDex), uint8(IBattleArena.DexType.UNISWAP_V4));
        assertEq(uint8(b.opponentDex), uint8(IBattleArena.DexType.CAMELOT_V3));
        assertEq(uint8(b.status), uint8(IBattleArena.BattleStatus.ACTIVE));
    }

    function testJoinBattle_FeeBattleSnapshots() public {
        v4Adapter.setFeeGrowthInside(ALICE_V4_TOKEN, 100e18, 200e18);
        camelotAdapter.setFeeGrowthInside(BOB_CAMELOT_TOKEN, 300e18, 400e18);

        vm.prank(alice);
        uint256 battleId = arena.createBattle(
            IBattleArena.DexType.UNISWAP_V4,
            ALICE_V4_TOKEN,
            TEST_DURATION,
            IBattleArena.BattleType.FEE
        );

        vm.prank(bob);
        arena.joinBattle(battleId, IBattleArena.DexType.CAMELOT_V3, BOB_CAMELOT_TOKEN);

        IBattleArena.Battle memory b = arena.getBattle(battleId);
        assertEq(b.opponentStartFeeGrowth0, 300e18);
        assertEq(b.opponentStartFeeGrowth1, 400e18);
    }

    function testJoinBattle_EmitsBattleJoined() public {
        vm.prank(alice);
        uint256 battleId = arena.createBattle(
            IBattleArena.DexType.UNISWAP_V4,
            ALICE_V4_TOKEN,
            TEST_DURATION,
            IBattleArena.BattleType.RANGE
        );

        vm.expectEmit(true, true, false, true);
        emit IBattleArena.BattleJoined(
            battleId,
            bob,
            IBattleArena.DexType.UNISWAP_V4,
            BOB_V4_TOKEN,
            USD_VALUE,
            block.timestamp
        );

        vm.prank(bob);
        arena.joinBattle(battleId, IBattleArena.DexType.UNISWAP_V4, BOB_V4_TOKEN);
    }

    function testJoinBattle_RevertCannotJoinOwn() public {
        vm.prank(alice);
        uint256 battleId = arena.createBattle(
            IBattleArena.DexType.UNISWAP_V4,
            ALICE_V4_TOKEN,
            TEST_DURATION,
            IBattleArena.BattleType.RANGE
        );

        // Alice tries to join own battle with Camelot position
        vm.prank(alice);
        vm.expectRevert(BattleArena.CannotJoinOwnBattle.selector);
        arena.joinBattle(battleId, IBattleArena.DexType.CAMELOT_V3, ALICE_CAMELOT_TOKEN);
    }

    function testJoinBattle_RevertNotPending() public {
        uint256 battleId = _createAndJoinBattle(
            alice, IBattleArena.DexType.UNISWAP_V4, ALICE_V4_TOKEN,
            bob, IBattleArena.DexType.UNISWAP_V4, BOB_V4_TOKEN,
            IBattleArena.BattleType.RANGE
        );

        // Charlie tries to join an already-active battle
        vm.prank(charlie);
        vm.expectRevert(BattleArena.BattleNotPending.selector);
        arena.joinBattle(battleId, IBattleArena.DexType.UNISWAP_V4, CHARLIE_V4_TOKEN);
    }

    function testJoinBattle_RevertTokenPairMismatch() public {
        vm.prank(alice);
        uint256 battleId = arena.createBattle(
            IBattleArena.DexType.UNISWAP_V4,
            ALICE_V4_TOKEN,
            TEST_DURATION,
            IBattleArena.BattleType.RANGE
        );

        // Set Bob's position to different token pair
        v4Adapter.setPosition(BOB_V4_TOKEN, IDEXAdapter.PositionData({
            owner: bob,
            token0: WETH,
            token1: address(0xBEEF), // Different token1
            tickLower: -800,
            tickUpper: 800,
            liquidity: 1e18,
            usdValue: USD_VALUE
        }));

        vm.prank(bob);
        vm.expectRevert(BattleArena.TokenPairMismatch.selector);
        arena.joinBattle(battleId, IBattleArena.DexType.UNISWAP_V4, BOB_V4_TOKEN);
    }

    function testJoinBattle_RevertValueOutOfTolerance() public {
        vm.prank(alice);
        uint256 battleId = arena.createBattle(
            IBattleArena.DexType.UNISWAP_V4,
            ALICE_V4_TOKEN,
            TEST_DURATION,
            IBattleArena.BattleType.RANGE
        );

        // Charlie's position is $3000, Alice's is $1000 — way outside 5% tolerance
        vm.prank(charlie);
        vm.expectRevert(BattleArena.LPValueNotWithinTolerance.selector);
        arena.joinBattle(battleId, IBattleArena.DexType.UNISWAP_V4, CHARLIE_V4_TOKEN);
    }

    function testJoinBattle_RevertBattleDoesNotExist() public {
        vm.prank(bob);
        vm.expectRevert(BattleArena.BattleDoesNotExist.selector);
        arena.joinBattle(999, IBattleArena.DexType.UNISWAP_V4, BOB_V4_TOKEN);
    }

    // ================================================================
    //                 UPDATE BATTLE STATUS TESTS
    // ================================================================

    function testUpdateBattleStatus_RangeBattle() public {
        uint256 battleId = _createAndJoinBattle(
            alice, IBattleArena.DexType.UNISWAP_V4, ALICE_V4_TOKEN,
            bob, IBattleArena.DexType.UNISWAP_V4, BOB_V4_TOKEN,
            IBattleArena.BattleType.RANGE
        );

        // Both in range — advance 30 minutes
        vm.warp(block.timestamp + 30 minutes);
        arena.updateBattleStatus(battleId);

        IBattleArena.Battle memory b = arena.getBattle(battleId);
        assertEq(b.creatorInRangeTime, 30 minutes);
        assertEq(b.opponentInRangeTime, 30 minutes);
    }

    function testUpdateBattleStatus_OneOutOfRange() public {
        uint256 battleId = _createAndJoinBattle(
            alice, IBattleArena.DexType.UNISWAP_V4, ALICE_V4_TOKEN,
            bob, IBattleArena.DexType.UNISWAP_V4, BOB_V4_TOKEN,
            IBattleArena.BattleType.RANGE
        );

        // Set Bob's position out of range
        v4Adapter.setInRange(BOB_V4_TOKEN, false);

        vm.warp(block.timestamp + 30 minutes);
        arena.updateBattleStatus(battleId);

        IBattleArena.Battle memory b = arena.getBattle(battleId);
        assertEq(b.creatorInRangeTime, 30 minutes);
        assertEq(b.opponentInRangeTime, 0); // Bob was out of range
    }

    function testUpdateBattleStatus_CapsAtBattleEnd() public {
        uint256 battleId = _createAndJoinBattle(
            alice, IBattleArena.DexType.UNISWAP_V4, ALICE_V4_TOKEN,
            bob, IBattleArena.DexType.UNISWAP_V4, BOB_V4_TOKEN,
            IBattleArena.BattleType.RANGE
        );

        // Advance past battle end
        vm.warp(block.timestamp + TEST_DURATION + 1 hours);
        arena.updateBattleStatus(battleId);

        IBattleArena.Battle memory b = arena.getBattle(battleId);
        // Should cap at TEST_DURATION, not extend beyond
        assertEq(b.creatorInRangeTime, TEST_DURATION);
        assertEq(uint8(b.status), uint8(IBattleArena.BattleStatus.EXPIRED));
    }

    function testUpdateBattleStatus_MultipleUpdates() public {
        uint256 battleId = _createAndJoinBattle(
            alice, IBattleArena.DexType.UNISWAP_V4, ALICE_V4_TOKEN,
            bob, IBattleArena.DexType.UNISWAP_V4, BOB_V4_TOKEN,
            IBattleArena.BattleType.RANGE
        );

        // First update: 10 min, both in range
        vm.warp(block.timestamp + 10 minutes);
        arena.updateBattleStatus(battleId);

        // Second update: 20 more min, Bob goes out of range
        v4Adapter.setInRange(BOB_V4_TOKEN, false);
        vm.warp(block.timestamp + 20 minutes);
        arena.updateBattleStatus(battleId);

        IBattleArena.Battle memory b = arena.getBattle(battleId);
        assertEq(b.creatorInRangeTime, 30 minutes); // 10 + 20
        assertEq(b.opponentInRangeTime, 10 minutes); // Only first 10 min
    }

    function testUpdateBattleStatus_FeeBattleNoOp() public {
        v4Adapter.setFeeGrowthInside(ALICE_V4_TOKEN, 100e18, 200e18);
        v4Adapter.setFeeGrowthInside(BOB_V4_TOKEN, 100e18, 200e18);

        uint256 battleId = _createAndJoinBattle(
            alice, IBattleArena.DexType.UNISWAP_V4, ALICE_V4_TOKEN,
            bob, IBattleArena.DexType.UNISWAP_V4, BOB_V4_TOKEN,
            IBattleArena.BattleType.FEE
        );

        // Fee battles should return early (no in-range tracking)
        vm.warp(block.timestamp + 30 minutes);
        arena.updateBattleStatus(battleId);

        IBattleArena.Battle memory b = arena.getBattle(battleId);
        assertEq(b.creatorInRangeTime, 0); // No range tracking for fee battles
    }

    function testUpdateBattleStatus_RevertNotActive() public {
        vm.prank(alice);
        uint256 battleId = arena.createBattle(
            IBattleArena.DexType.UNISWAP_V4,
            ALICE_V4_TOKEN,
            TEST_DURATION,
            IBattleArena.BattleType.RANGE
        );

        // Battle is PENDING (no opponent), so update should revert
        vm.expectRevert(BattleArena.BattleNotActive.selector);
        arena.updateBattleStatus(battleId);
    }

    function testUpdateBattleStatus_EmitsBattleStatusUpdated() public {
        uint256 battleId = _createAndJoinBattle(
            alice, IBattleArena.DexType.UNISWAP_V4, ALICE_V4_TOKEN,
            bob, IBattleArena.DexType.UNISWAP_V4, BOB_V4_TOKEN,
            IBattleArena.BattleType.RANGE
        );

        vm.warp(block.timestamp + 10 minutes);

        vm.expectEmit(true, false, false, true);
        emit IBattleArena.BattleStatusUpdated(
            battleId,
            true,  // creator in range
            true,  // opponent in range
            10 minutes,
            10 minutes
        );

        arena.updateBattleStatus(battleId);
    }

    // ================================================================
    //                    RESOLVE BATTLE TESTS
    // ================================================================

    function testResolveBattle_RangeCreatorWins() public {
        uint256 battleId = _createAndJoinBattle(
            alice, IBattleArena.DexType.UNISWAP_V4, ALICE_V4_TOKEN,
            bob, IBattleArena.DexType.UNISWAP_V4, BOB_V4_TOKEN,
            IBattleArena.BattleType.RANGE
        );

        // Alice in range whole time, Bob out for part
        v4Adapter.setInRange(BOB_V4_TOKEN, false);

        vm.warp(block.timestamp + TEST_DURATION + 1);

        vm.prank(resolver);
        arena.resolveBattle(battleId);

        IBattleArena.Battle memory b = arena.getBattle(battleId);
        assertEq(b.winner, alice);
        assertEq(uint8(b.status), uint8(IBattleArena.BattleStatus.RESOLVED));
    }

    function testResolveBattle_RangeOpponentWins() public {
        uint256 battleId = _createAndJoinBattle(
            alice, IBattleArena.DexType.UNISWAP_V4, ALICE_V4_TOKEN,
            bob, IBattleArena.DexType.UNISWAP_V4, BOB_V4_TOKEN,
            IBattleArena.BattleType.RANGE
        );

        // Alice out of range, Bob in range
        // This means Alice gets 0 in-range time, Bob gets full duration
        v4Adapter.setInRange(ALICE_V4_TOKEN, false);

        vm.warp(block.timestamp + TEST_DURATION + 1);

        vm.prank(resolver);
        arena.resolveBattle(battleId);

        IBattleArena.Battle memory b = arena.getBattle(battleId);
        assertEq(b.winner, bob);
    }

    function testResolveBattle_TieGoesToCreator() public {
        // Both in range the entire time → equal scores → tie goes to creator
        uint256 battleId = _createAndJoinBattle(
            alice, IBattleArena.DexType.UNISWAP_V4, ALICE_V4_TOKEN,
            bob, IBattleArena.DexType.UNISWAP_V4, BOB_V4_TOKEN,
            IBattleArena.BattleType.RANGE
        );

        vm.warp(block.timestamp + TEST_DURATION + 1);

        vm.prank(resolver);
        arena.resolveBattle(battleId);

        IBattleArena.Battle memory b = arena.getBattle(battleId);
        assertEq(b.winner, alice); // Tie goes to creator
    }

    function testResolveBattle_FeeDistribution() public {
        uint256 battleId = _createAndJoinBattle(
            alice, IBattleArena.DexType.UNISWAP_V4, ALICE_V4_TOKEN,
            bob, IBattleArena.DexType.UNISWAP_V4, BOB_V4_TOKEN,
            IBattleArena.BattleType.RANGE
        );

        // Set fees: Alice=100+200, Bob=150+180
        // Total token0 fees = 250, Total token1 fees = 380
        v4Adapter.setFeesToCollect(ALICE_V4_TOKEN, 100e6, 200e6);
        v4Adapter.setFeesToCollect(BOB_V4_TOKEN, 150e6, 180e6);

        vm.warp(block.timestamp + TEST_DURATION + 1);

        uint256 aliceWethBefore = weth.balanceOf(alice);
        uint256 aliceUsdcBefore = usdc.balanceOf(alice);
        uint256 resolverWethBefore = weth.balanceOf(resolver);
        uint256 resolverUsdcBefore = usdc.balanceOf(resolver);

        vm.prank(resolver);
        arena.resolveBattle(battleId);

        // Winner (alice) gets 99%, resolver gets 1%
        // token0: 250e6 → winner: 247.5e6, resolver: 2.5e6
        // token1: 380e6 → winner: 376.2e6, resolver: 3.8e6
        uint256 aliceWeth = weth.balanceOf(alice) - aliceWethBefore;
        uint256 aliceUsdc = usdc.balanceOf(alice) - aliceUsdcBefore;
        uint256 resolverWeth = weth.balanceOf(resolver) - resolverWethBefore;
        uint256 resolverUsdc = usdc.balanceOf(resolver) - resolverUsdcBefore;

        assertEq(resolverWeth, (250e6 * 100) / 10000); // 1% of 250e6
        assertEq(aliceWeth, 250e6 - resolverWeth);     // 99% of 250e6
        assertEq(resolverUsdc, (380e6 * 100) / 10000); // 1% of 380e6
        assertEq(aliceUsdc, 380e6 - resolverUsdc);     // 99% of 380e6
    }

    function testResolveBattle_CrossDex() public {
        uint256 battleId = _createAndJoinBattle(
            alice, IBattleArena.DexType.UNISWAP_V4, ALICE_V4_TOKEN,
            bob, IBattleArena.DexType.CAMELOT_V3, BOB_CAMELOT_TOKEN,
            IBattleArena.BattleType.RANGE
        );

        vm.warp(block.timestamp + TEST_DURATION + 1);

        vm.prank(resolver);
        arena.resolveBattle(battleId);

        IBattleArena.Battle memory b = arena.getBattle(battleId);
        assertEq(uint8(b.status), uint8(IBattleArena.BattleStatus.RESOLVED));
        assertTrue(b.winner == alice || b.winner == bob);
    }

    function testResolveBattle_ReturnsPositions() public {
        uint256 battleId = _createAndJoinBattle(
            alice, IBattleArena.DexType.UNISWAP_V4, ALICE_V4_TOKEN,
            bob, IBattleArena.DexType.UNISWAP_V4, BOB_V4_TOKEN,
            IBattleArena.BattleType.RANGE
        );

        vm.warp(block.timestamp + TEST_DURATION + 1);

        vm.prank(resolver);
        arena.resolveBattle(battleId);

        // Both positions should be unlocked and transferred out
        assertFalse(v4Adapter.locked(ALICE_V4_TOKEN));
        assertFalse(v4Adapter.locked(BOB_V4_TOKEN));
        assertTrue(v4Adapter.transferredOut(ALICE_V4_TOKEN));
        assertTrue(v4Adapter.transferredOut(BOB_V4_TOKEN));
    }

    function testResolveBattle_UpdatesLeaderboard() public {
        uint256 battleId = _createAndJoinBattle(
            alice, IBattleArena.DexType.UNISWAP_V4, ALICE_V4_TOKEN,
            bob, IBattleArena.DexType.UNISWAP_V4, BOB_V4_TOKEN,
            IBattleArena.BattleType.RANGE
        );

        vm.warp(block.timestamp + TEST_DURATION + 1);

        vm.prank(resolver);
        arena.resolveBattle(battleId);

        assertTrue(leaderboardContract.resultRecorded());
    }

    function testResolveBattle_RevertNotExpired() public {
        uint256 battleId = _createAndJoinBattle(
            alice, IBattleArena.DexType.UNISWAP_V4, ALICE_V4_TOKEN,
            bob, IBattleArena.DexType.UNISWAP_V4, BOB_V4_TOKEN,
            IBattleArena.BattleType.RANGE
        );

        // Don't advance time
        vm.prank(resolver);
        vm.expectRevert(BattleArena.BattleNotExpired.selector);
        arena.resolveBattle(battleId);
    }

    function testResolveBattle_RevertAlreadyResolved() public {
        uint256 battleId = _createAndJoinBattle(
            alice, IBattleArena.DexType.UNISWAP_V4, ALICE_V4_TOKEN,
            bob, IBattleArena.DexType.UNISWAP_V4, BOB_V4_TOKEN,
            IBattleArena.BattleType.RANGE
        );

        vm.warp(block.timestamp + TEST_DURATION + 1);

        vm.prank(resolver);
        arena.resolveBattle(battleId);

        vm.prank(resolver);
        vm.expectRevert(BattleArena.BattleAlreadyResolved.selector);
        arena.resolveBattle(battleId);
    }

    function testResolveBattle_RevertNoOpponent() public {
        vm.prank(alice);
        uint256 battleId = arena.createBattle(
            IBattleArena.DexType.UNISWAP_V4,
            ALICE_V4_TOKEN,
            TEST_DURATION,
            IBattleArena.BattleType.RANGE
        );

        vm.warp(block.timestamp + TEST_DURATION + 1);

        vm.prank(resolver);
        vm.expectRevert(BattleArena.NoOpponentJoined.selector);
        arena.resolveBattle(battleId);
    }

    // ================================================================
    //                  EMERGENCY WITHDRAW TESTS
    // ================================================================

    function testEmergencyWithdraw_PendingBattle() public {
        vm.prank(alice);
        uint256 battleId = arena.createBattle(
            IBattleArena.DexType.UNISWAP_V4,
            ALICE_V4_TOKEN,
            TEST_DURATION,
            IBattleArena.BattleType.RANGE
        );

        // Creator can withdraw from pending battle immediately
        vm.prank(alice);
        arena.emergencyWithdraw(battleId);

        IBattleArena.Battle memory b = arena.getBattle(battleId);
        assertEq(uint8(b.status), uint8(IBattleArena.BattleStatus.RESOLVED));
        assertTrue(v4Adapter.transferredOut(ALICE_V4_TOKEN));
    }

    function testEmergencyWithdraw_ActiveBattleAfterBuffer() public {
        uint256 battleId = _createAndJoinBattle(
            alice, IBattleArena.DexType.UNISWAP_V4, ALICE_V4_TOKEN,
            bob, IBattleArena.DexType.UNISWAP_V4, BOB_V4_TOKEN,
            IBattleArena.BattleType.RANGE
        );

        // Advance past duration + emergency buffer (1 day)
        vm.warp(block.timestamp + TEST_DURATION + 1 days + 1);

        vm.prank(alice);
        arena.emergencyWithdraw(battleId);

        IBattleArena.Battle memory b = arena.getBattle(battleId);
        assertEq(uint8(b.status), uint8(IBattleArena.BattleStatus.RESOLVED));
    }

    function testEmergencyWithdraw_RevertTooEarly() public {
        uint256 battleId = _createAndJoinBattle(
            alice, IBattleArena.DexType.UNISWAP_V4, ALICE_V4_TOKEN,
            bob, IBattleArena.DexType.UNISWAP_V4, BOB_V4_TOKEN,
            IBattleArena.BattleType.RANGE
        );

        // Only advance to after battle end, but before emergency buffer
        vm.warp(block.timestamp + TEST_DURATION + 1);

        vm.prank(alice);
        vm.expectRevert(BattleArena.BattleNotExpiredForEmergency.selector);
        arena.emergencyWithdraw(battleId);
    }

    function testEmergencyWithdraw_RevertNotParticipant() public {
        uint256 battleId = _createAndJoinBattle(
            alice, IBattleArena.DexType.UNISWAP_V4, ALICE_V4_TOKEN,
            bob, IBattleArena.DexType.UNISWAP_V4, BOB_V4_TOKEN,
            IBattleArena.BattleType.RANGE
        );

        vm.warp(block.timestamp + TEST_DURATION + 1 days + 1);

        vm.prank(charlie);
        vm.expectRevert(BattleArena.NotBattleParticipant.selector);
        arena.emergencyWithdraw(battleId);
    }

    function testEmergencyWithdraw_RevertAlreadyResolved() public {
        uint256 battleId = _createAndJoinBattle(
            alice, IBattleArena.DexType.UNISWAP_V4, ALICE_V4_TOKEN,
            bob, IBattleArena.DexType.UNISWAP_V4, BOB_V4_TOKEN,
            IBattleArena.BattleType.RANGE
        );

        vm.warp(block.timestamp + TEST_DURATION + 1);
        vm.prank(resolver);
        arena.resolveBattle(battleId);

        vm.warp(block.timestamp + 1 days + 1);
        vm.prank(alice);
        vm.expectRevert(BattleArena.BattleAlreadyResolved.selector);
        arena.emergencyWithdraw(battleId);
    }

    // ================================================================
    //                     VIEW FUNCTION TESTS
    // ================================================================

    function testGetBattle() public {
        vm.prank(alice);
        arena.createBattle(
            IBattleArena.DexType.UNISWAP_V4,
            ALICE_V4_TOKEN,
            TEST_DURATION,
            IBattleArena.BattleType.RANGE
        );

        IBattleArena.Battle memory b = arena.getBattle(0);
        assertEq(b.creator, alice);
        assertEq(b.duration, TEST_DURATION);
    }

    function testGetBattleCount() public {
        assertEq(arena.getBattleCount(), 0);

        vm.prank(alice);
        arena.createBattle(
            IBattleArena.DexType.UNISWAP_V4,
            ALICE_V4_TOKEN,
            TEST_DURATION,
            IBattleArena.BattleType.RANGE
        );

        assertEq(arena.getBattleCount(), 1);
    }

    function testGetBattlesByStatus() public {
        // Create 2 battles — one pending, one active
        vm.prank(alice);
        arena.createBattle(
            IBattleArena.DexType.UNISWAP_V4,
            ALICE_V4_TOKEN,
            TEST_DURATION,
            IBattleArena.BattleType.RANGE
        );

        vm.prank(alice);
        arena.createBattle(
            IBattleArena.DexType.CAMELOT_V3,
            ALICE_CAMELOT_TOKEN,
            TEST_DURATION,
            IBattleArena.BattleType.RANGE
        );

        // Join second battle to make it active
        vm.prank(bob);
        arena.joinBattle(1, IBattleArena.DexType.CAMELOT_V3, BOB_CAMELOT_TOKEN);

        uint256[] memory pending = arena.getBattlesByStatus(IBattleArena.BattleStatus.PENDING);
        uint256[] memory active = arena.getBattlesByStatus(IBattleArena.BattleStatus.ACTIVE);

        assertEq(pending.length, 1);
        assertEq(pending[0], 0);
        assertEq(active.length, 1);
        assertEq(active[0], 1);
    }

    function testGetPlayerBattles() public {
        vm.prank(alice);
        arena.createBattle(
            IBattleArena.DexType.UNISWAP_V4,
            ALICE_V4_TOKEN,
            TEST_DURATION,
            IBattleArena.BattleType.RANGE
        );

        vm.prank(bob);
        arena.joinBattle(0, IBattleArena.DexType.UNISWAP_V4, BOB_V4_TOKEN);

        uint256[] memory aliceBattles = arena.getPlayerBattles(alice);
        uint256[] memory bobBattles = arena.getPlayerBattles(bob);
        uint256[] memory charlieBattles = arena.getPlayerBattles(charlie);

        assertEq(aliceBattles.length, 1);
        assertEq(bobBattles.length, 1);
        assertEq(charlieBattles.length, 0);
    }

    function testIsBattleExpired() public {
        uint256 battleId = _createAndJoinBattle(
            alice, IBattleArena.DexType.UNISWAP_V4, ALICE_V4_TOKEN,
            bob, IBattleArena.DexType.UNISWAP_V4, BOB_V4_TOKEN,
            IBattleArena.BattleType.RANGE
        );

        assertFalse(arena.isBattleExpired(battleId));

        vm.warp(block.timestamp + TEST_DURATION);
        assertTrue(arena.isBattleExpired(battleId));
    }

    // ================================================================
    //                     ADMIN FUNCTION TESTS
    // ================================================================

    function testRegisterAdapter() public {
        MockDEXAdapter newAdapter = new MockDEXAdapter("new_dex", address(arena));

        vm.prank(owner);
        arena.registerAdapter(IBattleArena.DexType.UNISWAP_V4, address(newAdapter));
    }

    function testRegisterAdapter_RevertNotOwner() public {
        vm.prank(alice);
        vm.expectRevert(BattleArena.NotOwner.selector);
        arena.registerAdapter(IBattleArena.DexType.UNISWAP_V4, address(v4Adapter));
    }

    function testRegisterAdapter_RevertZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(BattleArena.ZeroAddress.selector);
        arena.registerAdapter(IBattleArena.DexType.UNISWAP_V4, address(0));
    }

    function testPauseUnpause() public {
        vm.prank(owner);
        arena.pause();

        vm.prank(alice);
        vm.expectRevert();
        arena.createBattle(
            IBattleArena.DexType.UNISWAP_V4,
            ALICE_V4_TOKEN,
            TEST_DURATION,
            IBattleArena.BattleType.RANGE
        );

        vm.prank(owner);
        arena.unpause();

        vm.prank(alice);
        arena.createBattle(
            IBattleArena.DexType.UNISWAP_V4,
            ALICE_V4_TOKEN,
            TEST_DURATION,
            IBattleArena.BattleType.RANGE
        );
    }

    function testOnlyOwnerAdmin() public {
        vm.startPrank(alice);

        vm.expectRevert(BattleArena.NotOwner.selector);
        arena.setScoringEngine(address(0x1));

        vm.expectRevert(BattleArena.NotOwner.selector);
        arena.setLeaderboard(address(0x1));

        vm.expectRevert(BattleArena.NotOwner.selector);
        arena.pause();

        vm.expectRevert(BattleArena.NotOwner.selector);
        arena.transferOwnership(alice);

        vm.stopPrank();
    }

    function testTransferOwnership() public {
        vm.prank(owner);
        arena.transferOwnership(alice);
        assertEq(arena.owner(), alice);

        // Old owner can no longer call admin functions
        vm.prank(owner);
        vm.expectRevert(BattleArena.NotOwner.selector);
        arena.pause();

        // New owner can
        vm.prank(alice);
        arena.pause();
    }

    function testTransferOwnership_RevertZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(BattleArena.ZeroAddress.selector);
        arena.transferOwnership(address(0));
    }

    // ================================================================
    //                      FUZZ TESTS
    // ================================================================

    function testFuzz_CreateBattleWithDuration(uint256 duration) public {
        duration = bound(duration, arena.MIN_BATTLE_DURATION(), arena.MAX_BATTLE_DURATION());

        vm.prank(alice);
        uint256 battleId = arena.createBattle(
            IBattleArena.DexType.UNISWAP_V4,
            ALICE_V4_TOKEN,
            duration,
            IBattleArena.BattleType.RANGE
        );

        IBattleArena.Battle memory b = arena.getBattle(battleId);
        assertEq(b.duration, duration);
    }

    function testFuzz_RevertInvalidDuration(uint256 duration) public {
        vm.assume(duration < arena.MIN_BATTLE_DURATION() || duration > arena.MAX_BATTLE_DURATION());

        vm.prank(alice);
        vm.expectRevert();
        arena.createBattle(
            IBattleArena.DexType.UNISWAP_V4,
            ALICE_V4_TOKEN,
            duration,
            IBattleArena.BattleType.RANGE
        );
    }

    function testFuzz_ValueTolerance(uint256 opponentValue) public {
        // Creator value is 1000e8
        opponentValue = bound(opponentValue, 1, 10000e8);

        v4Adapter.setPosition(BOB_V4_TOKEN, IDEXAdapter.PositionData({
            owner: bob,
            token0: WETH,
            token1: USDC,
            tickLower: -800,
            tickUpper: 800,
            liquidity: 1e18,
            usdValue: opponentValue
        }));

        vm.prank(alice);
        uint256 battleId = arena.createBattle(
            IBattleArena.DexType.UNISWAP_V4,
            ALICE_V4_TOKEN,
            TEST_DURATION,
            IBattleArena.BattleType.RANGE
        );

        // Check if value is within tolerance (5%)
        uint256 maxVal = USD_VALUE > opponentValue ? USD_VALUE : opponentValue;
        uint256 diff = USD_VALUE > opponentValue ? USD_VALUE - opponentValue : opponentValue - USD_VALUE;
        bool withinTolerance = diff <= (maxVal * 500) / 10000;

        if (withinTolerance) {
            vm.prank(bob);
            arena.joinBattle(battleId, IBattleArena.DexType.UNISWAP_V4, BOB_V4_TOKEN);
            // Should succeed
            IBattleArena.Battle memory b = arena.getBattle(battleId);
            assertEq(uint8(b.status), uint8(IBattleArena.BattleStatus.ACTIVE));
        } else {
            vm.prank(bob);
            vm.expectRevert(BattleArena.LPValueNotWithinTolerance.selector);
            arena.joinBattle(battleId, IBattleArena.DexType.UNISWAP_V4, BOB_V4_TOKEN);
        }
    }

    // ================================================================
    //                      GAS TESTS
    // ================================================================

    function testGas_CreateBattle() public {
        vm.prank(alice);
        uint256 gasBefore = gasleft();
        arena.createBattle(
            IBattleArena.DexType.UNISWAP_V4,
            ALICE_V4_TOKEN,
            TEST_DURATION,
            IBattleArena.BattleType.RANGE
        );
        uint256 gasUsed = gasBefore - gasleft();
        console.log("Gas used for createBattle:", gasUsed);
        assertLt(gasUsed, 500000);
    }

    function testGas_JoinBattle() public {
        vm.prank(alice);
        uint256 battleId = arena.createBattle(
            IBattleArena.DexType.UNISWAP_V4,
            ALICE_V4_TOKEN,
            TEST_DURATION,
            IBattleArena.BattleType.RANGE
        );

        vm.prank(bob);
        uint256 gasBefore = gasleft();
        arena.joinBattle(battleId, IBattleArena.DexType.UNISWAP_V4, BOB_V4_TOKEN);
        uint256 gasUsed = gasBefore - gasleft();
        console.log("Gas used for joinBattle:", gasUsed);
        assertLt(gasUsed, 500000);
    }

    function testGas_ResolveBattle() public {
        uint256 battleId = _createAndJoinBattle(
            alice, IBattleArena.DexType.UNISWAP_V4, ALICE_V4_TOKEN,
            bob, IBattleArena.DexType.UNISWAP_V4, BOB_V4_TOKEN,
            IBattleArena.BattleType.RANGE
        );

        vm.warp(block.timestamp + TEST_DURATION + 1);

        vm.prank(resolver);
        uint256 gasBefore = gasleft();
        arena.resolveBattle(battleId);
        uint256 gasUsed = gasBefore - gasleft();
        console.log("Gas used for resolveBattle:", gasUsed);
        assertLt(gasUsed, 800000);
    }
}

// ============ MOCK CONTRACTS ============

/**
 * @title MockDEXAdapter
 * @notice Mock adapter implementing IDEXAdapter for testing the BattleArena
 */
contract MockDEXAdapter is IDEXAdapter {
    string private _dexId;
    string private constant V4_ID = "uniswap_v4";
    string private constant CAMELOT_ID = "camelot_v3";
    bool private _isV4;
    address private _arena;
    address private _nft;

    mapping(uint256 => PositionData) private _positions;
    mapping(uint256 => bool) private _inRange;
    mapping(uint256 => bool) private _locked;
    mapping(uint256 => bool) private _transferred;
    mapping(uint256 => bool) private _transferredOut;
    mapping(uint256 => uint256) private _fees0;
    mapping(uint256 => uint256) private _fees1;
    mapping(uint256 => uint256) private _feesUSD;
    mapping(uint256 => uint256) private _feeGrowth0;
    mapping(uint256 => uint256) private _feeGrowth1;

    MockERC20 private token0Mock;
    MockERC20 private token1Mock;

    constructor(string memory dexId_, address arena_) {
        _dexId = dexId_;
        _isV4 = keccak256(bytes(dexId_)) == keccak256(bytes("uniswap_v4"));
        _arena = arena_;
    }

    // ============ Setup Helpers ============

    function setPosition(uint256 tokenId, PositionData memory data) external {
        _positions[tokenId] = data;
    }

    function setInRange(uint256 tokenId, bool inRange_) external {
        _inRange[tokenId] = inRange_;
    }

    function setFeesToCollect(uint256 tokenId, uint256 fee0, uint256 fee1) external {
        _fees0[tokenId] = fee0;
        _fees1[tokenId] = fee1;
    }

    function setAccumulatedFeesUSD(uint256 tokenId, uint256 feesUSD_) external {
        _feesUSD[tokenId] = feesUSD_;
    }

    function setFeeGrowthInside(uint256 tokenId, uint256 fg0, uint256 fg1) external {
        _feeGrowth0[tokenId] = fg0;
        _feeGrowth1[tokenId] = fg1;
    }

    // ============ State Getters for Test Assertions ============

    function locked(uint256 tokenId) external view returns (bool) { return _locked[tokenId]; }
    function transferred(uint256 tokenId) external view returns (bool) { return _transferred[tokenId]; }
    function transferredOut(uint256 tokenId) external view returns (bool) { return _transferredOut[tokenId]; }

    // ============ IDEXAdapter Implementation ============

    function getPosition(uint256 tokenId) external view override returns (PositionData memory) {
        return _positions[tokenId];
    }

    function isInRange(uint256 tokenId) external view override returns (bool) {
        return _inRange[tokenId];
    }

    function getCurrentTick(uint256 /* tokenId */) external pure override returns (int24) {
        return 0;
    }

    function getAccumulatedFees(uint256 tokenId) external view override returns (uint256, uint256) {
        return (_fees0[tokenId], _fees1[tokenId]);
    }

    function getAccumulatedFeesUSD(uint256 tokenId) external view override returns (uint256) {
        return _feesUSD[tokenId];
    }

    function getFeeGrowthInside(uint256 tokenId) external view override returns (uint256, uint256) {
        return (_feeGrowth0[tokenId], _feeGrowth1[tokenId]);
    }

    function lockPosition(uint256 tokenId) external override {
        _locked[tokenId] = true;
    }

    function unlockPosition(uint256 tokenId) external override {
        _locked[tokenId] = false;
    }

    function collectFees(uint256 tokenId, address recipient)
        external
        override
        returns (uint256 collected0, uint256 collected1)
    {
        collected0 = _fees0[tokenId];
        collected1 = _fees1[tokenId];

        PositionData memory pos = _positions[tokenId];

        // Mint and transfer (simulates collecting fees from pool)
        if (collected0 > 0) {
            MockERC20(pos.token0).mint(address(this), collected0);
            MockERC20(pos.token0).transfer(recipient, collected0);
        }
        if (collected1 > 0) {
            MockERC20(pos.token1).mint(address(this), collected1);
            MockERC20(pos.token1).transfer(recipient, collected1);
        }

        _fees0[tokenId] = 0;
        _fees1[tokenId] = 0;
    }

    function transferPositionIn(address /* from */, address /* to */, uint256 tokenId) external override {
        _transferred[tokenId] = true;
    }

    function transferPositionOut(address /* to */, uint256 tokenId) external override {
        _transferredOut[tokenId] = true;
    }

    function positionNFT() external pure override returns (address) {
        return address(0);
    }

    function dexId() external pure override returns (string memory) {
        return "mock_dex";
    }
}

/**
 * @title MockScoringEngine
 * @notice Mock scoring engine for testing battle resolution
 */
contract MockScoringEngine is IScoringEngine {
    function calculateRangeScore(
        uint256 inRangeTime,
        uint256 totalTime,
        uint256 /* tickDistance */
    ) external pure override returns (uint256) {
        if (totalTime == 0) return 0;
        return (inRangeTime * 1e18) / totalTime;
    }

    function calculateFeeScore(
        uint256 feesUSD,
        uint256 lpValueUSD,
        uint256 duration
    ) external pure override returns (uint256) {
        if (lpValueUSD == 0 || duration == 0) return 0;
        return (feesUSD * 1e18) / (lpValueUSD * duration);
    }

    function determineWinner(uint256 scoreA, uint256 scoreB) external pure override returns (uint8) {
        return scoreA >= scoreB ? 1 : 2;
    }

    function calculateRewards(
        uint256 totalFees,
        uint256 resolverBps
    ) external pure override returns (uint256 winnerAmount, uint256 resolverAmount) {
        resolverAmount = (totalFees * resolverBps) / 10000;
        winnerAmount = totalFees - resolverAmount;
    }

    function normalizeCrossDex(uint256 rawScore, uint8 /* dexType */) external pure override returns (uint256) {
        return rawScore;
    }
}

/**
 * @title MockLeaderboard
 * @notice Mock leaderboard for testing arena integration
 */
contract MockLeaderboard is ILeaderboard {
    bool public resultRecorded;
    address public lastWinner;
    address public lastLoser;
    uint256 public lastBattleValue;

    function recordResult(address winner, address loser, uint256 battleValueUSD) external override {
        resultRecorded = true;
        lastWinner = winner;
        lastLoser = loser;
        lastBattleValue = battleValueUSD;
    }

    function getPlayerStats(address /* player */)
        external
        pure
        override
        returns (uint256, uint256, uint256, uint256, uint256)
    {
        return (1000, 0, 0, 0, 0);
    }
}

/**
 * @title MockERC20
 * @notice Simple ERC20 mock for testing (same as existing tests)
 */
contract MockERC20 {
    string public name;
    string public symbol;
    uint8 public decimals;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(string memory _name, string memory _symbol, uint8 _decimals) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
}
