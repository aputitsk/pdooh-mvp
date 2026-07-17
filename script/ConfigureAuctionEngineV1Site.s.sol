// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AuctionEngineV1} from "../src/AuctionEngineV1.sol";

interface VmConfigureV1 {
    function envAddress(string calldata name) external returns (address);
    function envBytes32(string calldata name) external returns (bytes32);
    function envUint(string calldata name) external returns (uint256);
    function startBroadcast() external;
    function stopBroadcast() external;
}

contract ConfigureAuctionEngineV1Site {
    VmConfigureV1 private constant vm = VmConfigureV1(address(uint160(uint256(keccak256("hevm cheat code")))));

    error ZeroConfigurationAddress();
    error ZeroConfigurationValue();
    error Uint64ConfigurationOverflow(string name, uint256 value);
    error Uint32ConfigurationOverflow(string name, uint256 value);

    function run() external {
        address engineAddress = vm.envAddress("PDOOH_AUCTION_ENGINE_V1");
        address treasury = vm.envAddress("PDOOH_TREASURY");
        bytes32 siteId = vm.envBytes32("PDOOH_INITIAL_SITE_ID");
        uint256 firstCycleStartsAt = vm.envUint("PDOOH_FIRST_CYCLE_START");
        uint256 proofDeadlineSeconds = vm.envUint("PDOOH_PROOF_DEADLINE_SECONDS");

        if (engineAddress == address(0) || treasury == address(0)) {
            revert ZeroConfigurationAddress();
        }
        if (siteId == bytes32(0) || firstCycleStartsAt == 0) {
            revert ZeroConfigurationValue();
        }
        if (firstCycleStartsAt > type(uint64).max) {
            revert Uint64ConfigurationOverflow("PDOOH_FIRST_CYCLE_START", firstCycleStartsAt);
        }
        if (proofDeadlineSeconds > type(uint32).max) {
            revert Uint32ConfigurationOverflow("PDOOH_PROOF_DEADLINE_SECONDS", proofDeadlineSeconds);
        }

        vm.startBroadcast();
        AuctionEngineV1(engineAddress).configureInitialSite(
            siteId,
            AuctionEngineV1.SiteConfigInput({
                // forge-lint: disable-next-line(unsafe-typecast)
                firstCycleStartsAt: uint64(firstCycleStartsAt),
                openSeconds: 60,
                lockedSeconds: 2,
                playbackSecondsPerSlot: 10,
                // forge-lint: disable-next-line(unsafe-typecast)
                proofDeadlineSeconds: uint32(proofDeadlineSeconds),
                slotCount: 3,
                minimumPaidBid: 20_000,
                treasury: treasury
            })
        );
        vm.stopBroadcast();
    }
}
