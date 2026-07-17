// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title pDOOH Auction Identifier Helpers
/// @notice Canonical versioned ID formulas shared by contracts and off-chain tooling.
library AuctionIds {
    bytes32 internal constant SITE_ID_DOMAIN = keccak256("pdooh.siteId.v1");
    bytes32 internal constant SLOT_KEY_DOMAIN = keccak256("pdooh.slotKey.v1");
    bytes32 internal constant BID_ID_DOMAIN = keccak256("pdooh.bidId.v1");
    bytes32 internal constant RESERVATION_ID_DOMAIN = keccak256("pdooh.reservationId.v1");
    bytes32 internal constant SETTLEMENT_ID_DOMAIN = keccak256("pdooh.settlementId.v1");
    bytes32 internal constant CONFIG_HASH_DOMAIN = keccak256("pdooh.configHash.v1");
    bytes32 internal constant PLAYBACK_REPORT_DOMAIN = keccak256("pdooh.playbackReportDigest.v1");

    struct ConfigHashInput {
        bytes32 siteId;
        uint32 version;
        uint64 effectiveCycleId;
        uint64 firstCycleStartsAt;
        uint32 openSeconds;
        uint32 lockedSeconds;
        uint32 playbackSecondsPerSlot;
        uint32 proofDeadlineSeconds;
        uint8 slotCount;
        uint256 minimumPaidBid;
        address treasury;
    }

    struct PlaybackReportInput {
        bytes32 siteId;
        uint64 cycleId;
        uint8 slotIndex;
        bytes32 advertisementId;
        bytes32 screenId;
        uint64 playbackStartedAt;
        uint64 playbackEndedAt;
        uint256 reporterNonce;
        bool success;
        bytes32 evidenceHash;
    }

    function siteId(string memory canonicalSiteKey) internal pure returns (bytes32) {
        return keccak256(abi.encode(SITE_ID_DOMAIN, canonicalSiteKey));
    }

    function slotKey(bytes32 siteId_, uint64 cycleId, uint8 slotIndex) internal pure returns (bytes32) {
        return keccak256(abi.encode(SLOT_KEY_DOMAIN, siteId_, cycleId, slotIndex));
    }

    function bidId(bytes32 slotKey_, address bidder) internal pure returns (bytes32) {
        return keccak256(abi.encode(BID_ID_DOMAIN, slotKey_, bidder));
    }

    function reservationId(bytes32 bidId_) internal pure returns (bytes32) {
        return keccak256(abi.encode(RESERVATION_ID_DOMAIN, bidId_));
    }

    function settlementId(bytes32 slotKey_, address bidder, bytes32 advertisementId) internal pure returns (bytes32) {
        return keccak256(abi.encode(SETTLEMENT_ID_DOMAIN, slotKey_, bidder, advertisementId));
    }

    function configHash(ConfigHashInput memory input) internal pure returns (bytes32) {
        return keccak256(abi.encode(CONFIG_HASH_DOMAIN, input));
    }

    function playbackReportDigest(PlaybackReportInput memory input) internal pure returns (bytes32) {
        return keccak256(abi.encode(PLAYBACK_REPORT_DOMAIN, input));
    }
}
