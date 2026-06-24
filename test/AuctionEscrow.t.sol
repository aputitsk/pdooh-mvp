// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AuctionEscrow} from "../src/AuctionEscrow.sol";
import {MockUSDC} from "./MockUSDC.sol";

interface Vm {
    function prank(address sender) external;
    function startPrank(address sender) external;
    function stopPrank() external;
    function expectRevert() external;
    function expectRevert(bytes calldata revertData) external;
}

contract AuctionEscrowTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    MockUSDC private usdc;
    AuctionEscrow private escrow;

    address private constant OWNER = address(0xA11CE);
    address private constant OPERATOR = address(0x0A9);
    address private constant NEW_OPERATOR = address(0x0B0);
    address private constant TREASURY = address(0x7E);
    address private constant ADVERTISER = address(0xAD);
    address private constant OTHER = address(0xB0B);

    uint256 private constant ONE_USDC = 1_000_000;
    bytes32 private constant SETTLEMENT_ID = keccak256("settlement-1");

    error AssertionFailed();

    function setUp() public {
        usdc = new MockUSDC();
        escrow = new AuctionEscrow(usdc, TREASURY, OWNER, OPERATOR);
        usdc.mint(ADVERTISER, 100 * ONE_USDC);
    }

    function testConstructorStoresImmutableAddressesAndOperator() public view {
        assertEq(address(escrow.usdc()), address(usdc));
        assertEq(escrow.treasury(), TREASURY);
        assertEq(escrow.owner(), OWNER);
        assertEq(escrow.operator(), OPERATOR);
    }

    function testConstructorRejectsZeroAddresses() public {
        vm.expectRevert(abi.encodeWithSelector(AuctionEscrow.ZeroAddress.selector));
        new AuctionEscrow(usdc, address(0), OWNER, OPERATOR);

        vm.expectRevert(abi.encodeWithSelector(AuctionEscrow.ZeroAddress.selector));
        new AuctionEscrow(usdc, TREASURY, OWNER, address(0));

        vm.expectRevert();
        new AuctionEscrow(usdc, TREASURY, address(0), OPERATOR);
    }

    function testDepositCreditsAdvertiserBalanceAndTotalEscrowed() public {
        depositFromAdvertiser(10 * ONE_USDC);

        assertEq(escrow.balanceOf(ADVERTISER), 10 * ONE_USDC);
        assertEq(escrow.totalEscrowed(), 10 * ONE_USDC);
        assertEq(usdc.balanceOf(address(escrow)), 10 * ONE_USDC);
        assertAccountingInvariant();
    }

    function testDepositRejectsZeroAmount() public {
        vm.prank(ADVERTISER);
        vm.expectRevert(abi.encodeWithSelector(AuctionEscrow.ZeroAmount.selector));
        escrow.deposit(0);
    }

    function testWithdrawSendsOnlyToMsgSender() public {
        depositFromAdvertiser(10 * ONE_USDC);

        vm.prank(ADVERTISER);
        escrow.withdraw(4 * ONE_USDC);

        assertEq(escrow.balanceOf(ADVERTISER), 6 * ONE_USDC);
        assertEq(escrow.totalEscrowed(), 6 * ONE_USDC);
        assertEq(usdc.balanceOf(ADVERTISER), 94 * ONE_USDC);
        assertEq(usdc.balanceOf(OTHER), 0);
        assertAccountingInvariant();
    }

    function testWithdrawRejectsAnotherAdvertiserBalance() public {
        depositFromAdvertiser(10 * ONE_USDC);

        vm.prank(OTHER);
        vm.expectRevert(
            abi.encodeWithSelector(AuctionEscrow.InsufficientEscrowBalance.selector, OTHER, ONE_USDC, 0)
        );
        escrow.withdraw(ONE_USDC);
    }

    function testSettleTransfersEscrowBalanceToTreasury() public {
        depositFromAdvertiser(10 * ONE_USDC);

        settleAsOperator(4 * ONE_USDC, SETTLEMENT_ID);

        assertEq(escrow.balanceOf(ADVERTISER), 6 * ONE_USDC);
        assertEq(escrow.totalEscrowed(), 6 * ONE_USDC);
        assertTrue(escrow.processedSettlement(SETTLEMENT_ID));
        assertEq(usdc.balanceOf(address(escrow)), 6 * ONE_USDC);
        assertEq(usdc.balanceOf(TREASURY), 4 * ONE_USDC);
        assertAccountingInvariant();
    }

    function testSettleRejectsUnauthorizedCaller() public {
        depositFromAdvertiser(10 * ONE_USDC);

        vm.prank(ADVERTISER);
        vm.expectRevert(abi.encodeWithSelector(AuctionEscrow.UnauthorizedOperator.selector, ADVERTISER));
        escrow.settle(ADVERTISER, ONE_USDC, SETTLEMENT_ID);
    }

    function testSettleRejectsAmountGreaterThanAdvertiserEscrowBalance() public {
        depositFromAdvertiser(10 * ONE_USDC);

        vm.prank(OPERATOR);
        vm.expectRevert(
            abi.encodeWithSelector(
                AuctionEscrow.InsufficientEscrowBalance.selector,
                ADVERTISER,
                11 * ONE_USDC,
                10 * ONE_USDC
            )
        );
        escrow.settle(ADVERTISER, 11 * ONE_USDC, SETTLEMENT_ID);
    }

    function testSettleRejectsReplayOfSettlementId() public {
        depositFromAdvertiser(10 * ONE_USDC);
        settleAsOperator(ONE_USDC, SETTLEMENT_ID);

        vm.prank(OPERATOR);
        vm.expectRevert(abi.encodeWithSelector(AuctionEscrow.SettlementAlreadyProcessed.selector, SETTLEMENT_ID));
        escrow.settle(ADVERTISER, ONE_USDC, SETTLEMENT_ID);
    }

    function testSettleRejectsZeroSettlementId() public {
        depositFromAdvertiser(10 * ONE_USDC);

        vm.prank(OPERATOR);
        vm.expectRevert(abi.encodeWithSelector(AuctionEscrow.ZeroIdentifier.selector));
        escrow.settle(ADVERTISER, ONE_USDC, bytes32(0));
    }

    function testOwnerCannotWithdrawAdvertiserEscrowDirectly() public {
        depositFromAdvertiser(10 * ONE_USDC);

        vm.prank(OWNER);
        vm.expectRevert(abi.encodeWithSelector(AuctionEscrow.InsufficientEscrowBalance.selector, OWNER, ONE_USDC, 0));
        escrow.withdraw(ONE_USDC);

        assertEq(escrow.balanceOf(ADVERTISER), 10 * ONE_USDC);
        assertEq(usdc.balanceOf(address(escrow)), 10 * ONE_USDC);
        assertEq(usdc.balanceOf(OWNER), 0);
    }

    function testOperatorCannotWithdrawAdvertiserEscrowDirectly() public {
        depositFromAdvertiser(10 * ONE_USDC);

        vm.prank(OPERATOR);
        vm.expectRevert(
            abi.encodeWithSelector(AuctionEscrow.InsufficientEscrowBalance.selector, OPERATOR, ONE_USDC, 0)
        );
        escrow.withdraw(ONE_USDC);

        assertEq(escrow.balanceOf(ADVERTISER), 10 * ONE_USDC);
        assertEq(usdc.balanceOf(address(escrow)), 10 * ONE_USDC);
        assertEq(usdc.balanceOf(OPERATOR), 0);
    }

    function testOwnerCanChangeOperator() public {
        vm.prank(OWNER);
        escrow.setOperator(NEW_OPERATOR);

        assertEq(escrow.operator(), NEW_OPERATOR);
    }

    function testAfterSetOperatorOldOperatorCannotSettleAndNewOperatorCanSettle() public {
        depositFromAdvertiser(10 * ONE_USDC);

        vm.prank(OWNER);
        escrow.setOperator(NEW_OPERATOR);

        vm.prank(OPERATOR);
        vm.expectRevert(abi.encodeWithSelector(AuctionEscrow.UnauthorizedOperator.selector, OPERATOR));
        escrow.settle(ADVERTISER, ONE_USDC, SETTLEMENT_ID);

        vm.prank(NEW_OPERATOR);
        escrow.settle(ADVERTISER, ONE_USDC, SETTLEMENT_ID);

        assertEq(escrow.balanceOf(ADVERTISER), 9 * ONE_USDC);
        assertEq(escrow.totalEscrowed(), 9 * ONE_USDC);
        assertEq(usdc.balanceOf(TREASURY), ONE_USDC);
        assertAccountingInvariant();
    }

    function testNonOwnerCannotChangeOperator() public {
        vm.prank(OPERATOR);
        vm.expectRevert();
        escrow.setOperator(NEW_OPERATOR);
    }

    function testRenounceOwnershipIsDisabled() public {
        vm.prank(OWNER);
        vm.expectRevert(abi.encodeWithSelector(AuctionEscrow.RenounceOwnershipDisabled.selector));
        escrow.renounceOwnership();
    }

    function testAccountingInvariantAllowsUnsolicitedTokenSurplus() public {
        depositFromAdvertiser(10 * ONE_USDC);
        usdc.mint(address(escrow), ONE_USDC);

        assertEq(usdc.balanceOf(address(escrow)), 11 * ONE_USDC);
        assertAccountingInvariant();
    }

    function depositFromAdvertiser(uint256 amount) private {
        vm.startPrank(ADVERTISER);
        usdc.approve(address(escrow), amount);
        escrow.deposit(amount);
        vm.stopPrank();
    }

    function settleAsOperator(uint256 amount, bytes32 settlementId) private {
        vm.prank(OPERATOR);
        escrow.settle(ADVERTISER, amount, settlementId);
    }

    function assertAccountingInvariant() private view {
        assertTrue(usdc.balanceOf(address(escrow)) >= escrow.totalEscrowed());
    }

    function assertEq(address actual, address expected) private pure {
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
}
