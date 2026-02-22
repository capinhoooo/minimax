#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]

#[cfg(not(feature = "export-abi"))]
pub extern "C" fn main() {}

#[cfg(feature = "export-abi")]
fn main() {
    battle_scoring::print_from_args();
}
