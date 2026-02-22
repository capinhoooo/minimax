# Minimax - Frontend

React web application for creating, joining, and tracking cross-DEX LP position battles on Arbitrum Sepolia. Includes in-app liquidity provisioning (since no external DEX UI supports Arb Sepolia), a live Agent dashboard, and an on-chain ELO leaderboard.

## Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | Home | Landing page with project overview |
| `/lobby` | Lobby | Dashboard with featured battles, quick actions, and live stats |
| `/battle` | Battle Arena | Browse and filter all active battles |
| `/battle/:id` | Battle Detail | Live battle tracking with performance chart |
| `/battle/create` | Create Battle | Select DEX (V4/Camelot), deposit LP NFT, choose battle type and duration |
| `/liquidity` | Add Liquidity | Mint LP positions on Uniswap V4 or Camelot V3 (WETH/USDC) |
| `/faucet` | Faucet | Wrap ETH to WETH and mint testnet USDC |
| `/agent` | Agent Dashboard | Live strategy loop visualization with advisory data |
| `/leaderboard` | Leaderboard | Player rankings by ELO, wins, and total value won |
| `/profile` | Profile | User's battle history and LP positions |

## Key Flows

### Add Liquidity (`/liquidity`)
Since no external DEX frontend supports Arbitrum Sepolia, the app includes a built-in liquidity page:
- Select DEX: Uniswap V4 or Camelot V3
- Enter WETH and USDC amounts with price range (min/max USDC per WETH)
- Multi-step approval flow:
  - V4: ERC20 approve to Permit2 -> Permit2 approve to PositionManager -> Mint
  - Camelot: ERC20 approve to NFT Manager -> Mint
- On success, shows minted token ID with link to create a battle

### Create Battle (`/battle/create`)
- Select DEX platform (Uniswap V4 or Camelot V3)
- Positions are fetched from the correct NFT contract per DEX
- Approve the **adapter** (not BattleArena) for NFT transfer
- Choose battle type (Range or Fee) and duration
- Enter arena to create the battle

### Join Battle (modal on `/battle/:id`)
- Select DEX and LP position to enter an existing battle
- Cross-DEX battles supported (V4 position vs Camelot position)

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
| Lucide React | 0.563 | Icon library |

## Contract Integration

The frontend interacts with the BattleArena contract and DEX-specific NFT contracts on Arbitrum Sepolia:

```typescript
// hooks/useBattleVault.ts -- BattleArena read/write hooks
useBattleCount()                    // Total battle count
useActiveBattles()                  // Active battle IDs (status = 1)
usePendingBattles()                 // Pending battle IDs (status = 0)
useBattle(battleId)                 // Full battle struct
useTimeRemaining(battle)            // Time until expiry
useCreateBattle()                   // Create battle (dexType, tokenId, duration, battleType)
useJoinBattle()                     // Join battle (battleId, dexType, tokenId)
useUpdateBattleStatus()             // Update in-range tracking for active battles
useResolveBattle()                  // Settle expired battle

// hooks/usePositionManager.ts -- DEX-aware LP position queries
useUserPositions(owner, nftContract)     // Get token IDs (V4: ownerOf scan, Camelot: tokenOfOwnerByIndex)
useIsApprovedForAll(owner, operator, nftContract)  // Check adapter approval
useSetApprovalForAll()                   // Approve adapter for NFT transfers

// hooks/useAddLiquidity.ts -- Mint new LP positions
useAddLiquidityV4()       // V4: Permit2 flow -> modifyLiquidities (MINT_POSITION + CLOSE_CURRENCY)
useAddLiquidityCamelot()  // Camelot: ERC20 approve -> NonfungiblePositionManager.mint()

// hooks/useStylus.ts -- Stylus contract reads
usePlayerStats(address)   // ELO, wins, losses from Leaderboard
useScoringEngine()        // calculateRangeScore, calculateFeeScore
```

## Wagmi Configuration

Arbitrum Sepolia with explicit gas fee estimation to work around stale RPC gas estimates:

```typescript
const arbSepolia = defineChain({
  ...arbitrumSepolia,
  fees: {
    async estimateFeesPerGas() {
      return {
        maxFeePerGas: parseGwei('0.3'),
        maxPriorityFeePerGas: parseGwei('0.01'),
      };
    },
  },
});
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
│   ├── Home.tsx                 # Landing page
│   ├── Lobby.tsx                # Main dashboard with stats
│   ├── Liquidity.tsx            # Add Liquidity (V4 + Camelot)
│   ├── Faucet.tsx               # Wrap ETH to WETH + Mint testnet USDC
│   ├── Agent.tsx                # Agent strategy loop dashboard
│   ├── Leaderboard.tsx          # Player rankings (ELO from Stylus)
│   ├── Profile.tsx              # User profile & history
│   └── Battle/
│       ├── BattleArena.tsx      # All battles listing
│       ├── BattleDetail.tsx     # Single battle view with performance chart
│       └── CreateBattle.tsx     # New battle creation (DEX-aware)
├── components/
│   ├── layout/
│   │   ├── Header.tsx           # Navigation bar
│   │   └── Layout.tsx           # Page wrapper with Outlet and footer
│   ├── battle/
│   │   ├── PerformanceChart.tsx # Battle performance visualization (Recharts)
│   │   └── JoinBattleModal.tsx  # Battle entry modal (DEX-aware)
│   └── wallet/
│       ├── ConnectButton.tsx    # Wallet connection button
│       └── WalletModal.tsx      # Wallet selection dialog
├── hooks/
│   ├── useBattleVault.ts        # BattleArena contract read/write hooks
│   ├── usePositionManager.ts    # DEX-aware LP position queries + approvals
│   ├── useAddLiquidity.ts       # Mint V4 and Camelot LP positions
│   ├── useBattleEvents.ts       # On-chain event listeners
│   └── useStylus.ts             # Stylus Leaderboard + ScoringEngine reads
├── lib/
│   ├── contracts.ts             # ABIs and deployed addresses (BattleArena, Adapters, Permit2, etc.)
│   ├── v4-encoding.ts           # V4 action encoding (MINT_POSITION, CLOSE_CURRENCY)
│   ├── tick-math.ts             # Price <-> tick conversion, tick alignment
│   └── utils.ts                 # Formatting helpers (addresses, amounts, time)
├── config/
│   └── wagmi.ts                 # Wagmi config with Arbitrum Sepolia + gas override
├── context/
│   └── WalletModalContext.tsx   # Global wallet modal state (React Context)
├── types/
│   └── index.ts                 # TypeScript types (DexType, BattleStatus, BattleType, etc.)
├── assets/                      # Logo, SVG images
├── App.tsx                      # Root component with routing and providers
├── main.tsx                     # React entry point
└── index.css                    # Global styles (Tailwind imports)
```

## Environment Variables

Copy `.env.example` to `.env`:

```env
VITE_WALLETCONNECT_PROJECT_ID=YOUR_PROJECT_ID
```
