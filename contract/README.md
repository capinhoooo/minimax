# LP BattleVault - Smart Contracts

Solidity smart contracts for PvP battles between Uniswap V4 LP positions, built with Foundry.

## Contracts

### LPBattleVaultV4.sol (Range Vault)

PvP battles based on **price range validity**. Two LP positions compete over a set duration — the position that stays in-range longer wins both positions.

- Reads pool state via V4 PoolManager `extsload`
- Tracks in-range time for both creator and opponent
- Resolver reward (1% of battle value) for anyone who settles an expired battle

### LPFeeBattleV4.sol (Fee Vault)

PvP battles based on **fee accumulation rate**. The LP position that earns more fees relative to its value wins.

- Tracks `feeGrowthInside0/1LastX128` at battle start via StateLibrary
- Computes fee deltas at resolve time: `(currentFeeGrowth - startFeeGrowth) * liquidity >> 128`
- Normalizes by LP value for fair comparison between different-sized positions

### BattleVaultHook.sol

Custom Uniswap V4 hook that integrates with the battle system for pool-specific logic.

### Supporting Libraries

| File | Purpose |
|------|---------|
| `PoolUtilsV4.sol` | Pool state helper functions |
| `TransferUtils.sol` | Safe token transfer helpers |
| `StringUtils.sol` | String formatting utilities |
| `SepoliaConstants.sol` | Testnet address constants |
| `IShared.sol` | Shared interfaces and error definitions |

## Build

```bash
forge build
```

## Test

```bash
forge test
```

## Deploy

The contracts are deployed on Sepolia using `forge create`:

```bash
source .env

# Deploy Range Vault
forge create src/LPBattleVaultV4.sol:LPBattleVaultV4 \
  --constructor-args $POOL_MANAGER $POSITION_MANAGER \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast --verify

# Deploy Fee Vault
forge create src/LPFeeBattleV4.sol:LPFeeBattleV4 \
  --constructor-args $POOL_MANAGER $POSITION_MANAGER \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast --verify
```

### Post-Deploy Configuration

```bash
# Set price feed for ETH (address(0) = native ETH in V4)
cast send $RANGE_VAULT "setPriceFeed(address,address)" \
  0x0000000000000000000000000000000000000000 $ETH_PRICE_FEED \
  --rpc-url $RPC_URL --private-key $PRIVATE_KEY

# Set stablecoin (USDC)
cast send $RANGE_VAULT "setStablecoin(address)" $USDC \
  --rpc-url $RPC_URL --private-key $PRIVATE_KEY
```

## Deployed Addresses (Sepolia)

| Contract | Address |
|----------|---------|
| Range Vault | `0xDC987dF013d655c8eEb89ACA2c14BdcFeEee850a` |
| Fee Vault | `0xF09216A363FC5D88E899aa92239B2eeB1913913B` |

## V4 Integration Details

The contracts use the Uniswap V4 PositionManager API (not V3):

```solidity
// Read position data
(PoolKey memory poolKey, PositionInfo info) = positionManager.getPoolAndPositionInfo(tokenId);
int24 tickLower = info.tickLower();
int24 tickUpper = info.tickUpper();
uint128 liquidity = positionManager.getPositionLiquidity(tokenId);

// Read fee growth from PoolManager
bytes32 positionId = keccak256(abi.encodePacked(
    address(positionManager), tickLower, tickUpper, bytes32(tokenId)
));
(, uint256 feeGrowth0, uint256 feeGrowth1) = poolManager.getPositionInfo(poolKey.toId(), positionId);
```

## Configuration

`foundry.toml`:
- Solidity: 0.8.26
- EVM: Cancun
- Optimizer: 1,000,000 runs
- VIA IR: enabled

## License

MIT
