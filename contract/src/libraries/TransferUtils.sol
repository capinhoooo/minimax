// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Currency, CurrencyLibrary} from "v4-core/types/Currency.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Transfer Utilities
/// @notice Safe transfer functions for tokens and currencies
library TransferUtils {
    using CurrencyLibrary for Currency;

    /// @notice Safely transfer ERC20 tokens if amount is non-zero
    /// @param token The token address
    /// @param to The recipient address
    /// @param amount The amount to transfer
    function safeTransferIfNonZero(address token, address to, uint256 amount) internal {
        if (amount > 0 && to != address(0)) {
            IERC20(token).transfer(to, amount);
        }
    }

    /// @notice Safely transfer Currency (V4 native type) if amount is non-zero
    /// @param currency The currency to transfer
    /// @param to The recipient address
    /// @param amount The amount to transfer
    function safeTransferCurrency(Currency currency, address to, uint256 amount) internal {
        if (amount > 0 && to != address(0)) {
            if (currency.isAddressZero()) {
                // Native ETH transfer
                (bool success, ) = to.call{value: amount}("");
                require(success, "ETH transfer failed");
            } else {
                // ERC20 transfer
                IERC20(Currency.unwrap(currency)).transfer(to, amount);
            }
        }
    }

    /// @notice Safely transfer from with allowance check
    /// @param token The token address
    /// @param from The sender address
    /// @param to The recipient address
    /// @param amount The amount to transfer
    function safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        if (amount > 0) {
            IERC20(token).transferFrom(from, to, amount);
        }
    }
}
