// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AuctionEngineV1, IAuctionEscrowV2} from "../src/AuctionEngineV1.sol";
import {AuctionEscrowV2} from "../src/AuctionEscrowV2.sol";

interface VmDeployV1 {
    function envAddress(string calldata name) external returns (address);
    function startBroadcast() external;
    function stopBroadcast() external;
}

contract DeployAuctionEngineV1 {
    VmDeployV1 private constant vm = VmDeployV1(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant ARC_TESTNET_USDC_ADDRESS = 0x3600000000000000000000000000000000000000;
    uint256 private constant ARC_TESTNET_CHAIN_ID = 5_042_002;

    error InvalidChain(uint256 actualChainId);
    error ZeroConfigurationAddress();
    error InvalidArcTestnetUsdc(address configured);

    function run() external returns (AuctionEscrowV2 escrow, AuctionEngineV1 engine) {
        address usdc = vm.envAddress("ARC_TESTNET_USDC");
        address admin = vm.envAddress("PDOOH_ADMIN");
        address configAdmin = vm.envAddress("PDOOH_CONFIG_ADMIN");
        address reporter = vm.envAddress("PDOOH_REPORTER");
        address pauser = vm.envAddress("PDOOH_PAUSER");

        if (block.chainid != ARC_TESTNET_CHAIN_ID) {
            revert InvalidChain(block.chainid);
        }
        if (
            usdc == address(0) || admin == address(0) || configAdmin == address(0) || reporter == address(0)
                || pauser == address(0)
        ) {
            revert ZeroConfigurationAddress();
        }
        if (usdc != ARC_TESTNET_USDC_ADDRESS) {
            revert InvalidArcTestnetUsdc(usdc);
        }
        vm.startBroadcast();
        escrow = new AuctionEscrowV2(IERC20(usdc), admin);
        engine = new AuctionEngineV1(IAuctionEscrowV2(address(escrow)), admin, configAdmin, reporter, pauser);
        escrow.setEngine(address(engine));
        vm.stopBroadcast();
    }
}
