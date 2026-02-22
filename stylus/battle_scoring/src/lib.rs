#![cfg_attr(not(any(feature = "export-abi", test, not(target_arch = "wasm32"))), no_main)]
#[cfg(any(target_arch = "wasm32", feature = "export-abi"))]
extern crate alloc;

#[cfg(any(target_arch = "wasm32", feature = "export-abi"))]
use stylus_sdk::prelude::*;
use alloy_primitives::U256;

// ============ Constants ============

/// 1e18 — used for normalized score precision
const SCORE_DECIMALS: u64 = 1_000_000_000_000_000_000;

/// Maximum basis points (100%)
const MAX_BPS: u64 = 10_000;

/// Tick distance bonus: positions with tighter range get up to 20% bonus
/// Threshold below which tick distance earns a bonus (100 ticks)
const TIGHT_RANGE_THRESHOLD: u64 = 100;

/// Maximum bonus for tight ranges (20% = 0.2 * 1e18)
const TIGHT_RANGE_BONUS: u64 = 200_000_000_000_000_000;

/// DEX normalization weight basis points (10000 = 1.0x)
/// Index 0 = UNISWAP_V4, Index 1 = CAMELOT_V3
const DEX_WEIGHT_BPS: [u64; 2] = [10_000, 10_000];

#[cfg(any(target_arch = "wasm32", feature = "export-abi"))]
sol_storage! {
    #[entrypoint]
    pub struct BattleScoring {
        /// Owner for future upgrades (unused in pure functions but reserved)
        address owner;
    }
}

#[cfg(any(target_arch = "wasm32", feature = "export-abi"))]
#[public]
impl BattleScoring {
    /// Calculate score for a range battle.
    pub fn calculate_range_score(
        &self,
        in_range_time: U256,
        total_time: U256,
        tick_distance: U256,
    ) -> U256 {
        range_score(in_range_time, total_time, tick_distance)
    }

    /// Calculate score for a fee battle.
    pub fn calculate_fee_score(
        &self,
        fees_usd: U256,
        lp_value_usd: U256,
        duration: U256,
    ) -> U256 {
        fee_score(fees_usd, lp_value_usd, duration)
    }

    /// Determine winner from two scores.
    pub fn determine_winner(&self, score_a: U256, score_b: U256) -> u8 {
        winner(score_a, score_b)
    }

    /// Calculate reward distribution amounts.
    pub fn calculate_rewards(
        &self,
        total_fees: U256,
        resolver_bps: U256,
    ) -> (U256, U256) {
        rewards(total_fees, resolver_bps)
    }

    /// Normalize a score for cross-DEX fairness.
    pub fn normalize_cross_dex(&self, raw_score: U256, dex_type: u8) -> U256 {
        normalize_cross_dex(raw_score, dex_type)
    }
}

// ============ Pure logic functions (testable without Stylus VM) ============

/// Calculate range score: (inRangeTime / totalTime) * 1e18, with tick tightness bonus.
pub fn range_score(in_range_time: U256, total_time: U256, tick_distance: U256) -> U256 {
    if total_time.is_zero() {
        return U256::ZERO;
    }

    let decimals = U256::from(SCORE_DECIMALS);

    // Base score: (inRangeTime * 1e18) / totalTime
    let base_score = (in_range_time * decimals) / total_time;

    // Tick distance bonus: tighter ranges get up to 20% bonus
    let threshold = U256::from(TIGHT_RANGE_THRESHOLD);
    let max_bonus = U256::from(TIGHT_RANGE_BONUS);

    let bonus = if tick_distance < threshold {
        // Linear bonus: bonus = maxBonus * (threshold - tickDistance) / threshold
        max_bonus * (threshold - tick_distance) / threshold
    } else {
        U256::ZERO
    };

    // Final score = baseScore + (baseScore * bonus / 1e18)
    base_score + (base_score * bonus / decimals)
}

/// Calculate fee yield rate: (feesUSD * 1e18) / (lpValueUSD * duration)
pub fn fee_score(fees_usd: U256, lp_value_usd: U256, duration: U256) -> U256 {
    if lp_value_usd.is_zero() || duration.is_zero() {
        return U256::ZERO;
    }
    let decimals = U256::from(SCORE_DECIMALS);
    (fees_usd * decimals) / (lp_value_usd * duration)
}

/// Determine winner: 1 = player A, 2 = player B. Tie goes to A.
pub fn winner(score_a: U256, score_b: U256) -> u8 {
    if score_a >= score_b { 1 } else { 2 }
}

/// Calculate rewards: (winnerAmount, resolverAmount) from total fees.
pub fn rewards(total_fees: U256, resolver_bps: U256) -> (U256, U256) {
    let max_bps = U256::from(MAX_BPS);
    if resolver_bps >= max_bps {
        return (U256::ZERO, total_fees);
    }
    let resolver_amount = (total_fees * resolver_bps) / max_bps;
    let winner_amount = total_fees - resolver_amount;
    (winner_amount, resolver_amount)
}

/// Normalize a score by applying a DEX-specific weight factor.
/// dex_type 0 = UNISWAP_V4, 1 = CAMELOT_V3.
/// Weight is in basis points: 10000 = 1.0x, 11000 = 1.1x, 9000 = 0.9x.
/// Unknown DEX types get no adjustment (1.0x).
pub fn normalize_cross_dex(raw_score: U256, dex_type: u8) -> U256 {
    let bps = U256::from(MAX_BPS);
    let weight = if (dex_type as usize) < DEX_WEIGHT_BPS.len() {
        U256::from(DEX_WEIGHT_BPS[dex_type as usize])
    } else {
        bps // unknown DEX → 1.0x (no adjustment)
    };
    (raw_score * weight) / bps
}

#[cfg(test)]
mod tests {
    use super::*;

    const E18: u64 = 1_000_000_000_000_000_000;

    // ============ Range Score Tests ============

    #[test]
    fn test_range_score_full_time_no_bonus() {
        let score = range_score(
            U256::from(3600u64),
            U256::from(3600u64),
            U256::from(200u64), // beyond threshold
        );
        assert_eq!(score, U256::from(E18));
    }

    #[test]
    fn test_range_score_half_time() {
        let score = range_score(
            U256::from(1800u64),
            U256::from(3600u64),
            U256::from(200u64),
        );
        assert_eq!(score, U256::from(E18 / 2));
    }

    #[test]
    fn test_range_score_zero_total_time() {
        let score = range_score(U256::from(1000u64), U256::ZERO, U256::ZERO);
        assert_eq!(score, U256::ZERO);
    }

    #[test]
    fn test_range_score_zero_in_range() {
        let score = range_score(U256::ZERO, U256::from(3600u64), U256::from(50u64));
        assert_eq!(score, U256::ZERO);
    }

    #[test]
    fn test_range_score_tight_range_max_bonus() {
        // tick_distance = 0 → max bonus (20%)
        let score = range_score(
            U256::from(3600u64),
            U256::from(3600u64),
            U256::ZERO,
        );
        let expected = U256::from(E18) + U256::from(TIGHT_RANGE_BONUS);
        assert_eq!(score, expected);
    }

    #[test]
    fn test_range_score_tight_range_half_bonus() {
        // tick_distance = 50 → half of max bonus
        let score = range_score(
            U256::from(3600u64),
            U256::from(3600u64),
            U256::from(50u64),
        );
        let half_bonus = TIGHT_RANGE_BONUS / 2;
        let expected = U256::from(E18) + U256::from(half_bonus);
        assert_eq!(score, expected);
    }

    #[test]
    fn test_range_score_at_threshold_no_bonus() {
        let score = range_score(
            U256::from(3600u64),
            U256::from(3600u64),
            U256::from(TIGHT_RANGE_THRESHOLD),
        );
        assert_eq!(score, U256::from(E18));
    }

    #[test]
    fn test_range_score_partial_time_with_bonus() {
        // 50% in range, max bonus
        let score = range_score(
            U256::from(1800u64),
            U256::from(3600u64),
            U256::ZERO,
        );
        let base = E18 / 2;
        let bonus = TIGHT_RANGE_BONUS / 2;
        let expected = U256::from(base) + U256::from(bonus);
        assert_eq!(score, expected);
    }

    // ============ Fee Score Tests ============

    #[test]
    fn test_fee_score_basic() {
        let score = fee_score(
            U256::from(10u64) * U256::from(100_000_000u64), // $10
            U256::from(1000u64) * U256::from(100_000_000u64), // $1000
            U256::from(3600u64),
        );
        let expected = U256::from(E18) / U256::from(360_000u64);
        assert_eq!(score, expected);
    }

    #[test]
    fn test_fee_score_zero_fees() {
        assert_eq!(fee_score(U256::ZERO, U256::from(1000u64), U256::from(3600u64)), U256::ZERO);
    }

    #[test]
    fn test_fee_score_zero_lp_value() {
        assert_eq!(fee_score(U256::from(100u64), U256::ZERO, U256::from(3600u64)), U256::ZERO);
    }

    #[test]
    fn test_fee_score_zero_duration() {
        assert_eq!(fee_score(U256::from(100u64), U256::from(1000u64), U256::ZERO), U256::ZERO);
    }

    #[test]
    fn test_fee_score_higher_fees_higher_score() {
        let low = fee_score(U256::from(10u64), U256::from(1000u64), U256::from(3600u64));
        let high = fee_score(U256::from(100u64), U256::from(1000u64), U256::from(3600u64));
        assert!(high > low);
    }

    #[test]
    fn test_fee_score_larger_position_lower_rate() {
        let small = fee_score(U256::from(100u64), U256::from(1000u64), U256::from(3600u64));
        let large = fee_score(U256::from(100u64), U256::from(2000u64), U256::from(3600u64));
        assert!(small > large);
    }

    // ============ Determine Winner Tests ============

    #[test]
    fn test_winner_a_higher() {
        assert_eq!(winner(U256::from(100u64), U256::from(50u64)), 1);
    }

    #[test]
    fn test_winner_b_higher() {
        assert_eq!(winner(U256::from(50u64), U256::from(100u64)), 2);
    }

    #[test]
    fn test_winner_tie_goes_to_a() {
        assert_eq!(winner(U256::from(100u64), U256::from(100u64)), 1);
    }

    #[test]
    fn test_winner_both_zero() {
        assert_eq!(winner(U256::ZERO, U256::ZERO), 1);
    }

    // ============ Calculate Rewards Tests ============

    #[test]
    fn test_rewards_standard_1_percent() {
        let (w, r) = rewards(U256::from(10000u64), U256::from(100u64));
        assert_eq!(r, U256::from(100u64));
        assert_eq!(w, U256::from(9900u64));
    }

    #[test]
    fn test_rewards_10_percent() {
        let (w, r) = rewards(U256::from(10000u64), U256::from(1000u64));
        assert_eq!(r, U256::from(1000u64));
        assert_eq!(w, U256::from(9000u64));
    }

    #[test]
    fn test_rewards_zero_fees() {
        let (w, r) = rewards(U256::ZERO, U256::from(100u64));
        assert_eq!(w, U256::ZERO);
        assert_eq!(r, U256::ZERO);
    }

    #[test]
    fn test_rewards_zero_resolver_bps() {
        let (w, r) = rewards(U256::from(10000u64), U256::ZERO);
        assert_eq!(w, U256::from(10000u64));
        assert_eq!(r, U256::ZERO);
    }

    #[test]
    fn test_rewards_full_bps() {
        let (w, r) = rewards(U256::from(10000u64), U256::from(10000u64));
        assert_eq!(w, U256::ZERO);
        assert_eq!(r, U256::from(10000u64));
    }

    #[test]
    fn test_rewards_conservation() {
        let total = U256::from(123_456_789u64);
        let (w, r) = rewards(total, U256::from(100u64));
        assert_eq!(w + r, total);
    }

    // ============ Cross-DEX Normalization Tests ============

    #[test]
    fn test_normalize_equal_weights() {
        // Both DEXes at 10000 BPS (1.0x) → no change
        let score = U256::from(1_000_000u64);
        assert_eq!(normalize_cross_dex(score, 0), score); // V4
        assert_eq!(normalize_cross_dex(score, 1), score); // Camelot
    }

    #[test]
    fn test_normalize_zero_score() {
        assert_eq!(normalize_cross_dex(U256::ZERO, 0), U256::ZERO);
        assert_eq!(normalize_cross_dex(U256::ZERO, 1), U256::ZERO);
    }

    #[test]
    fn test_normalize_unknown_dex() {
        // Unknown DEX type gets 1.0x (no adjustment)
        let score = U256::from(5000u64);
        assert_eq!(normalize_cross_dex(score, 255), score);
    }
}
