// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Arbitrum Sepolia Network Constants
/// @notice Contains all Arbitrum Sepolia testnet addresses for contracts, price feeds, and tokens
library ArbitrumSepoliaConstants {
    // ============ Uniswap V4 (Arbitrum Sepolia) ============

    /// @notice Uniswap V4 PoolManager
    address constant V4_POOL_MANAGER = 0xFB3e0C6F74eB1a21CC1Da29aeC80D2Dfe6C9a317;

    /// @notice Uniswap V4 PositionManager
    address constant V4_POSITION_MANAGER = 0xAc631556d3d4019C95769033B5E719dD77124BAc;

    /// @notice Uniswap V4 StateView
    address constant V4_STATE_VIEW = 0x9D467FA9062b6e9B1a46E26007aD82db116c67cB;

    /// @notice Uniswap V4 Universal Router
    address constant V4_UNIVERSAL_ROUTER = 0xeFd1D4bD4cf1e86Da286BB4CB1B8BcED9C10BA47;

    /// @notice Uniswap V4 Quoter
    address constant V4_QUOTER = 0x7dE51022d70A725b508085468052E25e22b5c4c9;

    /// @notice Permit2 (same across all chains)
    address constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    // ============ Camelot DEX (Arbitrum Sepolia) ============

    /// @notice Camelot Algebra Factory
    address constant CAMELOT_FACTORY = 0xaA37Bea711D585478E1c04b04707cCb0f10D762a;

    /// @notice Camelot NonfungiblePositionManager
    address constant CAMELOT_NFT_MANAGER = 0x79EA6cB3889fe1FC7490A1C69C7861761d882D4A;

    /// @notice Camelot SwapRouter
    address constant CAMELOT_SWAP_ROUTER = 0x171B925C51565F5D2a7d8C494ba3188D304EFD93;

    /// @notice Camelot Quoter
    address constant CAMELOT_QUOTER = 0xe49ef2F48539EA7498605CC1B3a242042cb5FC83;

    // ============ Tokens (Arbitrum Sepolia) ============

    /// @notice WETH on Arbitrum Sepolia
    address constant WETH = 0x980B62Da83eFf3D4576C647993b0c1D7faf17c73;

    /// @notice USDC on Arbitrum Sepolia
    address constant USDC = 0xb893E3334D4Bd6C5ba8277Fd559e99Ed683A9FC7;

    /// @notice GRAIL token on Arbitrum Sepolia
    address constant GRAIL = 0x52CFD1d72A64f8D13711bb7Dc3899653dbd4191B;

    // ============ Chainlink Price Feeds (Arbitrum Sepolia) ============
    // Note: Fetch exact addresses from:
    // https://docs.chain.link/data-feeds/price-feeds/addresses?network=arbitrum&networkType=testnet

    /// @notice ETH/USD price feed on Arbitrum Sepolia
    address constant ETH_USD_FEED = 0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165;

    /// @notice USDC/USD price feed on Arbitrum Sepolia
    address constant USDC_USD_FEED = 0x0153002d20B96532C639313c2d54c3dA09109309;

    /// @notice LINK/USD price feed on Arbitrum Sepolia
    address constant LINK_USD_FEED = 0x0FB99723Aee6f420beAD13e6bBB79b7E6F034298;

    /// @notice BTC/USD price feed on Arbitrum Sepolia
    address constant BTC_USD_FEED = 0x56a43EB56Da12C0dc1D972ACb089c06a5dEF8e69;
}
