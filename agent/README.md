# LP BattleVault Autonomous Agent

An autonomous agent that monitors and settles LP position battles on Uniswap V4.

## Features

- Monitors both Range Vault and Fee Vault contracts
- Auto-settles battles when duration expires
- Transparent logging of all agent actions
- Command-line interface for manual operations

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your private key and RPC URL
```

3. Build (optional - for production):
```bash
npm run build
```

## Usage

### Start Monitoring
```bash
npm run agent          # Default: starts monitor mode
npm run agent monitor  # Explicit monitor command
```

### Check Status
```bash
npm run status         # Quick status
npm run status -- -v   # Verbose status with battle details
```

### Settle Battles
```bash
npm run settle                  # Settle all ready battles
npm run settle 1 range          # Settle specific battle
npm run settle 1 fee            # Settle fee vault battle
npm run settle 1 range --force  # Force settle even if not ready
```

### List Battles
```bash
npm run agent battles range   # List range vault battles
npm run agent battles fee     # List fee vault battles
```

## Architecture

```
agent/
├── src/
│   ├── index.ts          # Main entry point
│   ├── BattleAgent.ts    # Core agent class
│   ├── config.ts         # Configuration loader
│   ├── commands/
│   │   ├── settle.ts     # Settle command
│   │   └── status.ts     # Status command
│   ├── utils/
│   │   └── logger.ts     # Structured logging
│   └── abis/
│       ├── LPBattleVaultV4.json  # Range vault ABI
│       └── LPFeeBattleV4.json    # Fee vault ABI
├── package.json
├── tsconfig.json
└── .env
```

## Contract Addresses (Sepolia)

- **Range Vault**: `0x3363363702f98e8CE93871996c5163b79238cE5a`
- **Fee Vault**: `0x4b188E84c7946Acd21aeB3F718E42C0f1b558950`

## Agent Actions

The agent logs all actions with full transparency:

- **SETTLE_BATTLE**: Resolves a completed battle and determines winner
- **UPDATE_BATTLE_STATUS**: Updates in-range tracking for range battles

Each action log includes:
- Timestamp
- Reasoning
- Inputs/Outputs
- Transaction hash
- Gas used
- Success/failure status

## Development

```bash
npm run dev   # Watch mode with hot reload
```

## License

MIT
