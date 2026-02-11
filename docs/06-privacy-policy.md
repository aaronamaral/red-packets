# Privacy Policy

**DRAFT -- Requires Legal Review**

> **Notice:** This document is an internal draft prepared by the engineering team. It has NOT been reviewed or approved by legal counsel or a data protection officer. It must undergo formal legal and privacy review before publication. Do not publish or distribute this document in its current form.

**Last Updated:** [DATE]

---

## 1. Introduction

This Privacy Policy describes how [ENTITY NAME] ("we," "us," or "our") collects, uses, stores, and discloses personal information in connection with the Red Packets on Base service ("Service"). By using the Service, you consent to the practices described in this policy.

This policy applies to all users of the Service, including creators and claimers of red packets.

## 2. Data We Collect

### 2.1 Data Collected via Twitter/X OAuth

When you authenticate with the Service through Twitter/X, we receive and store the following data from the Twitter/X API:

| Data Field | Purpose | Stored |
|---|---|---|
| Twitter User ID | Unique identifier for claim deduplication and rate limiting | Yes (database) |
| Twitter Username (handle) | Display on red packet cards, OG images, and claim records | Yes (database) |
| Profile Image URL | Display on red packet cards and OG image generation | Yes (database) |
| Account Creation Date | Anti-bot verification (minimum 30-day account age requirement) | Session only |
| Public Follower Count | Anti-bot verification (minimum 10 followers requirement) | Session only |

Account creation date and follower count are used during the claim verification process and are held in the server-side session (NextAuth JWT token) only. They are not persisted to the database.

### 2.2 Wallet and Transaction Data

When you interact with the Service through your cryptocurrency wallet, we collect:

| Data Field | Purpose | Stored |
|---|---|---|
| Wallet Address (public key) | Identifying the creator or claimer of a red packet | Yes (database) |
| Transaction Hashes | Recording on-chain transaction references for creation, claims, and refunds | Yes (database) |
| Claim Amounts | Recording the USDC amount received per claim (verified on-chain) | Yes (database) |

Wallet addresses are stored in lowercase-normalized form. We never collect, store, or have access to private keys or seed phrases.

### 2.3 Anti-Bot and Rate Limiting Data

To prevent abuse, we maintain:

| Data Field | Purpose | Retention |
|---|---|---|
| Twitter User ID + Timestamp (rate_limits table) | Enforcing maximum 10 claims per Twitter account per 24-hour rolling window | Indefinite (should be periodically pruned) |
| Packet ID + Twitter User ID (claims table, UNIQUE constraint) | Preventing the same Twitter account from claiming the same packet twice | Indefinite |
| EIP-712 Nonce | Preventing signature replay attacks | Stored on-chain (permanent) |

### 2.4 Data We Do NOT Collect

- Private keys or wallet seed phrases.
- Passwords (authentication is delegated to Twitter/X OAuth).
- IP addresses (not logged by the application; may be logged by hosting infrastructure).
- Device fingerprints or hardware identifiers.
- Location data beyond the country-level geo-blocking performed at the edge (see Section 5.4).
- Browsing history or tracking cookies beyond session management.

## 3. How We Use Your Data

We use the collected data exclusively for the following purposes:

- **Service Operation:** Enabling the creation, claiming, and refunding of red packets.
- **Anti-Bot Verification:** Validating that claimers meet minimum account age and follower thresholds.
- **Claim Deduplication:** Preventing the same Twitter account or wallet from claiming a red packet more than once.
- **Rate Limiting:** Enforcing a maximum of 10 claims per Twitter account per 24-hour period.
- **OG Image Generation:** Rendering dynamic Open Graph preview images that display the creator's Twitter handle and profile picture on shared links.
- **Packet Management:** Enabling creators to view their created packets, track claim counts, and initiate refunds.
- **On-Chain Verification:** Confirming that claim transactions were successfully executed on the Base blockchain and recording the verified claim amount.

We do NOT use your data for:

- Advertising or ad targeting.
- Selling or renting to third parties.
- Profiling or behavioral analysis beyond anti-bot checks.
- Training machine learning models.

## 4. Data Storage

### 4.1 Database (Off-Chain)

Off-chain data is stored in a Neon Postgres database hosted in the United States. The database contains three tables:

- **packets:** Stores metadata for each created red packet, including the creator's Twitter handle, Twitter user ID, avatar URL, wallet address, and creation transaction hash.
- **claims:** Stores claim records including the claimer's Twitter handle, Twitter user ID, wallet address, claim amount (once confirmed on-chain), and claim transaction hash.
- **rate_limits:** Stores timestamps of claims per Twitter user ID for rate limiting enforcement.

Database connections use TLS encryption in transit. Access is restricted to the application server via connection string credentials stored as environment variables.

### 4.2 Blockchain (On-Chain)

The following data is recorded on the Base blockchain via the RedPacket smart contract:

- Creator wallet address.
- Deposit amounts and claim amounts (in USDC).
- Claimer wallet addresses.
- Hashed Twitter User IDs (stored as `keccak256(packetId, twitterUserId)` in the `twitterClaimed` mapping).
- Nonces used for claim signatures.
- Packet parameters (amount, claim count, expiry, split type).

**On-chain data is permanent and publicly visible.** Blockchain data cannot be modified or deleted after confirmation. This is an inherent property of public blockchains and is outside our control.

### 4.3 Session Data

NextAuth.js session data (including Twitter user ID, handle, follower count, and account creation date) is stored in a signed JWT cookie on the client. Session tokens are signed with the `AUTH_SECRET` environment variable. Session data is not persisted server-side beyond the lifetime of the JWT.

## 5. Third-Party Services

The Service integrates with the following third-party services, each of which has its own privacy policy:

### 5.1 Twitter/X (OAuth Provider)

- **Data Shared:** OAuth authorization code (exchanged for access token).
- **Data Received:** User ID, username, profile image URL, account creation date, public follower count.
- **Purpose:** Authentication and anti-bot verification.
- **Privacy Policy:** [https://twitter.com/en/privacy](https://twitter.com/en/privacy)

### 5.2 Base Blockchain (Coinbase)

- **Data Recorded:** Wallet addresses, transaction amounts, claim records (permanent, public).
- **Purpose:** Smart contract execution for deposits, claims, and refunds.
- **Privacy Policy:** [https://www.coinbase.com/legal/privacy](https://www.coinbase.com/legal/privacy)

### 5.3 Vercel (Hosting Provider)

- **Data Processed:** HTTP requests, including IP addresses (at the edge for geo-blocking via the `x-vercel-ip-country` header).
- **Purpose:** Application hosting, edge middleware execution, serverless function runtime.
- **Privacy Policy:** [https://vercel.com/legal/privacy-policy](https://vercel.com/legal/privacy-policy)

### 5.4 Neon (Database Provider)

- **Data Stored:** All off-chain application data (see Section 4.1).
- **Purpose:** Persistent data storage for packet metadata, claim records, and rate limiting.
- **Data Location:** United States.
- **Privacy Policy:** [https://neon.tech/privacy-policy](https://neon.tech/privacy-policy)

### 5.5 Geo-Blocking

The Service uses Vercel's `x-vercel-ip-country` edge header to determine the country associated with incoming requests. This is used solely to block access from OFAC-sanctioned jurisdictions (Cuba, Iran, North Korea, Syria, Russia). The country code is not stored or logged by the application.

## 6. Cookies

The Service uses the following cookies:

| Cookie | Purpose | Type | Duration |
|---|---|---|---|
| `next-auth.session-token` | Maintains authenticated session state | Functional (required) | Session / configurable expiry |
| `next-auth.csrf-token` | Protects against cross-site request forgery | Security (required) | Session |
| `next-auth.callback-url` | Stores OAuth callback redirect URL | Functional (required) | Session |

The Service does NOT use:

- Analytics or tracking cookies.
- Advertising cookies.
- Third-party cookies beyond those required for Twitter/X OAuth.

## 7. Data Retention

| Data Type | Retention Period |
|---|---|
| Packet metadata (database) | Indefinite (required for ongoing packet management and refund capability) |
| Claim records (database) | Indefinite (required for deduplication and audit trail) |
| Rate limit entries (database) | Indefinite; should be periodically pruned to entries within the last 24 hours |
| Session data (JWT cookie) | Until session expiry or browser cookie deletion |
| On-chain data (blockchain) | Permanent and immutable |

[NOTE FOR LEGAL REVIEW: Specific retention periods and automated deletion schedules should be defined in accordance with applicable data protection regulations (GDPR, CCPA, etc.).]

## 8. User Rights

Depending on your jurisdiction, you may have the following rights regarding your personal data:

- **Right of Access:** Request a copy of the personal data we hold about you.
- **Right of Rectification:** Request correction of inaccurate personal data.
- **Right of Erasure ("Right to be Forgotten"):** Request deletion of your personal data from our database. Note that on-chain data (blockchain) cannot be deleted or modified.
- **Right to Data Portability:** Request your data in a structured, machine-readable format.
- **Right to Object:** Object to the processing of your personal data for specific purposes.
- **Right to Restrict Processing:** Request that we limit how we use your data.
- **Right to Withdraw Consent:** Withdraw your consent to data processing at any time (this does not affect the lawfulness of processing performed prior to withdrawal).

To exercise any of these rights, contact us at [CONTACT EMAIL]. We will respond to verifiable requests within 30 days (or such other period as required by applicable law).

**Important Limitation:** Data recorded on the Base blockchain is permanent and publicly accessible. We cannot modify, delete, or restrict access to on-chain data. This includes wallet addresses, transaction amounts, hashed Twitter user identifiers, and other data written to the smart contract. If you exercise a right to erasure, we can delete your data from our database, but on-chain records will persist.

## 9. Data Security

We implement the following security measures to protect your data:

- TLS encryption for all data in transit (HTTPS).
- Encrypted database connections (TLS to Neon Postgres).
- Environment variable storage for sensitive credentials (database connection strings, signer private keys, OAuth secrets).
- NextAuth JWT signing with a cryptographic secret.
- Atomic database operations to prevent race conditions in claim processing.
- Input validation and parameterized queries to prevent SQL injection.
- Edge middleware for geo-blocking (no sensitive data exposed in blocked responses).

Despite these measures, no system is completely secure. We cannot guarantee absolute security of your data.

## 10. International Data Transfers

The Service is hosted on Vercel's global edge network, with serverless functions and database storage in the United States. If you access the Service from outside the United States, your data may be transferred to and processed in the United States. By using the Service, you consent to such transfers.

[NOTE FOR LEGAL REVIEW: If the Service processes data of EU/EEA residents, appropriate safeguards for international data transfers (e.g., Standard Contractual Clauses) must be documented.]

## 11. Children's Privacy

The Service is not intended for individuals under the age of 18. We do not knowingly collect personal information from children under 18. If we become aware that we have collected personal information from a child under 18, we will take steps to delete that information promptly.

If you are a parent or guardian and believe that your child has provided us with personal information, please contact us at [CONTACT EMAIL].

## 12. Changes to This Policy

We may update this Privacy Policy from time to time. If we make material changes, we will provide notice through the Service or by other means. Your continued use of the Service after such notice constitutes acceptance of the updated policy.

The "Last Updated" date at the top of this document indicates when the policy was most recently revised.

## 13. Contact Information

For questions, concerns, or requests regarding this Privacy Policy or your personal data, please contact:

- **Email:** [CONTACT EMAIL]
- **Entity:** [ENTITY NAME]
- **Data Protection Officer:** [DPO NAME/EMAIL, if applicable]
- **Address:** [PHYSICAL ADDRESS]

---

> **DRAFT NOTICE:** This document is a preliminary draft and has not been reviewed by legal counsel or a data protection officer. Placeholders marked with [BRACKETS] must be completed before publication. Key areas requiring review include: GDPR compliance and lawful basis for processing, CCPA compliance (including "Do Not Sell" provisions), international data transfer mechanisms, specific retention periods, cookie consent requirements by jurisdiction, DPO appointment requirements, and Data Protection Impact Assessment (DPIA) necessity.
