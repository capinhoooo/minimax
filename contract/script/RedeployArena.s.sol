// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {Actions} from "v4-periphery/src/libraries/Actions.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IPositionManager} from "../src/interfaces/IShared.sol";
import {ArbitrumSepoliaConstants as C} from "../src/libraries/ArbitrumSepoliaConstants.sol";

import {BattleArena} from "../src/core/BattleArena.sol";
import {IBattleArena} from "../src/core/interfaces/IBattleArena.sol";
import {UniswapV4Adapter} from "../src/adapters/UniswapV4Adapter.sol";

interface IPermit2 {
    function approve(address token, address spender, uint160 amount, uint48 expiration) external;
}

/// @title RedeployArena - Deploy new BattleArena + Adapter, wire up, mint positions, run battle
contract RedeployArena is Script {
    address constant SCORING_ENGINE = 0xd34fFbE6D046cB1A3450768664caF97106d18204;
    address constant LEADERBOARD = 0x7FEB2cf23797Fd950380CD9aD4B7D4cAd4B3C85B;
    address constant HOOK = 0x51ed077265dC54B2AFdBf26181b48f7314B44A40;

    function run() external {
        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPk);
        console.log("Deployer:", deployer);

        vm.startBroadcast(deployerPk);

        // 1. Deploy new BattleArena
        BattleArena arena = new BattleArena(SCORING_ENGINE, LEADERBOARD);
        console.log("New BattleArena:", address(arena));

        // 2. Deploy new V4 Adapter pointing to new arena
        UniswapV4Adapter adapter = new UniswapV4Adapter(
            address(arena),
            C.V4_POOL_MANAGER,
            C.V4_POSITION_MANAGER
        );
        console.log("New V4Adapter:", address(adapter));

        // 3. Wire adapter to hook
        adapter.setBattleHook(HOOK);

        // 4. Set price feeds on adapter
        adapter.setPriceFeed(address(0), 0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165); // ETH/USD
        adapter.setPriceFeed(C.WETH, 0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165); // WETH/USD
        adapter.setPriceFeed(C.USDC, 0x0153002d20B96532C639313c2d54c3dA09109309); // USDC/USD
        adapter.setStablecoin(C.USDC, true);
        adapter.setTokenDecimals(C.WETH, 18);
        adapter.setTokenDecimals(C.USDC, 6);

        // 5. Register adapter on arena
        arena.registerAdapter(IBattleArena.DexType(0), address(adapter)); // UNISWAP_V4

        // 6. Arena approves adapter on PositionManager (THE FIX!)
        arena.approveAdapterForNFT(C.V4_POSITION_MANAGER, address(adapter), true);
        console.log("Arena approved adapter on PositionManager");

        // 7. Deployer approves new adapter on PositionManager (using ERC721 interface)
        IERC721(C.V4_POSITION_MANAGER).setApprovalForAll(address(adapter), true);

        vm.stopBroadcast();

        console.log("");
        console.log("=== Deployment Complete ===");
        console.log("BattleArena:", address(arena));
        console.log("V4Adapter:", address(adapter));
        console.log("");
        console.log("NEXT: Wallet 2 must approve adapter, then mint positions + run battle");
    }
}
