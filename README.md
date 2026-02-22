# Minimax -- Multi-DEX LP Battle Arena on Arbitrum

**Cross-DEX PvP battles between Uniswap V4 and Camelot V3 LP positions, scored by Arbitrum Stylus (Rust/WASM), with an on-chain ELO leaderboard and autonomous agent.**

Minimax turns passive liquidity providing into a competitive game. Two LP positions from *different DEXes* enter a time-bound battle, and the one that performs better -- staying in range longer (Range Battle) or accumulating more fees (Fee Battle) -- wins. An autonomous agent monitors battles, auto-settles expired ones for resolver rewards, and provides advisory intelligence via REST API.

## Architecture

```
minimax/
├── contract/           # Solidity smart contracts (Foundry)
│   ├── src/
│   │   ├── core/
│   │   │   ├── BattleArena.sol           -- Unified battle management (create, join, resolve)
│   │   │   └── interfaces/               -- IBattleArena, IDEXAdapter
│   │   ├── adapters/
│   │   │   ├── UniswapV4Adapter.sol      -- V4 position normalization + fee collection
│   │   │   └── CamelotAdapter.sol        -- Camelot/Algebra position normalization
│   │   ├── hooks/BattleVaultHook.sol     -- Custom V4 hook for position locking
│   │   ├── libraries/                    -- PoolUtilsV4, ArbitrumSepoliaConstants
│   │   └── interfaces/IShared.sol        -- Shared interfaces (IPositionManager, Chainlink)
│   ├── script/
│   │   ├── DeployBattleArena.s.sol       -- Full deployment script
│   │   └── SetupArbSepolia.s.sol         -- Testnet bootstrap (pools, positions, hook)
│   └── test/                             -- Foundry test suite
├── agent/              # Autonomous TypeScript agent (Node.js + Hono)
│   ├── src/
│   │   ├── BattleAgent.ts                -- MONITOR -> DECIDE -> ACT loop
│   │   ├── server.ts                     -- REST API with advisory endpoints
│   │   ├── analyzers/PoolAnalyzer.ts     -- V4 pool state reader + win probability
│   │   └── commands/                     -- CLI: demo, analyze, settle, status
│   └── dist/                             -- Compiled output
├── frontend/           # React web app (Vite + Tailwind CSS)
│   ├── src/
│   │   ├── pages/                        -- Lobby, Battle/, Liquidity, Faucet, Leaderboard, Agent, Profile
│   │   ├── components/                   -- Layout, battle UI, wallet integration
│   │   ├── hooks/                        -- useBattleVault, useAddLiquidity, usePositionManager
│   │   ├── lib/                          -- contracts.ts, v4-encoding.ts, tick-math.ts, utils
│   │   └── config/wagmi.ts              -- Wagmi + Arbitrum Sepolia config
│   └── dist/                             -- Production build
└── stylus/             # Arbitrum Stylus contracts (Rust/WASM)
    ├── battle_scoring/                   -- Range/fee scoring, cross-DEX normalization
    └── leaderboard/                      -- ELO ratings, player stats, win/loss tracking
```

## How It Works

### Battle Flow

1. **Get Tokens** -- Wrap ETH to WETH and mint testnet USDC via the in-app Faucet (`/faucet`)
2. **Add Liquidity** -- Mint an LP position on Uniswap V4 or Camelot V3 (in-app, since no external UI supports Arb Sepolia)
3. **Create Battle** -- Deposit your LP NFT into BattleArena, choose battle type and duration
4. **Join Battle** -- An opponent deposits their LP position (can be from a different DEX)
5. **Compete** -- The battle runs for the set duration:
   - **Range Battle**: Whoever stays in-range longer wins (call `updateBattleStatus` to track in-range time)
   - **Fee Battle**: Whoever earns more fees (relative to LP value) wins
6. **Resolve** -- Anyone can settle an expired battle. The Stylus scoring engine determines the winner, the ELO leaderboard updates, and the resolver earns a 1% reward

### Cross-DEX Adapter Pattern

The BattleArena uses an adapter pattern to normalize positions across DEXes:

```
BattleArena (core logic)
    ├── UniswapV4Adapter  -- V4 PositionManager, Permit2, PoolManager
    └── CamelotAdapter    -- Algebra NonfungiblePositionManager, Factory
```

Both adapters implement `IDEXAdapter` with: `getPosition()`, `isInRange()`, `getCurrentTick()`, `getFeeGrowthInside()`, `collectFees()`, `lockPosition()`, `unlockPosition()`, `transferPositionIn/Out()`.

### Stylus Scoring (Rust/WASM)

The scoring engine runs on Arbitrum Stylus for gas-efficient computation:

- `calculate_range_score(inRangeTime, totalTime, tickDistance)` -- Weighted range scoring
- `calculate_fee_score(feesUSD, lpValueUSD, duration)` -- Fee-normalized scoring
- `normalize_cross_dex(rawScore, dexType)` -- Cross-DEX normalization factors
- `determine_winner(scoreA, scoreB)` -- Winner determination with tie handling

The leaderboard tracks ELO ratings (K-factor=32, floor=100), wins/losses, and total value won.

### Agent Strategy Loop

```
MONITOR  ->  Scan BattleArena for active, pending, and expired battles
DECIDE   ->  Prioritize: resolve expired (reward), analyze active, recommend entries
ACT      ->  Execute on-chain: settle battles, update status, compute win probabilities
```

Advisory REST API (Hono on port 3001):
- `GET /api/status` -- Agent status + uptime
- `GET /api/battles` -- All active/pending/expired battles
- `GET /api/battles/:id` -- Single battle detail + analysis
- `GET /api/battles/:id/probability` -- Win probability calculation
- `GET /api/recommendations` -- Scored pending battles for optimal entry
- `GET /api/pools` -- V4 + Camelot pool state comparison
- `GET /api/players/:address` -- Player stats from Stylus leaderboard
- `GET /api/leaderboard` -- All players ranked by ELO

## Deployed Contracts (Arbitrum Sepolia)

| Contract | Address |
|----------|---------|
| BattleArena | `0x6cfFE36cC727A649bC8D269CbD675552d0A550F6` |
| UniswapV4Adapter | `0xca6118BD65778C454B67B11DE39B9BB881915b40` |
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

## Quick Start

### Prerequisites

- Node.js 18+
- Foundry (`curl -L https://foundry.paradigm.xyz | bash`)
- Rust + Cargo (for Stylus contracts)

### Smart Contracts

```bash
cd contract
forge install
forge build
forge test
```

### Deploy (Arbitrum Sepolia)

```bash
cd contract
cp .env.example .env   # Add PRIVATE_KEY, SCORING_ENGINE, LEADERBOARD
forge script script/DeployBattleArena.s.sol --rpc-url $RPC_URL --broadcast -vvvv
```

### Bootstrap Testnet (Pools + Positions + Hook)

The setup script creates V4 and Camelot WETH/USDC pools, mines and deploys the BattleVaultHook via CREATE2, mints LP positions on both DEXes, and approves the adapters. USDC on Arb Sepolia is mintable:

```bash
# Mint testnet USDC (if needed)
cast send 0xb893E3334D4Bd6C5ba8277Fd559e99Ed683A9FC7 "mint(address,uint256)" \
  YOUR_ADDRESS 220000000 --rpc-url $RPC_URL --private-key $PRIVATE_KEY

# Run the setup script
forge script script/SetupArbSepolia.s.sol --rpc-url $RPC_URL --broadcast -vvvv

# Initialize Stylus Leaderboard (Foundry can't simulate Stylus opcodes)
cast send 0x7FEB2cf23797Fd950380CD9aD4B7D4cAd4B3C85B \
  "initialize(address,address)" 0x6cfFE36cC727A649bC8D269CbD675552d0A550F6 YOUR_ADDRESS \
  --rpc-url $RPC_URL --private-key $PRIVATE_KEY
```

### Agent

```bash
cd agent
npm install
cp .env.example .env   # Add private key and RPC URL
npx tsx src/index.ts demo      # Run full demo
npx tsx src/index.ts serve     # Start API server + strategy loop
npx tsx src/index.ts status    # Check current battle state
npx tsx src/index.ts settle    # Settle expired battles
```

### Frontend

```bash
cd frontend
npm install
npm run dev   # http://localhost:5173
```

Navigate to `/faucet` to get WETH and USDC, then `/liquidity` to mint LP positions, then `/battle/create` to start a battle.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Solidity 0.8.24, Foundry, Uniswap V4 Core + Periphery, OpenZeppelin |
| Stylus Contracts | Rust, Arbitrum Stylus SDK, WASM compilation |
| Agent | TypeScript, Viem 2.x, Hono 4.x, Node.js |
| Frontend | React 19, Vite 7, Tailwind CSS 4, Wagmi 3, React Query 5, Recharts 3 |
| Network | Arbitrum Sepolia Testnet |
| Oracles | Chainlink ETH/USD price feeds |
