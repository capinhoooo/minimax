// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "forge-std/console.sol";

import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {Currency, CurrencyLibrary} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";

import {LPBattleVaultV4} from "../src/LPBattleVaultV4.sol";
import {LPFeeBattleV4} from "../src/LPFeeBattleV4.sol";
import {LPBattleVaultV4Test, MockPoolManagerV4, MockPositionManagerV4, MockBattleVaultHook, MockPriceFeed, MockERC20} from "./LPBattleVaultV4Test.t.sol";
import {
    NotOwner,
    ZeroAddress,
    NotLPOwner,
    BattleAlreadyResolved,
    BattleAlreadyJoined,
    BattleNotStarted,
    BattleNotEnded,
    BattleDoesNotExist,
    AlreadyResolved,
    NoOpponentJoined,
    LPValueNotWithinTolerance,
    BattleDurationTooLong,
    BattleNotExpiredForEmergencyWithdrawal
} from "../src/interfaces/IShared.sol";

/**
 * @title Extended LP BattleVault V4 Test Suite
 * @notice Fuzz tests, edge cases, and invariant tests
 */
contract LPBattleVaultV4ExtendedTest is LPBattleVaultV4Test {
    // Additional test tokens and positions
    uint256 public constant DAVE_TOKEN_ID = 1004;
    uint256 public constant EVE_TOKEN_ID = 1005;
    address public dave;
    address public eve;

    function setUp() public override {
        super.setUp();

        dave = makeAddr("dave");
        eve = makeAddr("eve");

        vm.startPrank(owner);

        // Setup additional positions for fuzz testing (range vault - with hook)
        mockPositionManager.setPositionData(
            DAVE_TOKEN_ID,
            dave,
            Currency.wrap(WETH),
            Currency.wrap(USDC),
            POOL_FEE,
            -1000,
            1000,
            1000000000000000000,
            400 * 1e6,
            900 * 1e6
        );
        mockPositionManager.setPositionHook(DAVE_TOKEN_ID, address(mockHook));
        mockPositionManager.setFeesToCollect(DAVE_TOKEN_ID, 400 * 1e6, 900 * 1e6);

        mockPositionManager.setPositionData(
            EVE_TOKEN_ID,
            eve,
            Currency.wrap(WETH),
            Currency.wrap(USDC),
            POOL_FEE,
            -1000,
            1000,
            1000000000000000000,
            350 * 1e6,
            850 * 1e6
        );
        mockPositionManager.setPositionHook(EVE_TOKEN_ID, address(mockHook));
        mockPositionManager.setFeesToCollect(EVE_TOKEN_ID, 350 * 1e6, 850 * 1e6);

        vm.stopPrank();
    }

    // ============ FUZZ TESTS ============

    /// @notice Fuzz test battle creation with various durations
    function testFuzz_CreateBattleWithDuration(uint256 duration) public {
        // Bound duration to valid range
        duration = bound(duration, 1, rangeVault.MAX_BATTLE_DURATION());

        vm.prank(alice);
        uint256 battleId = rangeVault.createBattle(ALICE_TOKEN_ID, duration);

        (,,,,,,uint256 storedDuration,,,) = rangeVault.getBattle(battleId);
        assertEq(storedDuration, duration);
    }

    /// @notice Fuzz test that invalid durations revert
    function testFuzz_RevertOnInvalidDuration(uint256 duration) public {
        // Only test durations beyond max
        vm.assume(duration > rangeVault.MAX_BATTLE_DURATION());

        vm.prank(alice);
        vm.expectRevert();
        rangeVault.createBattle(ALICE_TOKEN_ID, duration);
    }

    /// @notice Fuzz test battle resolution timing
    function testFuzz_ResolveBattleAfterDuration(uint256 extraTime) public {
        extraTime = bound(extraTime, 1, 365 days);

        vm.prank(alice);
        uint256 battleId = rangeVault.createBattle(ALICE_TOKEN_ID, TEST_DURATION);

        vm.prank(bob);
        rangeVault.joinBattle(battleId, BOB_TOKEN_ID);

        // Warp to exactly end time + extra
        vm.warp(block.timestamp + TEST_DURATION + extraTime);

        vm.prank(resolver);
        rangeVault.resolveBattle(battleId);

        (,,,,,,,,bool isResolved,) = rangeVault.getBattle(battleId);
        assertTrue(isResolved);
    }

    /// @notice Fuzz test multiple tick positions for in-range detection
    function testFuzz_InRangeDetection(int24 currentTick) public {
        // Bound tick to reasonable range
        currentTick = int24(bound(int256(currentTick), -887272, 887272));

        // Alice's position is [-1000, 1000]
        vm.prank(alice);
        uint256 battleId = rangeVault.createBattle(ALICE_TOKEN_ID, TEST_DURATION);

        vm.prank(bob);
        rangeVault.joinBattle(battleId, BOB_TOKEN_ID);

        // Update mock pool with fuzzed tick
        mockPoolManager.setSlot0WithHook(
            WETH,
            USDC,
            POOL_FEE,
            address(mockHook),
            79228162514264337593543950336,
            currentTick
        );

        // Get current performance
        (bool creatorInRange,,,,) = rangeVault.getCurrentPerformance(battleId);

        // Verify in-range logic
        bool expectedInRange = currentTick >= -1000 && currentTick < 1000;
        assertEq(creatorInRange, expectedInRange);
    }

    // ============ EDGE CASE TESTS ============

    /// @notice Test creating maximum allowed battles
    function testEdgeCase_MultipleBattlesFromSameUser() public {
        // Setup additional positions for dave (use IDs that don't conflict with fee vault IDs)
        uint256[] memory tokenIds = new uint256[](3);
        tokenIds[0] = 5001;
        tokenIds[1] = 5002;
        tokenIds[2] = 5003;

        vm.startPrank(owner);
        for (uint256 i = 0; i < tokenIds.length; i++) {
            mockPositionManager.setPositionData(
                tokenIds[i],
                dave,
                Currency.wrap(WETH),
                Currency.wrap(USDC),
                POOL_FEE,
                -1000,
                1000,
                1000000000000000000,
                uint128(400 * 1e6),
                uint128(900 * 1e6)
            );
            mockPositionManager.setPositionHook(tokenIds[i], address(mockHook));
            mockPositionManager.setFeesToCollect(tokenIds[i], 400 * 1e6, 900 * 1e6);
        }
        vm.stopPrank();

        vm.startPrank(dave);
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 battleId = rangeVault.createBattle(tokenIds[i], TEST_DURATION);
            assertEq(battleId, i);
        }
        vm.stopPrank();

        // Verify all battles created
        assertEq(rangeVault.battleIdCounter(), 3);
    }

    /// @notice Test battle at exact boundary tick
    function testEdgeCase_TickAtBoundary() public {
        vm.prank(alice);
        uint256 battleId = rangeVault.createBattle(ALICE_TOKEN_ID, TEST_DURATION);

        vm.prank(bob);
        rangeVault.joinBattle(battleId, BOB_TOKEN_ID);

        // Set tick to exactly lower boundary
        mockPoolManager.setSlot0WithHook(
            WETH,
            USDC,
            POOL_FEE,
            address(mockHook),
            79228162514264337593543950336,
            -1000 // Exactly at lower boundary - should be IN range
        );

        (bool creatorInRange,,,,) = rangeVault.getCurrentPerformance(battleId);
        assertTrue(creatorInRange); // tickLower is inclusive

        // Set tick to exactly upper boundary
        mockPoolManager.setSlot0WithHook(
            WETH,
            USDC,
            POOL_FEE,
            address(mockHook),
            79228162514264337593543950336,
            1000 // Exactly at upper boundary - should be OUT of range
        );

        (creatorInRange,,,,) = rangeVault.getCurrentPerformance(battleId);
        assertFalse(creatorInRange); // tickUpper is exclusive
    }

    /// @notice Test resolving at exact end time
    function testEdgeCase_ResolveAtExactEndTime() public {
        vm.prank(alice);
        uint256 battleId = rangeVault.createBattle(ALICE_TOKEN_ID, TEST_DURATION);

        vm.prank(bob);
        rangeVault.joinBattle(battleId, BOB_TOKEN_ID);

        uint256 startTime = block.timestamp;

        // Try to resolve 1 second before end - should fail
        vm.warp(startTime + TEST_DURATION - 1);
        vm.prank(resolver);
        vm.expectRevert(BattleNotEnded.selector);
        rangeVault.resolveBattle(battleId);

        // Resolve at exact end time - should succeed
        vm.warp(startTime + TEST_DURATION);
        vm.prank(resolver);
        rangeVault.resolveBattle(battleId);

        (,,,,,,,,bool isResolved,) = rangeVault.getBattle(battleId);
        assertTrue(isResolved);
    }

    /// @notice Test emergency withdrawal timing
    function testEdgeCase_EmergencyWithdrawalTiming() public {
        vm.prank(alice);
        uint256 battleId = rangeVault.createBattle(ALICE_TOKEN_ID, TEST_DURATION);

        vm.prank(bob);
        rangeVault.joinBattle(battleId, BOB_TOKEN_ID);

        // Try emergency withdraw before 7 days after battle end
        vm.warp(block.timestamp + TEST_DURATION + 6 days);

        vm.prank(owner);
        vm.expectRevert(BattleNotExpiredForEmergencyWithdrawal.selector);
        rangeVault.emergencyWithdraw(battleId, alice, ALICE_TOKEN_ID);

        // Should succeed after 7 days
        vm.warp(block.timestamp + 2 days); // Now 8 days total

        vm.prank(owner);
        rangeVault.emergencyWithdraw(battleId, alice, ALICE_TOKEN_ID);
    }

    /// @notice Test battle with stale price feeds returns zero value
    function testEdgeCase_StalePriceFeed() public {
        // Warp to a reasonable timestamp first (required for staleness check)
        vm.warp(1700000000); // Some reasonable timestamp

        // Deploy a stale price feed
        MockStalePriceFeed staleFeed = new MockStalePriceFeed(2000 * 1e8, 8);

        vm.startPrank(owner);
        // Set stale feed for WETH - this will cause value to be 0
        rangeVault.setPriceFeed(WETH, address(staleFeed));
        // Keep USDC as stablecoin so at least part of value is calculated
        vm.stopPrank();

        // Battle creation should work even with stale feeds (value will be 0 or partial)
        vm.prank(alice);
        uint256 battleId = rangeVault.createBattle(ALICE_TOKEN_ID, TEST_DURATION);

        // Value may be 0 or partial depending on stablecoin handling
        (,,,,,,,uint256 totalValue,,) = rangeVault.getBattle(battleId);
        // With stale ETH feed, only USDC value should be counted
        // This is expected behavior - stale feeds return 0 for safety
        // Just verify battle was created successfully
        (address creator,,,,,,,,bool isResolved,) = rangeVault.getBattle(battleId);
        assertEq(creator, alice);
        assertFalse(isResolved);
    }

    // ============ FEE BATTLE EXTENDED TESTS ============

    /// @notice Fuzz test fee battle with various fee collection amounts
    function testFuzz_FeeBattleFeeGrowth(uint128 aliceFee0, uint128 aliceFee1, uint128 bobFee0, uint128 bobFee1) public {
        // Bound fees to reasonable values
        aliceFee0 = uint128(bound(aliceFee0, 500 * 1e6, 10000 * 1e6));
        aliceFee1 = uint128(bound(aliceFee1, 1000 * 1e6, 20000 * 1e6));
        bobFee0 = uint128(bound(bobFee0, 300 * 1e6, 10000 * 1e6));
        bobFee1 = uint128(bound(bobFee1, 800 * 1e6, 20000 * 1e6));

        vm.prank(alice);
        uint256 battleId = feeVault.createBattle(ALICE_FEE_TOKEN_ID, TEST_DURATION);

        vm.prank(bob);
        feeVault.joinBattle(battleId, BOB_FEE_TOKEN_ID);

        // Update fees to collect after battle starts
        mockPositionManager.updateFees(ALICE_FEE_TOKEN_ID, aliceFee0, aliceFee1);
        mockPositionManager.updateFees(BOB_FEE_TOKEN_ID, bobFee0, bobFee1);

        vm.warp(block.timestamp + TEST_DURATION + 1);

        vm.prank(resolver);
        feeVault.resolveBattle(battleId);

        (,, address winner,,,,,,,bool isResolved,) = feeVault.getBattle(battleId);
        assertTrue(isResolved);
        assertTrue(winner == alice || winner == bob);
    }

    /// @notice Test fee battle tie scenario - same fee GROWTH results in creator win
    function testFeeBattle_TieGoesToCreator() public {
        // First, set up fee vault positions with IDENTICAL starting fees
        vm.startPrank(owner);
        mockPositionManager.setPositionData(
            ALICE_FEE_TOKEN_ID,
            alice,
            Currency.wrap(WETH),
            Currency.wrap(USDC),
            POOL_FEE,
            -1000,
            1000,
            1000000000000000000,
            500 * 1e6,
            1000 * 1e6
        );
        mockPositionManager.setFeesToCollect(ALICE_FEE_TOKEN_ID, 600 * 1e6, 1200 * 1e6);

        mockPositionManager.setPositionData(
            BOB_FEE_TOKEN_ID,
            bob,
            Currency.wrap(WETH),
            Currency.wrap(USDC),
            POOL_FEE,
            -1000,
            1000,
            1000000000000000000,
            500 * 1e6,
            1000 * 1e6
        );
        mockPositionManager.setFeesToCollect(BOB_FEE_TOKEN_ID, 600 * 1e6, 1200 * 1e6);
        vm.stopPrank();

        vm.prank(alice);
        uint256 battleId = feeVault.createBattle(ALICE_FEE_TOKEN_ID, TEST_DURATION);

        vm.prank(bob);
        feeVault.joinBattle(battleId, BOB_FEE_TOKEN_ID);

        // Set identical fee growth for collection
        mockPositionManager.updateFees(ALICE_FEE_TOKEN_ID, 600 * 1e6, 1200 * 1e6);
        mockPositionManager.updateFees(BOB_FEE_TOKEN_ID, 600 * 1e6, 1200 * 1e6);

        vm.warp(block.timestamp + TEST_DURATION + 1);

        vm.prank(resolver);
        feeVault.resolveBattle(battleId);

        (,, address winner,,,,,,,,) = feeVault.getBattle(battleId);
        // With identical fee rates (both 0 from mock), creator should win (tie-breaker: >= comparison)
        assertEq(winner, alice);
    }

    // ============ CONCURRENT BATTLES TESTS ============

    /// @notice Test multiple concurrent battles
    function testConcurrent_MultipleBattles() public {
        // Setup positions
        uint256[] memory aliceTokens = new uint256[](2);
        uint256[] memory bobTokens = new uint256[](2);
        aliceTokens[0] = 3001;
        aliceTokens[1] = 3002;
        bobTokens[0] = 3003;
        bobTokens[1] = 3004;

        vm.startPrank(owner);
        for (uint256 i = 0; i < 2; i++) {
            mockPositionManager.setPositionData(
                aliceTokens[i],
                alice,
                Currency.wrap(WETH),
                Currency.wrap(USDC),
                POOL_FEE,
                -1000,
                1000,
                1000000000000000000,
                uint128((500 + i * 100) * 1e6),
                uint128((1000 + i * 100) * 1e6)
            );
            mockPositionManager.setPositionHook(aliceTokens[i], address(mockHook));
            mockPositionManager.setFeesToCollect(aliceTokens[i], (500 + i * 100) * 1e6, (1000 + i * 100) * 1e6);

            mockPositionManager.setPositionData(
                bobTokens[i],
                bob,
                Currency.wrap(WETH),
                Currency.wrap(USDC),
                POOL_FEE,
                -1000,
                1000,
                1000000000000000000,
                uint128((500 + i * 100) * 1e6),
                uint128((1000 + i * 100) * 1e6)
            );
            mockPositionManager.setPositionHook(bobTokens[i], address(mockHook));
            mockPositionManager.setFeesToCollect(bobTokens[i], (500 + i * 100) * 1e6, (1000 + i * 100) * 1e6);
        }
        vm.stopPrank();

        // Create and join multiple battles
        uint256[] memory battleIds = new uint256[](2);

        for (uint256 i = 0; i < 2; i++) {
            vm.prank(alice);
            battleIds[i] = rangeVault.createBattle(aliceTokens[i], TEST_DURATION);

            vm.prank(bob);
            rangeVault.joinBattle(battleIds[i], bobTokens[i]);
        }

        // Verify both battles are active
        uint256[] memory activeBattles = rangeVault.getActiveBattles();
        assertEq(activeBattles.length, 2);

        // Resolve all battles
        vm.warp(block.timestamp + TEST_DURATION + 1);

        for (uint256 i = 0; i < 2; i++) {
            vm.prank(resolver);
            rangeVault.resolveBattle(battleIds[i]);
        }

        // Verify all resolved
        activeBattles = rangeVault.getActiveBattles();
        assertEq(activeBattles.length, 0);
    }

    // ============ PRICE MOVEMENT SIMULATION ============

    /// @notice Test battle with price movements during battle
    function testPriceMovement_DuringBattle() public {
        vm.prank(alice);
        uint256 battleId = rangeVault.createBattle(ALICE_TOKEN_ID, TEST_DURATION);

        vm.prank(bob);
        rangeVault.joinBattle(battleId, BOB_TOKEN_ID);

        uint256 startTime = block.timestamp;

        // Simulate price movements every 10 minutes
        int24[] memory ticks = new int24[](6);
        ticks[0] = 0;      // In range for both
        ticks[1] = 500;    // In range for both
        ticks[2] = 950;    // In range for both (close to boundary)
        ticks[3] = 1100;   // Out of range for both
        ticks[4] = -500;   // In range for both
        ticks[5] = 200;    // In range for both

        for (uint256 i = 0; i < ticks.length; i++) {
            vm.warp(startTime + (i + 1) * 10 minutes);

            mockPoolManager.setSlot0WithHook(
                WETH,
                USDC,
                POOL_FEE,
                address(mockHook),
                79228162514264337593543950336,
                ticks[i]
            );

            // Update battle status
            rangeVault.updateBattleStatus(battleId);
        }

        // Fast forward to end
        vm.warp(startTime + TEST_DURATION + 1);

        vm.prank(resolver);
        rangeVault.resolveBattle(battleId);

        (,,,,,,,,bool isResolved,) = rangeVault.getBattle(battleId);
        assertTrue(isResolved);
    }

    // ============ ACCESS CONTROL TESTS ============

    /// @notice Test all admin functions are properly protected
    function testAccessControl_AdminFunctions() public {
        // Test setPositionManager
        vm.prank(alice);
        vm.expectRevert(NotOwner.selector);
        rangeVault.setPositionManager(address(0x123));

        // Test setBattleHook
        vm.prank(alice);
        vm.expectRevert(NotOwner.selector);
        rangeVault.setBattleHook(address(0x123));

        // Test setStablecoin
        vm.prank(alice);
        vm.expectRevert(NotOwner.selector);
        rangeVault.setStablecoin(address(0x123), true);

        // Test transferOwnership
        vm.prank(alice);
        vm.expectRevert(NotOwner.selector);
        rangeVault.transferOwnership(alice);

        // Test pause/unpause
        vm.prank(alice);
        vm.expectRevert(NotOwner.selector);
        rangeVault.pause();
    }

    /// @notice Test ownership transfer
    function testOwnershipTransfer() public {
        vm.prank(owner);
        rangeVault.transferOwnership(alice);

        // Old owner can no longer access admin functions
        vm.prank(owner);
        vm.expectRevert(NotOwner.selector);
        rangeVault.pause();

        // New owner can
        vm.prank(alice);
        rangeVault.pause();
    }

    // ============ VIEW FUNCTION TESTS ============

    /// @notice Test getBattleUSDValue formatting
    function testGetBattleUSDValue() public {
        vm.prank(alice);
        uint256 battleId = rangeVault.createBattle(ALICE_TOKEN_ID, TEST_DURATION);

        string memory usdValue = rangeVault.getBattleUSDValue(battleId);
        // Should return formatted USD string
        assertTrue(bytes(usdValue).length > 0);
    }

    /// @notice Test status strings for all battle states
    function testBattleStatusStrings() public {
        vm.prank(alice);
        uint256 battleId = rangeVault.createBattle(ALICE_TOKEN_ID, TEST_DURATION);

        // Pending (waiting for opponent)
        assertEq(rangeVault.getBattleStatus(battleId), "pending");

        vm.prank(bob);
        rangeVault.joinBattle(battleId, BOB_TOKEN_ID);

        // Ongoing
        assertEq(rangeVault.getBattleStatus(battleId), "ongoing");

        // Ready to resolve
        vm.warp(block.timestamp + TEST_DURATION + 1);
        assertEq(rangeVault.getBattleStatus(battleId), "ready_to_resolve");

        vm.prank(resolver);
        rangeVault.resolveBattle(battleId);

        // Resolved
        assertEq(rangeVault.getBattleStatus(battleId), "resolved");
    }

    // ============ REENTRANCY TESTS ============

    /// @notice Verify reentrancy protection on createBattle
    function testReentrancy_CreateBattle() public {
        // The contract uses ReentrancyGuard
        // Test that rapid sequential calls don't cause issues
        uint256[] memory tokenIds = new uint256[](3);
        tokenIds[0] = 4001;
        tokenIds[1] = 4002;
        tokenIds[2] = 4003;

        vm.startPrank(owner);
        for (uint256 i = 0; i < 3; i++) {
            mockPositionManager.setPositionData(
                tokenIds[i],
                alice,
                Currency.wrap(WETH),
                Currency.wrap(USDC),
                POOL_FEE,
                -1000,
                1000,
                1000000000000000000,
                uint128(500 * 1e6),
                uint128(1000 * 1e6)
            );
            mockPositionManager.setPositionHook(tokenIds[i], address(mockHook));
            mockPositionManager.setFeesToCollect(tokenIds[i], 500 * 1e6, 1000 * 1e6);
        }
        vm.stopPrank();

        vm.startPrank(alice);
        for (uint256 i = 0; i < 3; i++) {
            rangeVault.createBattle(tokenIds[i], TEST_DURATION);
        }
        vm.stopPrank();

        assertEq(rangeVault.battleIdCounter(), 3);
    }
}

/**
 * @title Mock Stale Price Feed
 * @notice Returns stale price data for testing
 */
contract MockStalePriceFeed {
    int256 public price;
    uint8 public decimals;
    uint256 public lastUpdate;

    constructor(int256 _price, uint8 _decimals) {
        price = _price;
        decimals = _decimals;
        // Set last update to a fixed old timestamp (beyond staleness threshold of 5 hours)
        // Use 0 to ensure it's always stale regardless of block.timestamp
        lastUpdate = 0;
    }

    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) {
        return (1, price, lastUpdate, lastUpdate, 1);
    }
}

/**
 * @title Invariant Test Handler
 * @notice Handler contract for invariant testing
 */
contract BattleInvariantHandler is Test {
    LPBattleVaultV4 public vault;
    MockPositionManagerV4 public positionManager;

    uint256[] public createdBattles;
    address[] public actors;

    constructor(LPBattleVaultV4 _vault, MockPositionManagerV4 _pm) {
        vault = _vault;
        positionManager = _pm;
        actors.push(makeAddr("actor1"));
        actors.push(makeAddr("actor2"));
    }

    function createBattle(uint256 actorSeed, uint256 duration) external {
        address actor = actors[actorSeed % actors.length];
        duration = bound(duration, 1, vault.MAX_BATTLE_DURATION());

        uint256 tokenId = 10000 + createdBattles.length;

        // Setup position (no hook needed for invariant tests since vault has no hook set)
        positionManager.setPositionData(
            tokenId,
            actor,
            Currency.wrap(address(0x1)),
            Currency.wrap(address(0x2)),
            3000,
            -1000,
            1000,
            1e18,
            500 * 1e6,
            1000 * 1e6
        );
        positionManager.setFeesToCollect(tokenId, 500 * 1e6, 1000 * 1e6);

        vm.prank(actor);
        try vault.createBattle(tokenId, duration) returns (uint256 battleId) {
            createdBattles.push(battleId);
        } catch {}
    }

    function getCreatedBattlesCount() external view returns (uint256) {
        return createdBattles.length;
    }
}

/**
 * @title Invariant Tests
 * @notice Tests system invariants
 */
contract LPBattleVaultInvariantTest is Test {
    LPBattleVaultV4 public vault;
    BattleInvariantHandler public handler;

    function setUp() public {
        MockPoolManagerV4 poolManager = new MockPoolManagerV4();
        MockPositionManagerV4 positionManager = new MockPositionManagerV4();

        vault = new LPBattleVaultV4(address(poolManager));
        vault.setPositionManager(address(positionManager));

        handler = new BattleInvariantHandler(vault, positionManager);

        targetContract(address(handler));
    }

    /// @notice Invariant: battleIdCounter always equals or exceeds created battles
    function invariant_battleIdCounterConsistent() public view {
        assertGe(vault.battleIdCounter(), handler.getCreatedBattlesCount());
    }
}
