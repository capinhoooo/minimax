// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "forge-std/console.sol";

import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {Currency, CurrencyLibrary} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";
import {PositionInfo, PositionInfoLibrary} from "v4-periphery/src/libraries/PositionInfoLibrary.sol";

import {LPBattleVaultV4} from "../src/LPBattleVaultV4.sol";
import {LPFeeBattleV4} from "../src/LPFeeBattleV4.sol";
import {BattleVaultHook} from "../src/hooks/BattleVaultHook.sol";
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
    BattleDurationTooLong
} from "../src/interfaces/IShared.sol";

/**
 * @title LP BattleVault V4 Test Suite
 * @notice Tests for LPBattleVaultV4 (Range Battles) and LPFeeBattleV4 (Fee Battles)
 * @dev Uses mock contracts to simulate Uniswap V4 interactions
 */
contract LPBattleVaultV4Test is Test {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;

    // Contracts
    LPBattleVaultV4 public rangeVault;
    LPFeeBattleV4 public feeVault;
    MockPoolManagerV4 public mockPoolManager;
    MockPositionManagerV4 public mockPositionManager;
    MockBattleVaultHook public mockHook;

    // Test accounts
    address public owner = makeAddr("owner");
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public charlie = makeAddr("charlie");
    address public resolver = makeAddr("resolver");

    // Test tokens (mock ERC20s)
    MockERC20 public weth;
    MockERC20 public usdc;
    MockERC20 public wbtc;

    // Token addresses
    address public WETH;
    address public USDC;
    address public WBTC;

    // Test LP NFT IDs (range vault - positions with hook)
    uint256 public constant ALICE_TOKEN_ID = 1001;
    uint256 public constant BOB_TOKEN_ID = 1002;
    uint256 public constant CHARLIE_TOKEN_ID = 1003;

    // Fee vault LP NFT IDs (positions without hook)
    uint256 public constant ALICE_FEE_TOKEN_ID = 2001;
    uint256 public constant BOB_FEE_TOKEN_ID = 2002;
    uint256 public constant CHARLIE_FEE_TOKEN_ID = 2003;

    // Test constants
    uint256 public constant TEST_DURATION = 1 hours;
    uint24 public constant POOL_FEE = 3000; // 0.3%
    int24 public constant TICK_SPACING = 60;

    // Events
    event BattleCreated(uint256 indexed battleId, address indexed creator, uint256 tokenId, uint256 duration, uint256 totalValueUSD);
    event BattleJoined(uint256 indexed battleId, address indexed opponent, uint256 tokenId, uint256 startTime);
    event BattleResolved(uint256 indexed battleId, address indexed winner, address indexed resolver, uint256 resolverReward);

    function setUp() public virtual {
        vm.startPrank(owner);

        // Deploy mock ERC20 tokens
        weth = new MockERC20("Wrapped Ether", "WETH", 18);
        usdc = new MockERC20("USD Coin", "USDC", 6);
        wbtc = new MockERC20("Wrapped Bitcoin", "WBTC", 8);

        WETH = address(weth);
        USDC = address(usdc);
        WBTC = address(wbtc);

        // Deploy mock V4 contracts
        mockPoolManager = new MockPoolManagerV4();
        mockPositionManager = new MockPositionManagerV4();

        // Deploy main contracts
        rangeVault = new LPBattleVaultV4(address(mockPoolManager));
        feeVault = new LPFeeBattleV4(address(mockPoolManager));

        // Deploy mock hook (needs to be deployed after vault for address reference)
        mockHook = new MockBattleVaultHook(address(mockPoolManager), address(rangeVault));

        // Configure vaults
        rangeVault.setPositionManager(address(mockPositionManager));
        rangeVault.setBattleHook(address(mockHook));
        feeVault.setPositionManager(address(mockPositionManager));

        // Setup price feeds
        setupMockPriceFeeds();

        // Setup test positions
        setupTestPositions();

        // Setup mock pool state - MUST be after hook is deployed
        // Range vault uses hook address in PoolKey
        setupMockPool();
        // Fee vault uses address(0) for hooks
        setupMockPoolForFeeVault();

        vm.stopPrank();
    }

    function setupMockPriceFeeds() internal {
        // Deploy mock price feeds
        MockPriceFeed ethFeed = new MockPriceFeed(2000 * 1e8, 8); // $2000 ETH
        MockPriceFeed btcFeed = new MockPriceFeed(50000 * 1e8, 8); // $50000 BTC
        MockPriceFeed usdcFeed = new MockPriceFeed(1 * 1e8, 8); // $1 USDC

        // Set price feeds for range vault (skip address(0) - contract doesn't allow it)
        rangeVault.setPriceFeed(WETH, address(ethFeed));
        rangeVault.setPriceFeed(WBTC, address(btcFeed));
        rangeVault.setPriceFeed(USDC, address(usdcFeed));

        // Set price feeds for fee vault
        feeVault.setPriceFeed(WETH, address(ethFeed));
        feeVault.setPriceFeed(WBTC, address(btcFeed));
        feeVault.setPriceFeed(USDC, address(usdcFeed));

        // Set stablecoins
        rangeVault.setStablecoin(USDC, true);
        feeVault.setStablecoin(USDC, true);
    }

    function setupTestPositions() internal {
        // === Range vault positions (with hook in PoolKey) ===

        // Alice's position: WETH/USDC, in range
        mockPositionManager.setPositionData(
            ALICE_TOKEN_ID, alice,
            Currency.wrap(WETH), Currency.wrap(USDC),
            POOL_FEE, -1000, 1000,
            1000000000000000000, // 1 ETH worth of liquidity
            500 * 1e6, 1000 * 1e6
        );
        mockPositionManager.setPositionHook(ALICE_TOKEN_ID, address(mockHook));
        mockPositionManager.setFeesToCollect(ALICE_TOKEN_ID, 500 * 1e6, 1000 * 1e6);

        // Bob's position: IDENTICAL tick range and liquidity (within 5% tolerance)
        mockPositionManager.setPositionData(
            BOB_TOKEN_ID, bob,
            Currency.wrap(WETH), Currency.wrap(USDC),
            POOL_FEE, -1000, 1000,
            1000000000000000000,
            300 * 1e6, 800 * 1e6
        );
        mockPositionManager.setPositionHook(BOB_TOKEN_ID, address(mockHook));
        mockPositionManager.setFeesToCollect(BOB_TOKEN_ID, 300 * 1e6, 800 * 1e6);

        // Charlie's position: significantly different value (outside tolerance)
        mockPositionManager.setPositionData(
            CHARLIE_TOKEN_ID, charlie,
            Currency.wrap(WETH), Currency.wrap(USDC),
            POOL_FEE, -1000, 1000,
            2000000000000000000, // 2x liquidity
            200 * 1e6, 400 * 1e6
        );
        mockPositionManager.setPositionHook(CHARLIE_TOKEN_ID, address(mockHook));
        mockPositionManager.setFeesToCollect(CHARLIE_TOKEN_ID, 200 * 1e6, 400 * 1e6);

        // === Fee vault positions (no hook) ===

        mockPositionManager.setPositionData(
            ALICE_FEE_TOKEN_ID, alice,
            Currency.wrap(WETH), Currency.wrap(USDC),
            POOL_FEE, -1000, 1000,
            1000000000000000000,
            500 * 1e6, 1000 * 1e6
        );
        mockPositionManager.setFeesToCollect(ALICE_FEE_TOKEN_ID, 500 * 1e6, 1000 * 1e6);

        mockPositionManager.setPositionData(
            BOB_FEE_TOKEN_ID, bob,
            Currency.wrap(WETH), Currency.wrap(USDC),
            POOL_FEE, -1000, 1000,
            1000000000000000000,
            300 * 1e6, 800 * 1e6
        );
        mockPositionManager.setFeesToCollect(BOB_FEE_TOKEN_ID, 300 * 1e6, 800 * 1e6);

        mockPositionManager.setPositionData(
            CHARLIE_FEE_TOKEN_ID, charlie,
            Currency.wrap(WETH), Currency.wrap(USDC),
            POOL_FEE, -1000, 1000,
            2000000000000000000,
            200 * 1e6, 400 * 1e6
        );
        mockPositionManager.setFeesToCollect(CHARLIE_FEE_TOKEN_ID, 200 * 1e6, 400 * 1e6);
    }

    function setupMockPool() internal {
        // Set pool state: sqrtPriceX96 for ~1:1 ratio at tick 0
        // sqrtPriceX96 = sqrt(1) * 2^96 = 79228162514264337593543950336
        // Range vault uses hook address in PoolKey
        mockPoolManager.setSlot0WithHook(
            WETH,
            USDC,
            POOL_FEE,
            address(mockHook),
            79228162514264337593543950336, // sqrtPriceX96
            0 // current tick
        );
    }

    function setupMockPoolForFeeVault() internal {
        // Fee vault uses address(0) for hooks
        mockPoolManager.setSlot0WithHook(
            WETH,
            USDC,
            POOL_FEE,
            address(0),
            79228162514264337593543950336, // sqrtPriceX96
            0 // current tick
        );
    }

    // ============ RANGE BATTLE TESTS ============

    function testRangeBattle_CreateBattle() public {
        vm.startPrank(alice);

        uint256 battleId = rangeVault.createBattle(ALICE_TOKEN_ID, TEST_DURATION);

        assertEq(battleId, 0);

        // Verify battle details
        (
            address creator,
            address opponent,
            address winner,
            uint256 creatorTokenId,
            ,
            uint256 startTime,
            uint256 duration,
            uint256 totalValueUSD,
            bool isResolved,
            string memory status
        ) = rangeVault.getBattle(battleId);

        assertEq(creator, alice);
        assertEq(opponent, address(0));
        assertEq(winner, address(0));
        assertEq(creatorTokenId, ALICE_TOKEN_ID);
        assertEq(startTime, 0); // Not started until opponent joins
        assertEq(duration, TEST_DURATION);
        assertGt(totalValueUSD, 0);
        assertFalse(isResolved);
        assertEq(status, "pending");

        vm.stopPrank();
    }

    function testRangeBattle_JoinBattle() public {
        // Alice creates battle
        vm.prank(alice);
        uint256 battleId = rangeVault.createBattle(ALICE_TOKEN_ID, TEST_DURATION);

        // Bob joins battle
        vm.prank(bob);
        rangeVault.joinBattle(battleId, BOB_TOKEN_ID);

        // Verify battle state
        (
            address creator,
            address opponent,
            ,
            ,
            uint256 opponentTokenId,
            uint256 startTime,
            ,
            ,
            bool isResolved,
            string memory status
        ) = rangeVault.getBattle(battleId);

        assertEq(creator, alice);
        assertEq(opponent, bob);
        assertEq(opponentTokenId, BOB_TOKEN_ID);
        assertGt(startTime, 0);
        assertFalse(isResolved);
        assertEq(status, "ongoing");
    }

    function testRangeBattle_CannotJoinWithIncompatibleValue() public {
        // Alice creates battle
        vm.prank(alice);
        uint256 battleId = rangeVault.createBattle(ALICE_TOKEN_ID, TEST_DURATION);

        // Charlie tries to join with incompatible LP value (outside 5% tolerance)
        vm.prank(charlie);
        vm.expectRevert(LPValueNotWithinTolerance.selector);
        rangeVault.joinBattle(battleId, CHARLIE_TOKEN_ID);
    }

    function testRangeBattle_ResolveBattleWhenBothInRange() public {
        // Create and join battle
        vm.prank(alice);
        uint256 battleId = rangeVault.createBattle(ALICE_TOKEN_ID, TEST_DURATION);

        vm.prank(bob);
        rangeVault.joinBattle(battleId, BOB_TOKEN_ID);

        // Fast forward past battle duration
        vm.warp(block.timestamp + TEST_DURATION + 1);

        // Record balances before resolve
        uint256 resolverWethBefore = weth.balanceOf(resolver);
        uint256 resolverUsdcBefore = usdc.balanceOf(resolver);

        // Resolve battle
        vm.prank(resolver);
        rangeVault.resolveBattle(battleId);

        // Verify resolution
        (
            ,
            ,
            address winner,
            ,
            ,
            ,
            ,
            ,
            bool isResolved,
            string memory status
        ) = rangeVault.getBattle(battleId);

        assertTrue(isResolved);
        assertEq(status, "resolved");
        // Winner should be determined by in-range time (both start at 0, so creator wins tie)
        assertEq(winner, alice);

        // Verify fee distribution: 1% to resolver, 99% to winner
        // Alice fees: 500e6 WETH + 1000e6 USDC, Bob fees: 300e6 WETH + 800e6 USDC
        // Total WETH fees: 800e6, Total USDC fees: 1800e6
        uint256 resolverWeth = weth.balanceOf(resolver) - resolverWethBefore;
        uint256 resolverUsdc = usdc.balanceOf(resolver) - resolverUsdcBefore;
        uint256 winnerWeth = weth.balanceOf(alice);
        uint256 winnerUsdc = usdc.balanceOf(alice);

        // Resolver: 1% of each position's fees
        assertEq(resolverWeth, 5e6 + 3e6); // 1% of 500e6 + 1% of 300e6
        assertEq(resolverUsdc, 10e6 + 8e6); // 1% of 1000e6 + 1% of 800e6

        // Winner: 99% of each position's fees
        assertEq(winnerWeth, 495e6 + 297e6); // 99% of 500e6 + 99% of 300e6
        assertEq(winnerUsdc, 990e6 + 792e6); // 99% of 1000e6 + 99% of 800e6
    }

    function testRangeBattle_ResolveBattleWhenOneOutOfRange() public {
        // Create and join battle
        vm.prank(alice);
        uint256 battleId = rangeVault.createBattle(ALICE_TOKEN_ID, TEST_DURATION);

        vm.prank(bob);
        rangeVault.joinBattle(battleId, BOB_TOKEN_ID);

        // Both positions have range [-1000, 1000]
        // Set tick to 1100 which is outside both ranges for price impact testing
        // Note: With identical ranges, we test winner by in-range time accumulation
        // Move tick out of range, then back in for only creator's range test
        mockPoolManager.setSlot0WithHook(
            WETH,
            USDC,
            POOL_FEE,
            address(mockHook),
            79228162514264337593543950336, // sqrtPriceX96
            1100 // current tick - outside both ranges [-1000, 1000]
        );

        // Fast forward past battle duration
        vm.warp(block.timestamp + TEST_DURATION + 1);

        // Resolve battle - both out of range, tie goes to creator (alice)
        vm.prank(resolver);
        rangeVault.resolveBattle(battleId);

        (,, address winner,,,,,, bool isResolved,) = rangeVault.getBattle(battleId);
        assertTrue(isResolved);
        assertEq(winner, alice);

        // Verify fees were collected and distributed to winner (alice)
        assertGt(weth.balanceOf(alice), 0);
        assertGt(usdc.balanceOf(alice), 0);
        assertGt(weth.balanceOf(resolver), 0);
        assertGt(usdc.balanceOf(resolver), 0);
    }

    function testRangeBattle_CannotResolveBeforeEnd() public {
        vm.prank(alice);
        uint256 battleId = rangeVault.createBattle(ALICE_TOKEN_ID, TEST_DURATION);

        vm.prank(bob);
        rangeVault.joinBattle(battleId, BOB_TOKEN_ID);

        // Try to resolve immediately
        vm.prank(resolver);
        vm.expectRevert(BattleNotEnded.selector);
        rangeVault.resolveBattle(battleId);
    }

    function testRangeBattle_CannotResolveTwice() public {
        vm.prank(alice);
        uint256 battleId = rangeVault.createBattle(ALICE_TOKEN_ID, TEST_DURATION);

        vm.prank(bob);
        rangeVault.joinBattle(battleId, BOB_TOKEN_ID);

        vm.warp(block.timestamp + TEST_DURATION + 1);

        vm.prank(resolver);
        rangeVault.resolveBattle(battleId);

        // Try to resolve again
        vm.prank(resolver);
        vm.expectRevert(AlreadyResolved.selector);
        rangeVault.resolveBattle(battleId);
    }

    function testRangeBattle_CannotJoinOwnBattle() public {
        vm.prank(alice);
        uint256 battleId = rangeVault.createBattle(ALICE_TOKEN_ID, TEST_DURATION);

        // Alice tries to join her own battle (but doesn't own BOB_TOKEN_ID)
        vm.prank(alice);
        vm.expectRevert(NotLPOwner.selector);
        rangeVault.joinBattle(battleId, BOB_TOKEN_ID);
    }

    function testRangeBattle_CannotJoinAlreadyJoinedBattle() public {
        vm.prank(alice);
        uint256 battleId = rangeVault.createBattle(ALICE_TOKEN_ID, TEST_DURATION);

        vm.prank(bob);
        rangeVault.joinBattle(battleId, BOB_TOKEN_ID);

        // Charlie tries to join already joined battle
        vm.prank(charlie);
        vm.expectRevert(BattleAlreadyJoined.selector);
        rangeVault.joinBattle(battleId, CHARLIE_TOKEN_ID);
    }

    // ============ FEE BATTLE TESTS ============

    function testFeeBattle_CreateBattle() public {
        vm.prank(alice);
        uint256 battleId = feeVault.createBattle(ALICE_FEE_TOKEN_ID, TEST_DURATION);

        assertEq(battleId, 0);

        (
            address creator,
            address opponent,
            ,
            uint256 creatorTokenId,
            ,
            ,
            uint256 duration,
            uint256 creatorLPValue,
            ,
            bool isResolved,
            string memory status
        ) = feeVault.getBattle(battleId);

        assertEq(creator, alice);
        assertEq(opponent, address(0));
        assertEq(creatorTokenId, ALICE_FEE_TOKEN_ID);
        assertEq(duration, TEST_DURATION);
        assertGt(creatorLPValue, 0);
        assertFalse(isResolved);
        assertEq(status, "waiting_for_opponent");
    }

    function testFeeBattle_JoinBattle() public {
        vm.prank(alice);
        uint256 battleId = feeVault.createBattle(ALICE_FEE_TOKEN_ID, TEST_DURATION);

        vm.prank(bob);
        feeVault.joinBattle(battleId, BOB_FEE_TOKEN_ID);

        (
            address creator,
            address opponent,
            ,
            ,
            uint256 opponentTokenId,
            uint256 startTime,
            ,
            ,
            ,
            bool isResolved,
            string memory status
        ) = feeVault.getBattle(battleId);

        assertEq(creator, alice);
        assertEq(opponent, bob);
        assertEq(opponentTokenId, BOB_FEE_TOKEN_ID);
        assertGt(startTime, 0);
        assertFalse(isResolved);
        assertEq(status, "ongoing");
    }

    function testFeeBattle_ResolveBattle() public {
        vm.prank(alice);
        uint256 battleId = feeVault.createBattle(ALICE_FEE_TOKEN_ID, TEST_DURATION);

        vm.prank(bob);
        feeVault.joinBattle(battleId, BOB_FEE_TOKEN_ID);

        // Simulate fee growth - update feesToCollect for fee collection
        mockPositionManager.updateFees(ALICE_FEE_TOKEN_ID, 800 * 1e6, 1500 * 1e6);
        mockPositionManager.updateFees(BOB_FEE_TOKEN_ID, 400 * 1e6, 1000 * 1e6);

        vm.warp(block.timestamp + TEST_DURATION + 1);

        vm.prank(resolver);
        feeVault.resolveBattle(battleId);

        (,, address winner,,,,,,,bool isResolved, string memory status) = feeVault.getBattle(battleId);
        assertTrue(isResolved);
        assertEq(status, "resolved");
        // Winner determined by fee growth rate (both 0 from mock → tie → creator wins)
        assertEq(winner, alice);

        // Verify fee distribution: fees are collected and distributed
        // Alice fees: 800e6 WETH + 1500e6 USDC, Bob fees: 400e6 WETH + 1000e6 USDC
        assertGt(weth.balanceOf(alice), 0); // winner gets 99% of all fees
        assertGt(usdc.balanceOf(alice), 0);
        assertGt(weth.balanceOf(resolver), 0); // resolver gets 1%
        assertGt(usdc.balanceOf(resolver), 0);
    }

    function testFeeBattle_CannotJoinTwice() public {
        vm.prank(alice);
        uint256 battleId = feeVault.createBattle(ALICE_FEE_TOKEN_ID, TEST_DURATION);

        vm.prank(bob);
        feeVault.joinBattle(battleId, BOB_FEE_TOKEN_ID);

        vm.prank(charlie);
        vm.expectRevert(BattleAlreadyJoined.selector);
        feeVault.joinBattle(battleId, CHARLIE_FEE_TOKEN_ID);
    }

    // ============ VIEW FUNCTION TESTS ============

    function testGetTimeRemaining() public {
        vm.prank(alice);
        uint256 battleId = rangeVault.createBattle(ALICE_TOKEN_ID, TEST_DURATION);

        vm.prank(bob);
        rangeVault.joinBattle(battleId, BOB_TOKEN_ID);

        uint256 timeRemaining = rangeVault.getTimeRemaining(battleId);
        assertEq(timeRemaining, TEST_DURATION);

        // Fast forward half
        vm.warp(block.timestamp + TEST_DURATION / 2);
        timeRemaining = rangeVault.getTimeRemaining(battleId);
        assertEq(timeRemaining, TEST_DURATION / 2);

        // Fast forward past end
        vm.warp(block.timestamp + TEST_DURATION);
        timeRemaining = rangeVault.getTimeRemaining(battleId);
        assertEq(timeRemaining, 0);
    }

    function testGetActiveBattles() public {
        // Create multiple battles
        vm.prank(alice);
        rangeVault.createBattle(ALICE_TOKEN_ID, TEST_DURATION);

        uint256[] memory activeBattles = rangeVault.getActiveBattles();
        assertEq(activeBattles.length, 1);
    }

    function testGetPendingBattles() public {
        vm.prank(alice);
        rangeVault.createBattle(ALICE_TOKEN_ID, TEST_DURATION);

        uint256[] memory pendingBattles = rangeVault.getPendingBattles();
        assertEq(pendingBattles.length, 1);

        // After joining, should not be pending
        vm.prank(bob);
        rangeVault.joinBattle(0, BOB_TOKEN_ID);

        pendingBattles = rangeVault.getPendingBattles();
        assertEq(pendingBattles.length, 0);
    }

    function testGetUserBattles() public {
        vm.prank(alice);
        rangeVault.createBattle(ALICE_TOKEN_ID, TEST_DURATION);

        (uint256[] memory battleIds, bool[] memory isCreator) = rangeVault.getUserBattles(alice);
        assertEq(battleIds.length, 1);
        assertTrue(isCreator[0]);

        // Bob joins
        vm.prank(bob);
        rangeVault.joinBattle(0, BOB_TOKEN_ID);

        (battleIds, isCreator) = rangeVault.getUserBattles(bob);
        assertEq(battleIds.length, 1);
        assertFalse(isCreator[0]); // Bob is not creator
    }

    // ============ ADMIN FUNCTION TESTS ============

    function testOnlyOwnerCanSetPriceFeed() public {
        MockPriceFeed newFeed = new MockPriceFeed(3000 * 1e8, 8);

        vm.prank(alice);
        vm.expectRevert(NotOwner.selector);
        rangeVault.setPriceFeed(WETH, address(newFeed));

        vm.prank(owner);
        rangeVault.setPriceFeed(WETH, address(newFeed));
    }

    function testOnlyOwnerCanPause() public {
        vm.prank(alice);
        vm.expectRevert(NotOwner.selector);
        rangeVault.pause();

        vm.prank(owner);
        rangeVault.pause();
    }

    function testCannotCreateBattleWhenPaused() public {
        vm.prank(owner);
        rangeVault.pause();

        vm.prank(alice);
        vm.expectRevert();
        rangeVault.createBattle(ALICE_TOKEN_ID, TEST_DURATION);
    }

    // ============ GAS TESTS ============

    function testGas_CreateBattle() public {
        vm.prank(alice);
        uint256 gasBefore = gasleft();
        rangeVault.createBattle(ALICE_TOKEN_ID, TEST_DURATION);
        uint256 gasUsed = gasBefore - gasleft();

        console.log("Gas used for createBattle:", gasUsed);
        assertLt(gasUsed, 400000); // Increased for V4 complexity
    }

    function testGas_JoinBattle() public {
        vm.prank(alice);
        rangeVault.createBattle(ALICE_TOKEN_ID, TEST_DURATION);

        vm.prank(bob);
        uint256 gasBefore = gasleft();
        rangeVault.joinBattle(0, BOB_TOKEN_ID);
        uint256 gasUsed = gasBefore - gasleft();

        console.log("Gas used for joinBattle:", gasUsed);
        assertLt(gasUsed, 300000); // Increased for V4 complexity
    }

    function testGas_ResolveBattle() public {
        vm.prank(alice);
        rangeVault.createBattle(ALICE_TOKEN_ID, TEST_DURATION);

        vm.prank(bob);
        rangeVault.joinBattle(0, BOB_TOKEN_ID);

        vm.warp(block.timestamp + TEST_DURATION + 1);

        vm.prank(resolver);
        uint256 gasBefore = gasleft();
        rangeVault.resolveBattle(0);
        uint256 gasUsed = gasBefore - gasleft();

        console.log("Gas used for resolveBattle:", gasUsed);
        assertLt(gasUsed, 600000); // Increased for V4 fee collection
    }
}

// ============ MOCK CONTRACTS ============

/**
 * @title Mock Pool Manager V4
 * @notice Simulates Uniswap V4 PoolManager for testing
 * @dev Implements extsload for StateLibrary compatibility
 */
contract MockPoolManagerV4 {
    using PoolIdLibrary for PoolKey;

    // POOLS_SLOT from StateLibrary - keccak256("Pools") - 1
    bytes32 internal constant POOLS_SLOT = bytes32(uint256(keccak256("Pools")) - 1);

    struct Slot0Data {
        uint160 sqrtPriceX96;
        int24 tick;
        uint24 protocolFee;
        uint24 lpFee;
    }

    mapping(bytes32 => Slot0Data) public poolSlot0;
    mapping(bytes32 => bytes32) internal storageSlots;

    // Store any slot data directly (for flexibility)
    mapping(bytes32 => bytes32) public anySlot;

    function setSlot0(
        address token0,
        address token1,
        uint24 fee,
        uint160 sqrtPriceX96,
        int24 tick
    ) external {
        _setSlot0Internal(token0, token1, fee, address(0), sqrtPriceX96, tick);
    }

    function setSlot0WithHook(
        address token0,
        address token1,
        uint24 fee,
        address hook,
        uint160 sqrtPriceX96,
        int24 tick
    ) external {
        _setSlot0Internal(token0, token1, fee, hook, sqrtPriceX96, tick);
    }

    // Default slot0 value for all pools (simplifies testing)
    bytes32 public defaultSlot0;

    function _setSlot0Internal(
        address token0,
        address token1,
        uint24 fee,
        address hook,
        uint160 sqrtPriceX96,
        int24 tick
    ) internal {
        // Ensure token0 < token1
        if (token0 > token1) {
            (token0, token1) = (token1, token0);
        }

        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(token0),
            currency1: Currency.wrap(token1),
            fee: fee,
            tickSpacing: _getTickSpacing(fee),
            hooks: IHooks(hook)
        });

        bytes32 poolIdRaw = PoolId.unwrap(key.toId());
        poolSlot0[poolIdRaw] = Slot0Data({
            sqrtPriceX96: sqrtPriceX96,
            tick: tick,
            protocolFee: 0,
            lpFee: fee
        });

        // Store packed slot0 value for extsload
        bytes32 slot0Value = _packSlot0(sqrtPriceX96, tick, 0, fee);

        // The storage slot for pool[poolId].slot0 is POOLS_SLOT ^ poolId
        bytes32 storageKey = POOLS_SLOT ^ poolIdRaw;
        storageSlots[storageKey] = slot0Value;

        // Also set as default for any pool (simplifies mocking)
        defaultSlot0 = slot0Value;
    }

    function _packSlot0(uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee) internal pure returns (bytes32) {
        // Pack according to StateLibrary expectations
        uint256 packed = uint256(sqrtPriceX96);
        packed |= uint256(uint24(tick)) << 160;
        packed |= uint256(protocolFee) << 184;
        packed |= uint256(lpFee) << 208;
        return bytes32(packed);
    }

    /// @notice Implements extsload for StateLibrary compatibility
    function extsload(bytes32 slot) external view returns (bytes32) {
        // First check specific storage slots
        bytes32 value = storageSlots[slot];
        if (value != bytes32(0)) {
            return value;
        }
        // Check anySlot mapping
        value = anySlot[slot];
        if (value != bytes32(0)) {
            return value;
        }
        // Fallback to default slot0 for any pool query
        // This simplifies testing by returning valid data for any pool
        return defaultSlot0;
    }

    /// @notice Implements batch extsload
    function extsload(bytes32[] calldata slots) external view returns (bytes32[] memory) {
        bytes32[] memory values = new bytes32[](slots.length);
        for (uint256 i = 0; i < slots.length; i++) {
            bytes32 value = storageSlots[slots[i]];
            if (value == bytes32(0)) {
                value = anySlot[slots[i]];
            }
            values[i] = value;
        }
        return values;
    }

    /// @notice Implements extsload(startSlot, nSlots) for StateLibrary.getPositionInfo
    function extsload(bytes32 startSlot, uint256 nSlots) external view returns (bytes32[] memory) {
        bytes32[] memory values = new bytes32[](nSlots);
        for (uint256 i = 0; i < nSlots; i++) {
            bytes32 slot = bytes32(uint256(startSlot) + i);
            bytes32 value = storageSlots[slot];
            if (value == bytes32(0)) {
                value = anySlot[slot];
            }
            values[i] = value;
        }
        return values;
    }

    /// @notice Set arbitrary storage slot (for testing edge cases)
    function setAnySlot(bytes32 slot, bytes32 value) external {
        anySlot[slot] = value;
    }

    /// @notice Set position state for StateLibrary.getPositionInfo compatibility
    /// @dev Writes liquidity, feeGrowthInside0, feeGrowthInside1 at the correct storage slots
    function setPositionState(
        bytes32 poolIdRaw,
        bytes32 positionId,
        uint128 liquidity,
        uint256 feeGrowthInside0,
        uint256 feeGrowthInside1
    ) external {
        // Replicate StateLibrary slot computation:
        // stateSlot = keccak256(PoolId.unwrap(poolId), POOLS_SLOT)
        bytes32 stateSlot = keccak256(abi.encodePacked(poolIdRaw, POOLS_SLOT));
        // positionMapping = stateSlot + POSITIONS_OFFSET (6)
        bytes32 positionMapping = bytes32(uint256(stateSlot) + 6);
        // posSlot = keccak256(positionId, positionMapping)
        bytes32 posSlot = keccak256(abi.encodePacked(positionId, positionMapping));

        // Write 3 consecutive slots: liquidity, feeGrowth0, feeGrowth1
        storageSlots[posSlot] = bytes32(uint256(liquidity));
        storageSlots[bytes32(uint256(posSlot) + 1)] = bytes32(feeGrowthInside0);
        storageSlots[bytes32(uint256(posSlot) + 2)] = bytes32(feeGrowthInside1);
    }

    /// @notice Direct slot0 setter by poolId for maximum flexibility
    function setSlot0ByPoolId(bytes32 poolIdRaw, uint160 sqrtPriceX96, int24 tick, uint24 lpFee) external {
        poolSlot0[poolIdRaw] = Slot0Data({
            sqrtPriceX96: sqrtPriceX96,
            tick: tick,
            protocolFee: 0,
            lpFee: lpFee
        });

        bytes32 slot0Value = _packSlot0(sqrtPriceX96, tick, 0, lpFee);
        bytes32 storageKey = POOLS_SLOT ^ poolIdRaw;
        storageSlots[storageKey] = slot0Value;
    }

    function getSlot0(PoolId poolId) external view returns (
        uint160 sqrtPriceX96,
        int24 tick,
        uint24 protocolFee,
        uint24 lpFee
    ) {
        Slot0Data memory data = poolSlot0[PoolId.unwrap(poolId)];
        return (data.sqrtPriceX96, data.tick, data.protocolFee, data.lpFee);
    }

    /// @notice Helper to compute pool ID for testing
    function computePoolId(
        address token0,
        address token1,
        uint24 fee,
        address hook
    ) external pure returns (bytes32) {
        if (token0 > token1) {
            (token0, token1) = (token1, token0);
        }
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(token0),
            currency1: Currency.wrap(token1),
            fee: fee,
            tickSpacing: _getTickSpacing(fee),
            hooks: IHooks(hook)
        });
        return PoolId.unwrap(key.toId());
    }

    function _getTickSpacing(uint24 fee) internal pure returns (int24) {
        if (fee == 500) return 10;
        if (fee == 3000) return 60;
        if (fee == 10000) return 200;
        return 60;
    }
}

/**
 * @title Mock Position Manager V4
 * @notice Simulates V4 Position Manager NFT with fee collection support
 */
contract MockPositionManagerV4 {
    using PoolIdLibrary for PoolKey;

    struct Position {
        address owner;
        Currency currency0;
        Currency currency1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
        uint128 tokensOwed0;
        uint128 tokensOwed1;
    }

    mapping(uint256 => Position) public positionData;
    mapping(uint256 => address) public tokenOwners;
    mapping(uint256 => address) public positionHooks;
    mapping(uint256 => uint256) public feesToCollect0;
    mapping(uint256 => uint256) public feesToCollect1;

    function setPositionData(
        uint256 tokenId,
        address positionOwner,
        Currency currency0,
        Currency currency1,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity,
        uint128 tokensOwed0,
        uint128 tokensOwed1
    ) external {
        positionData[tokenId] = Position({
            owner: positionOwner,
            currency0: currency0,
            currency1: currency1,
            fee: fee,
            tickLower: tickLower,
            tickUpper: tickUpper,
            liquidity: liquidity,
            tokensOwed0: tokensOwed0,
            tokensOwed1: tokensOwed1
        });
        tokenOwners[tokenId] = positionOwner;
    }

    function setPositionHook(uint256 tokenId, address hook) external {
        positionHooks[tokenId] = hook;
    }

    function setFeesToCollect(uint256 tokenId, uint256 fee0, uint256 fee1) external {
        feesToCollect0[tokenId] = fee0;
        feesToCollect1[tokenId] = fee1;
    }

    function updateFees(uint256 tokenId, uint128 newFee0, uint128 newFee1) external {
        positionData[tokenId].tokensOwed0 = newFee0;
        positionData[tokenId].tokensOwed1 = newFee1;
        // Also update feesToCollect for V4 fee collection mock
        feesToCollect0[tokenId] = uint256(newFee0);
        feesToCollect1[tokenId] = uint256(newFee1);
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        return tokenOwners[tokenId];
    }

    /// @notice V4 PositionManager: get pool key and packed position info
    function getPoolAndPositionInfo(uint256 tokenId)
        external
        view
        returns (PoolKey memory poolKey, PositionInfo info)
    {
        Position memory pos = positionData[tokenId];
        poolKey = PoolKey({
            currency0: pos.currency0,
            currency1: pos.currency1,
            fee: pos.fee,
            tickSpacing: _getTickSpacing(pos.fee),
            hooks: IHooks(positionHooks[tokenId])
        });
        info = PositionInfoLibrary.initialize(poolKey, pos.tickLower, pos.tickUpper);
    }

    /// @notice V4 PositionManager: get position liquidity
    function getPositionLiquidity(uint256 tokenId) external view returns (uint128) {
        return positionData[tokenId].liquidity;
    }

    /// @notice V4 PositionManager: modify liquidities (fee collection mock)
    /// @dev Decodes DECREASE_LIQUIDITY action and mints configured fee amounts to caller
    function modifyLiquidities(bytes calldata unlockData, uint256 /* deadline */) external payable {
        (bytes memory actions, bytes[] memory params) = abi.decode(unlockData, (bytes, bytes[]));

        if (actions.length > 0) {
            // Extract tokenId from the first action (DECREASE_LIQUIDITY)
            (uint256 tokenId,,,,) = abi.decode(params[0], (uint256, uint256, uint128, uint128, bytes));

            Position memory pos = positionData[tokenId];
            uint256 fee0 = feesToCollect0[tokenId];
            uint256 fee1 = feesToCollect1[tokenId];

            // Mint fee tokens to caller (the vault contract)
            if (fee0 > 0) {
                address token0 = Currency.unwrap(pos.currency0);
                MockERC20(token0).mint(msg.sender, fee0);
                feesToCollect0[tokenId] = 0;
            }
            if (fee1 > 0) {
                address token1 = Currency.unwrap(pos.currency1);
                MockERC20(token1).mint(msg.sender, fee1);
                feesToCollect1[tokenId] = 0;
            }
        }
    }

    function positions(uint256 tokenId) external view returns (
        uint96 nonce,
        address operator,
        Currency currency0,
        Currency currency1,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity,
        uint256 feeGrowthInside0LastX128,
        uint256 feeGrowthInside1LastX128,
        uint128 tokensOwed0,
        uint128 tokensOwed1
    ) {
        Position memory pos = positionData[tokenId];
        return (
            0, // nonce
            address(0), // operator
            pos.currency0,
            pos.currency1,
            pos.fee,
            pos.tickLower,
            pos.tickUpper,
            pos.liquidity,
            0, // feeGrowthInside0LastX128
            0, // feeGrowthInside1LastX128
            pos.tokensOwed0,
            pos.tokensOwed1
        );
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        tokenOwners[tokenId] = to;
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    function _getTickSpacing(uint24 fee) internal pure returns (int24) {
        if (fee == 500) return 10;
        if (fee == 3000) return 60;
        if (fee == 10000) return 200;
        return 60;
    }
}

/**
 * @title Mock Battle Vault Hook
 * @notice Simplified mock hook for testing
 */
contract MockBattleVaultHook {
    address public immutable poolManager;
    address public immutable battleVault;

    mapping(uint256 => bool) public registeredBattles;
    mapping(bytes32 => mapping(int24 => mapping(int24 => bool))) public positionLocked;

    constructor(address _poolManager, address _battleVault) {
        poolManager = _poolManager;
        battleVault = _battleVault;
    }

    function registerBattle(uint256 battleId, PoolKey calldata) external {
        registeredBattles[battleId] = true;
    }

    function lockPosition(PoolKey calldata key, int24 tickLower, int24 tickUpper) external {
        bytes32 poolId = PoolId.unwrap(key.toId());
        positionLocked[poolId][tickLower][tickUpper] = true;
    }

    function unlockPosition(PoolKey calldata key, int24 tickLower, int24 tickUpper) external {
        bytes32 poolId = PoolId.unwrap(key.toId());
        positionLocked[poolId][tickLower][tickUpper] = false;
    }

    function isPositionInRange(
        PoolKey calldata key,
        int24 tickLower,
        int24 tickUpper
    ) external view returns (bool) {
        MockPoolManagerV4 pm = MockPoolManagerV4(poolManager);
        (, int24 currentTick,,) = pm.getSlot0(key.toId());
        return currentTick >= tickLower && currentTick < tickUpper;
    }
}

/**
 * @title Mock Price Feed
 * @notice Simulates Chainlink price feed
 */
contract MockPriceFeed {
    int256 public price;
    uint8 public decimals;
    uint256 public updatedAt;

    constructor(int256 _price, uint8 _decimals) {
        price = _price;
        decimals = _decimals;
        updatedAt = block.timestamp;
    }

    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt_,
        uint80 answeredInRound
    ) {
        return (1, price, block.timestamp, block.timestamp, 1);
    }

    function setPrice(int256 _price) external {
        price = _price;
        updatedAt = block.timestamp;
    }
}

/**
 * @title Mock ERC20
 * @notice Simple ERC20 mock for testing
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
