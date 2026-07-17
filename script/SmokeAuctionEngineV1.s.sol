// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AuctionEngineV1} from "../src/AuctionEngineV1.sol";
import {AuctionEscrowV2} from "../src/AuctionEscrowV2.sol";
import {AuctionIds} from "../src/AuctionIds.sol";

interface VmSmokeV1 {
    function envAddress(string calldata name) external returns (address);
    function envBytes32(string calldata name) external returns (bytes32);
    function envUint(string calldata name) external returns (uint256);
    function startBroadcast() external;
    function stopBroadcast() external;
}

contract SmokeAuctionEngineV1Base {
    VmSmokeV1 internal constant vm = VmSmokeV1(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 internal constant ARC_TESTNET_CHAIN_ID = 5_042_002;
    address internal constant ARC_TESTNET_USDC_ADDRESS = 0x3600000000000000000000000000000000000000;

    error SmokeInvalidChain(uint256 actualChainId);
    error SmokeInvalidUsdc(address configured);
    error SmokeZeroAddress(string name);
    error SmokeZeroValue(string name);
    error SmokeUint8Overflow(string name, uint256 value);
    error SmokeUint64Overflow(string name, uint256 value);
    error SmokeBiddingWindowClosed(uint256 nowTimestamp, uint64 startsAt, uint64 openEndsAt);
    error SmokeBidNotAbovePaidThreshold(uint256 amount, uint256 minimumPaidBid);
    error SmokeUnexpectedBidState();
    error SmokeOpenWindowActive(uint256 nowTimestamp, uint64 openEndsAt);
    error SmokeUnexpectedSlotOutcome(AuctionEngineV1.SlotOutcome actual, AuctionEngineV1.SlotOutcome expected);
    error SmokePlaybackWindowNotReady(uint256 nowTimestamp, uint64 playbackEndedAt);
    error SmokePlaybackProofExpired(uint256 nowTimestamp, uint64 proofDeadline);
    error SmokeProofDeadlineActive(uint256 nowTimestamp, uint64 proofDeadline);

    struct SmokeConfig {
        IERC20 usdc;
        AuctionEscrowV2 escrow;
        AuctionEngineV1 engine;
        bytes32 siteId;
        uint64 cycleId;
        uint8 slotIndex;
    }

    function _config() internal returns (SmokeConfig memory config) {
        address usdcAddress = vm.envAddress("ARC_TESTNET_USDC");
        address escrowAddress = vm.envAddress("PDOOH_AUCTION_ESCROW_V2");
        address engineAddress = vm.envAddress("PDOOH_AUCTION_ENGINE_V1");

        if (block.chainid != ARC_TESTNET_CHAIN_ID) {
            revert SmokeInvalidChain(block.chainid);
        }
        if (usdcAddress == address(0)) {
            revert SmokeZeroAddress("ARC_TESTNET_USDC");
        }
        if (usdcAddress != ARC_TESTNET_USDC_ADDRESS) {
            revert SmokeInvalidUsdc(usdcAddress);
        }
        if (escrowAddress == address(0)) {
            revert SmokeZeroAddress("PDOOH_AUCTION_ESCROW_V2");
        }
        if (engineAddress == address(0)) {
            revert SmokeZeroAddress("PDOOH_AUCTION_ENGINE_V1");
        }

        config.usdc = IERC20(usdcAddress);
        config.escrow = AuctionEscrowV2(escrowAddress);
        config.engine = AuctionEngineV1(engineAddress);
        config.siteId = vm.envBytes32("PDOOH_SMOKE_SITE_ID");
        config.cycleId = _envUint64("PDOOH_SMOKE_CYCLE_ID");
        config.slotIndex = _envUint8("PDOOH_SMOKE_SLOT_INDEX");

        if (config.siteId == bytes32(0)) {
            revert SmokeZeroValue("PDOOH_SMOKE_SITE_ID");
        }
    }

    function _envUint8(string memory name) internal returns (uint8) {
        uint256 value = vm.envUint(name);
        if (value > type(uint8).max) {
            revert SmokeUint8Overflow(name, value);
        }
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint8(value);
    }

    function _envUint64(string memory name) internal returns (uint64) {
        uint256 value = vm.envUint(name);
        if (value > type(uint64).max) {
            revert SmokeUint64Overflow(name, value);
        }
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint64(value);
    }

    function _slotProofDeadline(AuctionEngineV1.CycleSnapshot memory snapshot, uint8 slotIndex)
        internal
        pure
        returns (uint64)
    {
        uint64 slotStart = snapshot.playbackStartsAt + uint64(slotIndex) * snapshot.playbackSecondsPerSlot;
        return slotStart + snapshot.playbackSecondsPerSlot + (snapshot.proofDeadlineEndsAt - snapshot.endsAt);
    }

    function _requireOutcome(
        AuctionEngineV1.SlotOutcome actual,
        AuctionEngineV1.SlotOutcome expected
    ) internal pure {
        if (actual != expected) {
            revert SmokeUnexpectedSlotOutcome(actual, expected);
        }
    }
}

contract SmokeAuctionEngineV1Bid is SmokeAuctionEngineV1Base {
    function run() external {
        SmokeConfig memory config = _config();
        address advertiser = vm.envAddress("PDOOH_SMOKE_ADVERTISER");
        bytes32 advertisementId = vm.envBytes32("PDOOH_SMOKE_ADVERTISEMENT_ID");
        uint256 amount = vm.envUint("PDOOH_SMOKE_BID_AMOUNT");

        if (advertiser == address(0)) {
            revert SmokeZeroAddress("PDOOH_SMOKE_ADVERTISER");
        }
        if (advertisementId == bytes32(0)) {
            revert SmokeZeroValue("PDOOH_SMOKE_ADVERTISEMENT_ID");
        }
        if (amount == 0) {
            revert SmokeZeroValue("PDOOH_SMOKE_BID_AMOUNT");
        }

        AuctionEngineV1.CycleSnapshot memory snapshot = config.engine.previewCycle(config.siteId, config.cycleId);
        if (block.timestamp < snapshot.startsAt || block.timestamp >= snapshot.openEndsAt) {
            revert SmokeBiddingWindowClosed(block.timestamp, snapshot.startsAt, snapshot.openEndsAt);
        }
        if (amount <= snapshot.minimumPaidBid) {
            revert SmokeBidNotAbovePaidThreshold(amount, snapshot.minimumPaidBid);
        }

        uint256 available = config.escrow.availableOf(advertiser);
        uint256 missingDeposit = amount > available ? amount - available : 0;

        vm.startBroadcast();
        if (missingDeposit != 0) {
            config.usdc.approve(address(config.escrow), missingDeposit);
            config.escrow.deposit(missingDeposit);
        }
        config.engine.placeBid(config.siteId, config.cycleId, config.slotIndex, advertisementId, amount);
        vm.stopBroadcast();

        bytes32 slotKey = AuctionIds.slotKey(config.siteId, config.cycleId, config.slotIndex);
        bytes32 bidId = AuctionIds.bidId(slotKey, advertiser);
        AuctionEngineV1.Bid memory bid = config.engine.getBid(bidId);
        if (!bid.exists || bid.bidder != advertiser || bid.amount != amount || bid.advertisementId != advertisementId) {
            revert SmokeUnexpectedBidState();
        }
    }
}

contract SmokeAuctionEngineV1Finalize is SmokeAuctionEngineV1Base {
    function run() external {
        SmokeConfig memory config = _config();
        AuctionEngineV1.CycleSnapshot memory snapshot = config.engine.previewCycle(config.siteId, config.cycleId);
        if (block.timestamp < snapshot.openEndsAt) {
            revert SmokeOpenWindowActive(block.timestamp, snapshot.openEndsAt);
        }

        vm.startBroadcast();
        config.engine.finalizeSlot(config.siteId, config.cycleId, config.slotIndex);
        vm.stopBroadcast();

        AuctionEngineV1.SlotState memory slot =
            config.engine.getSlotState(config.siteId, config.cycleId, config.slotIndex);
        _requireOutcome(slot.outcome, AuctionEngineV1.SlotOutcome.PAID_WINNER);
    }
}

contract SmokeAuctionEngineV1Confirm is SmokeAuctionEngineV1Base {
    function run() external {
        SmokeConfig memory config = _config();
        bytes32 advertisementId = vm.envBytes32("PDOOH_SMOKE_ADVERTISEMENT_ID");
        bytes32 screenId = vm.envBytes32("PDOOH_SMOKE_SCREEN_ID");
        uint256 reporterNonce = vm.envUint("PDOOH_SMOKE_REPORTER_NONCE");

        if (advertisementId == bytes32(0)) {
            revert SmokeZeroValue("PDOOH_SMOKE_ADVERTISEMENT_ID");
        }
        if (screenId == bytes32(0)) {
            revert SmokeZeroValue("PDOOH_SMOKE_SCREEN_ID");
        }

        AuctionEngineV1.CycleSnapshot memory snapshot = config.engine.previewCycle(config.siteId, config.cycleId);
        uint64 playbackStartedAt =
            snapshot.playbackStartsAt + uint64(config.slotIndex) * snapshot.playbackSecondsPerSlot;
        uint64 playbackEndedAt = playbackStartedAt + snapshot.playbackSecondsPerSlot;
        uint64 proofDeadline = _slotProofDeadline(snapshot, config.slotIndex);

        if (block.timestamp < playbackEndedAt) {
            revert SmokePlaybackWindowNotReady(block.timestamp, playbackEndedAt);
        }
        if (block.timestamp > proofDeadline) {
            revert SmokePlaybackProofExpired(block.timestamp, proofDeadline);
        }

        AuctionEngineV1.SlotState memory beforeSlot =
            config.engine.getSlotState(config.siteId, config.cycleId, config.slotIndex);
        _requireOutcome(beforeSlot.outcome, AuctionEngineV1.SlotOutcome.PAID_WINNER);

        vm.startBroadcast();
        config.engine.confirmPlayback(
            AuctionEngineV1.PlaybackReport({
                siteId: config.siteId,
                cycleId: config.cycleId,
                slotIndex: config.slotIndex,
                advertisementId: advertisementId,
                screenId: screenId,
                playbackStartedAt: playbackStartedAt,
                playbackEndedAt: playbackEndedAt,
                reporterNonce: reporterNonce,
                success: true,
                evidenceHash: vm.envBytes32("PDOOH_SMOKE_EVIDENCE_HASH")
            })
        );
        vm.stopBroadcast();

        AuctionEngineV1.SlotState memory afterSlot =
            config.engine.getSlotState(config.siteId, config.cycleId, config.slotIndex);
        _requireOutcome(afterSlot.outcome, AuctionEngineV1.SlotOutcome.PLAYED);
    }
}

contract SmokeAuctionEngineV1Settle is SmokeAuctionEngineV1Base {
    function run() external {
        SmokeConfig memory config = _config();
        AuctionEngineV1.SlotState memory beforeSlot =
            config.engine.getSlotState(config.siteId, config.cycleId, config.slotIndex);
        _requireOutcome(beforeSlot.outcome, AuctionEngineV1.SlotOutcome.PLAYED);

        vm.startBroadcast();
        config.engine.settleSlot(config.siteId, config.cycleId, config.slotIndex);
        vm.stopBroadcast();

        AuctionEngineV1.SlotState memory afterSlot =
            config.engine.getSlotState(config.siteId, config.cycleId, config.slotIndex);
        _requireOutcome(afterSlot.outcome, AuctionEngineV1.SlotOutcome.SETTLED);
    }
}

contract SmokeAuctionEngineV1Expire is SmokeAuctionEngineV1Base {
    function run() external {
        SmokeConfig memory config = _config();
        AuctionEngineV1.CycleSnapshot memory snapshot = config.engine.previewCycle(config.siteId, config.cycleId);
        uint64 proofDeadline = _slotProofDeadline(snapshot, config.slotIndex);
        if (block.timestamp <= proofDeadline) {
            revert SmokeProofDeadlineActive(block.timestamp, proofDeadline);
        }

        AuctionEngineV1.SlotState memory beforeSlot =
            config.engine.getSlotState(config.siteId, config.cycleId, config.slotIndex);
        _requireOutcome(beforeSlot.outcome, AuctionEngineV1.SlotOutcome.PAID_WINNER);

        vm.startBroadcast();
        config.engine.expireSlot(config.siteId, config.cycleId, config.slotIndex);
        vm.stopBroadcast();

        AuctionEngineV1.SlotState memory afterSlot =
            config.engine.getSlotState(config.siteId, config.cycleId, config.slotIndex);
        _requireOutcome(afterSlot.outcome, AuctionEngineV1.SlotOutcome.EXPIRED);
    }
}
