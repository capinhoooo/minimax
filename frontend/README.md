# LP BattleVault - Frontend

React web application for creating, joining, and tracking Uniswap V4 LP position battles. Includes a live Agent dashboard that visualizes the autonomous agent's strategy loop and LI.FI cross-chain routes.

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
| `/bridge` | Bridge | Alias for `/swap` (same LI.FI widget) |
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
npm run build    # TypeScript check + Vite build, output in dist/
npm run preview  # Preview production build locally
npm run lint     # Run ESLint
```

## Tech Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 19.2 | UI framework |
| Vite | 7.2 | Build tool and dev server |
| TypeScript | 5.9 | Type safety |
| Tailwind CSS | 4.1 | Utility-first styling |
| Wagmi | 3.4 | Ethereum wallet connection and contract hooks |
| Viem | 2.x | Ethereum client library |
| React Router | 7.13 | Client-side routing |
| React Query | 5.90 | Data fetching and caching (10s refetch interval) |
| Recharts | 3.7 | Performance chart visualization |
| LI.FI Widget | 3.40 | Cross-chain swap and bridge UI (lazy-loaded, ~2MB) |
| LI.FI SDK | 3.15 | Programmatic cross-chain route access |
| Lucide React | 0.563 | Icon library |
| BigMi React | 0.7 | Wallet integration UI components |
| clsx + tailwind-merge | -- | Conditional class merging |
| date-fns | 4.1 | Date formatting utilities |

## Contract Integration

The frontend reads from deployed Sepolia contracts using Wagmi hooks:

```typescript
// hooks/useBattleVault.ts -- Read hooks
useBattleCount('range')             // Total battle count
useActiveBattles('range')           // Get active battle IDs
usePendingBattles('range')          // Get battles waiting for opponent
useRangeBattle(battleId)            // Get range battle details
useFeeBattle(battleId)              // Get fee battle details
useCurrentPerformance(battleId)     // Live performance (creator/opponent in-range time)
useCurrentFeePerformance(battleId)  // Live fee accumulation comparison
useTimeRemaining(battleId)          // Time until expiry

// Write operations
useCreateBattle('range')            // Deposit LP + create battle
useJoinBattle('range')              // Join existing battle
useResolveBattle('range')           // Settle expired battle
```

Additional hooks:
- `usePositionManager.ts` -- Query LP position data from V4 PositionManager
- `useBattleEvents.ts` -- Listen for on-chain battle events
- `useCCTPBridge.ts` -- Circle CCTP bridge operations for USDC

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
│   ├── Home.tsx                 # Landing page
│   ├── Lobby.tsx                # Main dashboard with stats
│   ├── Agent.tsx                # Agent strategy loop dashboard
│   ├── Leaderboard.tsx          # Player rankings
│   ├── Profile.tsx              # User profile & history
│   ├── Swap.tsx                 # LI.FI swap widget (lazy-loaded)
│   └── Battle/
│       ├── BattleArena.tsx      # All battles listing
│       ├── BattleDetail.tsx     # Single battle view with performance chart
│       └── CreateBattle.tsx     # New battle creation form
├── components/
│   ├── layout/
│   │   ├── Header.tsx           # Navigation bar
│   │   └── Layout.tsx           # Page wrapper with Outlet and footer
│   ├── battle/
│   │   ├── PerformanceChart.tsx # Battle performance visualization (Recharts)
│   │   └── JoinBattleModal.tsx  # Battle entry modal
│   ├── wallet/
│   │   ├── ConnectButton.tsx    # Wallet connection button
│   │   └── WalletModal.tsx      # Wallet selection dialog
│   └── CctpBridge.tsx           # USDC bridge component
├── hooks/
│   ├── useBattleVault.ts        # Contract read/write hooks (Range + Fee vaults)
│   ├── usePositionManager.ts    # LP position queries
│   ├── useBattleEvents.ts       # On-chain event listeners
│   └── useCCTPBridge.ts         # CCTP bridge operations
├── lib/
│   ├── contracts.ts             # ABIs, contract addresses, vault address resolver
│   └── utils.ts                 # Formatting helpers (addresses, amounts, time)
├── config/
│   └── wagmi.ts                 # Wagmi config with Sepolia chain + RPC
├── context/
│   └── WalletModalContext.tsx   # Global wallet modal state (React Context)
├── types/
│   └── index.ts                 # TypeScript type definitions (VaultType, BattleStatus, etc.)
├── assets/                      # Logo, SVG images
├── shims/
│   └── sui-jsonrpc.ts           # Sui RPC shim (for LI.FI Widget compatibility)
├── App.tsx                      # Root component with routing and providers
├── main.tsx                     # React entry point
└── index.css                    # Global styles (Tailwind imports)
```

## Environment Variables

Copy `.env.example` to `.env`:

```env
VITE_ALCHEMY_API_KEY=YOUR_ALCHEMY_KEY
VITE_WALLETCONNECT_PROJECT_ID=YOUR_PROJECT_ID
```