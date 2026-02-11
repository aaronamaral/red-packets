# Risk Assessment

**Red Packets on Base -- Comprehensive Risk Register**

**Prepared:** [DATE]
**Classification:** Internal -- Engineering / Compliance

---

## 1. Smart Contract Risk

**Severity:** Critical
**Likelihood:** Low-Medium

### Description

The RedPacket smart contract (`contracts/src/RedPacket.sol`) manages USDC deposits, claims, and refunds. A vulnerability in the contract could result in loss of user funds, unauthorized claims, or locked funds.

### Current Mitigations

- 56 unit tests (Foundry framework) covering creation, claiming, refunding, signature verification, anti-sybil, pause/unpause, ownership transfer, and accounting invariants.
- Internal code review by the development team.
- Uses audited OpenZeppelin library contracts: `SafeERC20`, `EIP712`, `ECDSA`, `ReentrancyGuard`.
- Checks-Effects-Interactions (CEI) pattern followed in all state-changing functions.
- `nonReentrant` modifier on `createPacket()`, `claim()`, and `refund()`.
- Division-by-zero guards and minimum claim amount enforcement in random split calculation.
- Zero-address validation on constructor, `setSigner()`, and `transferOwnership()`.

### Gaps

- **No formal third-party security audit.** The contract has not been reviewed by an independent security firm (e.g., Trail of Bits, OpenZeppelin Audits, Spearbit).
- No formal verification (e.g., Certora, Halmos).
- No bug bounty program.
- Fuzz testing coverage is limited; no stateful invariant tests.

### Recommendations

1. Commission a third-party smart contract audit before mainnet deployment.
2. Establish a bug bounty program via Immunefi or HackerOne.
3. Add Foundry fuzz tests and stateful invariant tests.
4. Consider formal verification for critical arithmetic (claim amount calculation).
5. Deploy behind an upgradeable proxy if ongoing contract improvements are anticipated.

---

## 2. Signer Key Risk

**Severity:** Critical
**Likelihood:** Low

### Description

The backend holds a private key (`SIGNER_PRIVATE_KEY`) used to sign EIP-712 claim authorizations. If this key is compromised, an attacker could generate valid claim signatures for any packet, draining all deposited funds without passing anti-bot checks.

### Current Mitigations

- The signer key is separate from the contract deployer/owner key.
- The key is stored as a Vercel environment variable (encrypted at rest by Vercel).
- The owner can call `setSigner()` to rotate the key and `pause()` to halt claims.
- Signatures include the claimer's wallet address, preventing signature transfer between wallets.
- Nonces are globally unique and consumed on-chain, preventing replay.

### Gaps

- **Single point of trust:** The signer key is a single ECDSA key with no multi-signature or threshold requirement.
- **Not stored in an HSM:** The key is a plaintext hex string in an environment variable, not managed by AWS KMS, HashiCorp Vault, or a hardware security module.
- **No key escrow or recovery procedure:** If the key is lost and the environment variable is deleted, no new claims can be authorized until `setSigner()` is called.
- **No automated anomaly detection:** There is no monitoring system that alerts on unusual signing patterns (e.g., a spike in claim signatures).

### Recommendations

1. Migrate the signer key to AWS KMS or GCP Cloud KMS with IAM-restricted access.
2. Implement monitoring and alerting on claim signature volume.
3. Document key rotation runbook and test it periodically.
4. Consider a multi-sig or threshold signature scheme for the signer role.
5. Implement IP allowlisting for the signing endpoint in production.

---

## 3. Maximum Financial Exposure

**Severity:** High
**Likelihood:** Medium

### Description

The maximum deposit per packet is $2,000 USDC. The contract can hold funds from an unlimited number of concurrent active packets. The total financial exposure at any given time is `$2,000 x N`, where `N` is the number of active (unclaimed, unexpired, unrefunded) packets.

### Scenarios

| Active Packets | Maximum Exposure |
|---|---|
| 10 | $20,000 |
| 100 | $200,000 |
| 1,000 | $2,000,000 |
| 10,000 | $20,000,000 |

### Current Mitigations

- Per-packet deposit cap of $2,000 USDC enforced at the contract level.
- Maximum 200 claims per packet.
- Maximum 24-hour expiry per packet.
- Emergency `pause()` function to halt all new creations and claims.
- Creators can refund remaining funds at any time.

### Gaps

- No global deposit cap (total value locked across all packets).
- No per-creator deposit cap (a single user can create unlimited packets).
- No circuit breaker for unusual activity (e.g., many large packets created in a short window).

### Recommendations

1. Monitor total value locked (TVL) in the contract.
2. Consider implementing per-creator rate limits for packet creation.
3. Establish internal thresholds for manual review (e.g., alert if TVL exceeds $100,000).
4. Set up automated balance monitoring on the contract address.

---

## 4. Twitter/X API Dependency

**Severity:** High
**Likelihood:** Medium

### Description

The Service depends on Twitter/X OAuth 2.0 for user authentication and anti-bot data (account age, follower count). If the Twitter/X API is unavailable, changed, or access is revoked, the claim flow is blocked entirely.

### Failure Modes

- **API Downtime:** Users cannot authenticate; no new claims can be initiated.
- **API Changes:** Twitter/X modifies OAuth endpoints, scope requirements, or profile data structure. The `user.fields` response format changes.
- **Rate Limiting:** Twitter/X imposes rate limits on the OAuth or user info endpoints, throttling or blocking authentication.
- **Access Revocation:** Twitter/X suspends or revokes the application's API credentials.
- **Platform Policy Changes:** Twitter/X restricts third-party OAuth usage or introduces new compliance requirements.

### Current Mitigations

- Anti-bot checks fail closed: if profile data is unavailable or unparseable, the claim is rejected (conservative approach).
- Session data is cached in a JWT cookie, reducing repeat API calls during an active session.

### Gaps

- No fallback authentication mechanism. Twitter/X is the sole identity provider.
- No caching of profile data beyond the session lifetime.
- No alerting on Twitter API errors or elevated failure rates.

### Recommendations

1. Implement monitoring and alerting on Twitter OAuth success/failure rates.
2. Consider supporting additional OAuth providers (e.g., Farcaster, GitHub) as fallback identity sources.
3. Cache Twitter profile data server-side with a reasonable TTL to reduce API dependency during active sessions.
4. Document a degraded-mode procedure for when Twitter is unavailable.

---

## 5. Database Dependency (Neon Postgres)

**Severity:** High
**Likelihood:** Low

### Description

The Neon Postgres database is used for claim deduplication, rate limiting, packet UUID resolution, and OG image data. If the database is unavailable, the claim flow fails.

### Failure Modes

- **Database Downtime:** Claim requests cannot be deduplicated or rate-limited. Packet UUIDs cannot be resolved to on-chain IDs.
- **Data Loss:** Loss of the `claims` table eliminates off-chain deduplication records.
- **Connection Exhaustion:** Neon serverless driver connection limits are reached under high load.

### Current Mitigations

- **On-chain deduplication (defense-in-depth):** The smart contract's `hasClaimed` and `twitterClaimed` mappings prevent double claims even if the database is unavailable. This is a critical safety net.
- Neon serverless driver uses HTTP-based connections (no persistent connection pool to exhaust).
- Database is managed by Neon (automated backups, replication).

### Gaps

- No application-level retry logic for database failures.
- No database connection health check endpoint.
- No documented disaster recovery procedure for database loss.
- Rate limiting data is not backed up by an on-chain mechanism.

### Recommendations

1. Implement retry logic with exponential backoff for database operations.
2. Add a health check endpoint that verifies database connectivity.
3. Document database backup and restore procedures.
4. Set up monitoring on database connection errors and query latency.
5. Consider a graceful degradation mode that relies on on-chain deduplication when the database is unavailable.

---

## 6. RPC Provider Dependency

**Severity:** Medium
**Likelihood:** Medium

### Description

The backend reads on-chain state (packet existence, expiry, claim count) via an RPC endpoint before signing claims. The frontend submits transactions via RPC. If the RPC endpoint is unavailable or rate-limited, both claim verification and transaction submission fail.

### Current Configuration

- Backend: Uses the `NEXT_PUBLIC_BASE_RPC_URL` environment variable, currently pointing to a public RPC or Alchemy/QuickNode endpoint.
- Frontend: Wagmi transport configured with `https://sepolia.base.org` (public, rate-limited) for testnet and `https://mainnet.base.org` (public, rate-limited) for mainnet.
- OnchainKit provider uses a Coinbase Developer Platform API key for RPC.

### Gaps

- Public RPCs (`sepolia.base.org`, `mainnet.base.org`) have aggressive rate limits and no SLA.
- No RPC failover configuration (single endpoint, no fallback).
- No request caching for frequently read on-chain state.

### Recommendations

1. Use a paid RPC provider (Alchemy, QuickNode, or Coinbase Cloud) with an SLA for production.
2. Configure multiple RPC endpoints with automatic failover.
3. Cache on-chain packet state with a short TTL (e.g., 10 seconds) to reduce RPC calls.
4. Monitor RPC request volume, latency, and error rates.

---

## 7. Pseudo-Random Fairness

**Severity:** Medium
**Likelihood:** Low

### Description

Random-split red packets determine claim amounts using on-chain pseudo-randomness:

```solidity
bytes32 seed = keccak256(
    abi.encodePacked(packetId, msg.sender, claimIndex, blockhash(block.number - 1))
);
```

This seed is deterministic and composed of publicly known or predictable values.

### Attack Vectors

- **Sequencer Manipulation:** On the Base L2 (a single-sequencer optimistic rollup), the sequencer operator could theoretically observe pending transactions and manipulate `blockhash` values to influence claim amounts. This is a theoretical risk; exploitation would require collusion with the sequencer operator.
- **Front-Running:** A sophisticated actor could simulate transactions with different timing to predict the claim amount before committing. However, the amount is bounded (20-200% of average), limiting the upside.
- **Pre-Computation:** Since all seed inputs are known or predictable, an attacker can pre-compute the expected claim amount and decide whether to claim.

### Current Mitigations

- Claim amounts are bounded between 20% and 200% of the average share.
- The maximum per-packet deposit is $2,000, limiting the absolute value at risk.
- The claimer's address is part of the seed, meaning different wallets produce different amounts.
- Equal-split fallback when the average per claim drops below 5 units.

### Gaps

- No use of a verifiable random function (VRF) such as Chainlink VRF.
- No user-facing disclosure that randomness is pseudo-random and potentially predictable.

### Recommendations

1. Add a disclaimer in the UI stating that random-split amounts are pseudo-random and not cryptographically secure.
2. For high-value packets, consider integrating Chainlink VRF or a commit-reveal scheme.
3. Evaluate whether the bounded range (20-200%) provides sufficient fairness for the intended use case.

---

## 8. Regulatory Risk

**Severity:** High
**Likelihood:** Medium

### Description

The Service facilitates the transfer of digital assets (USDC) between users. Depending on the jurisdiction, this may implicate money transmission, payment services, virtual asset service provider (VASP), or other financial services regulations.

### Considerations

- **Money Transmission:** In some jurisdictions, facilitating the transfer of value between parties may require a money transmitter license, even if the operator never takes custody of funds (smart contract custody model).
- **KYC/AML:** Regulatory frameworks may require Know Your Customer (KYC) verification beyond Twitter OAuth authentication. The current anti-bot checks (account age, follower count) are not equivalent to identity verification.
- **Sanctions Compliance:** The Service implements IP-based geo-blocking for OFAC-sanctioned countries (Cuba, Iran, North Korea, Syria, Russia), but this is not a comprehensive sanctions screening program (no wallet screening against SDN lists, no VPN detection beyond Vercel's capabilities).
- **Securities Regulation:** While USDC is generally classified as a stablecoin (not a security), the regulatory classification of red packets themselves (which involve random distribution of value) may vary by jurisdiction.
- **Gambling/Lottery Classification:** Random-split red packets involve an element of chance in determining claim amounts. Some jurisdictions may classify this as a lottery, sweepstakes, or game of chance, potentially triggering gambling regulations.
- **Tax Reporting:** Users may have tax obligations related to receiving USDC via red packets. The Service does not provide tax documentation (e.g., 1099 forms).

### Current Mitigations

- IP-based geo-blocking for OFAC-sanctioned countries.
- Per-packet deposit cap of $2,000.
- Terms & Conditions (draft) that require users to be 18+ and comply with local laws.

### Recommendations

1. Obtain formal legal guidance on money transmitter / VASP classification.
2. Evaluate the need for KYC verification based on transaction volume and jurisdiction.
3. Implement wallet screening against OFAC SDN lists (e.g., via Chainalysis, TRM Labs).
4. Assess gambling/lottery classification risk in target jurisdictions.
5. Consult with tax counsel regarding reporting obligations.

---

## 9. Reputational Risk

**Severity:** Medium
**Likelihood:** Low

### Description

The Service uses Coinbase branding and operates on the Base blockchain (a Coinbase-incubated L2). Any security incident, regulatory action, or user harm could impact the Coinbase brand.

### Scenarios

- **Fund Loss:** A smart contract exploit drains user deposits, generating negative coverage.
- **Sybil/Bot Abuse:** A coordinated bot attack claims a large number of red packets, undermining trust.
- **Regulatory Action:** A government agency takes enforcement action against the Service.
- **Misuse:** The Service is used for money laundering, sanctions evasion, or other illicit purposes.
- **Cultural Sensitivity:** Red packets have deep cultural significance in Chinese and other Asian cultures. Inappropriate branding, messaging, or commercialization could cause offense.

### Recommendations

1. Ensure all public-facing materials are culturally sensitive and respectful.
2. Establish a communications plan for security incidents.
3. Clarify the relationship between the Service and Coinbase (official product, partnership, or independent project).
4. Obtain explicit brand usage authorization from Coinbase.

---

## 10. Operational Risk

**Severity:** Medium
**Likelihood:** Medium

### Description

Day-to-day operational risks related to credential management, deployment, and system administration.

### Risk Areas

| Risk | Description | Impact |
|---|---|---|
| **Credential Leak** | `SIGNER_PRIVATE_KEY`, `DATABASE_URL`, or OAuth secrets exposed in logs, source control, or error messages. | Fund theft, data breach |
| **Deployment Error** | Incorrect environment variables deployed (e.g., testnet contract address on mainnet, wrong chain ID). | Claims fail or funds sent to wrong contract |
| **Certificate Expiry** | TLS certificates, OAuth app credentials, or API keys expire. | Service outage |
| **Dependency Vulnerability** | A vulnerability in a dependency (Next.js, Wagmi, Viem, OpenZeppelin, NextAuth) is exploited. | Application compromise |
| **Human Error** | Accidental deletion of database records, incorrect signer key rotation, or premature contract unpause. | Data loss, unauthorized claims |
| **Monitoring Gaps** | Failure to detect anomalous activity (e.g., a spike in claims, unusual deposit patterns). | Delayed incident response |

### Current Mitigations

- Environment variables are managed via Vercel's encrypted environment variable system.
- Separate signer key from deployer/owner key.
- Two-step ownership transfer prevents accidental ownership loss.
- Emergency `pause()` function for rapid incident response.

### Recommendations

1. Implement a credential rotation schedule (see Operational Runbook).
2. Use preview deployments and staging environments for pre-production validation.
3. Set up monitoring and alerting for error rates, claim volumes, and contract balance changes.
4. Conduct periodic dependency audits (`npm audit`, `forge update`).
5. Maintain and test the Operational Runbook procedures.
6. Implement a four-eyes principle for production deployments and credential changes.

---

## Risk Summary Matrix

| # | Risk | Severity | Likelihood | Overall | Primary Mitigation |
|---|---|---|---|---|---|
| 1 | Smart Contract Vulnerability | Critical | Low-Medium | High | Testing, OpenZeppelin libraries, CEI pattern |
| 2 | Signer Key Compromise | Critical | Low | High | Key isolation, `pause()`, `setSigner()` |
| 3 | Financial Exposure (TVL) | High | Medium | High | Per-packet caps, pause, refund |
| 4 | Twitter/X API Failure | High | Medium | High | Fail-closed anti-bot, JWT session cache |
| 5 | Database Failure | High | Low | Medium | On-chain dedup as backup |
| 6 | RPC Provider Failure | Medium | Medium | Medium | Multiple transports configured |
| 7 | Pseudo-Random Manipulation | Medium | Low | Low | Bounded range (20-200%), low max deposit |
| 8 | Regulatory Non-Compliance | High | Medium | High | Geo-blocking, deposit caps, T&Cs |
| 9 | Reputational Damage | Medium | Low | Low | Cultural sensitivity, incident response plan |
| 10 | Operational Error | Medium | Medium | Medium | Env var management, two-step ownership |

---

> **Review Cadence:** This risk assessment should be reviewed and updated quarterly, or upon any material change to the system architecture, threat landscape, or regulatory environment.
