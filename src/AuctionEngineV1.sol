// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {AuctionIds} from "./AuctionIds.sol";

interface IAuctionEscrowV2 {
    function reserve(address payer, uint256 amount, address beneficiary, bytes32 reservationId) external;
    function settleReservation(bytes32 reservationId, uint256 finalAmount, bytes32 settlementId) external;
    function releaseReservation(bytes32 reservationId) external;
}

/// @title pDOOH Auction Engine V1
/// @notice Contract authority for site config, bids, winner selection, playback state, and settlement eligibility.
contract AuctionEngineV1 is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant CONFIG_ADMIN_ROLE = keccak256("CONFIG_ADMIN_ROLE");
    bytes32 public constant REPORTER_ROLE = keccak256("REPORTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    uint32 public constant DEFAULT_OPEN_SECONDS = 60;
    uint32 public constant DEFAULT_LOCKED_SECONDS = 2;
    uint32 public constant DEFAULT_PLAYBACK_SECONDS_PER_SLOT = 10;
    uint8 public constant DEFAULT_SLOT_COUNT = 3;
    uint256 public constant DEFAULT_MINIMUM_PAID_BID = 20_000;
    uint16 public constant MAX_BIDS_PER_SLOT = 10;

    IAuctionEscrowV2 public immutable escrow;

    enum SlotOutcome {
        UNFINALIZED,
        PAID_WINNER,
        NO_PAID_WINNER,
        PLAYED,
        EXPIRED,
        SETTLED
    }

    struct SiteConfig {
        bool exists;
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
        bytes32 configHash;
    }

    struct SiteConfigInput {
        uint64 firstCycleStartsAt;
        uint32 openSeconds;
        uint32 lockedSeconds;
        uint32 playbackSecondsPerSlot;
        uint32 proofDeadlineSeconds;
        uint8 slotCount;
        uint256 minimumPaidBid;
        address treasury;
    }

    struct CycleSnapshot {
        bool exists;
        uint32 configVersion;
        bytes32 configHash;
        uint64 startsAt;
        uint64 openEndsAt;
        uint64 playbackStartsAt;
        uint64 endsAt;
        uint64 proofDeadlineEndsAt;
        uint8 slotCount;
        uint32 playbackSecondsPerSlot;
        uint256 minimumPaidBid;
        address treasury;
    }

    struct Bid {
        bool exists;
        address bidder;
        uint256 amount;
        bytes32 advertisementId;
        bytes32 reservationId;
    }

    struct SlotState {
        SlotOutcome outcome;
        address paidWinner;
        uint256 paidAmount;
        bytes32 advertisementId;
        bytes32 reservationId;
        bytes32 settlementId;
        bytes32 playbackReportDigest;
    }

    struct PlaybackReport {
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

    mapping(bytes32 siteId => uint32 versionCount) private _siteVersionCount;
    mapping(bytes32 siteId => mapping(uint32 version => SiteConfig config)) private _siteConfigs;
    mapping(bytes32 siteId => mapping(uint64 cycleId => CycleSnapshot snapshot)) private _cycleSnapshots;
    mapping(bytes32 bidId => Bid bid) private _bids;
    mapping(bytes32 slotKey => bytes32[] bidIds) private _slotBidIds;
    mapping(bytes32 slotKey => SlotState slot) private _slots;
    mapping(address reporter => mapping(uint256 nonce => bool used)) public reporterNonceUsed;

    event SiteConfigured(
        bytes32 indexed siteId,
        uint32 indexed version,
        uint64 indexed effectiveCycleId,
        bytes32 configHash,
        address treasury
    );
    event CycleSnapshotCreated(bytes32 indexed siteId, uint64 indexed cycleId, uint32 configVersion, bytes32 configHash);
    event BidPlaced(
        bytes32 indexed bidId,
        bytes32 indexed reservationId,
        bytes32 indexed siteId,
        uint64 cycleId,
        uint8 slotIndex,
        address bidder,
        bytes32 advertisementId,
        uint256 amount
    );
    event SlotFinalized(
        bytes32 indexed siteId,
        uint64 indexed cycleId,
        uint8 indexed slotIndex,
        SlotOutcome outcome,
        address paidWinner,
        uint256 paidAmount,
        bytes32 advertisementId
    );
    event PlaybackConfirmed(
        bytes32 indexed siteId,
        uint64 indexed cycleId,
        uint8 indexed slotIndex,
        address reporter,
        bytes32 playbackReportDigest
    );
    event SlotExpired(bytes32 indexed siteId, uint64 indexed cycleId, uint8 indexed slotIndex);
    event SlotSettled(
        bytes32 indexed siteId,
        uint64 indexed cycleId,
        uint8 indexed slotIndex,
        bytes32 reservationId,
        bytes32 settlementId,
        uint256 amount
    );

    error ZeroAddress();
    error ZeroIdentifier();
    error InvalidSiteConfig();
    error SiteAlreadyConfigured(bytes32 siteId);
    error SiteNotConfigured(bytes32 siteId);
    error InvalidCycle(bytes32 siteId, uint64 cycleId);
    error CycleNotStarted(bytes32 siteId, uint64 cycleId, uint64 startsAt);
    error InvalidSlot(uint8 slotIndex);
    error BiddingClosed(bytes32 siteId, uint64 cycleId);
    error TreasuryCannotBid(address bidder);
    error ZeroBidAmount();
    error DuplicateBid(bytes32 bidId);
    error BidLimitReached(bytes32 slotKey, uint256 limit);
    error SlotAlreadyFinalized(bytes32 slotKey);
    error SlotNotFinalized(bytes32 slotKey);
    error SlotHasNoPaidWinner(bytes32 slotKey);
    error SlotNotPlayed(bytes32 slotKey);
    error SlotNotExpired(bytes32 slotKey);
    error PlaybackReportAlreadyUsed(address reporter, uint256 reporterNonce);
    error InvalidPlaybackReport();
    error PlaybackNotEnded(uint64 playbackEndedAt);
    error PlaybackAdvertisementMismatch(bytes32 expected, bytes32 actual);

    constructor(IAuctionEscrowV2 escrow_, address initialAdmin, address configAdmin, address reporter, address pauser) {
        if (
            address(escrow_) == address(0) || initialAdmin == address(0) || configAdmin == address(0)
                || reporter == address(0) || pauser == address(0)
        ) {
            revert ZeroAddress();
        }

        escrow = escrow_;

        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(CONFIG_ADMIN_ROLE, configAdmin);
        _grantRole(REPORTER_ROLE, reporter);
        _grantRole(PAUSER_ROLE, pauser);
    }

    function configureInitialSite(bytes32 siteId, SiteConfigInput calldata input)
        external
        onlyRole(CONFIG_ADMIN_ROLE)
    {
        if (siteId == bytes32(0)) {
            revert ZeroIdentifier();
        }
        if (_siteVersionCount[siteId] != 0) {
            revert SiteAlreadyConfigured(siteId);
        }

        _storeSiteConfig(siteId, input, 1, 0);
    }

    function configureNextSiteVersion(bytes32 siteId, SiteConfigInput calldata input)
        external
        onlyRole(CONFIG_ADMIN_ROLE)
    {
        _requireConfigured(siteId);

        uint32 nextVersion = _siteVersionCount[siteId] + 1;
        uint64 effectiveCycleId = currentCycleId(siteId) + 1;
        SiteConfig memory currentConfig = getSiteConfigForCycle(siteId, effectiveCycleId - 1);
        uint64 effectiveStartsAt = _cycleStartsAt(currentConfig, effectiveCycleId);
        if (input.firstCycleStartsAt != effectiveStartsAt) {
            revert InvalidSiteConfig();
        }

        _storeSiteConfig(siteId, input, nextVersion, effectiveCycleId);
    }

    function placeBid(
        bytes32 siteId,
        uint64 cycleId,
        uint8 slotIndex,
        bytes32 advertisementId,
        uint256 amount
    ) external whenNotPaused nonReentrant returns (bytes32 bidId_, bytes32 reservationId_) {
        if (siteId == bytes32(0) || advertisementId == bytes32(0)) {
            revert ZeroIdentifier();
        }
        if (amount == 0) {
            revert ZeroBidAmount();
        }

        CycleSnapshot memory snapshot = snapshotCycle(siteId, cycleId);
        _requireSlot(snapshot, slotIndex);
        _requireOpenForBids(siteId, cycleId, snapshot);
        if (msg.sender == snapshot.treasury) {
            revert TreasuryCannotBid(msg.sender);
        }

        bytes32 slotKey_ = AuctionIds.slotKey(siteId, cycleId, slotIndex);
        bidId_ = AuctionIds.bidId(slotKey_, msg.sender);
        if (_bids[bidId_].exists) {
            revert DuplicateBid(bidId_);
        }
        if (_slotBidIds[slotKey_].length >= MAX_BIDS_PER_SLOT) {
            revert BidLimitReached(slotKey_, MAX_BIDS_PER_SLOT);
        }

        reservationId_ = AuctionIds.reservationId(bidId_);
        _bids[bidId_] = Bid({
            exists: true,
            bidder: msg.sender,
            amount: amount,
            advertisementId: advertisementId,
            reservationId: reservationId_
        });
        _slotBidIds[slotKey_].push(bidId_);

        escrow.reserve(msg.sender, amount, snapshot.treasury, reservationId_);

        emit BidPlaced(bidId_, reservationId_, siteId, cycleId, slotIndex, msg.sender, advertisementId, amount);
    }

    function finalizeSlot(bytes32 siteId, uint64 cycleId, uint8 slotIndex) public nonReentrant {
        CycleSnapshot memory snapshot = snapshotCycle(siteId, cycleId);
        _requireSlot(snapshot, slotIndex);
        if (block.timestamp < snapshot.openEndsAt) {
            revert BiddingClosed(siteId, cycleId);
        }

        bytes32 slotKey_ = AuctionIds.slotKey(siteId, cycleId, slotIndex);
        SlotState storage slot = _slots[slotKey_];
        if (slot.outcome != SlotOutcome.UNFINALIZED) {
            revert SlotAlreadyFinalized(slotKey_);
        }

        bytes32[] storage bidIds = _slotBidIds[slotKey_];
        bytes32 winningBidId;
        uint256 highestAmount;
        address paidWinner;
        bytes32 advertisementId;

        for (uint256 index = 0; index < bidIds.length; index++) {
            Bid storage bid = _bids[bidIds[index]];
            if (bid.amount > highestAmount) {
                highestAmount = bid.amount;
                paidWinner = bid.bidder;
                advertisementId = bid.advertisementId;
                winningBidId = bidIds[index];
            }
        }

        if (highestAmount > snapshot.minimumPaidBid) {
            Bid storage winningBid = _bids[winningBidId];
            slot.outcome = SlotOutcome.PAID_WINNER;
            slot.paidWinner = paidWinner;
            slot.paidAmount = highestAmount;
            slot.advertisementId = advertisementId;
            slot.reservationId = winningBid.reservationId;

            _releaseLosers(bidIds, winningBidId);
            emit SlotFinalized(siteId, cycleId, slotIndex, SlotOutcome.PAID_WINNER, paidWinner, highestAmount, advertisementId);
        } else {
            slot.outcome = SlotOutcome.NO_PAID_WINNER;
            _releaseLosers(bidIds, bytes32(0));
            emit SlotFinalized(siteId, cycleId, slotIndex, SlotOutcome.NO_PAID_WINNER, address(0), 0, bytes32(0));
        }
    }

    function confirmPlayback(PlaybackReport calldata report) external onlyRole(REPORTER_ROLE) nonReentrant {
        if (report.siteId == bytes32(0) || report.advertisementId == bytes32(0) || report.screenId == bytes32(0)) {
            revert ZeroIdentifier();
        }
        if (reporterNonceUsed[msg.sender][report.reporterNonce]) {
            revert PlaybackReportAlreadyUsed(msg.sender, report.reporterNonce);
        }

        CycleSnapshot memory snapshot = snapshotCycle(report.siteId, report.cycleId);
        _requireSlot(snapshot, report.slotIndex);
        bytes32 slotKey_ = AuctionIds.slotKey(report.siteId, report.cycleId, report.slotIndex);
        SlotState storage slot = _slots[slotKey_];
        if (slot.outcome != SlotOutcome.PAID_WINNER) {
            revert SlotNotFinalized(slotKey_);
        }
        if (!report.success || report.playbackEndedAt < report.playbackStartedAt) {
            revert InvalidPlaybackReport();
        }
        if (block.timestamp < report.playbackEndedAt) {
            revert PlaybackNotEnded(report.playbackEndedAt);
        }
        if (report.advertisementId != slot.advertisementId) {
            revert PlaybackAdvertisementMismatch(slot.advertisementId, report.advertisementId);
        }
        if (block.timestamp > _slotProofDeadline(snapshot, report.slotIndex)) {
            revert SlotNotExpired(slotKey_);
        }

        uint64 slotStart = snapshot.playbackStartsAt + uint64(report.slotIndex) * snapshot.playbackSecondsPerSlot;
        uint64 slotEnd = slotStart + snapshot.playbackSecondsPerSlot;
        if (report.playbackStartedAt < slotStart || report.playbackEndedAt > slotEnd) {
            revert InvalidPlaybackReport();
        }

        bytes32 digest = AuctionIds.playbackReportDigest(
            AuctionIds.PlaybackReportInput({
                siteId: report.siteId,
                cycleId: report.cycleId,
                slotIndex: report.slotIndex,
                advertisementId: report.advertisementId,
                screenId: report.screenId,
                playbackStartedAt: report.playbackStartedAt,
                playbackEndedAt: report.playbackEndedAt,
                reporterNonce: report.reporterNonce,
                success: report.success,
                evidenceHash: report.evidenceHash
            })
        );

        reporterNonceUsed[msg.sender][report.reporterNonce] = true;
        slot.outcome = SlotOutcome.PLAYED;
        slot.playbackReportDigest = digest;

        emit PlaybackConfirmed(report.siteId, report.cycleId, report.slotIndex, msg.sender, digest);
    }

    function expireSlot(bytes32 siteId, uint64 cycleId, uint8 slotIndex) external nonReentrant {
        CycleSnapshot memory snapshot = snapshotCycle(siteId, cycleId);
        _requireSlot(snapshot, slotIndex);

        bytes32 slotKey_ = AuctionIds.slotKey(siteId, cycleId, slotIndex);
        SlotState storage slot = _slots[slotKey_];
        if (slot.outcome != SlotOutcome.PAID_WINNER) {
            revert SlotHasNoPaidWinner(slotKey_);
        }
        if (block.timestamp <= _slotProofDeadline(snapshot, slotIndex)) {
            revert SlotNotExpired(slotKey_);
        }

        bytes32 reservationId_ = slot.reservationId;
        slot.outcome = SlotOutcome.EXPIRED;
        escrow.releaseReservation(reservationId_);

        emit SlotExpired(siteId, cycleId, slotIndex);
    }

    function settleSlot(bytes32 siteId, uint64 cycleId, uint8 slotIndex) external nonReentrant {
        CycleSnapshot memory snapshot = snapshotCycle(siteId, cycleId);
        _requireSlot(snapshot, slotIndex);

        bytes32 slotKey_ = AuctionIds.slotKey(siteId, cycleId, slotIndex);
        SlotState storage slot = _slots[slotKey_];
        if (slot.outcome != SlotOutcome.PLAYED) {
            revert SlotNotPlayed(slotKey_);
        }

        bytes32 settlementId_ = AuctionIds.settlementId(slotKey_, slot.paidWinner, slot.advertisementId);
        escrow.settleReservation(slot.reservationId, slot.paidAmount, settlementId_);

        slot.outcome = SlotOutcome.SETTLED;
        slot.settlementId = settlementId_;

        emit SlotSettled(siteId, cycleId, slotIndex, slot.reservationId, settlementId_, slot.paidAmount);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function snapshotCycle(bytes32 siteId, uint64 cycleId) public returns (CycleSnapshot memory) {
        _requireConfigured(siteId);

        CycleSnapshot storage existing = _cycleSnapshots[siteId][cycleId];
        if (existing.exists) {
            return existing;
        }

        CycleSnapshot memory built = previewCycle(siteId, cycleId);
        if (block.timestamp < built.startsAt) {
            revert CycleNotStarted(siteId, cycleId, built.startsAt);
        }

        existing.exists = true;
        existing.configVersion = built.configVersion;
        existing.configHash = built.configHash;
        existing.startsAt = built.startsAt;
        existing.openEndsAt = built.openEndsAt;
        existing.playbackStartsAt = built.playbackStartsAt;
        existing.endsAt = built.endsAt;
        existing.proofDeadlineEndsAt = built.proofDeadlineEndsAt;
        existing.slotCount = built.slotCount;
        existing.playbackSecondsPerSlot = built.playbackSecondsPerSlot;
        existing.minimumPaidBid = built.minimumPaidBid;
        existing.treasury = built.treasury;

        emit CycleSnapshotCreated(siteId, cycleId, built.configVersion, built.configHash);
        return existing;
    }

    function currentCycleId(bytes32 siteId) public view returns (uint64) {
        uint32 versionCount = _siteVersionCount[siteId];
        if (versionCount == 0) {
            revert SiteNotConfigured(siteId);
        }

        for (uint32 version = versionCount; version > 0; version--) {
            SiteConfig memory config = _siteConfigs[siteId][version];
            if (block.timestamp >= config.firstCycleStartsAt) {
                return config.effectiveCycleId + uint64((block.timestamp - config.firstCycleStartsAt) / _cycleDuration(config));
            }
        }

        return 0;
    }

    function previewCycle(bytes32 siteId, uint64 cycleId) public view returns (CycleSnapshot memory) {
        SiteConfig memory config = getSiteConfigForCycle(siteId, cycleId);
        uint64 startsAt = _cycleStartsAt(config, cycleId);
        uint64 openEndsAt = startsAt + config.openSeconds;
        uint64 playbackStartsAt = openEndsAt + config.lockedSeconds;
        uint64 endsAt = playbackStartsAt + uint64(config.slotCount) * config.playbackSecondsPerSlot;
        uint64 proofDeadlineEndsAt = endsAt + config.proofDeadlineSeconds;

        return CycleSnapshot({
            exists: false,
            configVersion: config.version,
            configHash: config.configHash,
            startsAt: startsAt,
            openEndsAt: openEndsAt,
            playbackStartsAt: playbackStartsAt,
            endsAt: endsAt,
            proofDeadlineEndsAt: proofDeadlineEndsAt,
            slotCount: config.slotCount,
            playbackSecondsPerSlot: config.playbackSecondsPerSlot,
            minimumPaidBid: config.minimumPaidBid,
            treasury: config.treasury
        });
    }

    function getSiteConfig(bytes32 siteId, uint32 version) external view returns (SiteConfig memory) {
        SiteConfig memory config = _siteConfigs[siteId][version];
        if (!config.exists) {
            revert SiteNotConfigured(siteId);
        }
        return config;
    }

    function getSiteConfigForCycle(bytes32 siteId, uint64 cycleId) public view returns (SiteConfig memory) {
        uint32 versionCount = _siteVersionCount[siteId];
        if (versionCount == 0) {
            revert SiteNotConfigured(siteId);
        }

        for (uint32 version = versionCount; version > 0; version--) {
            SiteConfig memory config = _siteConfigs[siteId][version];
            if (config.effectiveCycleId <= cycleId) {
                return config;
            }
        }

        revert InvalidCycle(siteId, cycleId);
    }

    function getCycleSnapshot(bytes32 siteId, uint64 cycleId) external view returns (CycleSnapshot memory) {
        return _cycleSnapshots[siteId][cycleId];
    }

    function getBid(bytes32 bidId_) external view returns (Bid memory) {
        return _bids[bidId_];
    }

    function getSlotState(bytes32 siteId, uint64 cycleId, uint8 slotIndex) external view returns (SlotState memory) {
        return _slots[AuctionIds.slotKey(siteId, cycleId, slotIndex)];
    }

    function getSlotBidCount(bytes32 siteId, uint64 cycleId, uint8 slotIndex) external view returns (uint256) {
        return _slotBidIds[AuctionIds.slotKey(siteId, cycleId, slotIndex)].length;
    }

    function slotKey(bytes32 siteId, uint64 cycleId, uint8 slotIndex) external pure returns (bytes32) {
        return AuctionIds.slotKey(siteId, cycleId, slotIndex);
    }

    function bidId(bytes32 slotKey_, address bidder) external pure returns (bytes32) {
        return AuctionIds.bidId(slotKey_, bidder);
    }

    function reservationId(bytes32 bidId_) external pure returns (bytes32) {
        return AuctionIds.reservationId(bidId_);
    }

    function settlementId(bytes32 slotKey_, address bidder, bytes32 advertisementId) external pure returns (bytes32) {
        return AuctionIds.settlementId(slotKey_, bidder, advertisementId);
    }

    function _storeSiteConfig(bytes32 siteId, SiteConfigInput calldata input, uint32 version, uint64 effectiveCycleId)
        private
    {
        _validateSiteConfig(input);

        bytes32 configHash = AuctionIds.configHash(
            AuctionIds.ConfigHashInput({
                siteId: siteId,
                version: version,
                effectiveCycleId: effectiveCycleId,
                firstCycleStartsAt: input.firstCycleStartsAt,
                openSeconds: input.openSeconds,
                lockedSeconds: input.lockedSeconds,
                playbackSecondsPerSlot: input.playbackSecondsPerSlot,
                proofDeadlineSeconds: input.proofDeadlineSeconds,
                slotCount: input.slotCount,
                minimumPaidBid: input.minimumPaidBid,
                treasury: input.treasury
            })
        );

        _siteVersionCount[siteId] = version;
        _siteConfigs[siteId][version] = SiteConfig({
            exists: true,
            version: version,
            effectiveCycleId: effectiveCycleId,
            firstCycleStartsAt: input.firstCycleStartsAt,
            openSeconds: input.openSeconds,
            lockedSeconds: input.lockedSeconds,
            playbackSecondsPerSlot: input.playbackSecondsPerSlot,
            proofDeadlineSeconds: input.proofDeadlineSeconds,
            slotCount: input.slotCount,
            minimumPaidBid: input.minimumPaidBid,
            treasury: input.treasury,
            configHash: configHash
        });

        emit SiteConfigured(siteId, version, effectiveCycleId, configHash, input.treasury);
    }

    function _validateSiteConfig(SiteConfigInput calldata input) private pure {
        if (
            input.firstCycleStartsAt == 0 || input.openSeconds == 0 || input.lockedSeconds == 0
                || input.playbackSecondsPerSlot == 0 || input.slotCount == 0 || input.treasury == address(0)
        ) {
            revert InvalidSiteConfig();
        }
    }

    function _requireConfigured(bytes32 siteId) private view {
        if (_siteVersionCount[siteId] == 0) {
            revert SiteNotConfigured(siteId);
        }
    }

    function _requireSlot(CycleSnapshot memory snapshot, uint8 slotIndex) private pure {
        if (slotIndex >= snapshot.slotCount) {
            revert InvalidSlot(slotIndex);
        }
    }

    function _requireOpenForBids(bytes32 siteId, uint64 cycleId, CycleSnapshot memory snapshot) private view {
        if (block.timestamp < snapshot.startsAt || block.timestamp >= snapshot.openEndsAt) {
            revert BiddingClosed(siteId, cycleId);
        }
    }

    function _releaseLosers(bytes32[] storage bidIds, bytes32 winningBidId) private {
        for (uint256 index = 0; index < bidIds.length; index++) {
            bytes32 currentBidId = bidIds[index];
            if (currentBidId != winningBidId) {
                escrow.releaseReservation(_bids[currentBidId].reservationId);
            }
        }
    }

    function _cycleDuration(SiteConfig memory config) private pure returns (uint64) {
        return uint64(config.openSeconds + config.lockedSeconds + uint32(config.slotCount) * config.playbackSecondsPerSlot);
    }

    function _cycleStartsAt(SiteConfig memory config, uint64 cycleId) private pure returns (uint64) {
        return config.firstCycleStartsAt + (cycleId - config.effectiveCycleId) * _cycleDuration(config);
    }

    function _slotProofDeadline(CycleSnapshot memory snapshot, uint8 slotIndex) private pure returns (uint64) {
        uint64 slotStart = snapshot.playbackStartsAt + uint64(slotIndex) * snapshot.playbackSecondsPerSlot;
        return slotStart + snapshot.playbackSecondsPerSlot + (snapshot.proofDeadlineEndsAt - snapshot.endsAt);
    }
}
