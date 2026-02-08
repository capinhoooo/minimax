# LP BattleVault - Smart Contracts

Solidity smart contracts for PvP battles between Uniswap V4 LP positions, built with Foundry.

## Overview

Two vault contracts enable competitive LP position battles on Uniswap V4. Players deposit LP position NFTs into a vault, and after a time-bound competition, the better-performing position wins both. A 1% resolver reward incentivizes third parties (including the autonomous agent) to settle expired battles.

## Contracts

### LPBattleVaultV4.sol (Range Vault)

PvP battles based on **price range validity**. Two LP positions compete over a set duration -- the position that stays in-range longer wins both positions.

- Reads current tick from V4 PoolManager via `extsload` to determine if each position's `[tickLower, tickUpper]` contains the pool price
- Tracks cumulative in-range time for both creator and opponent
- Calls `updateBattleStatus()` to snapshot in-range state periodically
- Resolver reward (1% of battle value) for anyone who settles an expired battle
- Emergency withdrawal available after extended expiry period
- Uses `ReentrancyGuard` and `Pausable` from OpenZeppelin

### LPFeeBattleV4.sol (Fee Vault)

PvP battles based on **fee accumulation rate**. The LP position that earns more fees relative to its value wins.

- Records `feeGrowthInside0/1LastX128` at battle start via `StateLibrary`
- Computes fee deltas at resolve time: `(currentFeeGrowth - startFeeGrowth) * liquidity >> 128`
- Normalizes by LP value for fair comparison between different-sized positions
- Chainlink price feeds (BTC/USD, ETH/USD, DAI/USD, LINK/USD, USDC/USD) for accurate LP value calculation
- Stablecoin whitelist for positions involving stablecoins

### BattleVaultHook.sol

Custom Uniswap V4 hook that integrates with the battle system for pool-specific logic.

### Supporting Libraries

| File | Purpose |
|------|---------|
| `PoolUtilsV4.sol` | Helper functions for reading V4 pool state (tick, price, liquidity) |
| `TransferUtils.sol` | Safe ERC20 and ERC721 token transfer wrappers |
| `StringUtils.sol` | String and number formatting utilities for on-chain display |
| `SepoliaConstants.sol` | Hardcoded testnet contract addresses (PoolManager, PositionManager, tokens) |

### Interfaces

| File | Purpose |
|------|---------|
| `IShared.sol` | Shared interfaces (`IPositionManager`, `AggregatorV3Interface`) and custom error definitions |

## Dependencies (Git Submodules)

| Submodule | Purpose |
|-----------|---------|
| `lib/v4-core/` | Uniswap V4 Core -- PoolManager, PoolId, PoolKey, StateLibrary, Currency |
| `lib/v4-periphery/` | Uniswap V4 Periphery -- PositionManager, PositionInfo, Actions |
| `lib/forge-std/` | Foundry standard library for testing |
| OpenZeppelin (via v4-core) | ReentrancyGuard, Pausable, IERC721Receiver, IERC20 |

## Build

```bash
forge build
```

## Test

```bash
forge test
```

Test files:
- `test/LPBattleVaultV4Test.t.sol` -- Core vault functionality (create, join, resolve, emergency withdraw)
- `test/LPBattleVaultV4Extended.t.sol` -- Extended scenarios (edge cases, multi-battle, fee distribution)

Run with verbosity:

```bash
forge test -vvv
```

## Deploy

The contracts are deployed on Sepolia using `forge create`:

```bash
source .env

# Deploy Range Vault
forge create src/LPBattleVaultV4.sol:LPBattleVaultV4 \
  --constructor-args $POOL_MANAGER $POSITION_MANAGER \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast --verify

# Deploy Fee Vault
forge create src/LPFeeBattleV4.sol:LPFeeBattleV4 \
  --constructor-args $POOL_MANAGER $POSITION_MANAGER \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast --verify
```

### Post-Deploy Configuration

```bash
# Set price feed for ETH (address(0) = native ETH in V4)
cast send $RANGE_VAULT "setPriceFeed(address,address)" \
  0x0000000000000000000000000000000000000000 $ETH_PRICE_FEED \
  --rpc-url $RPC_URL --private-key $PRIVATE_KEY

# Set stablecoin (USDC)
cast send $RANGE_VAULT "setStablecoin(address)" $USDC \
  --rpc-url $RPC_URL --private-key $PRIVATE_KEY
```

## Deployed Addresses (Sepolia)

| Contract | Address |
|----------|---------|
| Range Vault | `0xDC987dF013d655c8eEb89ACA2c14BdcFeEee850a` |
| Fee Vault | `0xF09216A363FC5D88E899aa92239B2eeB1913913B` |
| Pool Manager (Uniswap) | `0xE03A1074c86CFeDd5C142C4F04F1a1536e203543` |
| Position Manager (Uniswap) | `0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4` |

## V4 Integration Details

The contracts use the Uniswap V4 PositionManager API (not V3):

```solidity
// Read position data
(PoolKey memory poolKey, PositionInfo info) = positionManager.getPoolAndPositionInfo(tokenId);
int24 tickLower = info.tickLower();
int24 tickUpper = info.tickUpper();
uint128 liquidity = positionManager.getPositionLiquidity(tokenId);

// Read fee growth from PoolManager via StateLibrary
bytes32 positionId = keccak256(abi.encodePacked(
    address(positionManager), tickLower, tickUpper, bytes32(tokenId)
));
(, uint256 feeGrowth0, uint256 feeGrowth1) = poolManager.getPositionInfo(poolKey.toId(), positionId);
```

## Configuration

`foundry.toml`:
- Solidity: 0.8.26
- EVM: Cancun
- Optimizer: 1,000,000 runs
- VIA IR: enabled
- FFI: enabled
- Fuzz: 1,000 runs

Remappings:
- `@openzeppelin/contracts/` -> v4-core bundled OpenZeppelin
- `v4-core/` -> `lib/v4-periphery/lib/v4-core/src/`
- `v4-periphery/` -> `lib/v4-periphery/`
- `forge-std/` -> `lib/forge-std/src/`

## Environment Variables

Copy `.env.example` to `.env` and fill in:

```env
RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
PRIVATE_KEY=0xYOUR_PRIVATE_KEY
POOL_MANAGER=0xE03A1074c86CFeDd5C142C4F04F1a1536e203543
POSITION_MANAGER=0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4
ETH_PRICE_FEED=0x694AA1769357215DE4FAC081bf1f309aDC325306
USDC=0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
```

## Project Structure

```
contract/
├── src/
│   ├── LPBattleVaultV4.sol          # Range-based battle vault
│   ├── LPFeeBattleV4.sol            # Fee-based battle vault
│   ├── hooks/
│   │   └── BattleVaultHook.sol      # Custom V4 hook
│   ├── interfaces/
│   │   └── IShared.sol              # Shared interfaces & errors
│   └── libraries/
│       ├── PoolUtilsV4.sol          # Pool state helpers
│       ├── TransferUtils.sol        # Token transfer helpers
│       ├── StringUtils.sol          # String formatting
│       └── SepoliaConstants.sol     # Testnet addresses
├── test/
│   ├── LPBattleVaultV4Test.t.sol    # Core tests
│   └── LPBattleVaultV4Extended.t.sol# Extended tests
├── script/                           # Deployment scripts
├── lib/                              # Git submodules (v4-core, v4-periphery, forge-std)
├── foundry.toml                      # Foundry configuration
└── .env.example                      # Environment template
```

## License

MIT
