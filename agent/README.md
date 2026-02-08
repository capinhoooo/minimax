# LP BattleVault - Autonomous Agent

An autonomous TypeScript agent that monitors Uniswap V4 battle vaults and executes a **MONITOR -> DECIDE -> ACT** strategy loop with LI.FI cross-chain routing and a REST API for the frontend dashboard.

## Strategy Loop

```
MONITOR  ->  Scan Range Vault and Fee Vault for active/pending/expired battles
DECIDE   ->  Prioritize actions: resolve expired battles, analyze open battles, plan entries
ACT      ->  Execute on-chain: settle battles, update status, route cross-chain entries via LI.FI
```

The agent runs continuously, scanning both vaults every 30 seconds (configurable via `POLL_INTERVAL_MS`). Each cycle logs all decisions with full transparency.

## Features

- **Battle Monitoring** -- Reads active, pending, and expired battles from both vaults
- **Auto-Settlement** -- Resolves expired battles on-chain to earn resolver rewards (1% of battle value)
- **Pool State Analysis** -- Reads V4 PoolManager state via `extsload` (tick, sqrtPriceX96, liquidity, fees)
- **LI.FI Cross-Chain Routing** -- Queries LI.FI SDK for optimal bridge routes across 9+ providers
- **Cross-Chain Entry Planning** -- Plans multi-step battle entries: Bridge -> Swap -> Add Liquidity -> Enter Battle
- **CCTP Bridge Support** -- Native USDC bridging via Circle CCTP (Arc integration) as alternative to LI.FI
- **Transaction Evidence** -- Records all on-chain actions with hashes, gas usage, and block numbers
- **REST API** -- Hono-based API server exposing agent state, vault data, logs, decisions, and routes to the frontend

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env` with your configuration:

```env
CHAIN_ID=11155111
RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
PRIVATE_KEY=0xYOUR_PRIVATE_KEY
RANGE_VAULT_ADDRESS=0xDC987dF013d655c8eEb89ACA2c14BdcFeEee850a
FEE_VAULT_ADDRESS=0xF09216A363FC5D88E899aa92239B2eeB1913913B
POOL_MANAGER=0xE03A1074c86CFeDd5C142C4F04F1a1536e203543
POSITION_MANAGER=0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4
POLL_INTERVAL_MS=30000
LOG_LEVEL=info
API_PORT=3001
```

## Commands

| Command | Description |
|---------|-------------|
| `npx tsx src/index.ts monitor` | Start autonomous MONITOR->DECIDE->ACT loop (default) |
| `npx tsx src/index.ts serve` | Start API server (port 3001) + strategy loop |
| `npx tsx src/index.ts demo` | Full demo flow: status + strategy cycle + LI.FI routes + evidence |
| `npx tsx src/index.ts status` | Print agent status and vault overview |
| `npx tsx src/index.ts analyze` | Analyze all active battles across both vaults |
| `npx tsx src/index.ts analyze 0 range` | Analyze a specific battle |
| `npx tsx src/index.ts settle` | Run strategy cycle to settle ready battles |
| `npx tsx src/index.ts settle 1 fee` | Settle a specific battle |
| `npx tsx src/index.ts battles range` | List active battles in a vault |
| `npx tsx src/index.ts routes` | Query LI.FI cross-chain routes (Base -> Ethereum) |
| `npx tsx src/index.ts routes 84532 11155111` | Query routes between specific chains |
| `npx tsx src/index.ts help` | Show all commands |

## REST API

When running with `serve`, the agent exposes these endpoints on port 3001:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/status` | Agent address, balance, network, cycle count, uptime |
| GET | `/api/vaults` | Range and Fee vault battle data with time remaining |
| GET | `/api/logs?limit=50` | Recent agent action logs |
| GET | `/api/decisions` | Last strategy cycle decisions |
| GET | `/api/routes` | Last LI.FI route query results |
| GET | `/api/transactions` | All recorded transaction evidence |
| POST | `/api/cycle` | Trigger a manual strategy cycle |

## Architecture

```
agent/src/
├── index.ts                    # CLI entry point with command routing
├── BattleAgent.ts              # Core agent with MONITOR->DECIDE->ACT loop
├── config.ts                   # Environment configuration & validation
├── server.ts                   # Hono REST API server (CORS enabled)
├── analyzers/
│   └── PoolAnalyzer.ts         # V4 pool state reader (extsload) & battle scoring
├── commands/
│   ├── demo.ts                 # Full hackathon demo flow
│   ├── analyze.ts              # Battle analysis & scoring command
│   ├── settle.ts               # Settlement execution command
│   └── status.ts               # Status report command
├── integrations/
│   ├── LiFiIntegration.ts      # LI.FI SDK wrapper (routes, quotes, execution, LP split)
│   ├── ArcIntegration.ts       # Circle CCTP bridge (approve, depositForBurn, receiveMessage)
│   └── CrossChainEntryAgent.ts # Multi-chain battle entry planner (intent analysis, route comparison, execution plans)
├── utils/
│   ├── logger.ts               # Structured logging with action tracing & summary
│   └── txCollector.ts          # Transaction evidence collector (hash, gas, block)
└── abis/
    ├── LPBattleVaultV4.json    # Range vault ABI
    ├── LPFeeBattleV4.json      # Fee vault ABI
    └── PoolManager.json        # V4 PoolManager ABI (extsload)
```

## LI.FI Integration

The agent uses the LI.FI SDK to find optimal cross-chain routes for battle entry:

```
User on Base (USDC)
  |
  +-- LI.FI SDK queries 9+ bridge providers
  |   +-- Mayan (~5 min, $0.13 fees)
  |   +-- Stargate V2 (~3 min, $0.15 fees)
  |   +-- Glacier (~3 min, $0.15 fees)
  |   +-- Circle CCTP (~15 min, gas only)
  |
  +-- Agent builds execution plan:
      1. Bridge USDC (Base -> Ethereum)
      2. Swap 50% USDC -> ETH
      3. Add V4 Liquidity
      4. Enter Battle
```

Supported chains: Ethereum, Arbitrum, Optimism, Base, Polygon (mainnet) and Sepolia, Base Sepolia, Arbitrum Sepolia (testnet).

## Cross-Chain Entry Agent

The `CrossChainEntryAgent` implements its own MONITOR -> DECIDE -> ACT loop for cross-chain entries:

1. **MONITOR** -- Validates user intent (source chain, token, amount, target pool)
2. **DECIDE** -- Compares LI.FI direct routes vs Arc CCTP, recommends optimal path
3. **ACT** -- Creates a step-by-step execution plan with transaction details

It supports two routing methods:
- **LI.FI Direct** -- Combined swap+bridge in one flow (recommended for speed)
- **Arc CCTP** -- Native USDC burn/mint via Circle (lower fees, longer wait)

## Pool State Analysis

The `PoolAnalyzer` reads V4 pool state directly from the PoolManager using `extsload`:

- **Slot 0**: sqrtPriceX96 (160 bits), tick (24 bits), protocolFee (24 bits), lpFee (24 bits)
- **Slot 3**: liquidity (128 bits)
- **Position analysis**: in-range check, tick distance from center, range width, position within range (0-1)
- **Battle scoring**: rates attractiveness of pending battles for entry (0-100)

## Tech Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| TypeScript | 5.6+ | Type-safe agent logic |
| Viem | 2.21 | Ethereum client, transaction signing, ABI encoding |
| LI.FI SDK | 3.15 | Cross-chain route discovery & execution |
| LI.FI Types | 17.59 | Type definitions for routes and quotes |
| Hono | 4.11 | Lightweight REST API server |
| @hono/node-server | 1.19 | Node.js adapter for Hono |
| dotenv | 16.4 | Environment variable loading |
| tsx | 4.19 | TypeScript execution (dev) |

## Development

```bash
npm run dev          # Watch mode with hot reload
npm run build        # Compile TypeScript to dist/
npm run start        # Run compiled JS from dist/
npm run test:all     # Run all integration tests
npm run test:lifi    # Test LI.FI integration
npm run test:arc     # Test Arc CCTP integration
npm run test:crosschain  # Test cross-chain entry agent
npm run test:integration # Test full integration
```

## License

MIT
