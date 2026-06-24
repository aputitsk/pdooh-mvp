// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title pDOOH Auction Escrow
/// @notice Minimal USDC escrow for pDOOH auction settlement on Arc.
contract AuctionEscrow is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    address public immutable treasury;

    address public operator;
    uint256 public totalEscrowed;

    mapping(address advertiser => uint256 balance) private _balances;
    mapping(bytes32 settlementId => bool processed) public processedSettlement;

    event Deposited(address indexed advertiser, uint256 amount);
    event Withdrawn(address indexed advertiser, uint256 amount);
    event Settled(address indexed advertiser, uint256 amount, bytes32 indexed settlementId);
    event OperatorChanged(address indexed previousOperator, address indexed newOperator);

    error ZeroAddress();
    error ZeroAmount();
    error ZeroIdentifier();
    error UnauthorizedOperator(address caller);
    error SettlementAlreadyProcessed(bytes32 settlementId);
    error InsufficientEscrowBalance(address advertiser, uint256 requested, uint256 available);
    error RenounceOwnershipDisabled();

    modifier onlyOperator() {
        if (msg.sender != operator) {
            revert UnauthorizedOperator(msg.sender);
        }
        _;
    }

    constructor(IERC20 usdc_, address treasury_, address initialOwner_, address initialOperator_)
        Ownable(initialOwner_)
    {
        if (address(usdc_) == address(0) || treasury_ == address(0) || initialOperator_ == address(0)) {
            revert ZeroAddress();
        }

        usdc = usdc_;
        treasury = treasury_;
        operator = initialOperator_;

        emit OperatorChanged(address(0), initialOperator_);
    }

    function deposit(uint256 amount) external {
        if (amount == 0) {
            revert ZeroAmount();
        }

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        _balances[msg.sender] += amount;
        totalEscrowed += amount;

        emit Deposited(msg.sender, amount);
    }

    function withdraw(uint256 amount) external nonReentrant {
        if (amount == 0) {
            revert ZeroAmount();
        }

        uint256 available = _balances[msg.sender];
        if (available < amount) {
            revert InsufficientEscrowBalance(msg.sender, amount, available);
        }

        _balances[msg.sender] = available - amount;
        totalEscrowed -= amount;

        usdc.safeTransfer(msg.sender, amount);

        emit Withdrawn(msg.sender, amount);
    }

    function settle(address advertiser, uint256 amount, bytes32 settlementId) external onlyOperator nonReentrant {
        if (advertiser == address(0)) {
            revert ZeroAddress();
        }
        if (amount == 0) {
            revert ZeroAmount();
        }
        if (settlementId == bytes32(0)) {
            revert ZeroIdentifier();
        }
        if (processedSettlement[settlementId]) {
            revert SettlementAlreadyProcessed(settlementId);
        }

        uint256 available = _balances[advertiser];
        if (available < amount) {
            revert InsufficientEscrowBalance(advertiser, amount, available);
        }

        processedSettlement[settlementId] = true;
        _balances[advertiser] = available - amount;
        totalEscrowed -= amount;

        usdc.safeTransfer(treasury, amount);

        emit Settled(advertiser, amount, settlementId);
    }

    function setOperator(address newOperator) external onlyOwner {
        if (newOperator == address(0)) {
            revert ZeroAddress();
        }

        address previousOperator = operator;
        operator = newOperator;

        emit OperatorChanged(previousOperator, newOperator);
    }

    function balanceOf(address advertiser) external view returns (uint256) {
        return _balances[advertiser];
    }

    function renounceOwnership() public view override onlyOwner {
        revert RenounceOwnershipDisabled();
    }
}
