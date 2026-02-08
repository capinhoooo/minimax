# Minimax - LP BattleVault

**PvP battles between Uniswap V4 LP positions, powered by an autonomous agent with LI.FI cross-chain execution.**

Minimax turns passive liquidity providing into a competitive game. Two LP positions enter a time-bound battle, and the one that performs better -- staying in range longer (Range Vault) or accumulating more fees (Fee Vault) -- wins the opponent's position.

An autonomous agent monitors both vaults using a **MONITOR -> DECIDE -> ACT** strategy loop, auto-settles expired battles for resolver rewards, and plans cross-chain battle entries via the LI.FI SDK.

## Architecture

```
minimax/
├── contract/        # Solidity smart contracts (Foundry)
│   ├── src/
│   │   ├── LPBattleVaultV4.sol        — Range-based PvP battles
│   │   ├── LPFeeBattleV4.sol          — Fee-based PvP battles
│   │   ├── hooks/BattleVaultHook.sol  — Custom Uniswap V4 hook
│   │   ├── interfaces/IShared.sol     — Shared interfaces & errors
│   │   └── libraries/                 — Pool utils, transfer helpers, constants
│   └── test/                          — Foundry test suite
├── agent/           # Autonomous TypeScript agent (Node.js + Hono)
│   ├── src/
│   │   ├── BattleAgent.ts             — Strategy loop engine
│   │   ├── server.ts                  — REST API (Hono)
│   │   ├── analyzers/PoolAnalyzer.ts  — V4 pool state reader (extsload)
│   │   ├── integrations/
│   │   │   ├── LiFiIntegration.ts     — Cross-chain routing via LI.FI SDK
│   │   │   ├── ArcIntegration.ts      — Circle CCTP bridge integration
│   │   │   └── CrossChainEntryAgent.ts— Multi-chain battle entry planner
│   │   └── commands/                  — CLI commands (demo, analyze, settle, status)
│   └── dist/                          — Compiled output
└── frontend/        # React web app (Vite + Tailwind CSS)
    ├── src/
    │   ├── pages/                     — Home, Lobby, Agent, Battle/, Swap, Leaderboard, Profile
    │   ├── components/                — Layout, battle UI, wallet integration
    │   ├── hooks/                     — useBattleVault, usePositionManager, useBattleEvents, useCCTPBridge
    │   ├── lib/                       — Contract ABIs/addresses, formatting utils
    │   └── config/wagmi.ts            — Wagmi + chain configuration
    └── dist/                          — Production build
```

## How It Works

### Battle Flow

1. **Create** -- Deposit a Uniswap V4 LP position (NFT) into a vault and set a battle duration
2. **Join** -- An opponent deposits their LP position into the same battle
3. **Compete** -- The battle runs for the set duration:
   - **Range Vault**: Whoever stays in-range longer wins
   - **Fee Vault**: Whoever earns more fees (relative to LP value) wins
4. **Resolve** -- Anyone can settle an expired battle. The winner gets both positions; the resolver earns a 1% reward

### Battle Types

| Vault | Win Condition | Tracking Method |
|-------|--------------|-----------------|
| Range Vault (`LPBattleVaultV4`) | Position stays in-range longer | Reads current tick from PoolManager, compares against each position's `[tickLower, tickUpper]` |
| Fee Vault (`LPFeeBattleV4`) | Position accumulates more fees relative to value | Tracks `feeGrowthInside0/1LastX128` at battle start via `StateLibrary`, computes fee deltas at resolve |

### Agent Strategy Loop

The autonomous agent runs a continuous loop:

```
MONITOR  ->  Scan both vaults for active, pending, and expired battles
DECIDE   ->  Prioritize actions: resolve expired (reward), analyze open, plan entries
ACT      ->  Execute on-chain: settle battles, update status, or plan cross-chain entry via LI.FI
```

The agent exposes a REST API (Hono on port 3001) with endpoints for status, vault data, logs, decisions, routes, and transactions.

### Cross-Chain Entry (LI.FI)

Users on any EVM chain can enter battles on Ethereum through the agent's cross-chain planner:

```
Base (USDC)  ->  LI.FI Bridge  ->  Swap to ETH+USDC  ->  Add V4 Liquidity  ->  Enter Battle
```

The agent queries the LI.FI SDK for optimal routes across 9+ bridges (Mayan, Stargate V2, Glacier, Circle CCTP, etc.) and supports a fallback Arc CCTP path for native USDC bridging.

## Deployed Contracts (Sepolia)

| Contract | Address |
|----------|---------|
| Range Vault | `0xDC987dF013d655c8eEb89ACA2c14BdcFeEee850a` |
| Fee Vault | `0xF09216A363FC5D88E899aa92239B2eeB1913913B` |
| Pool Manager | `0xE03A1074c86CFeDd5C142C4F04F1a1536e203543` |
| Position Manager | `0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4` |

## Quick Start

### Prerequisites

- Node.js 18+
- Foundry (`curl -L https://foundry.paradigm.xyz | bash`)

### Smart Contracts

```bash
cd contract
forge build
forge test
```

### Agent

```bash
cd agent
npm install
cp .env.example .env    # Add your private key and RPC URL
npx tsx src/index.ts demo      # Run full demo
npx tsx src/index.ts monitor   # Start autonomous loop
npx tsx src/index.ts serve     # Start API server + loop
```

### Frontend

```bash
cd frontend
npm install
npm run dev   # http://localhost:5173
```

## Sponsor Integration

### Uniswap V4

- Direct interaction with V4 PoolManager via `extsload` for pool state reads (sqrtPriceX96, tick, liquidity, fees)
- LP position management through V4 PositionManager (`getPoolAndPositionInfo`, `getPositionLiquidity`)
- Custom V4 hook (`BattleVaultHook`) for battle-specific pool logic
- Fee tracking via `feeGrowthInside0/1LastX128` from `StateLibrary`
- Contracts built against Uniswap V4 Core + Periphery as git submodules

### LI.FI

- **MONITOR -> DECIDE -> ACT** strategy loop as the core agent architecture
- LI.FI SDK integration for cross-chain route discovery, quote comparison, and execution planning
- Route optimization across 9+ bridges (Mayan, Stargate V2, Glacier, CCTP, etc.)
- Cross-chain battle entry execution planning with step-by-step transaction plans
- Frontend Agent dashboard showing live route analysis and strategy loop execution
- LI.FI Widget embedded on `/swap` page for direct cross-chain swaps and bridges

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Solidity 0.8.26, Foundry, Uniswap V4 Core + Periphery, OpenZeppelin |
| Agent | TypeScript, Viem 2.21, LI.FI SDK 3.15, Hono 4.11, Node.js |
| Frontend | React 19, Vite 7, Tailwind CSS 4, Wagmi 3, React Query 5, Recharts 3, LI.FI Widget 3.40 |
| Cross-Chain | LI.FI SDK (9+ bridge providers), Circle CCTP (Arc integration) |
| Network | Ethereum Sepolia Testnet |

## Project Structure

| Directory | Description |
|-----------|-------------|
| `contract/` | Foundry project with Solidity contracts, tests, deployment scripts, and V4 submodules |
| `agent/` | TypeScript CLI + API server with strategy loop, pool analysis, and cross-chain integrations |
| `frontend/` | React SPA with battle UI, agent dashboard, wallet connection, and LI.FI swap widget |

## License

MIT
