// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {LPBattleVaultV4} from "../src/LPBattleVaultV4.sol";
import {LPFeeBattleV4} from "../src/LPFeeBattleV4.sol";
import {BattleVaultHook} from "../src/hooks/BattleVaultHook.sol";

contract Setup is Script {
    address constant BTC_USD_FEED = 0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43;
    address constant BTC_ETH_FEED = 0x5fb1616F78dA7aFC9FF79e0371741a747D2a7F22;
    address constant AUD_USD_FEED = 0xB0C712f98daE15264c8E26132BCC91C40aD4d5F9;
    address constant CZK_USD_FEED = 0xC32f0A9D70A34B9E7377C10FDAd88512596f61EA;
    address constant DAI_USD_FEED = 0x14866185B1962B63C3Ea9E03Bc1da838bab34C19;
    address constant ETH_USD_FEED = 0x694AA1769357215DE4FAC081bf1f309aDC325306;
    address constant LINK_USD_FEED = 0xc59E3633BAAC79493d908e63626716e204A45EdF;
    address constant USDC_USD_FEED = 0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E;

    address constant WETH = address(0);
    address constant WBTC = 0x29f2D40B0605204364af54EC677bD022dA425d03;
    address constant DAI = 0x68194a729C2450ad26072b3D33ADaCbcef39D574;
    address constant LINK = 0x779877A7B0D9E8603169DdbD7836e478b4624789;
    address constant USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;

    LPBattleVaultV4 public rangeVault;
    LPFeeBattleV4 public feeVault;
    BattleVaultHook public hook;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address poolManager = vm.envAddress("POOL_MANAGER");
        address positionManager = vm.envAddress("POSITION_MANAGER");

        vm.startBroadcast(deployerPrivateKey);

        console.log("=== Deploying LP BattleVault V4 System ===");
        console.log("Network: Sepolia");
        console.log("PoolManager:", poolManager);
        console.log("PositionManager:", positionManager);
        console.log("");

        rangeVault = new LPBattleVaultV4(poolManager);
        console.log("1. LPBattleVaultV4 (Range Battle) deployed at:", address(rangeVault));

        feeVault = new LPFeeBattleV4(poolManager);
        console.log("2. LPFeeBattleV4 (Fee Battle) deployed at:", address(feeVault));

        hook = new BattleVaultHook(
            IPoolManager(poolManager),
            address(rangeVault)
        );
        console.log("3. BattleVaultHook deployed at:", address(hook));

        console.log("\n--- Configuring Range Vault ---");
        rangeVault.setPositionManager(positionManager);
        rangeVault.setBattleHook(address(hook));
        _setupPriceFeeds(rangeVault);
        _setupStablecoins(rangeVault);
        console.log("Range Vault configured");

        console.log("\n--- Configuring Fee Vault ---");
        feeVault.setPositionManager(positionManager);
        _setupPriceFeedsForFeeVault(feeVault);
        _setupStablecoinsForFeeVault(feeVault);
        console.log("Fee Vault configured");

        vm.stopBroadcast();

        console.log("\n========================================");
        console.log("=== Deployment Complete ===");
        console.log("========================================");
        console.log("Network: Sepolia");
        console.log("");
        console.log("Contracts:");
        console.log("  Range Vault:", address(rangeVault));
        console.log("  Fee Vault:", address(feeVault));
        console.log("  Hook:", address(hook));
        console.log("");
        console.log("Price Feeds Configured:");
        console.log("  ETH/USD:", ETH_USD_FEED);
        console.log("  BTC/USD:", BTC_USD_FEED);
        console.log("  LINK/USD:", LINK_USD_FEED);
        console.log("  USDC/USD:", USDC_USD_FEED);
        console.log("  DAI/USD:", DAI_USD_FEED);
        console.log("========================================");
    }

    function _setupPriceFeeds(LPBattleVaultV4 vault) internal {
        vault.setPriceFeed(WETH, ETH_USD_FEED);

        if (WBTC != address(0)) {
            vault.setPriceFeed(WBTC, BTC_USD_FEED);
        }

        if (DAI != address(0)) {
            vault.setPriceFeed(DAI, DAI_USD_FEED);
        }

        if (LINK != address(0)) {
            vault.setPriceFeed(LINK, LINK_USD_FEED);
        }

        if (USDC != address(0)) {
            vault.setPriceFeed(USDC, USDC_USD_FEED);
        }
    }

    function _setupStablecoins(LPBattleVaultV4 vault) internal {
        if (USDC != address(0)) {
            vault.setStablecoin(USDC, true);
        }
        if (DAI != address(0)) {
            vault.setStablecoin(DAI, true);
        }
    }

    function _setupPriceFeedsForFeeVault(LPFeeBattleV4 vault) internal {
        vault.setPriceFeed(WETH, ETH_USD_FEED);

        if (WBTC != address(0)) {
            vault.setPriceFeed(WBTC, BTC_USD_FEED);
        }

        // DAI/USD
        if (DAI != address(0)) {
            vault.setPriceFeed(DAI, DAI_USD_FEED);
        }

        // LINK/USD
        if (LINK != address(0)) {
            vault.setPriceFeed(LINK, LINK_USD_FEED);
        }

        // USDC/USD
        if (USDC != address(0)) {
            vault.setPriceFeed(USDC, USDC_USD_FEED);
        }
    }

    function _setupStablecoinsForFeeVault(LPFeeBattleV4 vault) internal {
        if (USDC != address(0)) {
            vault.setStablecoin(USDC, true);
        }
        if (DAI != address(0)) {
            vault.setStablecoin(DAI, true);
        }
    }
}

/// @title Deploy Range Vault Only
/// @notice Deploys only the Range Battle vault
contract DeployRangeVault is Script {
    address constant ETH_USD_FEED = 0x694AA1769357215DE4FAC081bf1f309aDC325306;
    address constant BTC_USD_FEED = 0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43;
    address constant LINK_USD_FEED = 0xc59E3633BAAC79493d908e63626716e204A45EdF;
    address constant USDC_USD_FEED = 0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E;
    address constant DAI_USD_FEED = 0x14866185B1962B63C3Ea9E03Bc1da838bab34C19;

    address constant WBTC = 0x29f2D40B0605204364af54EC677bD022dA425d03;
    address constant DAI = 0x68194a729C2450ad26072b3D33ADaCbcef39D574;
    address constant LINK = 0x779877A7B0D9E8603169DdbD7836e478b4624789;
    address constant USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address poolManager = vm.envAddress("POOL_MANAGER");
        address positionManager = vm.envAddress("POSITION_MANAGER");

        vm.startBroadcast(deployerPrivateKey);

        LPBattleVaultV4 vault = new LPBattleVaultV4(poolManager);
        console.log("LPBattleVaultV4 deployed at:", address(vault));

        BattleVaultHook hook = new BattleVaultHook(
            IPoolManager(poolManager),
            address(vault)
        );
        console.log("BattleVaultHook deployed at:", address(hook));

        vault.setPositionManager(positionManager);
        vault.setBattleHook(address(hook));

        // Setup price feeds
        vault.setPriceFeed(address(0), ETH_USD_FEED);
        vault.setPriceFeed(WBTC, BTC_USD_FEED);
        vault.setPriceFeed(LINK, LINK_USD_FEED);
        vault.setPriceFeed(USDC, USDC_USD_FEED);
        vault.setPriceFeed(DAI, DAI_USD_FEED);

        // Setup stablecoins
        vault.setStablecoin(USDC, true);
        vault.setStablecoin(DAI, true);

        vm.stopBroadcast();

        console.log("\nRange Vault deployment complete");
    }
}

/// @title Deploy Fee Vault Only
/// @notice Deploys only the Fee Battle vault
contract DeployFeeVault is Script {
    address constant ETH_USD_FEED = 0x694AA1769357215DE4FAC081bf1f309aDC325306;
    address constant BTC_USD_FEED = 0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43;
    address constant LINK_USD_FEED = 0xc59E3633BAAC79493d908e63626716e204A45EdF;
    address constant USDC_USD_FEED = 0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E;
    address constant DAI_USD_FEED = 0x14866185B1962B63C3Ea9E03Bc1da838bab34C19;

    address constant WBTC = 0x29f2D40B0605204364af54EC677bD022dA425d03;
    address constant DAI = 0x68194a729C2450ad26072b3D33ADaCbcef39D574;
    address constant LINK = 0x779877A7B0D9E8603169DdbD7836e478b4624789;
    address constant USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address poolManager = vm.envAddress("POOL_MANAGER");
        address positionManager = vm.envAddress("POSITION_MANAGER");

        vm.startBroadcast(deployerPrivateKey);

        LPFeeBattleV4 vault = new LPFeeBattleV4(poolManager);
        console.log("LPFeeBattleV4 deployed at:", address(vault));

        vault.setPositionManager(positionManager);

        // Setup price feeds
        vault.setPriceFeed(address(0), ETH_USD_FEED);
        vault.setPriceFeed(WBTC, BTC_USD_FEED);
        vault.setPriceFeed(LINK, LINK_USD_FEED);
        vault.setPriceFeed(USDC, USDC_USD_FEED);
        vault.setPriceFeed(DAI, DAI_USD_FEED);

        // Setup stablecoins
        vault.setStablecoin(USDC, true);
        vault.setStablecoin(DAI, true);

        vm.stopBroadcast();

        console.log("\nFee Vault deployment complete");
    }
}

/// @title Configure Existing Deployment
/// @notice Configures price feeds on existing deployments
contract ConfigureDeployment is Script {
    address constant ETH_USD_FEED = 0x694AA1769357215DE4FAC081bf1f309aDC325306;
    address constant BTC_USD_FEED = 0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43;
    address constant LINK_USD_FEED = 0xc59E3633BAAC79493d908e63626716e204A45EdF;
    address constant USDC_USD_FEED = 0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E;
    address constant DAI_USD_FEED = 0x14866185B1962B63C3Ea9E03Bc1da838bab34C19;

    address constant WBTC = 0x29f2D40B0605204364af54EC677bD022dA425d03;
    address constant DAI = 0x68194a729C2450ad26072b3D33ADaCbcef39D574;
    address constant LINK = 0x779877A7B0D9E8603169DdbD7836e478b4624789;
    address constant USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address rangeVaultAddress = vm.envAddress("RANGE_VAULT");
        address feeVaultAddress = vm.envAddress("FEE_VAULT");

        vm.startBroadcast(deployerPrivateKey);

        // Configure Range Vault if provided
        if (rangeVaultAddress != address(0)) {
            LPBattleVaultV4 rangeVault = LPBattleVaultV4(rangeVaultAddress);

            rangeVault.setPriceFeed(address(0), ETH_USD_FEED);
            rangeVault.setPriceFeed(WBTC, BTC_USD_FEED);
            rangeVault.setPriceFeed(LINK, LINK_USD_FEED);
            rangeVault.setPriceFeed(USDC, USDC_USD_FEED);
            rangeVault.setPriceFeed(DAI, DAI_USD_FEED);

            rangeVault.setStablecoin(USDC, true);
            rangeVault.setStablecoin(DAI, true);

            console.log("Range Vault configured:", rangeVaultAddress);
        }

        // Configure Fee Vault if provided
        if (feeVaultAddress != address(0)) {
            LPFeeBattleV4 feeVault = LPFeeBattleV4(feeVaultAddress);

            feeVault.setPriceFeed(address(0), ETH_USD_FEED);
            feeVault.setPriceFeed(WBTC, BTC_USD_FEED);
            feeVault.setPriceFeed(LINK, LINK_USD_FEED);
            feeVault.setPriceFeed(USDC, USDC_USD_FEED);
            feeVault.setPriceFeed(DAI, DAI_USD_FEED);

            feeVault.setStablecoin(USDC, true);
            feeVault.setStablecoin(DAI, true);

            console.log("Fee Vault configured:", feeVaultAddress);
        }

        vm.stopBroadcast();
    }
}
