# Minimax - LP BattleVault

**PvP battles between Uniswap V4 LP positions, powered by an autonomous agent with LI.FI cross-chain execution.**

Minimax turns passive liquidity providing into a competitive game. Two LP positions enter a time-bound battle, and the one that performs better — staying in range longer (Range Vault) or accumulating more fees (Fee Vault) — wins the opponent's position.

An autonomous agent monitors both vaults using a **MONITOR -> DECIDE -> ACT** strategy loop, auto-settles expired battles for resolver rewards, and plans cross-chain battle entries via the LI.FI SDK.

## Architecture

```
minimax/
├── contract/     # Solidity smart contracts (Foundry)
│   ├── LPBattleVaultV4.sol   — Range-based PvP battles
│   ├── LPFeeBattleV4.sol     — Fee-based PvP battles
│   └── BattleVaultHook.sol   — Custom Uniswap V4 hook
├── agent/        # Autonomous TypeScript agent (Node.js)
│   ├── BattleAgent.ts        — Strategy loop engine
│   ├── PoolAnalyzer.ts       — V4 pool state reader (extsload)
│   ├── LiFiIntegration.ts    — Cross-chain routing via LI.FI SDK
│   └── CrossChainEntryAgent  — Multi-chain battle entry planner
└── frontend/     # React web app (Vite + Tailwind)
    ├── Agent dashboard        — Live strategy loop visualization
    ├── Battle arena            — Create, join, and track battles
    └── LI.FI Swap widget       — Cross-chain swaps and bridges
```

## How It Works

### Battle Flow

1. **Create** — Deposit a Uniswap V4 LP position (NFT) into a vault and set a battle duration
2. **Join** — An opponent deposits their LP position into the same battle
3. **Compete** — The battle runs for the set duration:
   - **Range Vault**: Whoever stays in-range longer wins
   - **Fee Vault**: Whoever earns more fees (relative to LP value) wins
4. **Resolve** — Anyone can settle an expired battle. The winner gets both positions; the resolver earns a reward

### Agent Strategy Loop

The autonomous agent runs a continuous loop:

```
MONITOR  →  Scan both vaults for active, pending, and expired battles
DECIDE   →  Prioritize actions: resolve expired (reward), analyze open, plan entries
ACT      →  Execute on-chain: settle battles, update status, or plan cross-chain entry via LI.FI
```

### Cross-Chain Entry (LI.FI)

Users on any EVM chain can enter battles on Ethereum through the agent's cross-chain planner:

```
Base (USDC)  →  LI.FI Bridge  →  Swap to ETH+USDC  →  Add V4 Liquidity  →  Enter Battle
```

The agent queries the LI.FI SDK for optimal routes across 9+ bridges (Mayan, Stargate V2, Glacier, Circle CCTP, etc.).

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
```

### Frontend

```bash
cd frontend
npm install
npm run dev   # http://localhost:5173
```

## Sponsor Integration

### Uniswap V4

- Direct interaction with V4 PoolManager via `extsload` for pool state reads
- LP position management through V4 PositionManager (`getPoolAndPositionInfo`, `getPositionLiquidity`)
- Custom V4 hook (`BattleVaultHook`) for battle-specific pool logic
- Fee tracking via `feeGrowthInside0/1LastX128` from StateLibrary

### LI.FI

- **MONITOR -> DECIDE -> ACT** strategy loop as the core agent architecture
- LI.FI SDK integration for cross-chain route discovery and comparison
- Route optimization across 9+ bridges (Mayan, Stargate V2, Glacier, CCTP, etc.)
- Cross-chain battle entry execution planning with step-by-step transaction plans
- Frontend Agent dashboard showing live route analysis and strategy loop execution

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Solidity 0.8.26, Foundry, Uniswap V4 Core + Periphery |
| Agent | TypeScript, Viem, LI.FI SDK, Node.js |
| Frontend | React 19, Vite, Tailwind CSS 4, Wagmi, Recharts |
| Cross-Chain | LI.FI SDK, Circle CCTP |
| Network | Ethereum Sepolia Testnet |

## License

MIT
