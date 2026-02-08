# LP BattleVault - Autonomous Agent

An autonomous TypeScript agent that monitors Uniswap V4 battle vaults and executes a **MONITOR -> DECIDE -> ACT** strategy loop with LI.FI cross-chain routing.

## Strategy Loop

```
MONITOR  →  Scan Range Vault and Fee Vault for active/pending/expired battles
DECIDE   →  Prioritize actions: resolve expired battles, analyze open battles, plan entries
ACT      →  Execute on-chain: settle battles, update status, route cross-chain entries via LI.FI
```

The agent runs continuously, scanning both vaults every 30 seconds (configurable). Each cycle logs all decisions with full transparency.

## Features

- **Battle Monitoring** — Reads active, pending, and expired battles from both vaults
- **Auto-Settlement** — Resolves expired battles on-chain to earn resolver rewards
- **Pool State Analysis** — Reads V4 PoolManager state via `extsload` (tick, sqrtPriceX96, liquidity, fees)
- **LI.FI Cross-Chain Routing** — Queries LI.FI SDK for optimal bridge routes across 9+ providers
- **Cross-Chain Entry Planning** — Plans multi-step battle entries: Bridge -> Swap -> Add Liquidity -> Enter Battle
- **CCTP Bridge Support** — Native USDC bridging via Circle CCTP as alternative to LI.FI
- **Transaction Evidence** — Records all on-chain actions with hashes, gas usage, and block numbers

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
```

## Commands

| Command | Description |
|---------|-------------|
| `npx tsx src/index.ts demo` | Full demo flow: status + strategy cycle + LI.FI routes + evidence |
| `npx tsx src/index.ts monitor` | Start autonomous MONITOR->DECIDE->ACT loop |
| `npx tsx src/index.ts status` | Print agent status and vault overview |
| `npx tsx src/index.ts analyze` | Analyze all active battles across both vaults |
| `npx tsx src/index.ts analyze 0 range` | Analyze a specific battle |
| `npx tsx src/index.ts settle` | Run strategy cycle to settle ready battles |
| `npx tsx src/index.ts settle 1 fee` | Settle a specific battle |
| `npx tsx src/index.ts battles range` | List active battles in a vault |
| `npx tsx src/index.ts routes` | Query LI.FI cross-chain routes (Base -> Ethereum) |
| `npx tsx src/index.ts help` | Show all commands |

## Architecture

```
agent/src/
├── index.ts                    # CLI entry point
├── BattleAgent.ts              # Core agent with strategy loop
├── config.ts                   # Environment configuration
├── analyzers/
│   └── PoolAnalyzer.ts         # V4 pool state reader (extsload)
├── commands/
│   ├── demo.ts                 # Full hackathon demo flow
│   ├── analyze.ts              # Battle analysis command
│   ├── settle.ts               # Settlement command
│   └── status.ts               # Status command
├── integrations/
│   ├── LiFiIntegration.ts      # LI.FI SDK wrapper (routes, quotes, execution)
│   ├── ArcIntegration.ts       # Circle CCTP bridge integration
│   └── CrossChainEntryAgent.ts # Multi-chain battle entry planner
├── utils/
│   ├── logger.ts               # Structured logging with action tracing
│   └── txCollector.ts          # Transaction evidence collector
└── abis/
    ├── LPBattleVaultV4.json    # Range vault ABI
    ├── LPFeeBattleV4.json      # Fee vault ABI
    └── PoolManager.json        # V4 PoolManager ABI (extsload)
```

## LI.FI Integration

The agent uses the LI.FI SDK to find optimal cross-chain routes for battle entry:

```
User on Base (USDC)
  │
  ├── LI.FI SDK queries 9+ bridge providers
  │   ├── Mayan (~5 min, $0.13 fees)
  │   ├── Stargate V2 (~3 min, $0.15 fees)
  │   ├── Glacier (~3 min, $0.15 fees)
  │   └── Circle CCTP (~15 min, gas only)
  │
  └── Agent builds execution plan:
      1. Bridge USDC (Base → Ethereum)
      2. Swap 50% USDC → ETH
      3. Add V4 Liquidity
      4. Enter Battle
```

## Pool State Analysis

The PoolAnalyzer reads V4 pool state directly from the PoolManager using `extsload`:

- **Slot 0**: sqrtPriceX96, tick, protocolFee, lpFee
- **Slot 3**: liquidity
- **Position analysis**: in-range check, tick distance, range width
- **Battle scoring**: rates attractiveness of pending battles for entry (0-100)

## Development

```bash
npm run dev          # Watch mode with hot reload
npm run build        # Compile TypeScript
npm run test:all     # Run integration tests
```

## License

MIT
