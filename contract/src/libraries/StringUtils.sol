// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title String Utilities
/// @notice Helper functions for string manipulation
library StringUtils {
    /// @notice Convert uint256 to string
    /// @param value The number to convert
    /// @return The string representation
    function uint2str(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }

        uint256 temp = value;
        uint256 digits;

        while (temp != 0) {
            digits++;
            temp /= 10;
        }

        bytes memory buffer = new bytes(digits);

        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }

        return string(buffer);
    }

    /// @notice Format USD value with 8 decimals to human readable
    /// @param rawValue The raw value with 8 decimals
    /// @return The formatted string (e.g., "$123.45")
    function formatUSDValue(uint256 rawValue) internal pure returns (string memory) {
        uint256 wholePart = rawValue / 1e8;
        uint256 decimalPart = (rawValue % 1e8) / 1e6; // 2 decimal places

        string memory wholeStr = uint2str(wholePart);
        string memory decimalStr = uint2str(decimalPart);

        // Pad decimal part with leading zero if needed
        if (decimalPart < 10) {
            decimalStr = string(abi.encodePacked("0", decimalStr));
        }

        return string(abi.encodePacked("$", wholeStr, ".", decimalStr));
    }

    /// @notice Convert address to string
    /// @param addr The address to convert
    /// @return The string representation
    function addressToString(address addr) internal pure returns (string memory) {
        bytes32 value = bytes32(uint256(uint160(addr)));
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(42);

        str[0] = "0";
        str[1] = "x";

        for (uint256 i = 0; i < 20; i++) {
            str[2 + i * 2] = alphabet[uint8(value[i + 12] >> 4)];
            str[3 + i * 2] = alphabet[uint8(value[i + 12] & 0x0f)];
        }

        return string(str);
    }
}
