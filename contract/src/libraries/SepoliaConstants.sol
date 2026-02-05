// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Sepolia Network Constants
/// @notice Contains all Sepolia testnet addresses for Chainlink price feeds and tokens
library SepoliaConstants {
    // ============ Chainlink Price Feeds (Sepolia) ============

    /// @notice BTC/USD price feed
    address constant BTC_USD_FEED = 0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43;

    /// @notice BTC/ETH price feed
    address constant BTC_ETH_FEED = 0x5fb1616F78dA7aFC9FF79e0371741a747D2a7F22;

    /// @notice AUD/USD price feed
    address constant AUD_USD_FEED = 0xB0C712f98daE15264c8E26132BCC91C40aD4d5F9;

    /// @notice CZK/USD price feed
    address constant CZK_USD_FEED = 0xC32f0A9D70A34B9E7377C10FDAd88512596f61EA;

    /// @notice DAI/USD price feed
    address constant DAI_USD_FEED = 0x14866185B1962B63C3Ea9E03Bc1da838bab34C19;

    /// @notice ETH/USD price feed
    address constant ETH_USD_FEED = 0x694AA1769357215DE4FAC081bf1f309aDC325306;

    /// @notice LINK/USD price feed
    address constant LINK_USD_FEED = 0xc59E3633BAAC79493d908e63626716e204A45EdF;

    /// @notice USDC/USD price feed
    address constant USDC_USD_FEED = 0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E;

    // ============ Common Token Addresses (Sepolia) ============

    /// @notice LINK token address on Sepolia
    address constant LINK_TOKEN = 0x779877A7B0D9E8603169DdbD7836e478b4624789;

    /// @notice USDC token address on Sepolia (Circle)
    address constant USDC_TOKEN = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;

    // ============ Uniswap V4 Addresses (Sepolia) ============
    // Note: Update these with actual deployed V4 addresses on Sepolia

    /// @notice Uniswap V4 PoolManager on Sepolia
    /// @dev Update this address after V4 is deployed on Sepolia
    address constant POOL_MANAGER = address(0);

    /// @notice Uniswap V4 PositionManager on Sepolia
    /// @dev Update this address after V4 is deployed on Sepolia
    address constant POSITION_MANAGER = address(0);
}
