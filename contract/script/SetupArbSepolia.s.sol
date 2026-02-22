// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";

import {Actions} from "v4-periphery/src/libraries/Actions.sol";
import {HookMiner} from "v4-periphery/src/utils/HookMiner.sol";

import {BattleVaultHook} from "../src/hooks/BattleVaultHook.sol";
import {BattleArena} from "../src/core/BattleArena.sol";
import {UniswapV4Adapter} from "../src/adapters/UniswapV4Adapter.sol";
import {IBattleArena} from "../src/core/interfaces/IBattleArena.sol";
import {IPositionManager} from "../src/interfaces/IShared.sol";
import {ArbitrumSepoliaConstants as C} from "../src/libraries/ArbitrumSepoliaConstants.sol";

// ============ Camelot Interfaces for Pool Creation ============

interface IAlgebraFactory {
    function createPool(address tokenA, address tokenB) external returns (address pool);
    function poolByPair(address tokenA, address tokenB) external view returns (address pool);
}

interface IAlgebraPool {
    function initialize(uint160 initialPrice) external;
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

interface ICamelotNFTManager {
    struct MintParams {
        address token0;
        address token1;
        int24 tickLower;
        int24 tickUpper;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        address recipient;
        uint256 deadline;
    }

    function mint(MintParams calldata params)
        external
        payable
        returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1);
}

// ============ Permit2 Interface ============

interface IPermit2 {
    function approve(address token, address spender, uint160 amount, uint48 expiration) external;
}

// ============ Leaderboard Interface ============

interface ILeaderboard {
    function initialize(address arena, address owner) external;
    function getPlayerStats(address player)
        external
        view
        returns (uint256 elo, uint256 wins, uint256 losses, uint256 totalBattles, uint256 totalValueWon);
}

// ============ WETH Interface ============

interface IWETH {
    function deposit() external payable;
    function balanceOf(address) external view returns (uint256);
}

/// @title SetupArbSepolia - Complete testnet infrastructure bootstrapping
/// @notice Deploys hook, creates pools, mints LP positions, initializes leaderboard
/// @dev Run with: forge script script/SetupArbSepolia.s.sol --rpc-url $RPC_URL --broadcast -vvvv
contract SetupArbSepolia is Script {
    using PoolIdLibrary for PoolKey;

    // ============ Deployed Contracts (from .env) ============
    address constant BATTLE_ARENA = 0x478505eb07B3C8943A642E51F066bcF8aC8ed51d;
    address constant V4_ADAPTER = 0x244C49E7986feC5BaD7C567d588B9262eF5e0604;
    address constant CAMELOT_ADAPTER = 0x5442068A4Cd117F26047c89f0A87D635112c886E;
    address constant SCORING_ENGINE = 0xd34fFbE6D046cB1A3450768664caF97106d18204;
    address constant LEADERBOARD = 0x7FEB2cf23797Fd950380CD9aD4B7D4cAd4B3C85B;

    // ============ V4 Pool Parameters ============
    // WETH (0x980B...) < USDC (0xb893...) so WETH = currency0, USDC = currency1
    uint24 constant V4_FEE = 3000; // 0.3%
    int24 constant V4_TICK_SPACING = 60;

    // Tick for ~$2600 WETH/USDC with WETH(18dec) as token0, USDC(6dec) as token1
    // price = 1.0001^tick * 10^(18-6) = 1.0001^tick * 1e12
    // We want price = 2600, so 1.0001^tick = 2600 / 1e12 = 2.6e-9
    // tick = ln(2.6e-9) / ln(1.0001) = -197_511 approximately
    // Rounded to tickSpacing 60: -197_520
    int24 constant CURRENT_TICK = -197_520;

    // Wide range: ~$1800 to ~$3500
    int24 constant WIDE_TICK_LOWER = -201_180; // ~$1800
    int24 constant WIDE_TICK_UPPER = -194_280; // ~$3500

    // Narrow range: ~$2400 to ~$2800
    int24 constant NARROW_TICK_LOWER = -198_300; // ~$2400
    int24 constant NARROW_TICK_UPPER = -196_800; // ~$2800

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("========================================");
        console.log("=== Minimax Arbitrum Sepolia Setup ===");
        console.log("========================================");
        console.log("Deployer:", deployer);
        console.log("Chain: Arbitrum Sepolia (421614)");
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // ========================================
        // STEP 1: Wrap ETH to WETH if needed
        // ========================================
        uint256 wethBalance = IERC20(C.WETH).balanceOf(deployer);
        console.log("Current WETH balance:", wethBalance);

        if (wethBalance < 0.01 ether) {
            console.log("Wrapping 0.03 ETH to WETH...");
            IWETH(C.WETH).deposit{value: 0.03 ether}();
            wethBalance = IERC20(C.WETH).balanceOf(deployer);
            console.log("New WETH balance:", wethBalance);
        }

        uint256 usdcBalance = IERC20(C.USDC).balanceOf(deployer);
        console.log("Current USDC balance:", usdcBalance);
        require(usdcBalance >= 10e6, "Need at least 10 USDC. Get from faucet.circle.com");
        console.log("");

        // ========================================
        // STEP 2: Mine + Deploy BattleVaultHook
        // ========================================
        console.log("--- Step 2: Mining + Deploying BattleVaultHook ---");

        uint160 flags = uint160(
            Hooks.BEFORE_ADD_LIQUIDITY_FLAG | Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG | Hooks.AFTER_SWAP_FLAG
        );

        (, bytes32 salt) = HookMiner.find(
            0x4e59b44847b379578588920cA78FbF26c0B4956C, // CREATE2 Deployer Proxy
            flags,
            type(BattleVaultHook).creationCode,
            abi.encode(IPoolManager(C.V4_POOL_MANAGER), BATTLE_ARENA)
        );

        BattleVaultHook hook = new BattleVaultHook{salt: salt}(
            IPoolManager(C.V4_POOL_MANAGER),
            BATTLE_ARENA
        );
        console.log("BattleVaultHook deployed at:", address(hook));

        // Wire hook to V4 Adapter
        UniswapV4Adapter(payable(V4_ADAPTER)).setBattleHook(address(hook));
        console.log("Hook wired to V4Adapter");
        console.log("");

        // ========================================
        // STEP 3: Initialize V4 WETH/USDC Pool
        // ========================================
        console.log("--- Step 3: Initializing V4 WETH/USDC Pool ---");

        // Verify token sort order
        require(C.WETH < C.USDC, "Token sort error: WETH must be < USDC");

        PoolKey memory v4PoolKey = PoolKey({
            currency0: Currency.wrap(C.WETH),
            currency1: Currency.wrap(C.USDC),
            fee: V4_FEE,
            tickSpacing: V4_TICK_SPACING,
            hooks: IHooks(address(hook))
        });

        // sqrtPriceX96 from tick
        uint160 sqrtPriceX96 = TickMath.getSqrtPriceAtTick(CURRENT_TICK);
        console.log("Initializing V4 pool at sqrtPriceX96:", uint256(sqrtPriceX96));

        IPoolManager(C.V4_POOL_MANAGER).initialize(v4PoolKey, sqrtPriceX96);
        console.log("V4 WETH/USDC pool initialized");

        PoolId v4PoolId = v4PoolKey.toId();
        console.log("V4 Pool ID:");
        console.logBytes32(PoolId.unwrap(v4PoolId));
        console.log("");

        // ========================================
        // STEP 4: Create Camelot WETH/USDC Pool
        // ========================================
        console.log("--- Step 4: Creating Camelot WETH/USDC Pool ---");

        address camelotPool = IAlgebraFactory(C.CAMELOT_FACTORY).poolByPair(C.WETH, C.USDC);

        if (camelotPool == address(0)) {
            console.log("Creating new Camelot pool...");
            camelotPool = IAlgebraFactory(C.CAMELOT_FACTORY).createPool(C.WETH, C.USDC);
            console.log("Camelot pool created at:", camelotPool);

            // Initialize with same price
            IAlgebraPool(camelotPool).initialize(sqrtPriceX96);
            console.log("Camelot pool initialized");
        } else {
            console.log("Camelot WETH/USDC pool already exists at:", camelotPool);
        }
        console.log("");

        // ========================================
        // STEP 5: Approve tokens for V4 via Permit2
        // ========================================
        console.log("--- Step 5: Token Approvals for V4 ---");

        // Approve WETH + USDC to Permit2
        IERC20(C.WETH).approve(C.PERMIT2, type(uint256).max);
        IERC20(C.USDC).approve(C.PERMIT2, type(uint256).max);
        console.log("Tokens approved to Permit2");

        // Approve PositionManager via Permit2
        IPermit2(C.PERMIT2).approve(C.WETH, C.V4_POSITION_MANAGER, type(uint160).max, type(uint48).max);
        IPermit2(C.PERMIT2).approve(C.USDC, C.V4_POSITION_MANAGER, type(uint160).max, type(uint48).max);
        console.log("Permit2 approved PositionManager for WETH + USDC");
        console.log("");

        // ========================================
        // STEP 6: Mint V4 LP Position (Wide Range)
        // ========================================
        console.log("--- Step 6: Minting V4 LP Position (Wide) ---");
        console.log("Range: wide ticks for ~$1800-$3500");

        _mintV4Position(
            v4PoolKey,
            WIDE_TICK_LOWER,
            WIDE_TICK_UPPER,
            0.01 ether, // ~0.01 WETH
            30e6, // 30 USDC
            deployer
        );
        console.log("V4 Position (wide range) minted");
        console.log("");

        // ========================================
        // STEP 7: Approve tokens for Camelot
        // ========================================
        console.log("--- Step 7: Token Approvals for Camelot ---");

        IERC20(C.WETH).approve(C.CAMELOT_NFT_MANAGER, type(uint256).max);
        IERC20(C.USDC).approve(C.CAMELOT_NFT_MANAGER, type(uint256).max);
        console.log("Tokens approved to Camelot NFT Manager");
        console.log("");

        // ========================================
        // STEP 8: Mint Camelot LP Position (Wide Range)
        // ========================================
        console.log("--- Step 8: Minting Camelot LP Position (Wide) ---");

        _mintCamelotPosition(
            WIDE_TICK_LOWER,
            WIDE_TICK_UPPER,
            0.01 ether, // ~0.01 WETH
            30e6, // 30 USDC
            deployer
        );
        console.log("Camelot Position (wide range) minted");
        console.log("");

        // ========================================
        // STEP 9: Initialize Leaderboard (SKIPPED)
        // ========================================
        // Note: Leaderboard is a Stylus (Rust/WASM) contract — Foundry cannot simulate
        // Stylus opcodes. Initialize it separately via cast:
        //   cast send 0x7FEB2cf23797Fd950380CD9aD4B7D4cAd4B3C85B "initialize(address,address)" \
        //     0x478505eb07B3C8943A642E51F066bcF8aC8ed51d <deployer> --private-key $PK --rpc-url $RPC
        console.log("--- Step 9: Leaderboard (Stylus) ---");
        console.log("Skipped: initialize Leaderboard via cast send after this script");
        console.log("");

        // ========================================
        // STEP 10: Verify deployment
        // ========================================
        console.log("--- Step 12: Verification ---");

        uint256 battleCount = BattleArena(BATTLE_ARENA).battleCount();
        console.log("Current battle count:", battleCount);

        vm.stopBroadcast();

        // ========================================
        // Summary
        // ========================================
        console.log("");
        console.log("========================================");
        console.log("=== Setup Complete ===");
        console.log("========================================");
        console.log("");
        console.log("Infrastructure:");
        console.log("  BattleVaultHook:   ", address(hook));
        console.log("  V4 Pool (WETH/USDC): initialized");
        console.log("  Camelot Pool:      ", camelotPool);
        console.log("");
        console.log("Existing Contracts:");
        console.log("  BattleArena:       ", BATTLE_ARENA);
        console.log("  V4 Adapter:        ", V4_ADAPTER);
        console.log("  Camelot Adapter:   ", CAMELOT_ADAPTER);
        console.log("  Scoring Engine:    ", SCORING_ENGINE);
        console.log("  Leaderboard:       ", LEADERBOARD);
        console.log("");
        console.log("NEXT STEPS:");
        console.log("  1. Note the minted token IDs from the tx logs");
        console.log("  2. Create a battle: BattleArena.createBattle(0, tokenId, 300, 0)");
        console.log("  3. Join with second account or Camelot position");
        console.log("  4. Start the agent: cd agent && npx tsx src/index.ts serve");
        console.log("  5. Update frontend hook address in contracts.ts");
        console.log("========================================");
    }

    // ============ Internal: Mint V4 Position ============

    function _mintV4Position(
        PoolKey memory poolKey,
        int24 tickLower,
        int24 tickUpper,
        uint256 amount0Max,
        uint256 amount1Max,
        address recipient
    ) internal {
        // Build actions: MINT_POSITION + CLOSE_CURRENCY + CLOSE_CURRENCY
        bytes memory actions = abi.encodePacked(
            uint8(Actions.MINT_POSITION),
            uint8(Actions.CLOSE_CURRENCY),
            uint8(Actions.CLOSE_CURRENCY)
        );

        // Build params
        bytes[] memory params = new bytes[](3);

        // MINT_POSITION params: poolKey, tickLower, tickUpper, liquidity, amount0Max, amount1Max, recipient, hookData
        // We pass amounts as max and let the PM calculate liquidity
        // Scaled down for testnet budget (~0.01 WETH per position)
        uint256 liquidityAmount = 3e12;

        params[0] = abi.encode(
            poolKey,
            tickLower,
            tickUpper,
            liquidityAmount,
            uint128(amount0Max),
            uint128(amount1Max),
            recipient,
            bytes("")
        );
        params[1] = abi.encode(poolKey.currency0);
        params[2] = abi.encode(poolKey.currency1);

        // Encode and call modifyLiquidities
        bytes memory unlockData = abi.encode(actions, params);
        IPositionManager(C.V4_POSITION_MANAGER).modifyLiquidities(unlockData, block.timestamp + 300);
    }

    // ============ Internal: Mint Camelot Position ============

    function _mintCamelotPosition(
        int24 tickLower,
        int24 tickUpper,
        uint256 amount0Desired,
        uint256 amount1Desired,
        address recipient
    ) internal {
        // Camelot uses token0 < token1 ordering (same as V4)
        address token0 = C.WETH < C.USDC ? C.WETH : C.USDC;
        address token1 = C.WETH < C.USDC ? C.USDC : C.WETH;

        // If WETH is token0, amounts stay as-is
        // If USDC is token0, swap amounts
        uint256 amt0 = token0 == C.WETH ? amount0Desired : amount1Desired;
        uint256 amt1 = token0 == C.WETH ? amount1Desired : amount0Desired;

        ICamelotNFTManager.MintParams memory mintParams = ICamelotNFTManager.MintParams({
            token0: token0,
            token1: token1,
            tickLower: tickLower,
            tickUpper: tickUpper,
            amount0Desired: amt0,
            amount1Desired: amt1,
            amount0Min: 0, // No slippage protection for testnet
            amount1Min: 0,
            recipient: recipient,
            deadline: block.timestamp + 300
        });

        ICamelotNFTManager(C.CAMELOT_NFT_MANAGER).mint(mintParams);
    }
}
