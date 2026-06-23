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

    function run() external returns (AuctionEscrow escrow) {
        address usdc = vm.envAddress("ARC_TESTNET_USDC");
        address treasury = vm.envAddress("PDOOH_TREASURY");
        address owner = vm.envAddress("PDOOH_OWNER");
        address operator = vm.envAddress("PDOOH_OPERATOR");

        vm.startBroadcast();
        escrow = new AuctionEscrow(IERC20(usdc), treasury, owner, operator);
        vm.stopBroadcast();
    }
}
