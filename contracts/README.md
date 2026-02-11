# RedPacket Smart Contract

## Overview

`RedPacket.sol` is a Solidity smart contract deployed on Base that enables users to create USDC-funded red packets (digital red envelopes) and share them with others. Recipients claim their share via EIP-712 signed authorization from a trusted backend signer.

**Deployed on Base Sepolia:** `0x1329B01e6fa433dB925426521d473131179c5738`

## How It Works

### 1. Creator deposits USDC

A user calls `createPacket()` with the total USDC amount, number of recipients, split type (equal or random), and expiry time. The USDC is transferred from the creator into the contract.

### 2. Recipients claim with a backend signature

To claim, a recipient obtains an EIP-712 signature from the backend (which performs anti-bot checks: Twitter account age, follower count, rate limiting). The recipient submits this signature to the contract's `claim()` function, which verifies it and transfers their share.

### 3. Creator can withdraw unclaimed funds

At any time, the creator can call `refund()` to withdraw any USDC that hasn't been claimed yet. This marks the packet as refunded and blocks future claims.

## Contract Details

### Inheritance

```
RedPacket
  ├── EIP712 (OpenZeppelin) — EIP-712 typed data signing/verification
  └── ReentrancyGuard (OpenZeppelin) — protection against reentrancy attacks
```

### State Variables

| Variable | Type | Description |
|----------|------|-------------|
| `usdc` | `IERC20 (immutable)` | The USDC token contract address |
| `signer` | `address` | Backend address whose signatures are accepted for claims |
| `owner` | `address` | Admin who can pause, update signer, transfer ownership |
| `pendingOwner` | `address` | Address that must call `acceptOwnership()` to become owner |
| `nextPacketId` | `uint256` | Auto-incrementing counter for onchain packet IDs |
| `paused` | `bool` | Emergency pause flag |

### Mappings

| Mapping | Description |
|---------|-------------|
| `packets[packetId]` | Stores the `Packet` struct for each packet |
| `hasClaimed[packetId][address]` | Whether a wallet address has claimed from a packet |
| `twitterClaimed[bytes32]` | Whether a Twitter user ID has claimed from a packet (key = `keccak256(packetId, twitterUserId)`) |
| `claimAmounts[packetId][claimIndex]` | The USDC amount for each individual claim |
| `usedNonces[nonce]` | Whether a signature nonce has been consumed |

### Packet Struct

```solidity
struct Packet {
    address creator;        // Who deposited the USDC
    uint256 totalAmount;    // Original deposit amount
    uint256 remainingAmount; // How much USDC is still unclaimed
    uint16 totalClaims;     // Maximum number of claims allowed
    uint16 claimedCount;    // How many claims have been made
    uint48 expiry;          // Unix timestamp after which claims are rejected
    bool isRandom;          // True = random split, False = equal split
    bool refunded;          // True if creator has withdrawn remaining funds
}
```

## Functions

### `createPacket(amount, totalClaims, isRandom, expiry) → packetId`

Creates a new red packet by depositing USDC into the contract.

**Parameters:**
- `amount` (uint256): Total USDC to deposit (6 decimals, e.g., 10000000 = $10)
- `totalClaims` (uint16): Number of people who can claim (1-200)
- `isRandom` (bool): Whether to distribute randomly or equally
- `expiry` (uint48): Unix timestamp when claims expire (max 24 hours from now)

**Requirements:**
- Amount > 0 and ≤ $2,000 (2,000,000,000 units)
- 1-200 claims
- At least $0.01 per claim (10,000 units)
- Expiry in the future, within 24 hours
- Contract not paused
- Creator must have approved USDC spending

**Emits:** `PacketCreated(packetId, creator, amount, totalClaims, isRandom, expiry)`

### `claim(packetId, twitterUserId, nonce, signature)`

Claims USDC from a red packet using a backend-signed authorization.

**Parameters:**
- `packetId` (uint256): The onchain packet ID
- `twitterUserId` (string): The claimer's Twitter user ID (for deduplication)
- `nonce` (uint256): A unique random nonce (prevents replay)
- `signature` (bytes): EIP-712 signature from the backend signer

**Verification steps (in order):**
1. Packet exists (creator ≠ address(0))
2. Packet not refunded
3. Packet not expired
4. Not fully claimed
5. Wallet hasn't already claimed this packet
6. Nonce hasn't been used
7. Twitter user hasn't claimed this packet (even with different wallet)
8. EIP-712 signature is valid and signed by the `signer` address

**Amount calculation:**
- **Equal split:** `remainingAmount / remainingClaims` — last claimer absorbs rounding remainder
- **Random split:** Pseudo-random between 20%-200% of average, bounded to ensure enough remains for other claimers. Falls back to equal split when average drops below 5 units.

**Emits:** `PacketClaimed(packetId, claimer, amount, claimIndex)`

### `refund(packetId)`

Creator withdraws any unclaimed USDC from their packet. Can be called at any time (no expiry wait required).

**Requirements:**
- Caller must be the packet creator
- Packet not already refunded
- Remaining amount > 0

**Effects:**
- Sets `refunded = true` (blocks future claims)
- Sets `remainingAmount = 0`
- Transfers remaining USDC to creator

**Emits:** `PacketRefunded(packetId, creator, amount)`

### `pause()` / `unpause()`

Emergency controls. When paused, `createPacket()` and `claim()` are blocked. `refund()` still works so creators can withdraw funds during an emergency.

**Access:** Owner only

### `setSigner(address)`

Updates the backend signer address. Old signatures immediately become invalid because they were signed by a different key. Used for key rotation if the signer key is compromised.

**Access:** Owner only. Cannot set to address(0).

### `transferOwnership(address)` / `acceptOwnership()`

Two-step ownership transfer:
1. Current owner calls `transferOwnership(newOwner)` — sets `pendingOwner`
2. New owner calls `acceptOwnership()` — becomes `owner`, clears `pendingOwner`

This prevents accidental ownership loss from typos. Cannot transfer to address(0).

## EIP-712 Signature Scheme

The contract uses EIP-712 typed data for claim authorization:

**Domain:**
```
name: "RedPacket"
version: "1"
chainId: <current chain>
verifyingContract: <contract address>
```

**Type:**
```
Claim(uint256 packetId, address claimer, string twitterUserId, uint256 nonce)
```

The backend signs this data with the `signer` private key. The contract recovers the signer from the signature and verifies it matches `signer`. The signature binds to:
- A specific packet
- A specific claimer wallet
- A specific Twitter user
- A specific nonce (one-time use)

This prevents: replay attacks, signature transfer between users, cross-chain replay, and cross-contract replay.

## Security Features

| Feature | Purpose |
|---------|---------|
| `nonReentrant` | All state-changing functions protected against reentrancy |
| `whenNotPaused` | Emergency kill switch for create and claim |
| `SafeERC20` | Safe token transfers that check return values |
| CEI pattern | State changes before external calls in all functions |
| `hasClaimed` mapping | Prevents same wallet from claiming twice |
| `twitterClaimed` mapping | Prevents same Twitter user from claiming with multiple wallets |
| `usedNonces` mapping | Prevents signature replay |
| Zero-address checks | Constructor, setSigner, transferOwnership all reject address(0) |
| Two-step ownership | Prevents accidental ownership loss |
| Division guards | Random split handles edge cases (range=0, minAmount=0, average<5) |
| Max deposit cap | $2,000 limit per packet |

## Random Split Algorithm

For random-split packets, each claim amount is calculated deterministically:

```
seed = keccak256(packetId, claimer, claimIndex, blockhash(block.number - 1))
average = remainingAmount / remainingClaims
minAmount = max(average / 5, 1)
maxAmount = average * 2
amount = minAmount + (seed % (maxAmount - minAmount))
```

**Bounds:** Each claim is between 20% and 200% of the current average. A reserve is maintained to ensure later claimers always receive at least `minAmount`. The last claimer receives all remaining funds.

**Note:** This randomness is pseudo-random and predictable to miners/sequencers. It is not cryptographically secure randomness. For the social/casual use case of red packets (max $2,000), this is an accepted tradeoff.

## Limits

| Limit | Value | Rationale |
|-------|-------|-----------|
| Max deposit | $2,000 | Regulatory/risk management |
| Max claims | 200 | Gas limit per packet |
| Max expiry | 24 hours | Prevents long-lived unclaimed funds |
| Min per claim | $0.01 | Prevents spam/dust packets |

## Testing

```bash
cd contracts
forge install OpenZeppelin/openzeppelin-contracts --no-git
forge test -v
```

**Test coverage (56 tests):**
- Constructor validation
- Packet creation (happy path + all validation errors)
- Equal split claiming (basic, full, rounding)
- Random split claiming (non-zero, last claimer remainder)
- Signature verification (invalid, wrong nonce, replayed nonce)
- Anti-sybil (same address, same Twitter different wallet)
- State checks (nonexistent, expired, fully claimed, refunded, paused)
- Refund (full, partial, events, access control, blocks future claims)
- Pause/unpause (access control, blocks create/claim, allows refund)
- Signer management (update, zero address, invalidates old signatures)
- Ownership transfer (two-step, access control, zero address)
- Accounting invariants (balance matches packets, no funds lost)
- Max deposit boundary

## Deployment

```bash
# Set environment variables
export DEPLOYER_PRIVATE_KEY=<private key with ETH for gas>
export USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e  # Base Sepolia
export SIGNER_ADDRESS=<backend signer public address>

# Deploy
forge script script/Deploy.s.sol \
  --rpc-url https://sepolia.base.org \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast

# For mainnet, add --verify --etherscan-api-key $BASESCAN_API_KEY
```

## Fund Traceability

Every dollar is fully traceable on-chain:

1. **PacketCreated** event: Links creator wallet → packet ID → USDC amount
2. **PacketClaimed** event: Links claimer wallet → packet ID → USDC amount
3. **PacketRefunded** event: Links creator wallet → packet ID → refund amount

The contract is not a mixer. Funds are isolated per packet with full audit trail. No commingling, no anonymity set.
