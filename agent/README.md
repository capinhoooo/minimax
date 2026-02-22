# Minimax - Autonomous Battle Agent

An autonomous TypeScript agent that monitors the BattleArena contract on Arbitrum Sepolia, auto-settles expired battles for resolver rewards, and provides advisory intelligence via REST API.

## Strategy Loop

```
MONITOR  ->  Scan BattleArena for active, pending, and expired battles
DECIDE   ->  Prioritize: resolve expired (reward), analyze active, recommend entries
ACT      ->  Execute on-chain: settle battles, update status, compute win probabilities
```

The agent runs continuously, scanning the BattleArena every 30 seconds (configurable via `POLL_INTERVAL_MS`). Each cycle logs all decisions with full transparency.

## Features

- **Multi-DEX Battle Monitoring** -- Reads active, pending, and expired battles across Uniswap V4 and Camelot V3
- **Auto-Settlement** -- Resolves expired battles on-chain to earn resolver rewards (1% of battle value)
- **Pool State Analysis** -- Reads V4 PoolManager state via `extsload` + Camelot pool state via `globalState()`
- **Win Probability** -- Computes win probability for range battles based on in-range time and elapsed time
- **Advisory REST API** -- Hono-based API exposing battle data, pool state, player stats, and recommendations
- **Stylus Leaderboard** -- Reads ELO ratings and player stats from the Rust/WASM Leaderboard contract
- **LI.FI Cross-Chain Routing** -- Queries LI.FI SDK for optimal bridge routes across 9+ providers
- **Transaction Evidence** -- Records all on-chain actions with hashes, gas usage, and block numbers

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env` with your configuration:

```env
CHAIN_ID=421614
RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
PRIVATE_KEY=0xYOUR_PRIVATE_KEY
BATTLE_ARENA_ADDRESS=0x478505eb07B3C8943A642E51F066bcF8aC8ed51d
POOL_MANAGER=0xFB3e0C6F74eB1a21CC1Da29aeC80D2Dfe6C9a317
LEADERBOARD_ADDRESS=0x7FEB2cf23797Fd950380CD9aD4B7D4cAd4B3C85B
SCORING_ENGINE_ADDRESS=0xd34fFbE6D046cB1A3450768664caF97106d18204
CAMELOT_FACTORY=0xaA37Bea711D585478E1c04b04707cCb0f10D762a
WETH_ADDRESS=0x980B62Da83eFf3D4576C647993b0c1D7faf17c73
USDC_ADDRESS=0xb893E3334D4Bd6C5ba8277Fd559e99Ed683A9FC7
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
| `npx tsx src/index.ts status` | Print agent status and arena overview |
| `npx tsx src/index.ts battles` | List active and pending battles |
| `npx tsx src/index.ts analyze` | Analyze all active battles |
| `npx tsx src/index.ts analyze [id]` | Analyze a specific battle |
| `npx tsx src/index.ts settle` | Run strategy cycle to settle ready battles |
| `npx tsx src/index.ts settle [id]` | Settle a specific battle |
| `npx tsx src/index.ts routes [from] [to]` | Query LI.FI cross-chain routes |
| `npx tsx src/index.ts help` | Show all commands |

## REST API

When running with `serve`, the agent exposes these endpoints on port 3001:

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/status` | Agent address, balance, network, cycle count, uptime |
| GET | `/api/battles` | Active + pending battle data with time remaining |
| GET | `/api/logs?limit=50` | Recent agent action logs |
| GET | `/api/decisions` | Last strategy cycle decisions |
| GET | `/api/transactions` | All recorded transaction evidence |
| POST | `/api/cycle` | Trigger a manual strategy cycle |

### Advisory Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/battles/:id` | Single battle detail + pool analysis |
| GET | `/api/battles/:id/probability` | Win probability calculation |
| GET | `/api/recommendations` | Score pending battles for optimal entry (sorted by attractiveness) |
| GET | `/api/pools` | V4 + Camelot WETH/USDC pool state comparison |
| GET | `/api/players/:address` | Player stats from Stylus Leaderboard (ELO, wins, losses) |
| GET | `/api/leaderboard` | All players ranked by ELO |
| GET | `/api/routes` | Last LI.FI route query results |

## Architecture

```
agent/src/
├── index.ts                    # CLI entry point with command routing
├── BattleAgent.ts              # Core agent with MONITOR->DECIDE->ACT loop
├── config.ts                   # Environment configuration & validation
├── server.ts                   # Hono REST API server (CORS enabled)
├── analyzers/
│   └── PoolAnalyzer.ts         # V4 pool state reader (extsload), battle scoring, win probability
├── commands/
│   ├── demo.ts                 # Full hackathon demo flow
│   ├── analyze.ts              # Battle analysis & scoring command
│   ├── settle.ts               # Settlement execution command
│   └── status.ts               # Status report command
├── integrations/
│   ├── LiFiIntegration.ts      # LI.FI SDK wrapper (routes, quotes, execution)
│   ├── ArcIntegration.ts       # Circle CCTP bridge integration
│   └── CrossChainEntryAgent.ts # Multi-chain battle entry planner
├── utils/
│   ├── logger.ts               # Structured logging with action tracing & summary
│   └── txCollector.ts          # Transaction evidence collector (hash, gas, block)
└── abis/
    ├── BattleArena.json        # BattleArena ABI
    ├── Leaderboard.json        # Stylus Leaderboard ABI
    └── PoolManager.json        # V4 PoolManager ABI (extsload)
```

## Pool State Analysis

The `PoolAnalyzer` reads V4 pool state directly from the PoolManager using `extsload`:

- **Slot 0**: sqrtPriceX96 (160 bits), tick (24 bits), protocolFee (24 bits), lpFee (24 bits)
- **Slot 3**: liquidity (128 bits)
- **Position analysis**: in-range check, tick distance from center, range width, position within range (0-1)
- **Battle scoring**: rates attractiveness of pending battles for entry (0-100)

For Camelot pools, it reads `globalState()` from the Algebra pool contract to get price, tick, and fee data.

## Win Probability

For range battles, the agent computes win probability based on:
- Current in-range time percentage for each position
- Elapsed time confidence (higher confidence as battle progresses)
- Returns `{ creatorProbability, opponentProbability, reasoning, factors }`

Fee battles return 50/50 until resolution (fees are only computed at settle time).

## Tech Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| TypeScript | 5.6+ | Type-safe agent logic |
| Viem | 2.21 | Ethereum client, transaction signing, ABI encoding |
| Hono | 4.11 | Lightweight REST API server |
| @hono/node-server | 1.19 | Node.js adapter for Hono |
| LI.FI SDK | 3.15 | Cross-chain route discovery |
| dotenv | 16.4 | Environment variable loading |
| tsx | 4.19 | TypeScript execution (dev) |

## Development

```bash
npm run dev          # Watch mode with hot reload
npm run build        # Compile TypeScript to dist/
npm run start        # Run compiled JS from dist/
```
