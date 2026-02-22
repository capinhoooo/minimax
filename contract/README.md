# Minimax - Smart Contracts

Solidity smart contracts for cross-DEX PvP LP battles on Arbitrum Sepolia, built with Foundry.

## Overview

The BattleArena contract manages competitive battles between LP positions from different DEXes (Uniswap V4 and Camelot V3). Players deposit LP position NFTs, compete over a time-bound period, and the better-performing position wins. A 1% resolver reward incentivizes third parties (including the autonomous agent) to settle expired battles.

## Architecture

```
BattleArena (core battle logic)
    ├── UniswapV4Adapter  -- V4 PositionManager, Permit2, PoolManager
    ├── CamelotAdapter    -- Algebra NonfungiblePositionManager, Factory
    ├── ScoringEngine     -- Stylus (Rust/WASM) scoring computation
    └── Leaderboard       -- Stylus (Rust/WASM) ELO ratings
```

Users approve the **adapter** (not the BattleArena directly) for NFT transfers. The adapter calls `safeTransferFrom` on the NFT contract to move positions into the arena.

## Contracts

### Core

| Contract | Description |
|----------|-------------|
| `BattleArena.sol` | Unified battle management: create, join, resolve, emergency withdraw. Supports Range and Fee battle types across multiple DEXes. |
| `UniswapV4Adapter.sol` | Normalizes V4 positions via PositionManager. Reads pool state via PoolManager `extsload`. Handles Permit2 approval flow. |
| `CamelotAdapter.sol` | Normalizes Camelot/Algebra V3 positions. Reads pool state via `globalState()`. Uses standard ERC721 approval. |
| `BattleVaultHook.sol` | Custom Uniswap V4 hook for position locking/unlocking during battles. Flags: `BEFORE_ADD_LIQUIDITY`, `BEFORE_REMOVE_LIQUIDITY`, `AFTER_SWAP`. |

### Interfaces

| Contract | Description |
|----------|-------------|
| `IBattleArena.sol` | Full BattleArena interface with battle lifecycle functions |
| `IDEXAdapter.sol` | Standard adapter interface: `getPosition()`, `isInRange()`, `getCurrentTick()`, `getFeeGrowthInside()`, `collectFees()`, `lockPosition()`, `unlockPosition()`, `transferPositionIn/Out()` |
| `IScoringEngine.sol` | Stylus scoring engine interface |
| `ILeaderboard.sol` | Stylus leaderboard interface |
| `IShared.sol` | Shared interfaces (`IPositionManager`, `AggregatorV3Interface`) and custom errors |

### Libraries

| Contract | Description |
|----------|-------------|
| `PoolUtilsV4.sol` | Helper functions for reading V4 pool state (tick, price, liquidity) |
| `TransferUtils.sol` | Safe ERC20 and ERC721 token transfer wrappers |
| `StringUtils.sol` | String and number formatting utilities |
| `ArbitrumSepoliaConstants.sol` | Hardcoded Arbitrum Sepolia contract addresses |
| `SepoliaConstants.sol` | Legacy Sepolia testnet addresses |

### Legacy (V4-only)

| Contract | Description |
|----------|-------------|
| `LPBattleVaultV4.sol` | Original range-based battle vault (V4 only, pre-adapter pattern) |
| `LPFeeBattleV4.sol` | Original fee-based battle vault (V4 only, pre-adapter pattern) |

## Battle Types

### Range Battle
Two LP positions compete over a set duration. The position that stays in-range longer wins. The adapter's `isInRange()` checks whether the pool's current tick falls within the position's `[tickLower, tickUpper]`. In-range time is tracked cumulatively via `updateBattleStatus()`.

### Fee Battle
Two LP positions compete based on fee accumulation rate. Fee growth is recorded at battle start via `feeGrowthInside0/1LastX128`, and deltas are computed at resolution. Scores are normalized by LP value using Chainlink price feeds for fair comparison.

## Deployed Addresses (Arbitrum Sepolia)

| Contract | Address |
|----------|---------|
| BattleArena | `0x478505eb07B3C8943A642E51F066bcF8aC8ed51d` |
| UniswapV4Adapter | `0x244C49E7986feC5BaD7C567d588B9262eF5e0604` |
| CamelotAdapter | `0x5442068A4Cd117F26047c89f0A87D635112c886E` |
| BattleVaultHook | `0x51ed077265dC54B2AFdBf26181b48f7314B44A40` |
| ScoringEngine (Stylus) | `0xd34fFbE6D046cB1A3450768664caF97106d18204` |
| Leaderboard (Stylus) | `0x7FEB2cf23797Fd950380CD9aD4B7D4cAd4B3C85B` |

### Infrastructure

| Component | Address |
|-----------|---------|
| V4 PoolManager | `0xFB3e0C6F74eB1a21CC1Da29aeC80D2Dfe6C9a317` |
| V4 PositionManager | `0xAc631556d3d4019C95769033B5E719dD77124BAc` |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| Camelot Factory | `0xaA37Bea711D585478E1c04b04707cCb0f10D762a` |
| Camelot NFT Manager | `0x79EA6cB3889fe1FC7490A1C69C7861761d882D4A` |
| Camelot Pool (WETH/USDC) | `0x3965361EA4f9000AE3cf995f553115b2832D0E2d` |
| WETH | `0x980B62Da83eFf3D4576C647993b0c1D7faf17c73` |
| USDC (Mintable) | `0xb893E3334D4Bd6C5ba8277Fd559e99Ed683A9FC7` |
| ETH/USD Feed | `0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165` |

## Build

```bash
forge build
```

## Test

```bash
forge test
```

Test files:
- `test/BattleArenaTest.t.sol` -- BattleArena with adapter pattern tests
- `test/LPBattleVaultV4Test.t.sol` -- Legacy range vault tests
- `test/LPBattleVaultV4Extended.t.sol` -- Legacy extended scenario tests

Run with verbosity:

```bash
forge test -vvv
```

## Deploy

### BattleArena (current architecture)

```bash
cd contract
source .env
forge script script/DeployBattleArena.s.sol --rpc-url $RPC_URL --broadcast -vvvv
```

### Bootstrap Testnet (Pools + Positions + Hook)

The setup script creates WETH/USDC pools on both V4 and Camelot, mines the BattleVaultHook address via CREATE2, mints LP positions on both DEXes, and approves adapters:

```bash
# Mint testnet USDC (public mint function)
cast send 0xb893E3334D4Bd6C5ba8277Fd559e99Ed683A9FC7 "mint(address,uint256)" \
  $DEPLOYER 220000000 --rpc-url $RPC_URL --private-key $PRIVATE_KEY

# Run setup
forge script script/SetupArbSepolia.s.sol --rpc-url $RPC_URL --broadcast -vvvv

# Initialize Leaderboard (Foundry can't simulate Stylus opcodes)
cast send 0x7FEB2cf23797Fd950380CD9aD4B7D4cAd4B3C85B \
  "initialize(address,address)" $BATTLE_ARENA $DEPLOYER \
  --rpc-url $RPC_URL --private-key $PRIVATE_KEY
```

## Scripts

| Script | Purpose |
|--------|---------|
| `DeployBattleArena.s.sol` | Deploy BattleArena + adapters, wire together, set price feeds |
| `SetupArbSepolia.s.sol` | Bootstrap testnet: create pools, mine hook, mint positions, approve adapters |
| `Setup.s.sol` | Legacy setup script |

## Dependencies (Git Submodules)

| Submodule | Purpose |
|-----------|---------|
| `lib/v4-core/` | Uniswap V4 Core -- PoolManager, PoolId, PoolKey, StateLibrary, Currency |
| `lib/v4-periphery/` | Uniswap V4 Periphery -- PositionManager, PositionInfo, Actions, HookMiner |
| `lib/forge-std/` | Foundry standard library for testing |
| OpenZeppelin (via v4-core) | ReentrancyGuard, Pausable, IERC721Receiver, IERC20 |

## Project Structure

```
contract/
├── src/
│   ├── core/
│   │   ├── BattleArena.sol              # Unified multi-DEX battle manager
│   │   └── interfaces/
│   │       ├── IBattleArena.sol         # BattleArena interface
│   │       ├── IDEXAdapter.sol          # Standard DEX adapter interface
│   │       ├── IScoringEngine.sol       # Stylus scoring interface
│   │       └── ILeaderboard.sol         # Stylus leaderboard interface
│   ├── adapters/
│   │   ├── UniswapV4Adapter.sol         # V4 position normalization
│   │   └── CamelotAdapter.sol           # Camelot/Algebra position normalization
│   ├── hooks/
│   │   └── BattleVaultHook.sol          # Custom V4 hook for position locking
│   ├── interfaces/
│   │   └── IShared.sol                  # Shared interfaces & errors
│   ├── libraries/
│   │   ├── PoolUtilsV4.sol              # Pool state helpers
│   │   ├── TransferUtils.sol            # Token transfer helpers
│   │   ├── StringUtils.sol              # String formatting
│   │   ├── ArbitrumSepoliaConstants.sol # Arb Sepolia addresses
│   │   └── SepoliaConstants.sol         # Legacy Sepolia addresses
│   ├── LPBattleVaultV4.sol              # Legacy range vault
│   └── LPFeeBattleV4.sol               # Legacy fee vault
├── test/
│   ├── BattleArenaTest.t.sol            # BattleArena tests
│   ├── LPBattleVaultV4Test.t.sol        # Legacy range tests
│   └── LPBattleVaultV4Extended.t.sol    # Legacy extended tests
├── script/
│   ├── DeployBattleArena.s.sol          # Deployment script
│   ├── SetupArbSepolia.s.sol            # Testnet bootstrap
│   └── Setup.s.sol                      # Legacy setup
├── lib/                                  # Git submodules
├── foundry.toml                          # Foundry configuration
└── .env.example                          # Environment template
```

## Configuration

`foundry.toml`:
- Solidity: 0.8.26
- EVM: Cancun
- Optimizer: 1,000,000 runs
- VIA IR: enabled
- FFI: enabled
- Fuzz: 1,000 runs

## Environment Variables

Copy `.env.example` to `.env` and fill in:

```env
RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
PRIVATE_KEY=0xYOUR_PRIVATE_KEY
SCORING_ENGINE=0xd34fFbE6D046cB1A3450768664caF97106d18204
LEADERBOARD=0x7FEB2cf23797Fd950380CD9aD4B7D4cAd4B3C85B
```
