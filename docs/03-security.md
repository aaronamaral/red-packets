# Security

This document describes the security architecture of Red Packets on Base, covering smart contract protections, anti-bot controls, anti-sybil mechanisms, signature security, infrastructure-level defenses, and emergency procedures. It is intended for security reviewers, auditors, and compliance officers.

---

## 1. Threat Model

| # | Threat | Impact | Mitigation | Layer |
|---|--------|--------|-----------|-------|
| T-1 | Bot claiming (automated drain) | Loss of deposited funds | Twitter OAuth + account age >= 30 days + follower count >= 10, all fail-closed | Off-chain |
| T-2 | Packet ID enumeration | Attacker discovers and claims arbitrary packets | Claim URLs use database UUIDs; sequential on-chain `packetId` is never exposed in URLs | Application |
| T-3 | Double claim (same wallet) | Claimer receives multiple payouts from one packet | `hasClaimed[packetId][msg.sender]` mapping checked before transfer | On-chain |
| T-4 | Double claim (same Twitter account, different wallets) | Sybil attack via wallet rotation | `twitterClaimed[keccak256(packetId, twitterUserId)]` on-chain mapping + DB `UNIQUE(packet_id, claimer_twitter_id)` constraint | On-chain + DB |
| T-5 | Race condition double-claim | Two concurrent requests obtain two signatures for the same user | Atomic `INSERT ... ON CONFLICT DO NOTHING RETURNING id` in PostgreSQL before signature generation; no row returned means no signature issued | DB |
| T-6 | Signature replay | Reuse of a valid signature to claim again | Global `usedNonces` mapping on-chain; 256-bit cryptographically random nonces | On-chain |
| T-7 | Cross-chain signature replay | Valid Base signature replayed on another chain | EIP-712 domain separator includes `chainId` and `verifyingContract` address | On-chain |
| T-8 | Signer key compromise | Attacker generates valid claim signatures | `pause()` halts all creates/claims; `setSigner()` rotates to new key | Admin |
| T-9 | Division by zero (random split) | Transaction revert or unexpected behavior | Guards: `range == 0` fallback, `minAmount == 0` fallback, `average < 5` equal-split fallback | On-chain |
| T-10 | Zero-amount claim | Claimer receives 0 USDC but occupies a slot | `require(claimAmount > 0)` + `MIN_PER_CLAIM` constant ($0.01) enforced at creation | On-chain |
| T-11 | Ownership loss | Admin functions permanently inaccessible | Two-step ownership transfer: `transferOwnership()` + `acceptOwnership()` | On-chain |
| T-12 | Reentrancy | Attacker re-enters during USDC transfer | `nonReentrant` modifier on `createPacket`, `claim`, and `refund`; Checks-Effects-Interactions (CEI) pattern throughout | On-chain |
| T-13 | API data leakage | Individual claim details exposed publicly | Public endpoints return only aggregate data (total claims, claimed count); individual claim records are never returned | Application |
| T-14 | Claim amount spoofing | Frontend reports a false claim amount to the database | `/confirm` endpoint fetches the transaction receipt on-chain, decodes the `PacketClaimed` event log, and writes the verified amount | Application |
| T-15 | Reverted transaction ghost data | Failed transaction recorded as successful claim | `receipt.status` checked for `"success"` before any DB write; `PacketClaimed` event must be present in logs | Application |
| T-16 | Sanctioned country access | Regulatory violation via OFAC-listed jurisdictions | Next.js edge middleware blocks CU, IR, KP, SY, RU using Vercel `x-vercel-ip-country` header | Infrastructure |
| T-17 | Claim farming across packets | Single user claims many packets per day | Rate limit: maximum 10 claims per Twitter account per rolling 24-hour window | DB |
| T-18 | Zero-address injection | Setting signer or owner to `address(0)` permanently disables functionality | `require(_signer != address(0))` on constructor and `setSigner`; `require(newOwner != address(0))` on `transferOwnership` | On-chain |

---

## 2. Smart Contract Security

**Contract:** `RedPacket.sol` (Solidity 0.8.24, Foundry)

### 2.1 Reentrancy Protection

All three state-changing functions that move funds (`createPacket`, `claim`, `refund`) carry the `nonReentrant` modifier from OpenZeppelin's `ReentrancyGuard`. In addition, the contract follows the Checks-Effects-Interactions (CEI) pattern throughout: all storage writes (nonce consumption, claim recording, balance updates) occur before any external call (`safeTransfer` / `safeTransferFrom`).

### 2.2 Pause Mechanism

The `whenNotPaused` modifier gates `createPacket` and `claim`. The contract owner can invoke `pause()` to immediately halt all new deposits and claims. `refund()` is intentionally excluded from the pause gate so creators can always withdraw their remaining funds, even during an incident.

### 2.3 Checks-Effects-Interactions Pattern

In the `claim` function specifically:

1. **Checks:** Packet existence, not refunded, not expired, not fully claimed, wallet not already claimed, nonce not used, Twitter user not already claimed, signature valid.
2. **Effects:** `usedNonces[nonce] = true`, `hasClaimed[packetId][msg.sender] = true`, `twitterClaimed[twitterKey] = true`, `claimedCount++`, `remainingAmount -= claimAmount`, `claimAmounts` recorded.
3. **Interaction:** `usdc.safeTransfer(msg.sender, claimAmount)`.

### 2.4 Two-Step Ownership Transfer

Ownership cannot be transferred in a single transaction. The current owner calls `transferOwnership(newOwner)` to set `pendingOwner`, and the new owner must call `acceptOwnership()` to finalize. This prevents accidental transfer to an incorrect or inaccessible address. Both functions include zero-address validation.

### 2.5 Zero-Address Checks

The constructor requires non-zero addresses for both `_usdc` (USDC token) and `_signer`. The `setSigner` function requires a non-zero `_signer`. The `transferOwnership` function requires a non-zero `newOwner`. These prevent accidental bricking of contract functionality.

### 2.6 On-Chain Twitter Deduplication

The `twitterClaimed` mapping stores `keccak256(abi.encodePacked(packetId, twitterUserId))` as a key. This prevents the same Twitter user from claiming a packet with multiple wallets, even if they somehow obtain multiple valid signatures. This is a defense-in-depth measure layered on top of the off-chain DB constraint.

### 2.7 Division-by-Zero Guards

The `_calculateClaimAmount` function contains multiple safeguards for the random split path:

- If `average < 5` (too small for meaningful randomization), falls back to equal split.
- If `minAmount == 0`, sets it to 1 to guarantee a non-zero floor.
- If `range == 0`, sets it to 1 to prevent modulo-by-zero.
- If `reserveForOthers >= packet.remainingAmount`, falls back to equal split.
- Final safety: if computed `amount == 0`, sets it to 1.

### 2.8 Deposit and Claim Limits

Enforced at the contract level:

| Parameter | Limit | Constant |
|-----------|-------|----------|
| Maximum deposit per packet | $2,000 USDC | `MAX_DEPOSIT = 2_000_000_000` |
| Maximum claims per packet | 200 | Hardcoded `require` |
| Maximum expiry duration | 24 hours | `block.timestamp + 1 days` |
| Minimum per-claim amount | $0.01 USDC | `MIN_PER_CLAIM = 10_000` |

### 2.9 SafeERC20

All USDC transfers use OpenZeppelin's `SafeERC20` wrapper (`safeTransfer`, `safeTransferFrom`), which checks return values and reverts on failure. This protects against non-standard ERC-20 implementations.

---

## 3. Anti-Bot System

**Source:** `src/lib/antibot.ts`
**Enforcement point:** `POST /api/packets/[id]/claim` (server-side only)

### 3.1 Checks

| Check | Threshold | Fail-Closed Behavior |
|-------|-----------|---------------------|
| Twitter account age | >= 30 days | If `createdAt` is missing, empty, or unparseable, the claim is rejected. |
| Twitter follower count | >= 10 followers | If `followersCount` is not a number or is `NaN`, the claim is rejected. |
| Duplicate claim (per packet) | 1 claim per Twitter user per packet | DB query checks `claims` table. |
| Rate limit (global) | 10 claims per Twitter user per 24 hours | DB query checks `rate_limits` table with rolling 24-hour window. |
| Profile data presence | Both `createdAt` and `followersCount` required | If both are absent/zero, the claim is immediately rejected with `missing_profile_data`. |

### 3.2 Fail-Closed Design

Every check defaults to rejection when data is unavailable or malformed:

- `checkAccountAge`: returns `false` if `createdAt` is falsy or if `new Date(createdAt)` produces `NaN`.
- `checkFollowerCount`: returns `false` if `followers` is not of type `number` or is `NaN`.
- `runAntiBotChecks`: returns `{ passed: false, reason: "missing_profile_data" }` if both profile data points are absent.

This means a failure in the Twitter API or an incomplete OAuth response cannot be exploited to bypass bot detection.

### 3.3 Rate Limiting

Each successful claim attempt inserts a row into the `rate_limits` table with the current timestamp. The rate check queries for rows where `claimed_at > NOW() - INTERVAL '24 hours'` and compares against the `MAX_CLAIMS_PER_DAY` threshold (currently 10). The rate limit insert occurs before signature generation, so even if the on-chain transaction fails, the rate limit slot is consumed.

### 3.4 Execution Order

Anti-bot checks run in this specific order, short-circuiting on first failure:

1. Profile data presence check
2. Account age check
3. Follower count check
4. Duplicate claim check (DB query)
5. Rate limit check (DB query)

Database queries (steps 4 and 5) are deferred until after the cheaper in-memory checks pass, reducing unnecessary load.

---

## 4. Anti-Sybil Defenses

Sybil attacks (one person claiming with many identities) are mitigated at three layers:

### 4.1 On-Chain Layer

- **`hasClaimed[packetId][msg.sender]`**: Prevents a single wallet from claiming the same packet twice.
- **`twitterClaimed[keccak256(packetId, twitterUserId)]`**: Prevents a single Twitter account from claiming the same packet via different wallets. The contract receives the `twitterUserId` as a parameter, and its authenticity is guaranteed by the EIP-712 signature from the trusted signer.

### 4.2 Database Layer

- **`UNIQUE(packet_id, claimer_twitter_id)`**: A database-level uniqueness constraint on the `claims` table. The atomic `INSERT ... ON CONFLICT DO NOTHING RETURNING id` pattern ensures that even concurrent requests cannot produce two claim rows for the same (packet, Twitter user) pair.

### 4.3 Application Layer

- **Atomic DB insert before signing**: The claim route inserts the claim record into the database before generating the EIP-712 signature. If the insert returns zero rows (conflict), no signature is issued. This closes the race condition window between checking eligibility and issuing a signature.
- **Rate limiting**: The 10 claims per 24 hours cap limits the economic value of any single bot-controlled Twitter account.

---

## 5. UUID Enumeration Prevention

Claim URLs use the format `/claim/[uuid]` where `uuid` is a v4 UUID generated by PostgreSQL (`gen_random_uuid()`). The sequential on-chain `packetId` (0, 1, 2, ...) is never exposed in any URL or public API response.

**Why this matters:** Without UUIDs, an attacker could trivially enumerate all active packets by iterating `/claim/0`, `/claim/1`, `/claim/2`, etc. With UUIDs, the URL space is 2^122 (128 bits minus 6 version/variant bits), making brute-force enumeration computationally infeasible.

**Resolution flow:** All API routes that receive a UUID resolve it to the on-chain `packetId` via a database lookup (`SELECT packet_id FROM packets WHERE id = $uuid`). The on-chain ID is used internally for contract calls but is never returned to the client in URL-facing contexts.

---

## 6. Signature Security

### 6.1 EIP-712 Typed Data Signing

Claims require an EIP-712 signature from a trusted backend signer. The signature covers a structured message:

```
Claim(uint256 packetId, address claimer, string twitterUserId, uint256 nonce)
```

The EIP-712 domain separator binds the signature to a specific deployment:

```
Domain {
  name: "RedPacket",
  version: "1",
  chainId: <deployment chain ID>,
  verifyingContract: <contract address>
}
```

This prevents signatures generated for Base Sepolia (chain ID 84532) from being replayed on Base mainnet (chain ID 8453), and vice versa.

### 6.2 Nonce Generation

Nonces are 256-bit values generated using `crypto.getRandomValues(new Uint8Array(32))` in the claim route. This uses the Web Crypto API's cryptographically secure random number generator. With 2^256 possible values, the probability of nonce collision is negligible.

### 6.3 Nonce Consumption

The contract maintains a global `usedNonces` mapping (`mapping(uint256 => bool)`). Each nonce is marked as used during the claim transaction (in the Effects phase, before the Interaction phase). A replayed signature with the same nonce will revert with `"Nonce already used"`.

### 6.4 Signature Verification

The contract uses OpenZeppelin's `ECDSA.recover` on the EIP-712 digest to extract the signer address. If the recovered address does not match the stored `signer` address, the transaction reverts. The `ECDSA` library includes protections against signature malleability (s-value canonicalization).

---

## 7. IP Sanctions and Geo-Blocking

**Source:** `src/middleware.ts`

### 7.1 Implementation

Next.js edge middleware intercepts every request before it reaches any page or API route. The middleware reads the `x-vercel-ip-country` header, which Vercel populates automatically at the edge from the client's IP geolocation.

### 7.2 Blocked Countries

| Country | ISO Code | Basis |
|---------|----------|-------|
| Cuba | CU | OFAC Comprehensive Sanctions |
| Iran | IR | OFAC Comprehensive Sanctions |
| North Korea | KP | OFAC Comprehensive Sanctions |
| Syria | SY | OFAC Comprehensive Sanctions |
| Russia | RU | OFAC Sanctions / Executive Orders |

### 7.3 Behavior

- **Blocked request:** Returns HTTP 403 with a static HTML page stating "This service is not available in your region due to regulatory requirements."
- **No header present:** The request is allowed through. This occurs in local development (no Vercel edge) and prevents the middleware from breaking the dev environment.
- **Excluded routes:** `api/auth` routes are excluded from the middleware matcher to ensure OAuth callback flows are not disrupted.

### 7.4 Limitations

- Geo-blocking by IP is not foolproof. Users with VPNs or proxies can bypass this control.
- The `x-vercel-ip-country` header is only available on Vercel's edge network. Self-hosted deployments would need an alternative geolocation source.
- The blocked country list is maintained as a JavaScript `Set` in middleware source code. Updates require a code deployment.

---

## 8. Security Headers

The application should be configured with the following security headers (via `next.config.js` or Vercel configuration):

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Frame-Options` | `DENY` | Prevents clickjacking by disallowing the page from being embedded in iframes |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-type sniffing attacks |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limits referrer information leaked to third-party origins |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Disables browser APIs not needed by the application |

These headers reduce the attack surface for browser-based attacks against users interacting with the application.

---

## 9. Reverted Transaction Handling

The `/api/packets/[id]/confirm` endpoint verifies claims on-chain before recording them in the database. This prevents "ghost data" from reverted transactions:

1. **Transaction receipt fetch:** `publicClient.getTransactionReceipt({ hash: txHash })`. If the transaction does not exist, returns 404.
2. **Contract address verification:** `receipt.to` must match `RED_PACKET_CONTRACT`. Prevents spoofing with unrelated transactions.
3. **Status check:** `receipt.status` must equal `"success"`. Reverted transactions are rejected with HTTP 400.
4. **Event log parsing:** The `PacketClaimed` event is decoded from the receipt logs. The `packetId` in the event must match the expected packet. The `amount` and `claimer` are extracted directly from the verified event.
5. **Authenticated update:** The DB update is scoped to the authenticated user's `twitterId` and the verified `claimer` address, preventing one user from confirming another user's claim.

---

## 10. Emergency Procedures

### 10.1 Pause

If a vulnerability is discovered or suspicious activity is detected:

1. Contract owner calls `pause()`.
2. All `createPacket` and `claim` transactions will revert immediately.
3. Existing creators can still call `refund()` to withdraw their remaining funds.
4. Investigate and remediate.
5. Owner calls `unpause()` to resume normal operation.

### 10.2 Signer Key Rotation

If the backend signer key is compromised:

1. Call `pause()` to halt claims immediately.
2. Generate a new signer keypair.
3. Call `setSigner(newSignerAddress)` on the contract.
4. Update the `SIGNER_PRIVATE_KEY` environment variable on the backend.
5. Redeploy the backend.
6. Call `unpause()`.

All previously issued but unused signatures become invalid because they were signed by the old key. The contract will reject them since `ECDSA.recover` will return the old signer address, which no longer matches the stored `signer`.

### 10.3 Ownership Transfer

If the owner key needs to be rotated:

1. Current owner calls `transferOwnership(newOwnerAddress)`.
2. New owner calls `acceptOwnership()` from the new address.
3. The old owner address loses all admin privileges.

---

## 11. Signer Key Compromise Blast Radius

The backend signer key (`SIGNER_PRIVATE_KEY`) is the most sensitive secret in the system. If compromised, an attacker can:

- **Generate valid claim signatures** for any packet, bypassing all anti-bot and anti-sybil checks.
- **Drain active packets** by submitting claims with fabricated `twitterUserId` values and fresh nonces.
- **Not steal funds beyond active packet balances.** The signer has no ability to withdraw funds, change contract parameters, or pause/unpause the contract.
- **Not affect already-claimed or refunded packets.** The on-chain `hasClaimed`, `twitterClaimed`, and `usedNonces` mappings still apply.

**Limiting factors:**

- Each claim still requires an on-chain transaction, so the attacker needs ETH for gas.
- The `hasClaimed` mapping prevents the same wallet from claiming twice, forcing the attacker to use many wallets.
- The contract owner can call `pause()` and `setSigner()` to halt the attack and rotate the key.
- The maximum exposure per packet is $2,000 USDC. The total exposure is the sum of all remaining balances across active, non-expired packets.

**The signer key is NOT the contract owner key.** Compromise of the signer does not grant admin access. The owner key can independently halt operations and rotate the signer.

---

## 12. Audit Status

### What Has Been Tested

- **56 Foundry unit tests** covering all contract functions, edge cases, access control, and failure modes.
- Manual security review of the contract, anti-bot system, and claim flow.
- Race condition testing of the atomic DB insert pattern.

### What Needs Formal Audit

The following components have not undergone a formal third-party security audit:

| Component | Risk Level | Reason |
|-----------|-----------|--------|
| `RedPacket.sol` smart contract | High | Holds user funds. Custom random split logic. Signature verification. |
| EIP-712 signing flow (`eip712.ts` + contract) | High | Signature correctness and domain binding are critical to fund safety. |
| Anti-bot system (`antibot.ts`) | Medium | Effectiveness against sophisticated bots. Fail-closed correctness. |
| Claim route (`/api/packets/[id]/claim`) | Medium | Race condition handling. Nonce generation. Input validation. |
| Confirm route (`/api/packets/[id]/confirm`) | Medium | On-chain verification correctness. Event parsing. |
| Database schema and constraints | Low | Uniqueness constraints. Index correctness. |

**Recommendation:** A formal smart contract audit by a reputable firm (e.g., OpenZeppelin, Trail of Bits, Spearbit) is strongly recommended before mainnet deployment with significant user funds.

---

## 13. Trust Assumptions

The system operates under the following trust assumptions:

| Assumption | Consequence if Violated |
|-----------|------------------------|
| **The backend signer key is not compromised.** | Attacker can generate valid claim signatures and drain active packets (see Section 11). |
| **The contract owner key is not compromised.** | Attacker can pause/unpause, change signer, transfer ownership. Cannot directly steal funds. |
| **Vercel correctly reports the client's country via `x-vercel-ip-country`.** | Sanctioned country users could bypass geo-blocking. |
| **Twitter OAuth returns accurate profile data (account age, followers).** | Inaccurate data could allow bots to pass or legitimate users to fail checks. Fail-closed design means errors reject rather than allow. |
| **The PostgreSQL database is available and consistent.** | If the DB is down, claims fail (no signature issued). If data is corrupted, duplicate claims could theoretically occur, but on-chain mappings provide defense-in-depth. |
| **Base L2 chain operates correctly and finalizes transactions.** | If the chain halts or reorgs, confirmed claims could be reverted. Packets have a 24-hour maximum expiry, limiting exposure window. |
| **OpenZeppelin contracts are correct.** | `ReentrancyGuard`, `EIP712`, `ECDSA`, and `SafeERC20` are battle-tested and widely audited. This is a reasonable assumption. |
| **USDC contract on Base is a standard ERC-20.** | `SafeERC20` provides protection against non-standard behavior. Circle's USDC is well-audited. |
| **`crypto.getRandomValues` provides cryptographically secure randomness.** | If the CSPRNG is broken, nonces could be predictable. This is a standard Web Crypto API backed by the OS entropy pool. |
| **On-chain randomness (`blockhash`) is not manipulable for profit.** | A miner/sequencer could influence the random split amount. However, with a $2,000 maximum packet and bounded 20-200% of average range, the economic incentive for manipulation is minimal. |
