# LP BattleVault - Frontend

React web application for creating, joining, and tracking Uniswap V4 LP position battles. Includes a live Agent dashboard that visualizes the autonomous agent's strategy loop.

## Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | Home | Landing page with project overview |
| `/lobby` | Lobby | Dashboard with featured battles, quick actions, and live stats |
| `/battle` | Battle Arena | Browse and filter all active battles |
| `/battle/:id` | Battle Detail | Live battle tracking with performance chart |
| `/battle/create` | Create Battle | Deposit LP position and start a new battle |
| `/agent` | Agent Dashboard | Live strategy loop visualization with LI.FI routes |
| `/leaderboard` | Leaderboard | Player rankings by win rate and total value |
| `/swap` | Swap / Bridge | LI.FI widget for cross-chain swaps and bridges |
| `/profile` | Profile | User's battle history and LP positions |

## Agent Dashboard

The `/agent` page provides a live visualization of the autonomous agent:

- **Start/Stop controls** for the MONITOR -> DECIDE -> ACT strategy loop
- **Real-time vault monitoring** with live reads from Range and Fee vault contracts
- **LI.FI route display** showing cross-chain bridge options (Mayan, Stargate V2, CCTP)
- **Execution plan** visualization: Bridge -> Swap -> Add Liquidity -> Enter Battle
- **Terminal-style action log** showing every agent decision in real-time
- **Sponsor coverage cards** highlighting Uniswap V4 and LI.FI integration

## Setup

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`.

## Build

```bash
npm run build    # Output in dist/
npm run preview  # Preview production build
```

## Tech Stack

| Technology | Purpose |
|-----------|---------|
| React 19 | UI framework |
| Vite 7 | Build tool and dev server |
| Tailwind CSS 4 | Styling |
| Wagmi 3 | Ethereum wallet connection |
| Viem | Ethereum client library |
| React Router 7 | Client-side routing |
| React Query | Data fetching and caching (10s refetch) |
| Recharts | Performance chart visualization |
| LI.FI Widget | Cross-chain swap and bridge UI |
| Lucide React | Icon library |

## Contract Integration

The frontend reads from deployed Sepolia contracts using Wagmi hooks:

```typescript
// hooks/useBattleVault.ts
useActiveBattles('range')        // Get active battle IDs
useRangeBattle(battleId)         // Get battle details
useCurrentPerformance(battleId)  // Live performance (15s refresh)
useTimeRemaining(battleId)       // Time until expiry

// Write operations
useCreateBattle('range')         // Deposit LP + create battle
useJoinBattle('range')           // Join existing battle
useResolveBattle('range')        // Settle expired battle
```

## Design System

- **Primary**: `#ed7f2f` (orange) for actions and accents
- **Secondary**: `#42c7e6` (cyan) for information and data
- **Success**: `#22c55e` (green) for active/online states
- **Background**: `#010101` with `rgba(10, 10, 10, 0.95)` cards
- **Typography**: System font + monospace for data, `tracking-wider` for labels
- **Cards**: Rounded with semi-transparent backgrounds and colored borders

## Project Structure

```
frontend/src/
├── pages/
│   ├── Home.tsx              # Landing page
│   ├── Lobby.tsx             # Main dashboard
│   ├── Agent.tsx             # Agent strategy loop dashboard
│   ├── Leaderboard.tsx       # Player rankings
│   ├── Profile.tsx           # User profile
│   ├── Swap.tsx              # LI.FI swap widget
│   └── Battle/
│       ├── BattleArena.tsx   # All battles listing
│       ├── BattleDetail.tsx  # Single battle view
│       └── CreateBattle.tsx  # New battle creation
├── components/
│   ├── layout/
│   │   ├── Header.tsx        # Navigation bar
│   │   └── Layout.tsx        # Page wrapper with footer
│   ├── battle/
│   │   ├── PerformanceChart.tsx  # Battle performance visualization
│   │   └── JoinBattleModal.tsx   # Battle entry modal
│   └── wallet/
│       ├── ConnectButton.tsx     # Wallet connection
│       └── WalletModal.tsx       # Wallet selection
├── hooks/
│   ├── useBattleVault.ts     # Contract read/write hooks
│   ├── usePositionManager.ts # LP position hooks
│   └── useBattleEvents.ts   # Event listener hooks
├── lib/
│   ├── contracts.ts          # ABIs and addresses
│   └── utils.ts              # Formatting helpers
└── config/
    └── wagmi.ts              # Wagmi + chain configuration
```

## License

MIT
