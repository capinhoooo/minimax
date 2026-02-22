# Minimax - Stylus Contracts (Rust/WASM)

Arbitrum Stylus smart contracts for gas-efficient battle scoring and ELO leaderboard computation. Compiled to WASM and deployed on Arbitrum Sepolia.

## Contracts

### battle_scoring (ScoringEngine)

Pure computation contract for determining battle outcomes across DEXes.

**Deployed**: `0xd34fFbE6D046cB1A3450768664caF97106d18204`

| Function | Description |
|----------|-------------|
| `calculate_range_score(inRangeTime, totalTime, tickDistance)` | Weighted range scoring with tick tightness bonus (up to 20% for positions within 100 ticks) |
| `calculate_fee_score(feesUSD, lpValueUSD, duration)` | Fee yield rate: `(feesUSD * 1e18) / (lpValueUSD * duration)` |
| `determine_winner(scoreA, scoreB)` | Returns 1 (player A) or 2 (player B). Ties go to A. |
| `calculate_rewards(totalFees, resolverBps)` | Splits fees into `(winnerAmount, resolverAmount)` based on basis points |
| `normalize_cross_dex(rawScore, dexType)` | Applies DEX-specific weight factors for cross-DEX fairness (currently 1.0x for both V4 and Camelot) |

**Scoring details**:
- Range score: `(inRangeTime / totalTime) * 1e18` + tick tightness bonus
- Tick tightness bonus: linear from 20% (distance=0) to 0% (distance>=100)
- Fee score: normalized yield rate per unit of LP value per second
- All math uses `U256` with 1e18 precision to avoid floating point

### leaderboard (Leaderboard)

Persistent ELO rating system with player statistics.

**Deployed**: `0x7FEB2cf23797Fd950380CD9aD4B7D4cAd4B3C85B`

| Function | Description |
|----------|-------------|
| `initialize(arena, owner)` | Set the authorized BattleArena and owner addresses |
| `record_result(winner, loser, battleValueUSD)` | Update ELO ratings and stats (only callable by BattleArena) |
| `get_player_stats(player)` | Returns `(elo, wins, losses, totalBattles, totalValueWon)` |
| `get_elo(player)` | Returns current ELO rating (default: 1000) |
| `get_player_count()` | Total unique players |
| `get_arena()` | Returns authorized arena address |

**ELO system**:
- Starting ELO: 1000
- K-factor: 32
- ELO floor: 100 (ratings can't drop below)
- Uses linear approximation of standard ELO formula with integer math
- At equal ratings: winner gains 16, loser loses 16
- Underdogs gain more, favorites gain less (up to +/-400 spread)
- Winner always gains at least 1 ELO point

**Storage layout** (`sol_storage!`):
```
arena: address              -- Authorized BattleArena contract
owner: address              -- Admin
elo_ratings: mapping        -- Player ELO ratings
wins: mapping               -- Win count per player
losses: mapping             -- Loss count per player
total_battles: mapping      -- Total battles per player
total_value_won: mapping    -- Cumulative USD value won (8 decimals)
initialized: mapping        -- Whether player has been initialized
player_count: uint256       -- Total unique players
```

## Build

```bash
# Build both contracts
cargo build --release --target wasm32-unknown-unknown

# Export ABI (for Solidity interface generation)
cargo run --features export-abi -p battle_scoring
cargo run --features export-abi -p leaderboard
```

## Test

```bash
# Run all tests (pure logic, no Stylus VM needed)
cargo test

# Run with output
cargo test -- --nocapture
```

Both contracts separate pure logic functions from the Stylus entrypoint, enabling full unit testing without the Stylus VM:

- `battle_scoring`: `range_score()`, `fee_score()`, `winner()`, `rewards()`, `normalize_cross_dex()`
- `leaderboard`: `calculate_new_elo()`

## Deploy

```bash
# Deploy using cargo-stylus
cargo stylus deploy --private-key $PRIVATE_KEY --endpoint $RPC_URL -p battle_scoring
cargo stylus deploy --private-key $PRIVATE_KEY --endpoint $RPC_URL -p leaderboard

# Initialize leaderboard (must be done via cast, not Foundry)
cast send $LEADERBOARD "initialize(address,address)" $BATTLE_ARENA $OWNER \
  --rpc-url $RPC_URL --private-key $PRIVATE_KEY
```

**Note**: Foundry cannot simulate Stylus opcodes (`OpcodeNotFound` errors). All interactions with deployed Stylus contracts must use `cast send` / `cast call` directly against the live Arbitrum Sepolia RPC.

## Dependencies

| Crate | Version | Purpose |
|-------|---------|---------|
| stylus-sdk | 0.10.0 | Stylus runtime, storage, entrypoint macros |
| alloy-primitives | 1.0.1 | `U256`, `Address` types |
| alloy-sol-types | 1.0.1 | Solidity ABI compatibility |

## Project Structure

```
stylus/
├── Cargo.toml                   # Workspace definition
├── battle_scoring/
│   ├── Cargo.toml               # ScoringEngine dependencies
│   └── src/
│       ├── lib.rs               # Scoring logic + Stylus entrypoint + tests
│       └── main.rs              # Binary entrypoint
└── leaderboard/
    ├── Cargo.toml               # Leaderboard dependencies
    └── src/
        ├── lib.rs               # ELO system + Stylus entrypoint + tests
        └── main.rs              # Binary entrypoint
```
