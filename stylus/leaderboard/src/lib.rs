#![cfg_attr(not(any(feature = "export-abi", test, not(target_arch = "wasm32"))), no_main)]
#[cfg(any(target_arch = "wasm32", feature = "export-abi"))]
extern crate alloc;

#[cfg(any(target_arch = "wasm32", feature = "export-abi"))]
use stylus_sdk::prelude::*;
#[cfg(any(target_arch = "wasm32", feature = "export-abi"))]
use alloy_primitives::Address;
use alloy_primitives::U256;

// ============ ELO Constants ============

/// Starting ELO for new players
const DEFAULT_ELO: u64 = 1000;

/// K-factor for ELO calculation (how much a single game affects rating)
const K_FACTOR: u64 = 32;

/// Scale factor for integer ELO math (avoid floating point)
const ELO_SCALE: u64 = 1000;

/// ELO difference at which expected score = ~0.91 (400 in standard ELO)
const ELO_SPREAD: u64 = 400;

#[cfg(any(target_arch = "wasm32", feature = "export-abi"))]
sol_storage! {
    #[entrypoint]
    pub struct Leaderboard {
        /// The BattleArena contract — only caller allowed to record results
        address arena;

        /// Contract owner for admin
        address owner;

        /// Player ELO ratings (address => elo)
        mapping(address => uint256) elo_ratings;

        /// Player win count
        mapping(address => uint256) wins;

        /// Player loss count
        mapping(address => uint256) losses;

        /// Player total battles
        mapping(address => uint256) total_battles;

        /// Player total USD value won (8 decimals)
        mapping(address => uint256) total_value_won;

        /// Whether a player has been initialized (has played at least once)
        mapping(address => bool) initialized;

        /// Total unique players
        uint256 player_count;
    }
}

#[cfg(any(target_arch = "wasm32", feature = "export-abi"))]
#[public]
impl Leaderboard {
    /// Initialize the leaderboard with the arena and owner addresses.
    pub fn initialize(&mut self, arena: Address, owner: Address) {
        let current_owner = self.owner.get();
        if current_owner != Address::ZERO {
            assert!(
                self.vm().msg_sender() == current_owner,
                "Leaderboard: caller is not the owner"
            );
        }
        self.arena.set(arena);
        self.owner.set(owner);
    }

    /// Record a battle result and update ELO ratings.
    pub fn record_result(
        &mut self,
        winner: Address,
        loser: Address,
        battle_value_usd: U256,
    ) {
        assert!(
            self.vm().msg_sender() == self.arena.get(),
            "Leaderboard: caller is not the arena"
        );

        self.ensure_initialized(winner);
        self.ensure_initialized(loser);

        let winner_elo = self.elo_ratings.get(winner);
        let loser_elo = self.elo_ratings.get(loser);

        let (new_winner_elo, new_loser_elo) = calculate_new_elo(winner_elo, loser_elo);

        self.elo_ratings.setter(winner).set(new_winner_elo);
        self.elo_ratings.setter(loser).set(new_loser_elo);

        let w = self.wins.get(winner);
        self.wins.setter(winner).set(w + U256::from(1));

        let l = self.losses.get(loser);
        self.losses.setter(loser).set(l + U256::from(1));

        let wb = self.total_battles.get(winner);
        self.total_battles.setter(winner).set(wb + U256::from(1));

        let lb = self.total_battles.get(loser);
        self.total_battles.setter(loser).set(lb + U256::from(1));

        let wv = self.total_value_won.get(winner);
        self.total_value_won.setter(winner).set(wv + battle_value_usd);
    }

    /// Get player statistics.
    pub fn get_player_stats(
        &self,
        player: Address,
    ) -> (U256, U256, U256, U256, U256) {
        let is_init = self.initialized.get(player);

        if !is_init {
            return (
                U256::from(DEFAULT_ELO),
                U256::ZERO,
                U256::ZERO,
                U256::ZERO,
                U256::ZERO,
            );
        }

        (
            self.elo_ratings.get(player),
            self.wins.get(player),
            self.losses.get(player),
            self.total_battles.get(player),
            self.total_value_won.get(player),
        )
    }

    /// Get a player's current ELO rating.
    pub fn get_elo(&self, player: Address) -> U256 {
        let is_init = self.initialized.get(player);
        if !is_init {
            return U256::from(DEFAULT_ELO);
        }
        self.elo_ratings.get(player)
    }

    /// Get total number of unique players.
    pub fn get_player_count(&self) -> U256 {
        self.player_count.get()
    }

    /// Get the arena address.
    pub fn get_arena(&self) -> Address {
        self.arena.get()
    }
}

#[cfg(any(target_arch = "wasm32", feature = "export-abi"))]
impl Leaderboard {
    /// Ensure a player is initialized with default ELO.
    fn ensure_initialized(&mut self, player: Address) {
        let is_init = self.initialized.get(player);
        if !is_init {
            self.initialized.setter(player).set(true);
            self.elo_ratings
                .setter(player)
                .set(U256::from(DEFAULT_ELO));

            let count = self.player_count.get();
            self.player_count.set(count + U256::from(1));
        }
    }
}

// ============ Pure ELO calculation (testable without Stylus VM) ============

/// Calculate new ELO ratings after a match.
///
/// Uses a linear approximation of the standard ELO formula with integer math:
///   Expected score for winner:
///     E_w = SCALE/2 + clamp((winner_elo - loser_elo) * SCALE / (4 * SPREAD), -SCALE/2, SCALE/2)
///
///   New rating: R' = R + K * (S - E/SCALE)
///   where S = 1 for win, 0 for loss
///
/// At equal ratings: E_w = 500/1000 = 50%, gain = K/2 = 16
/// At +400 diff (favorite): E_w = 750/1000 = 75%, gain = K*250/1000 = 8
/// At -400 diff (underdog): E_w = 250/1000 = 25%, gain = K*750/1000 = 24
pub fn calculate_new_elo(winner_elo: U256, loser_elo: U256) -> (U256, U256) {
    let k = U256::from(K_FACTOR);
    let scale = U256::from(ELO_SCALE);
    let half_scale = scale / U256::from(2u64);
    let spread4 = U256::from(ELO_SPREAD * 4); // 4 * spread for wider linear range

    // Expected score for winner using clamped linear approximation
    let expected_winner = if winner_elo >= loser_elo {
        let diff = winner_elo - loser_elo;
        let bonus = (diff * scale) / spread4;
        let result = half_scale + bonus;
        // Clamp at scale (probability can't exceed 1.0)
        if result > scale { scale } else { result }
    } else {
        let diff = loser_elo - winner_elo;
        let penalty = (diff * scale) / spread4;
        // Clamp at zero (probability can't go negative)
        if penalty >= half_scale {
            U256::ZERO
        } else {
            half_scale - penalty
        }
    };

    // Winner gain = K * (SCALE - expected) / SCALE  (since S=1 for winner)
    let winner_gain = (k * (scale - expected_winner)) / scale;

    // Loser loss = K * expected_loser / SCALE  (since S=0 for loser)
    let expected_loser = scale - expected_winner;
    let loser_loss = (k * expected_loser) / scale;

    // Ensure winner always gains at least 1 ELO point
    let winner_gain = if winner_gain.is_zero() {
        U256::from(1u64)
    } else {
        winner_gain
    };

    let new_winner_elo = winner_elo + winner_gain;

    // Floor at 100
    let min_elo = U256::from(100u64);
    let new_loser_elo = if loser_elo > loser_loss + min_elo {
        loser_elo - loser_loss
    } else {
        min_elo
    };

    (new_winner_elo, new_loser_elo)
}

#[cfg(test)]
mod tests {
    use super::*;

    // ============ ELO Calculation Tests ============

    #[test]
    fn test_elo_equal_ratings() {
        // Equal ratings: expected ~50% for each
        // Winner gains K * (1 - 0.5) = 16, Loser loses 16
        let (new_w, new_l) = calculate_new_elo(
            U256::from(1000u64),
            U256::from(1000u64),
        );
        assert_eq!(new_w, U256::from(1016u64));
        assert_eq!(new_l, U256::from(984u64));
    }

    #[test]
    fn test_elo_conservation() {
        let w_elo = U256::from(1200u64);
        let l_elo = U256::from(1000u64);
        let (new_w, new_l) = calculate_new_elo(w_elo, l_elo);

        let total_before = w_elo + l_elo;
        let total_after = new_w + new_l;

        let diff = if total_after > total_before {
            total_after - total_before
        } else {
            total_before - total_after
        };
        assert!(diff <= U256::from(2u64), "ELO not approximately conserved");
    }

    #[test]
    fn test_elo_underdog_gains_more() {
        let (underdog_new, _) = calculate_new_elo(
            U256::from(800u64),
            U256::from(1200u64),
        );
        let (equal_new, _) = calculate_new_elo(
            U256::from(1000u64),
            U256::from(1000u64),
        );

        let underdog_gain = underdog_new - U256::from(800u64);
        let equal_gain = equal_new - U256::from(1000u64);
        assert!(underdog_gain > equal_gain);
    }

    #[test]
    fn test_elo_favorite_gains_less() {
        let (fav_new, _) = calculate_new_elo(
            U256::from(1200u64),
            U256::from(800u64),
        );
        let (equal_new, _) = calculate_new_elo(
            U256::from(1000u64),
            U256::from(1000u64),
        );

        let fav_gain = fav_new - U256::from(1200u64);
        let equal_gain = equal_new - U256::from(1000u64);
        assert!(fav_gain < equal_gain);
    }

    #[test]
    fn test_elo_minimum_floor() {
        let (_, new_l) = calculate_new_elo(
            U256::from(1500u64),
            U256::from(110u64),
        );
        assert!(new_l >= U256::from(100u64));
    }

    #[test]
    fn test_elo_at_floor() {
        let (_, new_l) = calculate_new_elo(
            U256::from(1200u64),
            U256::from(100u64),
        );
        assert_eq!(new_l, U256::from(100u64));
    }

    #[test]
    fn test_elo_winner_always_increases() {
        for (w, l) in [(500u64, 1500u64), (1000, 1000), (1500, 500), (100, 2000)] {
            let (new_w, _) = calculate_new_elo(U256::from(w), U256::from(l));
            assert!(new_w > U256::from(w), "Winner ELO should increase for ({w} vs {l})");
        }
    }

    #[test]
    fn test_elo_large_gap() {
        // Favorite (2000) beats underdog (500) → gains very little
        let (new_w, new_l) = calculate_new_elo(
            U256::from(2000u64),
            U256::from(500u64),
        );
        let gain = new_w - U256::from(2000u64);
        // With 1500 diff and spread4=1600, bonus = 1500*1000/1600 = 937 → clamped at 1000
        // gain = 32*(1000-1000)/1000 = 0 (at max expected, no gain)
        assert!(gain <= U256::from(1u64));
        assert!(new_l >= U256::from(100u64));
    }

    #[test]
    fn test_elo_symmetric_outcomes() {
        let w = U256::from(1100u64);
        let l = U256::from(900u64);
        let (new_w, new_l) = calculate_new_elo(w, l);

        let winner_gain = new_w - w;
        let loser_loss = l - new_l;

        let diff = if winner_gain > loser_loss {
            winner_gain - loser_loss
        } else {
            loser_loss - winner_gain
        };
        assert!(diff <= U256::from(1u64));
    }

    #[test]
    fn test_elo_constants() {
        assert_eq!(DEFAULT_ELO, 1000);
        assert_eq!(K_FACTOR, 32);
        assert_eq!(ELO_SPREAD, 400);
    }

    #[test]
    fn test_elo_progression_dominance() {
        // Player A wins 5 games in a row vs B
        let mut a = U256::from(1000u64);
        let mut b = U256::from(1000u64);

        for _ in 0..5 {
            let (new_a, new_b) = calculate_new_elo(a, b);
            a = new_a;
            b = new_b;
        }

        assert!(a > U256::from(1050u64));
        assert!(b < U256::from(950u64));
    }

    #[test]
    fn test_elo_alternating_wins() {
        let mut a = U256::from(1000u64);
        let mut b = U256::from(1000u64);

        for i in 0..10 {
            if i % 2 == 0 {
                let (new_a, new_b) = calculate_new_elo(a, b);
                a = new_a;
                b = new_b;
            } else {
                let (new_b, new_a) = calculate_new_elo(b, a);
                a = new_a;
                b = new_b;
            }
        }

        let a_val: u64 = a.to::<u64>();
        let b_val: u64 = b.to::<u64>();
        assert!((990..=1010).contains(&a_val), "A should be near 1000, got {a_val}");
        assert!((990..=1010).contains(&b_val), "B should be near 1000, got {b_val}");
    }
}
