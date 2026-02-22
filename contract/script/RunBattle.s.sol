// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {Actions} from "v4-periphery/src/libraries/Actions.sol";
import {IPositionManager} from "../src/interfaces/IShared.sol";
import {ArbitrumSepoliaConstants as C} from "../src/libraries/ArbitrumSepoliaConstants.sol";
import {BattleArena} from "../src/core/BattleArena.sol";
import {IBattleArena} from "../src/core/interfaces/IBattleArena.sol";

interface IPermit2 {
    function approve(address token, address spender, uint160 amount, uint48 expiration) external;
}

/// @title RunBattle - Mint positions and create battle
/// @notice Step 1: Deployer mints position + creates battle
contract MintAndCreateBattle is Script {
    address constant NEW_ARENA = 0xBA7559e1e00Ec894DEcFaF2D0273fDd77A1F0540;
    address constant NEW_ADAPTER = 0x1e73A6b71308b41d683FD77bBA43BD3C0bF20ee8;
    address constant HOOK = 0x51ed077265dC54B2AFdBf26181b48f7314B44A40;

    function run() external {
        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPk);
        console.log("Deployer:", deployer);

        vm.startBroadcast(deployerPk);

        // Pool key
        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(C.WETH),
            currency1: Currency.wrap(C.USDC),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(HOOK)
        });

        // Mint V4 position for deployer
        _mintV4Position(poolKey, deployer);

        // Get the token ID (nextTokenId - 1)
        // We'll read it from events or use nextTokenId
        uint256 tokenId = _getNextTokenId() - 1;
        console.log("Minted position tokenId:", tokenId);

        // Approve new adapter (already done in RedeployArena but safe to redo)
        IERC721(C.V4_POSITION_MANAGER).setApprovalForAll(NEW_ADAPTER, true);

        // Create battle: DexType=0 (V4), duration=300s (5min), BattleType=0 (RANGE)
        uint256 battleId = BattleArena(NEW_ARENA).createBattle(
            IBattleArena.DexType(0),
            tokenId,
            300,
            IBattleArena.BattleType(0)
        );
        console.log("Battle created! ID:", battleId);

        vm.stopBroadcast();
    }

    function _mintV4Position(PoolKey memory poolKey, address recipient) internal {
        bytes memory actions = abi.encodePacked(
            uint8(Actions.MINT_POSITION),
            uint8(Actions.CLOSE_CURRENCY),
            uint8(Actions.CLOSE_CURRENCY)
        );

        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(
            poolKey,
            int24(-201180),
            int24(-194280),
            uint256(3e12),
            uint128(0.01 ether),
            uint128(30e6),
            recipient,
            bytes("")
        );
        params[1] = abi.encode(poolKey.currency0);
        params[2] = abi.encode(poolKey.currency1);

        IPositionManager(C.V4_POSITION_MANAGER).modifyLiquidities(
            abi.encode(actions, params),
            block.timestamp + 300
        );
    }

    function _getNextTokenId() internal view returns (uint256) {
        // Read nextTokenId from PositionManager storage slot
        // ERC721 _nextTokenId is at slot depending on implementation
        // For V4 PositionManager, we can try calling nextTokenId()
        (bool success, bytes memory data) = C.V4_POSITION_MANAGER.staticcall(
            abi.encodeWithSignature("nextTokenId()")
        );
        require(success, "nextTokenId call failed");
        return abi.decode(data, (uint256));
    }
}

/// @title JoinBattle - Wallet 2 mints position and joins battle
contract MintAndJoinBattle is Script {
    address constant NEW_ARENA = 0xBA7559e1e00Ec894DEcFaF2D0273fDd77A1F0540;
    address constant NEW_ADAPTER = 0x1e73A6b71308b41d683FD77bBA43BD3C0bF20ee8;
    address constant HOOK = 0x51ed077265dC54B2AFdBf26181b48f7314B44A40;

    function run() external {
        uint256 wallet2Pk = vm.envUint("WALLET2_PK");
        address wallet2 = vm.addr(wallet2Pk);
        console.log("Wallet2:", wallet2);

        vm.startBroadcast(wallet2Pk);

        // Approvals for Permit2 + PositionManager (needed for minting)
        IERC20(C.WETH).approve(C.PERMIT2, type(uint256).max);
        IERC20(C.USDC).approve(C.PERMIT2, type(uint256).max);
        IPermit2(C.PERMIT2).approve(C.WETH, C.V4_POSITION_MANAGER, type(uint160).max, type(uint48).max);
        IPermit2(C.PERMIT2).approve(C.USDC, C.V4_POSITION_MANAGER, type(uint160).max, type(uint48).max);

        // Pool key
        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(C.WETH),
            currency1: Currency.wrap(C.USDC),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(HOOK)
        });

        // Mint V4 position for wallet2
        _mintV4Position(poolKey, wallet2);

        uint256 tokenId = _getNextTokenId() - 1;
        console.log("Minted position tokenId:", tokenId);

        // Approve new adapter for wallet2
        IERC721(C.V4_POSITION_MANAGER).setApprovalForAll(NEW_ADAPTER, true);

        // Join battle 0: DexType=0 (V4)
        BattleArena(NEW_ARENA).joinBattle(0, IBattleArena.DexType(0), tokenId);
        console.log("Joined battle 0!");

        vm.stopBroadcast();
    }

    function _mintV4Position(PoolKey memory poolKey, address recipient) internal {
        bytes memory actions = abi.encodePacked(
            uint8(Actions.MINT_POSITION),
            uint8(Actions.CLOSE_CURRENCY),
            uint8(Actions.CLOSE_CURRENCY)
        );

        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(
            poolKey,
            int24(-201180),
            int24(-194280),
            uint256(3e12),
            uint128(0.01 ether),
            uint128(30e6),
            recipient,
            bytes("")
        );
        params[1] = abi.encode(poolKey.currency0);
        params[2] = abi.encode(poolKey.currency1);

        IPositionManager(C.V4_POSITION_MANAGER).modifyLiquidities(
            abi.encode(actions, params),
            block.timestamp + 300
        );
    }

    function _getNextTokenId() internal view returns (uint256) {
        (bool success, bytes memory data) = C.V4_POSITION_MANAGER.staticcall(
            abi.encodeWithSignature("nextTokenId()")
        );
        require(success, "nextTokenId call failed");
        return abi.decode(data, (uint256));
    }
}
