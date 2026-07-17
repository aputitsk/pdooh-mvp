// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AuctionEngineV1, IAuctionEscrowV2} from "../src/AuctionEngineV1.sol";
import {AuctionEscrowV2} from "../src/AuctionEscrowV2.sol";
import {AuctionIds} from "../src/AuctionIds.sol";
import {MockUSDC} from "./MockUSDC.sol";

interface VmV1 {
    function prank(address sender) external;
    function startPrank(address sender) external;
    function stopPrank() external;
    function warp(uint256 timestamp) external;
    function expectRevert() external;
    function expectRevert(bytes calldata revertData) external;
}

contract Mock18Decimals is MockUSDC {
    function decimals() public pure override returns (uint8) {
        return 18;
    }
}

contract SettlementFailUSDC is MockUSDC {
    address public treasury;
    bool public failTreasuryTransfer;

    function setTreasury(address treasury_) external {
        treasury = treasury_;
    }

    function setFailTreasuryTransfer(bool fail) external {
        failTreasuryTransfer = fail;
    }

    function transfer(address to, uint256 value) public override returns (bool) {
        if (failTreasuryTransfer && to == treasury) {
            revert("TREASURY_TRANSFER_BLOCKED");
        }

        return super.transfer(to, value);
    }
}

contract AuctionEngineV1Test {
    VmV1 private constant vm = VmV1(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant ONE_USDC = 1_000_000;
    uint64 private constant START = 1_800_000_000;

    address private constant ADMIN = address(0xA11CE);
    address private constant CONFIG_ADMIN = address(0xC0F);
    address private constant REPORTER = address(0x0B5E);
    address private constant PAUSER = address(0x0A7);
    address private constant TREASURY = address(0x7E);
    address private constant ADVERTISER = address(0xAD);
    address private constant ADVERTISER_TWO = address(0xB0B);
    address private constant OTHER = address(0x0D0);
    address private constant OTHER_ENGINE = address(0xE09);

    bytes32 private constant SITE_ID = keccak256("pdooh.site.times-square");
    bytes32 private constant SITE_ID_TWO = keccak256("pdooh.site.hollywood");
    bytes32 private constant AD_ID = keccak256("ad-1");
    bytes32 private constant AD_ID_TWO = keccak256("ad-2");
    bytes32 private constant SCREEN_ID = keccak256("screen-1");

    MockUSDC private usdc;
    AuctionEscrowV2 private escrow;
    AuctionEngineV1 private engine;

    error AssertionFailed();

    function setUp() public {
        usdc = new MockUSDC();
        escrow = new AuctionEscrowV2(usdc, ADMIN);
        engine = new AuctionEngineV1(IAuctionEscrowV2(address(escrow)), ADMIN, CONFIG_ADMIN, REPORTER, PAUSER);

        vm.prank(ADMIN);
        escrow.setEngine(address(engine));

        usdc.mint(ADVERTISER, 100 * ONE_USDC);
        usdc.mint(ADVERTISER_TWO, 100 * ONE_USDC);
        usdc.mint(TREASURY, 100 * ONE_USDC);

        deposit(ADVERTISER, 100 * ONE_USDC);
        deposit(ADVERTISER_TWO, 100 * ONE_USDC);
        deposit(TREASURY, 100 * ONE_USDC);

        configureSite(SITE_ID, START, TREASURY);
        vm.warp(START);
    }

    function testEscrowRejectsNonSixDecimalToken() public {
        Mock18Decimals wrongDecimals = new Mock18Decimals();

        vm.expectRevert(abi.encodeWithSelector(AuctionEscrowV2.UnsupportedUsdcDecimals.selector, 18));
        new AuctionEscrowV2(wrongDecimals, ADMIN);
    }

    function testEscrowAccountingAvailableReservedAndWithdraw() public {
        bytes32 reservationId = keccak256("reservation");

        vm.prank(address(engine));
        escrow.reserve(ADVERTISER, 60 * ONE_USDC, TREASURY, reservationId);

        assertEq(escrow.balanceOf(ADVERTISER), 100 * ONE_USDC);
        assertEq(escrow.availableOf(ADVERTISER), 40 * ONE_USDC);
        assertEq(escrow.reservedOf(ADVERTISER), 60 * ONE_USDC);
        assertEq(escrow.availableOf(ADVERTISER) + escrow.reservedOf(ADVERTISER), escrow.balanceOf(ADVERTISER));

        vm.prank(ADVERTISER);
        vm.expectRevert(
            abi.encodeWithSelector(
                AuctionEscrowV2.InsufficientAvailableBalance.selector, ADVERTISER, 41 * ONE_USDC, 40 * ONE_USDC
            )
        );
        escrow.withdraw(41 * ONE_USDC);

        vm.prank(ADVERTISER);
        escrow.withdraw(40 * ONE_USDC);

        assertEq(escrow.balanceOf(ADVERTISER), 60 * ONE_USDC);
        assertEq(escrow.availableOf(ADVERTISER), 0);
        assertEq(escrow.reservedOf(ADVERTISER), 60 * ONE_USDC);
    }

    function testEscrowOnlyCreatorEngineCanSettleAndBeneficiaryIsImmutable() public {
        bytes32 reservationId = keccak256("reservation");
        bytes32 settlementId = keccak256("settlement");

        vm.prank(address(engine));
        escrow.reserve(ADVERTISER, 60 * ONE_USDC, TREASURY, reservationId);

        vm.prank(OTHER_ENGINE);
        vm.expectRevert(
            abi.encodeWithSelector(AuctionEscrowV2.UnauthorizedReservationEngine.selector, OTHER_ENGINE, address(engine))
        );
        escrow.settleReservation(reservationId, ONE_USDC, settlementId);

        AuctionEscrowV2.Reservation memory reservation = escrow.getReservation(reservationId);
        assertEq(reservation.beneficiary, TREASURY);
        assertEq(reservation.engine, address(engine));

        vm.prank(address(engine));
        vm.expectRevert(
            abi.encodeWithSelector(AuctionEscrowV2.FinalAmountExceedsReserved.selector, 61 * ONE_USDC, 60 * ONE_USDC)
        );
        escrow.settleReservation(reservationId, 61 * ONE_USDC, settlementId);

        vm.prank(address(engine));
        escrow.settleReservation(reservationId, 30 * ONE_USDC, settlementId);

        assertEq(escrow.balanceOf(ADVERTISER), 70 * ONE_USDC);
        assertEq(escrow.availableOf(ADVERTISER), 70 * ONE_USDC);
        assertEq(escrow.reservedOf(ADVERTISER), 0);
        assertEq(usdc.balanceOf(TREASURY), 30 * ONE_USDC);
    }

    function testEscrowRejectsNativeValuePath() public {
        (bool ok,) = address(escrow).call{value: 1}("");
        assertFalse(ok);

        (ok,) = address(escrow).call{value: 1}(abi.encodeWithSelector(AuctionEscrowV2.deposit.selector, ONE_USDC));
        assertFalse(ok);
    }

    function testFuzzEscrowAccountingInvariant(uint96 rawDeposit, uint96 rawReservation) public {
        uint256 amount = uint256(rawDeposit % 1_000_000_000) + 1;
        uint256 reserved = uint256(rawReservation % amount) + 1;
        MockUSDC localUsdc = new MockUSDC();
        AuctionEscrowV2 localEscrow = new AuctionEscrowV2(localUsdc, ADMIN);

        vm.prank(ADMIN);
        localEscrow.setEngine(OTHER_ENGINE);

        localUsdc.mint(OTHER, amount);
        vm.startPrank(OTHER);
        localUsdc.approve(address(localEscrow), amount);
        localEscrow.deposit(amount);
        vm.stopPrank();

        vm.prank(OTHER_ENGINE);
        localEscrow.reserve(OTHER, reserved, TREASURY, keccak256(abi.encode(amount, reserved)));

        assertEq(localEscrow.availableOf(OTHER) + localEscrow.reservedOf(OTHER), localEscrow.balanceOf(OTHER));
        assertTrue(localEscrow.totalAccounted() <= localUsdc.balanceOf(address(localEscrow)));
    }

    function testInitialConfigSnapshotUsesCurrentProductTiming() public {
        AuctionEngineV1.CycleSnapshot memory snapshot = engine.snapshotCycle(SITE_ID, 0);

        assertEq(snapshot.startsAt, START);
        assertEq(snapshot.openEndsAt, START + 60);
        assertEq(snapshot.playbackStartsAt, START + 62);
        assertEq(snapshot.endsAt, START + 92);
        assertEq(snapshot.slotCount, 3);
        assertEq(snapshot.playbackSecondsPerSlot, 10);
        assertEq(snapshot.minimumPaidBid, 20_000);
    }

    function testAsyncSiteSchedules() public {
        configureSite(SITE_ID_TWO, START + 10, TREASURY);

        AuctionEngineV1.CycleSnapshot memory first = engine.snapshotCycle(SITE_ID, 0);
        AuctionEngineV1.CycleSnapshot memory second = engine.previewCycle(SITE_ID_TWO, 0);

        assertEq(first.startsAt, START);
        assertEq(second.startsAt, START + 10);
    }

    function testConfigSnapshotPerCycleAndNoRetroactiveConfigChanges() public {
        AuctionEngineV1.CycleSnapshot memory beforeChange = engine.snapshotCycle(SITE_ID, 0);

        vm.warp(START + 5);
        AuctionEngineV1.SiteConfigInput memory next = defaultConfig(START + 92, TREASURY);
        next.openSeconds = 90;
        next.minimumPaidBid = 10_000;

        vm.prank(CONFIG_ADMIN);
        engine.configureNextSiteVersion(SITE_ID, next);

        AuctionEngineV1.SiteConfig memory cycleZeroConfig = engine.getSiteConfigForCycle(SITE_ID, 0);
        AuctionEngineV1.SiteConfig memory cycleOneConfig = engine.getSiteConfigForCycle(SITE_ID, 1);
        AuctionEngineV1.CycleSnapshot memory afterChange = engine.snapshotCycle(SITE_ID, 0);

        assertEq(cycleZeroConfig.openSeconds, 60);
        assertEq(cycleOneConfig.openSeconds, 90);
        assertEq(beforeChange.configHash, afterChange.configHash);
    }

    function testOneBidPerBidderPerSlotAndThreeSlotsReserveAggregateBalance() public {
        placeBid(ADVERTISER, SITE_ID, 0, 1 * ONE_USDC, AD_ID);

        bytes32 duplicateSlotKey = AuctionIds.slotKey(SITE_ID, 0, 0);
        bytes32 duplicateBidId = AuctionIds.bidId(duplicateSlotKey, ADVERTISER);
        vm.prank(ADVERTISER);
        vm.expectRevert(abi.encodeWithSelector(AuctionEngineV1.DuplicateBid.selector, duplicateBidId));
        engine.placeBid(SITE_ID, 0, 0, AD_ID, 1 * ONE_USDC);

        placeBid(ADVERTISER, SITE_ID, 1, 2 * ONE_USDC, AD_ID);
        placeBid(ADVERTISER, SITE_ID, 2, 3 * ONE_USDC, AD_ID);

        assertEq(engine.getSlotBidCount(SITE_ID, 0, 0), 1);
        assertEq(engine.getSlotBidCount(SITE_ID, 0, 1), 1);
        assertEq(engine.getSlotBidCount(SITE_ID, 0, 2), 1);
        assertEq(escrow.reservedOf(ADVERTISER), 6 * ONE_USDC);
        assertEq(escrow.availableOf(ADVERTISER), 94 * ONE_USDC);
    }

    function testAggregateAvailableBalanceAcrossSitesAndCyclesCannotBeExceeded() public {
        configureSite(SITE_ID_TWO, START, TREASURY);
        MockUSDC localUsdc = new MockUSDC();
        AuctionEscrowV2 localEscrow = new AuctionEscrowV2(localUsdc, ADMIN);
        AuctionEngineV1 localEngine =
            new AuctionEngineV1(IAuctionEscrowV2(address(localEscrow)), ADMIN, CONFIG_ADMIN, REPORTER, PAUSER);

        vm.prank(ADMIN);
        localEscrow.setEngine(address(localEngine));

        localUsdc.mint(ADVERTISER, 5 * ONE_USDC);
        vm.startPrank(ADVERTISER);
        localUsdc.approve(address(localEscrow), 5 * ONE_USDC);
        localEscrow.deposit(5 * ONE_USDC);
        vm.stopPrank();

        vm.startPrank(CONFIG_ADMIN);
        localEngine.configureInitialSite(SITE_ID, defaultConfig(START, TREASURY));
        localEngine.configureInitialSite(SITE_ID_TWO, defaultConfig(START, TREASURY));
        vm.stopPrank();

        vm.warp(START);
        vm.prank(ADVERTISER);
        localEngine.placeBid(SITE_ID, 0, 0, AD_ID, 3 * ONE_USDC);

        vm.prank(ADVERTISER);
        vm.expectRevert(
            abi.encodeWithSelector(
                AuctionEscrowV2.InsufficientAvailableBalance.selector, ADVERTISER, 3 * ONE_USDC, 2 * ONE_USDC
            )
        );
        localEngine.placeBid(SITE_ID_TWO, 0, 0, AD_ID, 3 * ONE_USDC);
    }

    function testTreasuryCannotBid() public {
        vm.prank(TREASURY);
        vm.expectRevert(abi.encodeWithSelector(AuctionEngineV1.TreasuryCannotBid.selector, TREASURY));
        engine.placeBid(SITE_ID, 0, 0, AD_ID, ONE_USDC);
    }

    function testMinimumPaidBidThresholdCreatesNoPaidWinnerAndReleasesReservation() public {
        placeBid(ADVERTISER, SITE_ID, 0, 20_000, AD_ID);

        vm.warp(START + 60);
        engine.finalizeSlot(SITE_ID, 0, 0);

        AuctionEngineV1.SlotState memory slot = engine.getSlotState(SITE_ID, 0, 0);
        assertEq(uint256(slot.outcome), uint256(AuctionEngineV1.SlotOutcome.NO_PAID_WINNER));
        assertEq(slot.paidWinner, address(0));
        assertEq(escrow.reservedOf(ADVERTISER), 0);
        assertEq(escrow.availableOf(ADVERTISER), 100 * ONE_USDC);
    }

    function testLoserReleaseWinnerProofAndPermissionlessSettlement() public {
        placeBid(ADVERTISER, SITE_ID, 0, 1 * ONE_USDC, AD_ID);
        placeBid(ADVERTISER_TWO, SITE_ID, 0, 2 * ONE_USDC, AD_ID_TWO);

        vm.warp(START + 60);
        engine.finalizeSlot(SITE_ID, 0, 0);

        AuctionEngineV1.SlotState memory finalized = engine.getSlotState(SITE_ID, 0, 0);
        assertEq(uint256(finalized.outcome), uint256(AuctionEngineV1.SlotOutcome.PAID_WINNER));
        assertEq(finalized.paidWinner, ADVERTISER_TWO);
        assertEq(finalized.paidAmount, 2 * ONE_USDC);
        assertEq(escrow.reservedOf(ADVERTISER), 0);
        assertEq(escrow.reservedOf(ADVERTISER_TWO), 2 * ONE_USDC);

        confirmSlotZero(AD_ID_TWO);

        vm.prank(OTHER);
        engine.settleSlot(SITE_ID, 0, 0);

        AuctionEngineV1.SlotState memory settled = engine.getSlotState(SITE_ID, 0, 0);
        assertEq(uint256(settled.outcome), uint256(AuctionEngineV1.SlotOutcome.SETTLED));
        assertEq(escrow.balanceOf(ADVERTISER_TWO), 98 * ONE_USDC);
        assertEq(escrow.reservedOf(ADVERTISER_TWO), 0);
        assertEq(usdc.balanceOf(TREASURY), 2 * ONE_USDC);
    }

    function testReporterCannotInjectDifferentAdvertisement() public {
        placeBid(ADVERTISER, SITE_ID, 0, ONE_USDC, AD_ID);

        vm.warp(START + 60);
        engine.finalizeSlot(SITE_ID, 0, 0);

        AuctionEngineV1.PlaybackReport memory report = playbackReport(AD_ID_TWO, 1);
        vm.warp(START + 72);
        vm.prank(REPORTER);
        vm.expectRevert(abi.encodeWithSelector(AuctionEngineV1.PlaybackAdvertisementMismatch.selector, AD_ID, AD_ID_TWO));
        engine.confirmPlayback(report);
    }

    function testReporterCanConfirmFourSecondPlaybackAndSettle() public {
        placeBid(ADVERTISER, SITE_ID, 0, ONE_USDC, AD_ID);

        vm.warp(START + 60);
        engine.finalizeSlot(SITE_ID, 0, 0);

        AuctionEngineV1.PlaybackReport memory report = playbackReport(AD_ID, 11);
        report.playbackEndedAt = START + 66;

        vm.warp(START + 66);
        vm.prank(REPORTER);
        engine.confirmPlayback(report);

        AuctionEngineV1.SlotState memory played = engine.getSlotState(SITE_ID, 0, 0);
        assertEq(uint256(played.outcome), uint256(AuctionEngineV1.SlotOutcome.PLAYED));

        vm.prank(OTHER);
        engine.settleSlot(SITE_ID, 0, 0);

        AuctionEngineV1.SlotState memory settled = engine.getSlotState(SITE_ID, 0, 0);
        assertEq(uint256(settled.outcome), uint256(AuctionEngineV1.SlotOutcome.SETTLED));
        assertEq(escrow.balanceOf(ADVERTISER), 99 * ONE_USDC);
        assertEq(escrow.reservedOf(ADVERTISER), 0);
        assertEq(usdc.balanceOf(TREASURY), ONE_USDC);
    }

    function testProofExpiryReleasesWinningReservation() public {
        placeBid(ADVERTISER, SITE_ID, 0, ONE_USDC, AD_ID);

        vm.warp(START + 60);
        engine.finalizeSlot(SITE_ID, 0, 0);

        vm.warp(START + 73);
        engine.expireSlot(SITE_ID, 0, 0);

        AuctionEngineV1.SlotState memory slot = engine.getSlotState(SITE_ID, 0, 0);
        assertEq(uint256(slot.outcome), uint256(AuctionEngineV1.SlotOutcome.EXPIRED));
        assertEq(escrow.reservedOf(ADVERTISER), 0);
        assertEq(escrow.availableOf(ADVERTISER), 100 * ONE_USDC);
    }

    function testSettlementRevertLeavesSlotPlayedAndReservationActiveForRetry() public {
        SettlementFailUSDC failingUsdc = new SettlementFailUSDC();
        failingUsdc.setTreasury(TREASURY);
        AuctionEscrowV2 failingEscrow = new AuctionEscrowV2(failingUsdc, ADMIN);
        AuctionEngineV1 failingEngine =
            new AuctionEngineV1(IAuctionEscrowV2(address(failingEscrow)), ADMIN, CONFIG_ADMIN, REPORTER, PAUSER);

        vm.prank(ADMIN);
        failingEscrow.setEngine(address(failingEngine));

        failingUsdc.mint(ADVERTISER, 10 * ONE_USDC);
        vm.startPrank(ADVERTISER);
        failingUsdc.approve(address(failingEscrow), 10 * ONE_USDC);
        failingEscrow.deposit(10 * ONE_USDC);
        vm.stopPrank();

        vm.prank(CONFIG_ADMIN);
        failingEngine.configureInitialSite(SITE_ID, defaultConfig(START, TREASURY));

        vm.warp(START);
        vm.prank(ADVERTISER);
        failingEngine.placeBid(SITE_ID, 0, 0, AD_ID, ONE_USDC);

        vm.warp(START + 60);
        failingEngine.finalizeSlot(SITE_ID, 0, 0);

        vm.warp(START + 72);
        vm.prank(REPORTER);
        failingEngine.confirmPlayback(playbackReportFor(AD_ID, 1, failingEngine));

        failingUsdc.setFailTreasuryTransfer(true);
        vm.expectRevert();
        failingEngine.settleSlot(SITE_ID, 0, 0);

        AuctionEngineV1.SlotState memory played = failingEngine.getSlotState(SITE_ID, 0, 0);
        assertEq(uint256(played.outcome), uint256(AuctionEngineV1.SlotOutcome.PLAYED));
        assertEq(failingEscrow.reservedOf(ADVERTISER), ONE_USDC);

        failingUsdc.setFailTreasuryTransfer(false);
        failingEngine.settleSlot(SITE_ID, 0, 0);

        AuctionEngineV1.SlotState memory settled = failingEngine.getSlotState(SITE_ID, 0, 0);
        assertEq(uint256(settled.outcome), uint256(AuctionEngineV1.SlotOutcome.SETTLED));
        assertEq(failingEscrow.reservedOf(ADVERTISER), 0);
    }

    function testPauseBlocksNewBidsButDoesNotBlockWithdrawOrRecovery() public {
        vm.prank(PAUSER);
        engine.pause();

        vm.prank(ADVERTISER);
        vm.expectRevert();
        engine.placeBid(SITE_ID, 0, 0, AD_ID, ONE_USDC);

        vm.prank(ADVERTISER);
        escrow.withdraw(ONE_USDC);

        assertEq(escrow.balanceOf(ADVERTISER), 99 * ONE_USDC);
    }

    function testMaxTenBiddersPerSlotGasPath() public {
        for (uint160 i = 1; i <= 10; i++) {
            address bidder = address(0x1000 + i);
            usdc.mint(bidder, 2 * ONE_USDC);
            deposit(bidder, 2 * ONE_USDC);
            placeBid(bidder, SITE_ID, 0, uint256(i) * 100_000 + 30_000, keccak256(abi.encode("ad", i)));
        }

        vm.warp(START + 60);
        uint256 gasBefore = gasleft();
        engine.finalizeSlot(SITE_ID, 0, 0);
        uint256 gasUsed = gasBefore - gasleft();

        assertTrue(gasUsed > 0);
        AuctionEngineV1.SlotState memory slot = engine.getSlotState(SITE_ID, 0, 0);
        assertEq(slot.paidWinner, address(0x1000 + 10));
    }

    function testBidLimitRejectsEleventhBidBeforeReservation() public {
        for (uint160 i = 1; i <= 10; i++) {
            address bidder = address(0x2000 + i);
            usdc.mint(bidder, 2 * ONE_USDC);
            deposit(bidder, 2 * ONE_USDC);
            placeBid(bidder, SITE_ID, 0, uint256(i) * 100_000 + 30_000, keccak256(abi.encode("ad", i)));
        }

        address eleventh = address(0x200B);
        usdc.mint(eleventh, 2 * ONE_USDC);
        deposit(eleventh, 2 * ONE_USDC);

        bytes32 cappedSlotKey = AuctionIds.slotKey(SITE_ID, 0, 0);
        vm.prank(eleventh);
        vm.expectRevert(abi.encodeWithSelector(AuctionEngineV1.BidLimitReached.selector, cappedSlotKey, 10));
        engine.placeBid(SITE_ID, 0, 0, AD_ID, ONE_USDC);

        assertEq(escrow.reservedOf(eleventh), 0);
    }

    function testFutureCycleCannotBeSnapshottedBeforeItStarts() public {
        vm.expectRevert(abi.encodeWithSelector(AuctionEngineV1.CycleNotStarted.selector, SITE_ID, 1, START + 92));
        engine.snapshotCycle(SITE_ID, 1);

        AuctionEngineV1.CycleSnapshot memory preview = engine.previewCycle(SITE_ID, 1);
        assertEq(preview.startsAt, START + 92);
        assertEq(engine.getCycleSnapshot(SITE_ID, 1).startsAt, 0);
    }

    function testReporterCannotConfirmPlaybackBeforeItEnds() public {
        placeBid(ADVERTISER, SITE_ID, 0, ONE_USDC, AD_ID);

        vm.warp(START + 60);
        engine.finalizeSlot(SITE_ID, 0, 0);

        vm.warp(START + 71);
        vm.prank(REPORTER);
        vm.expectRevert(abi.encodeWithSelector(AuctionEngineV1.PlaybackNotEnded.selector, START + 72));
        engine.confirmPlayback(playbackReport(AD_ID, 1));
    }

    function testAdminCannotGrantEngineRoleOrChangeConfiguredEngine() public {
        bytes32 engineRole = escrow.ENGINE_ROLE();

        vm.prank(ADMIN);
        vm.expectRevert(abi.encodeWithSelector(AuctionEscrowV2.EngineRoleGrantDisabled.selector));
        escrow.grantRole(engineRole, OTHER_ENGINE);

        vm.prank(ADMIN);
        vm.expectRevert(abi.encodeWithSelector(AuctionEscrowV2.EngineAlreadyConfigured.selector, address(engine)));
        escrow.setEngine(OTHER_ENGINE);
    }

    function placeBid(address bidder, bytes32 siteId, uint8 slotIndex, uint256 amount, bytes32 advertisementId) private {
        vm.prank(bidder);
        engine.placeBid(siteId, 0, slotIndex, advertisementId, amount);
    }

    function confirmSlotZero(bytes32 advertisementId) private {
        vm.warp(START + 72);
        vm.prank(REPORTER);
        engine.confirmPlayback(playbackReport(advertisementId, 1));
    }

    function playbackReport(bytes32 advertisementId, uint256 nonce)
        private
        pure
        returns (AuctionEngineV1.PlaybackReport memory)
    {
        return playbackReportStruct(SITE_ID, 0, 0, advertisementId, nonce);
    }

    function playbackReportFor(bytes32 advertisementId, uint256 nonce, AuctionEngineV1)
        private
        pure
        returns (AuctionEngineV1.PlaybackReport memory)
    {
        return playbackReportStruct(SITE_ID, 0, 0, advertisementId, nonce);
    }

    function playbackReportStruct(bytes32 siteId, uint64 cycleId, uint8 slotIndex, bytes32 advertisementId, uint256 nonce)
        private
        pure
        returns (AuctionEngineV1.PlaybackReport memory)
    {
        return AuctionEngineV1.PlaybackReport({
            siteId: siteId,
            cycleId: cycleId,
            slotIndex: slotIndex,
            advertisementId: advertisementId,
            screenId: SCREEN_ID,
            playbackStartedAt: START + 62 + uint64(slotIndex) * 10,
            playbackEndedAt: START + 72 + uint64(slotIndex) * 10,
            reporterNonce: nonce,
            success: true,
            evidenceHash: keccak256("evidence")
        });
    }

    function configureSite(bytes32 siteId, uint64 firstCycleStartsAt, address treasury) private {
        vm.prank(CONFIG_ADMIN);
        engine.configureInitialSite(siteId, defaultConfig(firstCycleStartsAt, treasury));
    }

    function defaultConfig(uint64 firstCycleStartsAt, address treasury)
        private
        pure
        returns (AuctionEngineV1.SiteConfigInput memory)
    {
        return AuctionEngineV1.SiteConfigInput({
            firstCycleStartsAt: firstCycleStartsAt,
            openSeconds: 60,
            lockedSeconds: 2,
            playbackSecondsPerSlot: 10,
            proofDeadlineSeconds: 0,
            slotCount: 3,
            minimumPaidBid: 20_000,
            treasury: treasury
        });
    }

    function deposit(address account, uint256 amount) private {
        vm.startPrank(account);
        usdc.approve(address(escrow), amount);
        escrow.deposit(amount);
        vm.stopPrank();
    }

    function assertEq(address actual, address expected) private pure {
        if (actual != expected) {
            revert AssertionFailed();
        }
    }

    function assertEq(bytes32 actual, bytes32 expected) private pure {
        if (actual != expected) {
            revert AssertionFailed();
        }
    }

    function assertEq(uint256 actual, uint256 expected) private pure {
        if (actual != expected) {
            revert AssertionFailed();
        }
    }

    function assertTrue(bool value) private pure {
        if (!value) {
            revert AssertionFailed();
        }
    }

    function assertFalse(bool value) private pure {
        if (value) {
            revert AssertionFailed();
        }
    }
}
