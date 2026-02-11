// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract RedPacket is EIP712, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Packet {
        address creator;
        uint256 totalAmount;
        uint256 remainingAmount;
        uint16 totalClaims;
        uint16 claimedCount;
        uint48 expiry;
        bool isRandom;
        bool refunded;
    }

    IERC20 public immutable usdc;
    address public signer;
    address public owner;
    address public pendingOwner;
    uint256 public nextPacketId;
    bool public paused;

    mapping(uint256 => Packet) public packets;
    mapping(uint256 => mapping(address => bool)) public hasClaimed;
    mapping(uint256 => mapping(uint256 => uint256)) public claimAmounts;
    mapping(uint256 => bool) public usedNonces;

    // Onchain Twitter dedup: keccak256(packetId, twitterUserId) => claimed
    mapping(bytes32 => bool) public twitterClaimed;

    bytes32 public constant CLAIM_TYPEHASH =
        keccak256("Claim(uint256 packetId,address claimer,string twitterUserId,uint256 nonce)");

    uint256 public constant MAX_DEPOSIT = 2_000_000_000; // $2000 in USDC (6 decimals)
    uint256 public constant MIN_PER_CLAIM = 10_000;       // $0.01 in USDC

    event PacketCreated(
        uint256 indexed packetId,
        address indexed creator,
        uint256 amount,
        uint16 totalClaims,
        bool isRandom,
        uint48 expiry
    );
    event PacketClaimed(
        uint256 indexed packetId,
        address indexed claimer,
        uint256 amount,
        uint16 claimIndex
    );
    event PacketRefunded(
        uint256 indexed packetId,
        address indexed creator,
        uint256 amount
    );
    event SignerUpdated(address indexed oldSigner, address indexed newSigner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event Paused(address account);
    event Unpaused(address account);

    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }

    constructor(address _usdc, address _signer) EIP712("RedPacket", "1") {
        require(_usdc != address(0), "Invalid USDC address");
        require(_signer != address(0), "Invalid signer address");
        usdc = IERC20(_usdc);
        signer = _signer;
        owner = msg.sender;
    }

    // ─── Packet Creation ────────────────────────────────────────────

    function createPacket(
        uint256 amount,
        uint16 totalClaims,
        bool isRandom,
        uint48 expiry
    ) external nonReentrant whenNotPaused returns (uint256 packetId) {
        require(amount > 0, "Amount must be > 0");
        require(amount <= MAX_DEPOSIT, "Max $2000 per packet");
        require(totalClaims > 0, "Must allow at least 1 claim");
        require(totalClaims <= 200, "Max 200 claims per packet");
        require(expiry > block.timestamp, "Expiry must be in future");
        require(expiry <= block.timestamp + 1 days, "Max 24 hour expiry");
        require(amount / totalClaims >= MIN_PER_CLAIM, "Min $0.01 per claim");

        packetId = nextPacketId++;

        packets[packetId] = Packet({
            creator: msg.sender,
            totalAmount: amount,
            remainingAmount: amount,
            totalClaims: totalClaims,
            claimedCount: 0,
            expiry: expiry,
            isRandom: isRandom,
            refunded: false
        });

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        emit PacketCreated(packetId, msg.sender, amount, totalClaims, isRandom, expiry);
    }

    // ─── Claiming ───────────────────────────────────────────────────

    function claim(
        uint256 packetId,
        string calldata twitterUserId,
        uint256 nonce,
        bytes calldata signature
    ) external nonReentrant whenNotPaused {
        Packet storage packet = packets[packetId];
        require(packet.creator != address(0), "Packet does not exist");
        require(!packet.refunded, "Packet refunded");
        require(block.timestamp < packet.expiry, "Packet expired");
        require(packet.claimedCount < packet.totalClaims, "Fully claimed");
        require(!hasClaimed[packetId][msg.sender], "Already claimed");
        require(!usedNonces[nonce], "Nonce already used");

        // Onchain Twitter user dedup — prevents same Twitter user claiming with different wallets
        bytes32 twitterKey = keccak256(abi.encodePacked(packetId, twitterUserId));
        require(!twitterClaimed[twitterKey], "Twitter user already claimed");

        // Verify EIP-712 signature
        bytes32 structHash = keccak256(
            abi.encode(CLAIM_TYPEHASH, packetId, msg.sender, keccak256(bytes(twitterUserId)), nonce)
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address recoveredSigner = ECDSA.recover(digest, signature);
        require(recoveredSigner == signer, "Invalid signature");

        // Effects — all state changes before external call
        usedNonces[nonce] = true;
        hasClaimed[packetId][msg.sender] = true;
        twitterClaimed[twitterKey] = true;

        uint16 claimIndex = packet.claimedCount;
        packet.claimedCount++;

        uint256 claimAmount = _calculateClaimAmount(packetId, claimIndex, packet);
        require(claimAmount > 0, "Claim amount is zero");
        packet.remainingAmount -= claimAmount;
        claimAmounts[packetId][claimIndex] = claimAmount;

        // Interaction
        usdc.safeTransfer(msg.sender, claimAmount);

        emit PacketClaimed(packetId, msg.sender, claimAmount, claimIndex);
    }

    // ─── Refund ─────────────────────────────────────────────────────

    function refund(uint256 packetId) external nonReentrant {
        Packet storage packet = packets[packetId];
        require(msg.sender == packet.creator, "Not creator");
        require(!packet.refunded, "Already refunded");
        require(packet.remainingAmount > 0, "Nothing to refund");

        packet.refunded = true;
        uint256 amount = packet.remainingAmount;
        packet.remainingAmount = 0;

        usdc.safeTransfer(packet.creator, amount);

        emit PacketRefunded(packetId, packet.creator, amount);
    }

    // ─── Random Amount Calculation ──────────────────────────────────

    function _calculateClaimAmount(
        uint256 packetId,
        uint16 claimIndex,
        Packet storage packet
    ) internal view returns (uint256) {
        uint16 remainingClaims = packet.totalClaims - claimIndex;

        // Equal split
        if (!packet.isRandom) {
            return packet.remainingAmount / remainingClaims;
        }

        // Last claimer gets everything remaining
        if (remainingClaims == 1) {
            return packet.remainingAmount;
        }

        uint256 average = packet.remainingAmount / remainingClaims;

        // Guard: if average is too small for meaningful random distribution, use equal split
        if (average < 5) {
            return packet.remainingAmount / remainingClaims;
        }

        bytes32 seed = keccak256(
            abi.encodePacked(packetId, msg.sender, claimIndex, blockhash(block.number - 1))
        );
        uint256 randomValue = uint256(seed);

        uint256 minAmount = average / 5;
        if (minAmount == 0) minAmount = 1; // Guarantee non-zero minimum

        uint256 maxAmount = average * 2;

        uint256 range = maxAmount - minAmount;
        if (range == 0) range = 1; // Prevent division by zero

        uint256 amount = minAmount + (randomValue % range);

        // Ensure enough remains for other claimers (each gets at least 1 unit)
        uint256 reserveForOthers = remainingClaims - 1; // 1 unit per remaining claimer minimum
        if (minAmount > 1) {
            reserveForOthers = minAmount * (remainingClaims - 1);
        }

        if (reserveForOthers >= packet.remainingAmount) {
            // Not enough to reserve, just give equal share
            return packet.remainingAmount / remainingClaims;
        }

        if (amount > packet.remainingAmount - reserveForOthers) {
            amount = packet.remainingAmount - reserveForOthers;
        }

        // Final safety: ensure non-zero
        if (amount == 0) amount = 1;

        return amount;
    }

    // ─── Admin: Pause ───────────────────────────────────────────────

    function pause() external {
        require(msg.sender == owner, "Not owner");
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external {
        require(msg.sender == owner, "Not owner");
        paused = false;
        emit Unpaused(msg.sender);
    }

    // ─── Admin: Signer ──────────────────────────────────────────────

    function setSigner(address _signer) external {
        require(msg.sender == owner, "Not owner");
        require(_signer != address(0), "Invalid signer address");
        emit SignerUpdated(signer, _signer);
        signer = _signer;
    }

    // ─── Admin: Two-Step Ownership Transfer ─────────────────────────

    function transferOwnership(address newOwner) external {
        require(msg.sender == owner, "Not owner");
        require(newOwner != address(0), "Invalid owner address");
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "Not pending owner");
        emit OwnershipTransferred(owner, pendingOwner);
        owner = pendingOwner;
        pendingOwner = address(0);
    }
}
