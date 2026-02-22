// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";

import {BattleArena} from "../src/core/BattleArena.sol";
import {UniswapV4Adapter} from "../src/adapters/UniswapV4Adapter.sol";
import {CamelotAdapter} from "../src/adapters/CamelotAdapter.sol";
import {BattleVaultHook} from "../src/hooks/BattleVaultHook.sol";
import {IBattleArena} from "../src/core/interfaces/IBattleArena.sol";
import {ArbitrumSepoliaConstants as C} from "../src/libraries/ArbitrumSepoliaConstants.sol";

/// @title DeployBattleArena - Full deployment script for Arbitrum Sepolia
/// @notice Deploys BattleArena + UniswapV4Adapter + CamelotAdapter, then wires everything
contract DeployBattleArena is Script {
    function run() external {
        // ============ Load env ============
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address scoringEngine = vm.envAddress("SCORING_ENGINE");
        address leaderboardAddr = vm.envAddress("LEADERBOARD");

        vm.startBroadcast(deployerPrivateKey);

        address deployer = vm.addr(deployerPrivateKey);
        console.log("=== Deploying Minimax BattleArena System ===");
        console.log("Network: Arbitrum Sepolia");
        console.log("Deployer:", deployer);
        console.log("Scoring Engine (Stylus):", scoringEngine);
        console.log("Leaderboard (Stylus):", leaderboardAddr);
        console.log("");

        // ============ 1. Deploy BattleArena ============
        BattleArena arena = new BattleArena(scoringEngine, leaderboardAddr);
        console.log("1. BattleArena deployed at:", address(arena));

        // ============ 2. Deploy UniswapV4Adapter ============
        UniswapV4Adapter v4Adapter = new UniswapV4Adapter(
            address(arena),
            C.V4_POOL_MANAGER,
            C.V4_POSITION_MANAGER
        );
        console.log("2. UniswapV4Adapter deployed at:", address(v4Adapter));

        // ============ 3. Deploy CamelotAdapter ============
        CamelotAdapter camelotAdapter = new CamelotAdapter(
            address(arena),
            C.CAMELOT_NFT_MANAGER,
            C.CAMELOT_FACTORY
        );
        console.log("3. CamelotAdapter deployed at:", address(camelotAdapter));

        // ============ 4. Register Adapters ============
        arena.registerAdapter(IBattleArena.DexType.UNISWAP_V4, address(v4Adapter));
        console.log("4. Registered UniswapV4Adapter");

        arena.registerAdapter(IBattleArena.DexType.CAMELOT_V3, address(camelotAdapter));
        console.log("5. Registered CamelotAdapter");

        // ============ 5. Configure V4 Adapter Price Feeds ============
        v4Adapter.setPriceFeed(address(0), C.ETH_USD_FEED); // Native ETH
        v4Adapter.setPriceFeed(C.WETH, C.ETH_USD_FEED);
        v4Adapter.setStablecoin(C.USDC, true);
        v4Adapter.setTokenDecimals(C.USDC, 6);
        console.log("6. V4 Adapter price feeds configured");

        // ============ 6. Configure Camelot Adapter Price Feeds ============
        camelotAdapter.setPriceFeed(address(0), C.ETH_USD_FEED);
        camelotAdapter.setPriceFeed(C.WETH, C.ETH_USD_FEED);
        camelotAdapter.setStablecoin(C.USDC, true);
        camelotAdapter.setTokenDecimals(C.USDC, 6);
        console.log("7. Camelot Adapter price feeds configured");

        vm.stopBroadcast();

        // ============ Summary ============
        console.log("\n========================================");
        console.log("=== Deployment Complete ===");
        console.log("========================================");
        console.log("");
        console.log("Contracts:");
        console.log("  BattleArena:       ", address(arena));
        console.log("  UniswapV4Adapter:  ", address(v4Adapter));
        console.log("  CamelotAdapter:    ", address(camelotAdapter));
        console.log("");
        console.log("Stylus Contracts:");
        console.log("  ScoringEngine:     ", scoringEngine);
        console.log("  Leaderboard:       ", leaderboardAddr);
        console.log("");
        console.log("Infrastructure:");
        console.log("  V4 PoolManager:    ", C.V4_POOL_MANAGER);
        console.log("  V4 PositionManager:", C.V4_POSITION_MANAGER);
        console.log("  Camelot Factory:   ", C.CAMELOT_FACTORY);
        console.log("  Camelot NFTManager:", C.CAMELOT_NFT_MANAGER);
        console.log("");
        console.log("Price Feeds:");
        console.log("  ETH/USD:           ", C.ETH_USD_FEED);
        console.log("  USDC/USD:          ", C.USDC_USD_FEED);
        console.log("");
        console.log("NEXT STEPS:");
        console.log("  1. Initialize leaderboard: call initialize(arenaAddr, deployerAddr)");
        console.log("  2. (Optional) Deploy BattleVaultHook via CREATE2");
        console.log("  3. Fund deployer with testnet ETH if needed");
        console.log("========================================");
    }
}
