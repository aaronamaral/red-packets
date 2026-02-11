# Compliance

This document describes the regulatory compliance posture of Red Packets on Base, covering sanctions screening, fund traceability, identity verification, anti-money laundering controls, data handling, and jurisdictional considerations. It is intended for compliance officers, legal reviewers, and regulatory assessors.

---

## 1. OFAC Sanctioned Country Blocking

### 1.1 Mechanism

Access from OFAC-sanctioned jurisdictions is blocked at the network edge using Next.js middleware deployed on Vercel's edge network. The middleware inspects the `x-vercel-ip-country` header, which Vercel automatically populates from the client's IP address geolocation before the request reaches any application code.

### 1.2 Blocked Jurisdictions

| Country | ISO 3166-1 Code | Sanctions Program |
|---------|-----------------|-------------------|
| Cuba | CU | OFAC Cuba Sanctions |
| Iran | IR | OFAC Iran Sanctions |
| North Korea | KP | OFAC North Korea Sanctions |
| Syria | SY | OFAC Syria Sanctions |
| Russia | RU | OFAC Russia-related Sanctions / Executive Orders |

### 1.3 Implementation Details

- **Enforcement layer:** Edge middleware (`src/middleware.ts`). Runs before any page rendering or API processing.
- **Response for blocked users:** HTTP 403 with a static HTML page: "This service is not available in your region due to regulatory requirements." No application data, wallet connections, or contract interactions are possible.
- **Route coverage:** All routes are covered except `_next/static`, `_next/image`, `images`, `favicon.ico`, and `api/auth` (OAuth callback routes must remain accessible to complete authentication flows initiated before geo-check).
- **Development behavior:** In local development (no `x-vercel-ip-country` header present), the middleware passes all requests through. This is intentional and does not affect production enforcement.
- **Update process:** The blocked country list is maintained as a `Set` in `src/middleware.ts`. Adding or removing a country requires a code change and deployment.

### 1.4 Known Limitations

- **VPN/proxy bypass:** IP-based geolocation can be circumvented by users employing VPNs, proxies, or Tor exit nodes in non-sanctioned countries. This is a known limitation of all IP-based geo-blocking systems.
- **Vercel dependency:** The `x-vercel-ip-country` header is specific to Vercel's infrastructure. Deployments on other platforms would require an alternative geolocation provider (e.g., Cloudflare `CF-IPCountry`, MaxMind GeoIP).
- **No secondary verification:** There is no additional sanctions screening (e.g., SDN list matching against wallet addresses or names). The system relies solely on IP geolocation.

---

## 2. Fund Traceability

### 2.1 Not a Mixer

Red Packets on Base is explicitly **not** a mixing service. Every movement of funds is fully traceable on-chain with clear provenance linking creators to claimers.

### 2.2 On-Chain Event Trail

Every fund movement emits an indexed event on the Base blockchain, creating a permanent, publicly auditable record:

| Event | Parameters | Provenance |
|-------|-----------|------------|
| `PacketCreated(packetId, creator, amount, totalClaims, isRandom, expiry)` | Creator's wallet address, deposit amount, packet configuration | Links deposited funds to the creator |
| `PacketClaimed(packetId, claimer, amount, claimIndex)` | Claimer's wallet address, exact amount received, sequential claim index | Links withdrawn funds to the claimer, associated with a specific packet and creator |
| `PacketRefunded(packetId, creator, amount)` | Creator's wallet address, refunded amount | Links returned funds back to the original creator |

### 2.3 Fund Isolation

Funds are isolated per packet. Each packet has its own `remainingAmount` balance. There is no pooling, commingling, or shared balance across packets. A claimer receives USDC directly from the contract, and the transfer amount is recorded both on-chain (in the event log and `claimAmounts` mapping) and in the application database.

### 2.4 Complete Audit Trail

For any given claim, the following chain of custody can be reconstructed:

1. **Creator deposits:** `PacketCreated` event links creator wallet to deposited USDC amount.
2. **Claimer receives:** `PacketClaimed` event links claimer wallet to received USDC amount, tied to a specific `packetId`.
3. **Creator-claimer link:** The shared `packetId` in both events establishes a direct relationship between the funding source (creator) and the recipient (claimer).
4. **Identity layer:** The off-chain database associates the creator's Twitter identity (handle, user ID) with the creator wallet, and the claimer's Twitter identity with the claimer wallet.
5. **Unclaimed funds returned:** `PacketRefunded` event confirms remaining funds returned to the original creator.

At no point can funds "disappear" or have their origin obscured. The USDC token itself provides an additional layer of traceability via standard ERC-20 `Transfer` events.

---

## 3. KYC / Identity Layer

### 3.1 Current Implementation: Twitter OAuth

The application uses Twitter (X) OAuth 2.0 as its identity verification layer. This is not a formal KYC process but provides a meaningful identity signal:

| Data Point | How Obtained | Purpose |
|-----------|--------------|---------|
| Twitter User ID | OAuth 2.0 token exchange | Unique, immutable identifier for deduplication |
| Twitter Handle | OAuth profile data | Display name, human-readable identity |
| Account Creation Date | Twitter API v2 user lookup | Anti-bot check (minimum 30 days old) |
| Follower Count | Twitter API v2 user lookup | Anti-bot check (minimum 10 followers) |
| Profile Avatar URL | OAuth profile data | OG image generation, UI display |

### 3.2 Identity Assurance Level

Twitter OAuth provides a low-to-moderate assurance identity layer:

- **Positive:** Ties claims to established social media accounts with real-world reputation. Account age and follower thresholds filter out throwaway accounts.
- **Limitation:** Twitter accounts do not constitute verified legal identity. Users can operate pseudonymously. Twitter does not perform government ID verification on standard accounts.
- **Suitability:** Appropriate for a promotional/gifting application with per-packet caps of $2,000 USDC. Not suitable as a sole KYC measure for high-value financial services.

### 3.3 Future Enhancement: Coinbase Onchain Attestations

The architecture supports integration with Coinbase's onchain attestation system via the Ethereum Attestation Service (EAS). This would provide a higher assurance identity layer:

- Coinbase verifies user identity through a formal KYC process (government ID, liveness check).
- Onchain attestations (e.g., "account verified," "country of residence") are issued as EAS attestations on Base.
- The smart contract or claim route could require a valid Coinbase attestation as an additional claim prerequisite.
- This enhancement is architecturally compatible but not currently implemented.

---

## 4. Anti-Money Laundering Controls

### 4.1 Value Limits

Hardcoded limits at the smart contract level constrain the economic scale of activity:

| Control | Limit | Enforcement |
|---------|-------|-------------|
| Maximum deposit per packet | $2,000 USDC | `require(amount <= MAX_DEPOSIT)` in contract |
| Maximum claims per packet | 200 | `require(totalClaims <= 200)` in contract |
| Minimum per-claim amount | $0.01 USDC | `require(amount / totalClaims >= MIN_PER_CLAIM)` in contract |
| Maximum packet lifetime | 24 hours | `require(expiry <= block.timestamp + 1 days)` in contract |

These limits are enforced at the contract level and cannot be bypassed by the application, the backend, or the contract owner. Changing these limits requires deploying a new contract.

### 4.2 Rate Limiting

| Control | Limit | Enforcement |
|---------|-------|-------------|
| Claims per Twitter account per 24 hours | 10 | Database query in `checkRateLimit()`, enforced before signature generation |

This limits the maximum value a single identity can extract across all packets in a 24-hour period to approximately $20,000 USDC (10 claims x $2,000 maximum packets), though in practice the average claim amount would be much lower.

### 4.3 Creator Withdrawal

Creators can withdraw unclaimed funds at any time by calling `refund()` on the contract. This function:

- Is restricted to the packet creator (`require(msg.sender == packet.creator)`).
- Returns all remaining funds to the creator's original wallet.
- Marks the packet as `refunded = true`, preventing further claims.
- Is not gated by expiry -- the creator does not need to wait for the packet to expire.
- Emits a `PacketRefunded` event for audit trail purposes.

This design ensures creators maintain full control over their deposited funds and are never locked out.

### 4.4 No Anonymity Features

The system does not implement:

- Mixing or tumbling of funds
- Privacy-preserving transfers (e.g., Tornado Cash-style commitments)
- Shielded pools or zero-knowledge fund flows
- Cross-chain bridging or token swaps
- Withdrawal to addresses other than the claimer's connected wallet

---

## 5. Data Inventory

### 5.1 On-Chain Data (Public, Permanent, Immutable)

The following data is stored on the Base blockchain and is publicly accessible by anyone:

| Data | Storage | Visibility |
|------|---------|------------|
| Creator wallet address | `packets[packetId].creator` | Public |
| Deposit amount | `packets[packetId].totalAmount` | Public |
| Remaining balance | `packets[packetId].remainingAmount` | Public |
| Claim configuration (count, random, expiry) | `packets[packetId].*` | Public |
| Claimer wallet addresses | `hasClaimed[packetId][address]` mapping, `PacketClaimed` events | Public |
| Claim amounts | `claimAmounts[packetId][claimIndex]`, `PacketClaimed` events | Public |
| Twitter user ID hashes | `twitterClaimed[keccak256(packetId, twitterUserId)]` | Public (hashed, not reversible without known input) |
| Used nonces | `usedNonces[nonce]` | Public |
| Refund status and amounts | `packets[packetId].refunded`, `PacketRefunded` events | Public |

**Note:** On-chain data cannot be deleted or modified after it is written. This is an inherent property of blockchain systems.

### 5.2 Database Data (Private, Server-Side)

The following data is stored in a Neon PostgreSQL database managed by the application:

| Table | Data Stored | Retention |
|-------|-------------|-----------|
| `packets` | UUID, on-chain packet ID, creator wallet address, creator Twitter ID, creator Twitter handle, creator Twitter avatar URL, creation transaction hash, timestamp | Indefinite |
| `claims` | UUID, on-chain packet ID, claimer wallet address, claimer Twitter ID, claimer Twitter handle, nonce, EIP-712 signature, claim amount (USDC), claim transaction hash, timestamp | Indefinite |
| `rate_limits` | UUID, Twitter user ID, claim timestamp | Indefinite (only the most recent 24 hours are queried) |

**Access control:** The database is accessed only by the Next.js backend via the Neon serverless driver. There is no admin panel, direct SQL access interface, or data export API exposed to users.

### 5.3 Session Data (Temporary, Server-Side)

The following data exists in the user's NextAuth.js session:

| Data | Source | Lifetime |
|------|--------|----------|
| Twitter User ID | OAuth token exchange | Session duration (browser session) |
| Twitter Handle | OAuth profile data | Session duration |
| Twitter Avatar URL | OAuth profile data | Session duration |
| Account Creation Date | Twitter API v2 | Session duration |
| Follower Count | Twitter API v2 | Session duration |

Session data is encrypted and stored in an HTTP-only cookie. It is not persisted to the database and expires when the browser session ends or the session token expires.

---

## 6. Privacy and GDPR Considerations

### 6.1 Personal Data Processing

The application processes the following categories of personal data:

| Category | Examples | Legal Basis (GDPR) | Purpose |
|----------|----------|-------------------|---------|
| Social media identifiers | Twitter user ID, handle, avatar URL | Legitimate interest / consent (OAuth grant) | Identity verification, anti-bot, UI display |
| Blockchain addresses | Ethereum/Base wallet addresses | Legitimate interest | Fund transfer, on-chain deduplication |
| IP-derived geolocation | Country code (via Vercel header) | Legal obligation (sanctions compliance) | OFAC sanctions screening |
| Transaction data | Transaction hashes, claim amounts | Contract performance | Service delivery, audit trail |

### 6.2 Data Minimization

- No government-issued ID is collected.
- No email addresses are collected.
- No phone numbers are collected.
- No physical addresses are collected.
- No financial account details (bank accounts, credit cards) are collected.
- Twitter profile data is limited to publicly available information (handle, avatar, follower count, account creation date).

### 6.3 Data Sharing

- **No personal data is sold to third parties.**
- **No personal data is shared with advertisers or data brokers.**
- On-chain data (wallet addresses, transaction amounts) is inherently public on the Base blockchain and accessible by any blockchain explorer, indexer, or node operator.
- Twitter profile data is obtained from Twitter's API and is subject to Twitter's Terms of Service.

### 6.4 Data Subject Rights

For users subject to GDPR or similar privacy regulations:

| Right | Applicability |
|-------|--------------|
| Right of access | Database records can be retrieved by Twitter user ID or wallet address. |
| Right to erasure | Database records (off-chain) can be deleted. On-chain data cannot be erased due to blockchain immutability. This is a known limitation of blockchain-based systems. |
| Right to rectification | Twitter profile data is refreshed from Twitter's API on each OAuth session. |
| Right to data portability | Data can be exported in structured format upon request. |
| Right to object | Users can choose not to use the service. No mandatory data processing occurs without user-initiated action. |

### 6.5 Blockchain Immutability Disclosure

Users should be informed that:

- Wallet addresses and transaction amounts are permanently recorded on a public blockchain.
- This data cannot be deleted, modified, or made private after a transaction is confirmed.
- While wallet addresses are pseudonymous, they may be linked to real-world identities through blockchain analysis, exchange KYC records, or other means.

---

## 7. Regulatory Considerations by Jurisdiction

### 7.1 United States

- **FinCEN:** The application facilitates peer-to-peer USDC transfers. It does not custody funds beyond the smart contract's temporary holding period (maximum 24 hours). The contract is non-custodial in the sense that only the creator can deposit and only verified claimers or the creator can withdraw.
- **OFAC:** Sanctioned country blocking is implemented (see Section 1). SDN list screening against wallet addresses is not currently implemented.
- **State money transmitter laws:** The application does not convert between currencies, does not hold funds in omnibus accounts, and does not provide fiat on/off ramps. Legal analysis of whether smart contract-based USDC distribution constitutes money transmission should be conducted on a state-by-state basis.
- **Securities laws:** USDC is a regulated stablecoin issued by Circle. Red packets distribute existing USDC and do not create, issue, or promote any token or security.

### 7.2 European Union

- **MiCA (Markets in Crypto-Assets Regulation):** The application distributes USDC, which is classified as an e-money token under MiCA. The application itself does not issue or redeem USDC. Compliance obligations may apply depending on whether the service is classified as a crypto-asset service provider.
- **GDPR:** See Section 6. The primary concern is blockchain immutability conflicting with the right to erasure. Off-chain data can be deleted; on-chain data cannot.
- **5AMLD / 6AMLD (Anti-Money Laundering Directives):** Value limits ($2,000 per packet) and identity verification (Twitter OAuth) provide baseline controls. Formal KYC may be required depending on classification.

### 7.3 United Kingdom

- **FCA:** Crypto asset promotions must comply with the Financial Promotions regime. The service is promotional in nature (Lunar New Year gifting) and distributes a regulated stablecoin (USDC).
- **MLR 2017 (Money Laundering Regulations):** Similar considerations to EU AML directives. The application's value limits and identity layer provide baseline controls.

### 7.4 Asia-Pacific

- **Singapore (MAS):** The Payment Services Act may apply if the service is deemed to provide a digital payment token service. The $2,000 per-packet cap is well below typical regulatory thresholds.
- **Hong Kong (SFC/HKMA):** Stablecoin regulation is evolving. USDC distribution may fall under the proposed stablecoin regulatory framework.
- **Japan (FSA):** Crypto asset exchange and transfer services are regulated. The service does not operate as an exchange.

### 7.5 General Considerations

- The application operates as a smart contract-based gifting mechanism. It does not provide custody, exchange, lending, or staking services.
- The maximum value per packet ($2,000 USDC) and maximum lifetime (24 hours) are intentionally conservative to reduce regulatory surface area.
- The transparent on-chain audit trail and identity layer (Twitter OAuth) distinguish this service from privacy-focused or anonymizing protocols.
- Legal review by qualified counsel in each target jurisdiction is recommended before launch.

---

## 8. Summary of Controls

| Control Category | Implementation | Enforcement Layer |
|-----------------|----------------|-------------------|
| Sanctions screening | IP-based country blocking (CU, IR, KP, SY, RU) | Edge middleware |
| Identity verification | Twitter OAuth 2.0 (account age >= 30 days, followers >= 10) | Application server |
| Anti-bot | Fail-closed profile checks, rate limiting (10/24h) | Application server |
| Anti-sybil | On-chain wallet + Twitter dedup, DB uniqueness constraint | Smart contract + DB |
| Value limits | $2,000/packet, 200 claims/packet, 24h max expiry | Smart contract |
| Fund traceability | On-chain events linking creator to claimer per packet | Smart contract |
| Data minimization | No government ID, email, phone, or physical address collected | Application design |
| Creator control | Immediate withdrawal of unclaimed funds at any time | Smart contract |
| Emergency halt | `pause()` stops all new deposits and claims | Smart contract |
| Audit trail | Immutable on-chain events + off-chain database records | Smart contract + DB |
