// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AuctionEscrow} from "../src/AuctionEscrow.sol";

interface Vm {
    function envAddress(string calldata name) external returns (address);
    function startBroadcast() external;
    function stopBroadcast() external;
}

contract DeployAuctionEscrow {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant ARC_TESTNET_USDC_ADDRESS = 0x3600000000000000000000000000000000000000;

    error ZeroConfigurationAddress();
    error InvalidArcTestnetUsdc(address configured);
    error TreasuryConfigurationMismatch(address frontendTreasury, address escrowTreasury);
    error RolesMustBeDistinct(address owner, address operator, address treasury);

    function run() external returns (AuctionEscrow escrow) {
        address usdc = vm.envAddress("ARC_TESTNET_USDC");
        address frontendTreasury = vm.envAddress("NEXT_PUBLIC_PDOOH_TREASURY_ADDRESS");
        address treasury = vm.envAddress("PDOOH_TREASURY");
        address owner = vm.envAddress("PDOOH_OWNER");
        address operator = vm.envAddress("PDOOH_OPERATOR_ADDRESS");

        if (
            usdc == address(0) || frontendTreasury == address(0) || treasury == address(0) || owner == address(0)
                || operator == address(0)
        ) {
            revert ZeroConfigurationAddress();
        }
        if (usdc != ARC_TESTNET_USDC_ADDRESS) {
            revert InvalidArcTestnetUsdc(usdc);
        }
        if (frontendTreasury != treasury) {
            revert TreasuryConfigurationMismatch(frontendTreasury, treasury);
        }
        if (owner == operator || owner == treasury || operator == treasury) {
            revert RolesMustBeDistinct(owner, operator, treasury);
        }

        vm.startBroadcast();
        escrow = new AuctionEscrow(IERC20(usdc), treasury, owner, operator);
        vm.stopBroadcast();
    }
}
