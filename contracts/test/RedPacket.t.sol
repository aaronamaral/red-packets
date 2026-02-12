// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/RedPacket.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Mock USDC token for testing
contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract RedPacketTest is Test {
    RedPacket public redPacket;
    MockUSDC public usdc;

    // Accounts
    address public deployer = address(1);
    address public signerAddr;
    uint256 public signerKey;
    address public creator = address(3);
    address public claimer1 = address(4);
    address public claimer2 = address(5);
    address public claimer3 = address(6);
    address public attacker = address(7);

    // Constants
    uint256 constant ONE_USDC = 1_000_000; // 6 decimals
    uint256 constant TEN_USDC = 10_000_000;
    uint256 constant HUNDRED_USDC = 100_000_000;
    uint256 constant MAX_DEPOSIT = 2_000_000_000;

    // EIP-712
    bytes32 constant CLAIM_TYPEHASH =
        keccak256("Claim(uint256 packetId,address claimer,string twitterUserId,uint256 nonce)");

    function setUp() public {
        // Generate signer keypair
        (signerAddr, signerKey) = makeAddrAndKey("signer");

        // Deploy contracts
        vm.startPrank(deployer);
        usdc = new MockUSDC();
        redPacket = new RedPacket(address(usdc), signerAddr);
        vm.stopPrank();

        // Fund creator with USDC
        usdc.mint(creator, 1000 * ONE_USDC);
        vm.prank(creator);
        usdc.approve(address(redPacket), type(uint256).max);
    }

    // ─── Helpers ──────────────────────────────────────────────────

    function _createPacket(uint256 amount, uint16 totalClaims, bool isRandom) internal returns (uint256) {
        vm.prank(creator);
        return redPacket.createPacket(
            amount,
            totalClaims,
            isRandom,
            uint48(block.timestamp + 1 hours)
        );
    }

    function _signClaim(
        uint256 packetId,
        address claimer,
        string memory twitterUserId,
        uint256 nonce
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(
            abi.encode(CLAIM_TYPEHASH, packetId, claimer, keccak256(bytes(twitterUserId)), nonce)
        );

        bytes32 domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("RedPacket"),
                keccak256("1"),
                block.chainid,
                address(redPacket)
            )
        );

        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function _claim(
        uint256 packetId,
        address claimer,
        string memory twitterUserId,
        uint256 nonce
    ) internal {
        bytes memory sig = _signClaim(packetId, claimer, twitterUserId, nonce);
        vm.prank(claimer);
        redPacket.claim(packetId, twitterUserId, nonce, sig);
    }

    // ═══════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════

    function test_constructor_setsState() public view {
        assertEq(address(redPacket.usdc()), address(usdc));
        assertEq(redPacket.signer(), signerAddr);
        assertEq(redPacket.owner(), deployer);
        assertEq(redPacket.nextPacketId(), 0);
        assertEq(redPacket.paused(), false);
    }

    function test_constructor_rejectsZeroUsdc() public {
        vm.expectRevert("Invalid USDC address");
        new RedPacket(address(0), signerAddr);
    }

    function test_constructor_rejectsZeroSigner() public {
        vm.expectRevert("Invalid signer address");
        new RedPacket(address(usdc), address(0));
    }

    // ═══════════════════════════════════════════════════════════════
    // CREATE PACKET
    // ═══════════════════════════════════════════════════════════════

    function test_create_basicEqualPacket() public {
        uint256 packetId = _createPacket(TEN_USDC, 10, false);
        assertEq(packetId, 0);

        (address pCreator, uint256 total, uint256 remaining, uint16 claims, uint16 claimed,
         uint48 expiry, bool isRandom, bool refunded) = redPacket.packets(0);

        assertEq(pCreator, creator);
        assertEq(total, TEN_USDC);
        assertEq(remaining, TEN_USDC);
        assertEq(claims, 10);
        assertEq(claimed, 0);
        assertTrue(expiry > block.timestamp);
        assertFalse(isRandom);
        assertFalse(refunded);
    }

    function test_create_basicRandomPacket() public {
        uint256 packetId = _createPacket(TEN_USDC, 5, true);
        (, , , , , , bool isRandom, ) = redPacket.packets(packetId);
        assertTrue(isRandom);
    }

    function test_create_incrementsPacketId() public {
        assertEq(_createPacket(ONE_USDC, 1, false), 0);
        assertEq(_createPacket(ONE_USDC, 1, false), 1);
        assertEq(_createPacket(ONE_USDC, 1, false), 2);
        assertEq(redPacket.nextPacketId(), 3);
    }

    function test_create_transfersUSDC() public {
        uint256 balBefore = usdc.balanceOf(creator);
        _createPacket(TEN_USDC, 5, false);
        assertEq(usdc.balanceOf(creator), balBefore - TEN_USDC);
        assertEq(usdc.balanceOf(address(redPacket)), TEN_USDC);
    }

    function test_create_emitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit RedPacket.PacketCreated(0, creator, TEN_USDC, 10, false, uint48(block.timestamp + 1 hours));
        _createPacket(TEN_USDC, 10, false);
    }

    function test_create_rejectsZeroAmount() public {
        vm.prank(creator);
        vm.expectRevert("Amount must be > 0");
        redPacket.createPacket(0, 10, false, uint48(block.timestamp + 1 hours));
    }

    function test_create_rejectsOverMaxDeposit() public {
        vm.prank(creator);
        vm.expectRevert("Max $2000 per packet");
        redPacket.createPacket(MAX_DEPOSIT + 1, 10, false, uint48(block.timestamp + 1 hours));
    }

    function test_create_rejectsZeroClaims() public {
        vm.prank(creator);
        vm.expectRevert("Must allow at least 1 claim");
        redPacket.createPacket(ONE_USDC, 0, false, uint48(block.timestamp + 1 hours));
    }

    function test_create_rejectsOver200Claims() public {
        vm.prank(creator);
        vm.expectRevert("Max 200 claims per packet");
        redPacket.createPacket(HUNDRED_USDC, 201, false, uint48(block.timestamp + 1 hours));
    }

    function test_create_rejectsExpiredExpiry() public {
        vm.prank(creator);
        vm.expectRevert("Expiry must be in future");
        redPacket.createPacket(ONE_USDC, 1, false, uint48(block.timestamp - 1));
    }

    function test_create_rejectsOver24hExpiry() public {
        vm.prank(creator);
        vm.expectRevert("Max 24 hour expiry");
        redPacket.createPacket(ONE_USDC, 1, false, uint48(block.timestamp + 25 hours));
    }

    function test_create_rejectsTooSmallPerClaim() public {
        vm.prank(creator);
        vm.expectRevert("Min $0.01 per claim");
        redPacket.createPacket(9999, 1, false, uint48(block.timestamp + 1 hours)); // $0.009999
    }

    function test_create_rejectsWhenPaused() public {
        vm.prank(deployer);
        redPacket.pause();
        vm.prank(creator);
        vm.expectRevert("Contract is paused");
        redPacket.createPacket(ONE_USDC, 1, false, uint48(block.timestamp + 1 hours));
    }

    // ═══════════════════════════════════════════════════════════════
    // CLAIM — EQUAL SPLIT
    // ═══════════════════════════════════════════════════════════════

    function test_claim_equalSplitBasic() public {
        uint256 packetId = _createPacket(TEN_USDC, 2, false);

        _claim(packetId, claimer1, "twitter1", 1);

        assertEq(usdc.balanceOf(claimer1), TEN_USDC / 2); // 5 USDC
        (, , uint256 remaining, , uint16 claimed, , , ) = redPacket.packets(packetId);
        assertEq(remaining, TEN_USDC / 2);
        assertEq(claimed, 1);
    }

    function test_claim_equalSplitFullyClaimed() public {
        uint256 packetId = _createPacket(TEN_USDC, 2, false);

        _claim(packetId, claimer1, "twitter1", 1);
        _claim(packetId, claimer2, "twitter2", 2);

        assertEq(usdc.balanceOf(claimer1), TEN_USDC / 2);
        assertEq(usdc.balanceOf(claimer2), TEN_USDC / 2);
        (, , uint256 remaining, , uint16 claimed, , , ) = redPacket.packets(packetId);
        assertEq(remaining, 0);
        assertEq(claimed, 2);
    }

    function test_claim_equalSplitRounding() public {
        // 10 USDC split 3 ways: 3.333333 + 3.333333 + 3.333334
        uint256 packetId = _createPacket(TEN_USDC, 3, false);

        _claim(packetId, claimer1, "twitter1", 1);
        _claim(packetId, claimer2, "twitter2", 2);
        _claim(packetId, claimer3, "twitter3", 3);

        uint256 total = usdc.balanceOf(claimer1) + usdc.balanceOf(claimer2) + usdc.balanceOf(claimer3);
        assertEq(total, TEN_USDC); // No dust lost
    }

    function test_claim_emitsEvent() public {
        uint256 packetId = _createPacket(TEN_USDC, 1, false);

        vm.expectEmit(true, true, false, true);
        emit RedPacket.PacketClaimed(packetId, claimer1, TEN_USDC, 0);
        _claim(packetId, claimer1, "twitter1", 1);
    }

    // ═══════════════════════════════════════════════════════════════
    // CLAIM — RANDOM SPLIT
    // ═══════════════════════════════════════════════════════════════

    function test_claim_randomSplitNonZero() public {
        uint256 packetId = _createPacket(TEN_USDC, 5, true);

        for (uint256 i = 0; i < 5; i++) {
            address claimer = address(uint160(100 + i));
            _claim(packetId, claimer, string(abi.encodePacked("tw", vm.toString(i))), i + 10);
            assertTrue(usdc.balanceOf(claimer) > 0, "Claimer received zero");
        }

        (, , uint256 remaining, , , , , ) = redPacket.packets(packetId);
        assertEq(remaining, 0, "Remaining should be zero after all claims");
    }

    function test_claim_randomSplitLastClaimerGetsRemainder() public {
        uint256 packetId = _createPacket(TEN_USDC, 2, true);

        _claim(packetId, claimer1, "twitter1", 1);
        uint256 claimed1 = usdc.balanceOf(claimer1);
        assertTrue(claimed1 > 0);

        _claim(packetId, claimer2, "twitter2", 2);
        uint256 claimed2 = usdc.balanceOf(claimer2);
        assertTrue(claimed2 > 0);

        assertEq(claimed1 + claimed2, TEN_USDC);
    }

    // ═══════════════════════════════════════════════════════════════
    // CLAIM — SIGNATURE VERIFICATION
    // ═══════════════════════════════════════════════════════════════

    function test_claim_rejectsInvalidSignature() public {
        uint256 packetId = _createPacket(TEN_USDC, 1, false);

        // Sign for claimer1 but try to claim as claimer2
        bytes memory sig = _signClaim(packetId, claimer1, "twitter1", 1);
        vm.prank(claimer2);
        vm.expectRevert("Invalid signature");
        redPacket.claim(packetId, "twitter1", 1, sig);
    }

    function test_claim_rejectsWrongNonce() public {
        uint256 packetId = _createPacket(TEN_USDC, 1, false);

        bytes memory sig = _signClaim(packetId, claimer1, "twitter1", 1);
        vm.prank(claimer1);
        // Use nonce 2 but signature was for nonce 1
        vm.expectRevert("Invalid signature");
        redPacket.claim(packetId, "twitter1", 2, sig);
    }

    function test_claim_rejectsReplayedNonce() public {
        uint256 packetId = _createPacket(TEN_USDC, 2, false);

        _claim(packetId, claimer1, "twitter1", 1);

        // Try to use same nonce for different claimer
        bytes memory sig = _signClaim(packetId, claimer2, "twitter2", 1);
        vm.prank(claimer2);
        vm.expectRevert("Nonce already used");
        redPacket.claim(packetId, "twitter2", 1, sig);
    }

    // ═══════════════════════════════════════════════════════════════
    // CLAIM — ANTI-SYBIL
    // ═══════════════════════════════════════════════════════════════

    function test_claim_rejectsDoubleClaim_sameAddress() public {
        uint256 packetId = _createPacket(TEN_USDC, 2, false);

        _claim(packetId, claimer1, "twitter1", 1);

        bytes memory sig = _signClaim(packetId, claimer1, "twitter1_alt", 2);
        vm.prank(claimer1);
        vm.expectRevert("Already claimed");
        redPacket.claim(packetId, "twitter1_alt", 2, sig);
    }

    function test_claim_rejectsDoubleClaim_sameTwitterDiffWallet() public {
        uint256 packetId = _createPacket(TEN_USDC, 2, false);

        _claim(packetId, claimer1, "sameTwitterUser", 1);

        bytes memory sig = _signClaim(packetId, claimer2, "sameTwitterUser", 2);
        vm.prank(claimer2);
        vm.expectRevert("Twitter user already claimed");
        redPacket.claim(packetId, "sameTwitterUser", 2, sig);
    }

    // ═══════════════════════════════════════════════════════════════
    // CLAIM — STATE CHECKS
    // ═══════════════════════════════════════════════════════════════

    function test_claim_rejectsNonexistentPacket() public {
        bytes memory sig = _signClaim(999, claimer1, "twitter1", 1);
        vm.prank(claimer1);
        vm.expectRevert("Packet does not exist");
        redPacket.claim(999, "twitter1", 1, sig);
    }

    function test_claim_rejectsExpiredPacket() public {
        uint256 packetId = _createPacket(TEN_USDC, 1, false);

        vm.warp(block.timestamp + 2 hours);

        bytes memory sig = _signClaim(packetId, claimer1, "twitter1", 1);
        vm.prank(claimer1);
        vm.expectRevert("Packet expired");
        redPacket.claim(packetId, "twitter1", 1, sig);
    }

    function test_claim_rejectsFullyClaimed() public {
        uint256 packetId = _createPacket(TEN_USDC, 1, false);
        _claim(packetId, claimer1, "twitter1", 1);

        bytes memory sig = _signClaim(packetId, claimer2, "twitter2", 2);
        vm.prank(claimer2);
        vm.expectRevert("Fully claimed");
        redPacket.claim(packetId, "twitter2", 2, sig);
    }

    function test_claim_rejectsRefundedPacket() public {
        uint256 packetId = _createPacket(TEN_USDC, 2, false);

        vm.warp(block.timestamp + 2 hours);
        vm.prank(creator);
        redPacket.refund(packetId);

        bytes memory sig = _signClaim(packetId, claimer1, "twitter1", 1);
        vm.prank(claimer1);
        vm.expectRevert("Packet refunded");
        redPacket.claim(packetId, "twitter1", 1, sig);
    }

    function test_claim_rejectsWhenPaused() public {
        uint256 packetId = _createPacket(TEN_USDC, 1, false);

        vm.prank(deployer);
        redPacket.pause();

        bytes memory sig = _signClaim(packetId, claimer1, "twitter1", 1);
        vm.prank(claimer1);
        vm.expectRevert("Contract is paused");
        redPacket.claim(packetId, "twitter1", 1, sig);
    }

    // ═══════════════════════════════════════════════════════════════
    // REFUND
    // ═══════════════════════════════════════════════════════════════

    function test_refund_fullAmount() public {
        uint256 packetId = _createPacket(TEN_USDC, 5, false);
        uint256 balBefore = usdc.balanceOf(creator);

        vm.warp(block.timestamp + 2 hours);
        vm.prank(creator);
        redPacket.refund(packetId);

        assertEq(usdc.balanceOf(creator), balBefore + TEN_USDC);
        (, , uint256 remaining, , , , , bool refunded) = redPacket.packets(packetId);
        assertEq(remaining, 0);
        assertTrue(refunded);
    }

    function test_refund_partialAfterClaims() public {
        uint256 packetId = _createPacket(TEN_USDC, 2, false);

        _claim(packetId, claimer1, "twitter1", 1);

        uint256 balBefore = usdc.balanceOf(creator);
        vm.warp(block.timestamp + 2 hours);
        vm.prank(creator);
        redPacket.refund(packetId);

        assertEq(usdc.balanceOf(creator), balBefore + TEN_USDC / 2);
    }

    function test_refund_emitsEvent() public {
        uint256 packetId = _createPacket(TEN_USDC, 1, false);

        vm.warp(block.timestamp + 2 hours);
        vm.expectEmit(true, true, false, true);
        emit RedPacket.PacketRefunded(packetId, creator, TEN_USDC);

        vm.prank(creator);
        redPacket.refund(packetId);
    }

    function test_refund_rejectsNonCreator() public {
        uint256 packetId = _createPacket(TEN_USDC, 1, false);

        vm.prank(attacker);
        vm.expectRevert("Not creator");
        redPacket.refund(packetId);
    }

    function test_refund_rejectsDoubleRefund() public {
        uint256 packetId = _createPacket(TEN_USDC, 1, false);

        vm.warp(block.timestamp + 2 hours);
        vm.prank(creator);
        redPacket.refund(packetId);

        vm.prank(creator);
        vm.expectRevert("Already refunded");
        redPacket.refund(packetId);
    }

    function test_refund_rejectsNothingToRefund() public {
        uint256 packetId = _createPacket(TEN_USDC, 1, false);

        _claim(packetId, claimer1, "twitter1", 1);

        vm.warp(block.timestamp + 2 hours);
        vm.prank(creator);
        vm.expectRevert("Nothing to refund");
        redPacket.refund(packetId);
    }

    function test_refund_beforeExpiry() public {
        // Creator cannot refund before expiry
        uint256 packetId = _createPacket(TEN_USDC, 5, false);

        vm.prank(creator);
        vm.expectRevert("Packet not expired");
        redPacket.refund(packetId);
    }

    function test_refund_blocksFutureClaims() public {
        uint256 packetId = _createPacket(TEN_USDC, 2, false);

        vm.warp(block.timestamp + 2 hours);
        vm.prank(creator);
        redPacket.refund(packetId);

        bytes memory sig = _signClaim(packetId, claimer1, "twitter1", 1);
        vm.prank(claimer1);
        vm.expectRevert("Packet refunded");
        redPacket.claim(packetId, "twitter1", 1, sig);
    }

    // ═══════════════════════════════════════════════════════════════
    // PAUSE / UNPAUSE
    // ═══════════════════════════════════════════════════════════════

    function test_pause_onlyOwner() public {
        vm.prank(attacker);
        vm.expectRevert("Not owner");
        redPacket.pause();
    }

    function test_unpause_onlyOwner() public {
        vm.prank(deployer);
        redPacket.pause();

        vm.prank(attacker);
        vm.expectRevert("Not owner");
        redPacket.unpause();
    }

    function test_pause_blocksCreateAndClaim() public {
        uint256 packetId = _createPacket(TEN_USDC, 1, false);

        vm.prank(deployer);
        redPacket.pause();

        // Create blocked
        vm.prank(creator);
        vm.expectRevert("Contract is paused");
        redPacket.createPacket(ONE_USDC, 1, false, uint48(block.timestamp + 1 hours));

        // Claim blocked
        bytes memory sig = _signClaim(packetId, claimer1, "twitter1", 1);
        vm.prank(claimer1);
        vm.expectRevert("Contract is paused");
        redPacket.claim(packetId, "twitter1", 1, sig);

        // Refund still works (not paused), but only after expiry
        vm.warp(block.timestamp + 2 hours);
        vm.prank(creator);
        redPacket.refund(packetId); // Should succeed
    }

    function test_unpause_restoresOperations() public {
        vm.prank(deployer);
        redPacket.pause();
        vm.prank(deployer);
        redPacket.unpause();

        // Create works again
        _createPacket(ONE_USDC, 1, false);
    }

    // ═══════════════════════════════════════════════════════════════
    // SIGNER MANAGEMENT
    // ═══════════════════════════════════════════════════════════════

    function test_setSigner_works() public {
        address newSigner = address(99);
        vm.prank(deployer);
        redPacket.setSigner(newSigner);
        assertEq(redPacket.signer(), newSigner);
    }

    function test_setSigner_onlyOwner() public {
        vm.prank(attacker);
        vm.expectRevert("Not owner");
        redPacket.setSigner(address(99));
    }

    function test_setSigner_rejectsZeroAddress() public {
        vm.prank(deployer);
        vm.expectRevert("Invalid signer address");
        redPacket.setSigner(address(0));
    }

    function test_setSigner_invalidatesOldSignatures() public {
        uint256 packetId = _createPacket(TEN_USDC, 1, false);

        // Sign with old signer
        bytes memory sig = _signClaim(packetId, claimer1, "twitter1", 1);

        // Rotate signer
        (, uint256 newSignerKey) = makeAddrAndKey("newSigner");
        address newSignerAddr = vm.addr(newSignerKey);
        vm.prank(deployer);
        redPacket.setSigner(newSignerAddr);

        // Old signature should fail
        vm.prank(claimer1);
        vm.expectRevert("Invalid signature");
        redPacket.claim(packetId, "twitter1", 1, sig);
    }

    // ═══════════════════════════════════════════════════════════════
    // OWNERSHIP TRANSFER (TWO-STEP)
    // ═══════════════════════════════════════════════════════════════

    function test_transferOwnership_twoStep() public {
        address newOwner = address(88);

        // Step 1: Current owner initiates
        vm.prank(deployer);
        redPacket.transferOwnership(newOwner);
        assertEq(redPacket.owner(), deployer); // Not yet transferred
        assertEq(redPacket.pendingOwner(), newOwner);

        // Step 2: New owner accepts
        vm.prank(newOwner);
        redPacket.acceptOwnership();
        assertEq(redPacket.owner(), newOwner);
        assertEq(redPacket.pendingOwner(), address(0));
    }

    function test_transferOwnership_onlyOwner() public {
        vm.prank(attacker);
        vm.expectRevert("Not owner");
        redPacket.transferOwnership(attacker);
    }

    function test_transferOwnership_rejectsZeroAddress() public {
        vm.prank(deployer);
        vm.expectRevert("Invalid owner address");
        redPacket.transferOwnership(address(0));
    }

    function test_acceptOwnership_onlyPendingOwner() public {
        vm.prank(deployer);
        redPacket.transferOwnership(address(88));

        vm.prank(attacker);
        vm.expectRevert("Not pending owner");
        redPacket.acceptOwnership();
    }

    // ═══════════════════════════════════════════════════════════════
    // ACCOUNTING INVARIANTS
    // ═══════════════════════════════════════════════════════════════

    function test_invariant_contractBalanceMatchesPackets() public {
        _createPacket(TEN_USDC, 2, false);     // packet 0
        _createPacket(HUNDRED_USDC, 10, true);  // packet 1

        _claim(0, claimer1, "tw1", 1);
        _claim(1, claimer2, "tw2", 2);

        (, , uint256 rem0, , , , , ) = redPacket.packets(0);
        (, , uint256 rem1, , , , , ) = redPacket.packets(1);

        assertEq(
            usdc.balanceOf(address(redPacket)),
            rem0 + rem1,
            "Contract balance must equal sum of remaining amounts"
        );
    }

    function test_invariant_noFundsLostOnFullClaim() public {
        uint256 amount = 7_777_777; // Odd number to test rounding
        uint256 packetId = _createPacket(amount, 3, false);

        _claim(packetId, claimer1, "tw1", 1);
        _claim(packetId, claimer2, "tw2", 2);
        _claim(packetId, claimer3, "tw3", 3);

        uint256 totalClaimed = usdc.balanceOf(claimer1) + usdc.balanceOf(claimer2) + usdc.balanceOf(claimer3);
        assertEq(totalClaimed, amount, "Total claimed must equal total deposited");
        assertEq(usdc.balanceOf(address(redPacket)), 0, "Contract should be empty");
    }

    // ═══════════════════════════════════════════════════════════════
    // MAX DEPOSIT
    // ═══════════════════════════════════════════════════════════════

    function test_create_maxDepositExact() public {
        usdc.mint(creator, MAX_DEPOSIT);
        vm.prank(creator);
        redPacket.createPacket(MAX_DEPOSIT, 200, false, uint48(block.timestamp + 1 hours));
    }

    function test_create_maxDepositPlusOne() public {
        usdc.mint(creator, MAX_DEPOSIT + 1);
        vm.prank(creator);
        vm.expectRevert("Max $2000 per packet");
        redPacket.createPacket(MAX_DEPOSIT + 1, 200, false, uint48(block.timestamp + 1 hours));
    }
}
