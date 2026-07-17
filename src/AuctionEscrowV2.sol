// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title pDOOH Auction Escrow V2
/// @notice ERC-20 USDC custody, accounting, and engine-owned reservations.
contract AuctionEscrowV2 is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant ENGINE_ROLE = keccak256("ENGINE_ROLE");

    IERC20 public immutable usdc;
    uint8 public immutable usdcDecimals;
    address public engine;

    uint256 public totalAccounted;
    uint256 public totalReserved;

    struct Reservation {
        address payer;
        address beneficiary;
        address engine;
        uint256 reservedAmount;
        uint256 finalAmount;
        bool settled;
        bool released;
    }

    mapping(address account => uint256 balance) private _balances;
    mapping(address account => uint256 reserved) private _reserved;
    mapping(bytes32 reservationId => Reservation reservation) private _reservations;
    mapping(bytes32 settlementId => bool processed) public processedSettlement;

    event Deposited(address indexed account, uint256 amount);
    event Withdrawn(address indexed account, uint256 amount);
    event EngineConfigured(address indexed engine);
    event Reserved(
        bytes32 indexed reservationId,
        address indexed payer,
        address indexed engine,
        address beneficiary,
        uint256 amount
    );
    event ReservationSettled(
        bytes32 indexed reservationId,
        bytes32 indexed settlementId,
        address indexed payer,
        address beneficiary,
        uint256 reservedAmount,
        uint256 finalAmount
    );
    event ReservationReleased(bytes32 indexed reservationId, address indexed payer, uint256 amount);

    error ZeroAddress();
    error ZeroAmount();
    error ZeroIdentifier();
    error UnsupportedUsdcDecimals(uint8 decimals);
    error InsufficientAvailableBalance(address account, uint256 requested, uint256 available);
    error ReservationAlreadyExists(bytes32 reservationId);
    error ReservationNotFound(bytes32 reservationId);
    error ReservationInactive(bytes32 reservationId);
    error UnauthorizedReservationEngine(address caller, address engine);
    error EngineAlreadyConfigured(address engine);
    error EngineRoleGrantDisabled();
    error FinalAmountExceedsReserved(uint256 finalAmount, uint256 reservedAmount);
    error SettlementAlreadyProcessed(bytes32 settlementId);

    constructor(IERC20 usdc_, address initialAdmin) {
        if (address(usdc_) == address(0) || initialAdmin == address(0)) {
            revert ZeroAddress();
        }

        uint8 decimals = IERC20Metadata(address(usdc_)).decimals();
        if (decimals != 6) {
            revert UnsupportedUsdcDecimals(decimals);
        }

        usdc = usdc_;
        usdcDecimals = decimals;

        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
    }

    function setEngine(address engine_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (engine_ == address(0)) {
            revert ZeroAddress();
        }
        if (engine != address(0)) {
            revert EngineAlreadyConfigured(engine);
        }

        engine = engine_;
        _grantRole(ENGINE_ROLE, engine_);

        emit EngineConfigured(engine_);
    }

    function grantRole(bytes32 role, address account) public override onlyRole(getRoleAdmin(role)) {
        if (role == ENGINE_ROLE) {
            revert EngineRoleGrantDisabled();
        }

        _grantRole(role, account);
    }

    function deposit(uint256 amount) external nonReentrant {
        if (amount == 0) {
            revert ZeroAmount();
        }

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        _balances[msg.sender] += amount;
        totalAccounted += amount;

        emit Deposited(msg.sender, amount);
    }

    function withdraw(uint256 amount) external nonReentrant {
        if (amount == 0) {
            revert ZeroAmount();
        }

        uint256 available = availableOf(msg.sender);
        if (available < amount) {
            revert InsufficientAvailableBalance(msg.sender, amount, available);
        }

        _balances[msg.sender] -= amount;
        totalAccounted -= amount;

        usdc.safeTransfer(msg.sender, amount);

        emit Withdrawn(msg.sender, amount);
    }

    function reserve(address payer, uint256 amount, address beneficiary, bytes32 reservationId_)
        external
        onlyRole(ENGINE_ROLE)
        nonReentrant
    {
        if (payer == address(0) || beneficiary == address(0)) {
            revert ZeroAddress();
        }
        if (amount == 0) {
            revert ZeroAmount();
        }
        if (reservationId_ == bytes32(0)) {
            revert ZeroIdentifier();
        }
        if (_reservations[reservationId_].payer != address(0)) {
            revert ReservationAlreadyExists(reservationId_);
        }

        uint256 available = availableOf(payer);
        if (available < amount) {
            revert InsufficientAvailableBalance(payer, amount, available);
        }

        _reserved[payer] += amount;
        totalReserved += amount;
        _reservations[reservationId_] = Reservation({
            payer: payer,
            beneficiary: beneficiary,
            engine: msg.sender,
            reservedAmount: amount,
            finalAmount: 0,
            settled: false,
            released: false
        });

        emit Reserved(reservationId_, payer, msg.sender, beneficiary, amount);
    }

    function settleReservation(bytes32 reservationId_, uint256 finalAmount, bytes32 settlementId_)
        external
        nonReentrant
    {
        if (settlementId_ == bytes32(0)) {
            revert ZeroIdentifier();
        }
        if (processedSettlement[settlementId_]) {
            revert SettlementAlreadyProcessed(settlementId_);
        }

        Reservation storage reservation = _activeReservationForCaller(reservationId_);
        if (finalAmount > reservation.reservedAmount) {
            revert FinalAmountExceedsReserved(finalAmount, reservation.reservedAmount);
        }

        reservation.settled = true;
        reservation.finalAmount = finalAmount;
        processedSettlement[settlementId_] = true;

        _reserved[reservation.payer] -= reservation.reservedAmount;
        totalReserved -= reservation.reservedAmount;

        if (finalAmount != 0) {
            _balances[reservation.payer] -= finalAmount;
            totalAccounted -= finalAmount;
            usdc.safeTransfer(reservation.beneficiary, finalAmount);
        }

        emit ReservationSettled(
            reservationId_,
            settlementId_,
            reservation.payer,
            reservation.beneficiary,
            reservation.reservedAmount,
            finalAmount
        );
    }

    function releaseReservation(bytes32 reservationId_) external nonReentrant {
        Reservation storage reservation = _activeReservationForCaller(reservationId_);

        reservation.released = true;
        _reserved[reservation.payer] -= reservation.reservedAmount;
        totalReserved -= reservation.reservedAmount;

        emit ReservationReleased(reservationId_, reservation.payer, reservation.reservedAmount);
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    function availableOf(address account) public view returns (uint256) {
        return _balances[account] - _reserved[account];
    }

    function reservedOf(address account) external view returns (uint256) {
        return _reserved[account];
    }

    function getReservation(bytes32 reservationId_) external view returns (Reservation memory) {
        return _reservations[reservationId_];
    }

    function _activeReservationForCaller(bytes32 reservationId_) private view returns (Reservation storage) {
        if (reservationId_ == bytes32(0)) {
            revert ZeroIdentifier();
        }

        Reservation storage reservation = _reservations[reservationId_];
        if (reservation.payer == address(0)) {
            revert ReservationNotFound(reservationId_);
        }
        if (reservation.engine != msg.sender) {
            revert UnauthorizedReservationEngine(msg.sender, reservation.engine);
        }
        if (reservation.settled || reservation.released) {
            revert ReservationInactive(reservationId_);
        }

        return reservation;
    }
}
