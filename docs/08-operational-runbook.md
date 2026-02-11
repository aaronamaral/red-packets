# Operational Runbook

**Red Packets on Base -- Production Operations**

**Prepared:** [DATE]
**Classification:** Internal -- Engineering

---

## Table of Contents

1. [Production Deployment](#1-production-deployment)
2. [Signer Key Rotation](#2-signer-key-rotation)
3. [Emergency Pause](#3-emergency-pause)
4. [Sanctions Country List Management](#4-sanctions-country-list-management)
5. [Anti-Bot Threshold Updates](#5-anti-bot-threshold-updates)
6. [Database Maintenance](#6-database-maintenance)
7. [Monitoring](#7-monitoring)
8. [Credential Rotation Schedule](#8-credential-rotation-schedule)
9. [Incident Response Procedures](#9-incident-response-procedures)

---

## 1. Production Deployment

### 1.1 Smart Contract Deployment

**Prerequisites:**

- Foundry toolchain installed (`forge`, `cast`, `anvil`).
- Deployer wallet funded with ETH on Base mainnet (for gas).
- Signer wallet address generated (separate from deployer).
- USDC contract address for Base mainnet: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.

**Procedure:**

```bash
# 1. Navigate to the contracts directory
cd contracts

# 2. Install dependencies
forge install OpenZeppelin/openzeppelin-contracts --no-git

# 3. Set environment variables
export USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
export SIGNER_ADDRESS=<signer-public-address>
export PRIVATE_KEY=<deployer-private-key>
export BASE_RPC_URL=https://mainnet.base.org  # or paid RPC endpoint

# 4. Run tests one final time
forge test -v

# 5. Deploy to Base mainnet
forge script script/Deploy.s.sol:DeployRedPacket \
  --rpc-url $BASE_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key <basescan-api-key>

# 6. Record the deployed contract address from output
# "RedPacket deployed at: 0x..."

# 7. Verify on Basescan
# Visit https://basescan.org/address/<contract-address>#code
# Confirm source code is verified and matches

# 8. Verify contract state
cast call <contract-address> "owner()" --rpc-url $BASE_RPC_URL
cast call <contract-address> "signer()" --rpc-url $BASE_RPC_URL
cast call <contract-address> "paused()" --rpc-url $BASE_RPC_URL
cast call <contract-address> "usdc()" --rpc-url $BASE_RPC_URL
```

### 1.2 Frontend Deployment

**Prerequisites:**

- Vercel account with project configured.
- All environment variables set in Vercel dashboard.
- Twitter OAuth callback URL updated to production domain.

**Environment Variables to Update for Production:**

```
NEXT_PUBLIC_CHAIN_ID=8453
NEXT_PUBLIC_USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
NEXT_PUBLIC_RED_PACKET_CONTRACT=<mainnet-contract-address>
NEXT_PUBLIC_BASE_RPC_URL=<paid-rpc-endpoint>
NEXT_PUBLIC_ONCHAINKIT_API_KEY=<coinbase-developer-platform-key>
AUTH_URL=https://<production-domain>
AUTH_SECRET=<new-production-secret>
AUTH_TWITTER_ID=<twitter-oauth-client-id>
AUTH_TWITTER_SECRET=<twitter-oauth-client-secret>
SIGNER_PRIVATE_KEY=<signer-private-key-hex-no-0x-prefix>
DATABASE_URL=<neon-postgres-connection-string>
```

**Procedure:**

```bash
# 1. Verify build succeeds locally
npm run build

# 2. Deploy via Vercel CLI or Git push
vercel --prod
# or: git push origin main  (if auto-deploy is configured)

# 3. Post-deployment verification
# a. Visit https://<production-domain> and verify landing page loads
# b. Sign in with Twitter/X and verify OAuth callback works
# c. Connect wallet and verify chain is Base mainnet (8453)
# d. Create a test packet with minimal amount ($0.10, 1 claim)
# e. Share link and open in incognito -- verify OG image renders
# f. Claim the test packet from a different Twitter account
# g. Verify claim amount on Basescan
# h. Refund any remaining test packet balance
# i. Run Twitter Card Validator on a share URL

# 4. Verify geo-blocking
# Test from a VPN exit in a sanctioned country to confirm 403 response
```

### 1.3 Post-Deployment Checklist

- [ ] Contract deployed and verified on Basescan.
- [ ] Contract `owner()` returns the expected deployer address.
- [ ] Contract `signer()` returns the expected signer address.
- [ ] Contract `paused()` returns `false`.
- [ ] Contract `usdc()` returns `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.
- [ ] Frontend loads on production domain.
- [ ] Twitter OAuth sign-in works.
- [ ] Wallet connection works (Coinbase Wallet and MetaMask).
- [ ] Test packet created, claimed, and refunded successfully.
- [ ] OG images render with correct template, PFP, and handle.
- [ ] Geo-blocking returns 403 for sanctioned countries.
- [ ] All environment variables are production values (not testnet).
- [ ] `SIGNER_PRIVATE_KEY` is NOT the deployer key.
- [ ] Database tables exist (`packets`, `claims`, `rate_limits`).

---

## 2. Signer Key Rotation

**When to Rotate:**

- Suspected key compromise.
- Scheduled rotation per credential rotation schedule.
- Personnel change (operator with key access leaves the team).

**Impact:**

- Any unsigned claims in progress will complete normally (signatures are generated per-request).
- Signatures issued before rotation remain valid (nonces are consumed on-chain).
- No in-flight claims will be disrupted.

**Procedure:**

```bash
# 1. Generate a new signer keypair
# Option A: Using cast (Foundry)
cast wallet new
# Output: Address: 0x<new-signer-address>
#         Private Key: 0x<new-private-key>

# Option B: Using Node.js
node -e "
const { generatePrivateKey, privateKeyToAccount } = require('viem/accounts');
const key = generatePrivateKey();
const account = privateKeyToAccount(key);
console.log('Address:', account.address);
console.log('Private Key:', key);
"

# 2. Call setSigner() on the contract from the owner wallet
cast send <contract-address> \
  "setSigner(address)" \
  <new-signer-address> \
  --private-key <owner-private-key> \
  --rpc-url <rpc-url>

# 3. Verify the on-chain signer was updated
cast call <contract-address> "signer()" --rpc-url <rpc-url>
# Should return: <new-signer-address>

# 4. Update the Vercel environment variable
# In Vercel Dashboard: Settings > Environment Variables
# Update SIGNER_PRIVATE_KEY to the new key (hex, no 0x prefix)

# 5. Redeploy the frontend to pick up the new environment variable
vercel --prod

# 6. Verify the new signer works
# Create a claim request and verify the backend signs successfully
# Check logs for any signature verification errors

# 7. Securely delete the old private key
# Remove from password manager, secure notes, etc.
```

**Rollback:**

If the new signer key is incorrect or lost before the environment variable is updated:

```bash
# Re-set to the old signer address (if still known)
cast send <contract-address> \
  "setSigner(address)" \
  <old-signer-address> \
  --private-key <owner-private-key> \
  --rpc-url <rpc-url>
```

---

## 3. Emergency Pause

### 3.1 Activating Pause

**When to Pause:**

- Suspected signer key compromise.
- Smart contract vulnerability discovered.
- Ongoing exploit or fund drain.
- Regulatory order to cease operations.

**What Pause Blocks:**

- `createPacket()` -- No new packets can be created.
- `claim()` -- No claims can be submitted.

**What Pause Does NOT Block:**

- `refund()` -- Creators can still withdraw their remaining funds.
- `setSigner()` -- Owner can still rotate the signer.
- `transferOwnership()` / `acceptOwnership()` -- Ownership transfer still works.
- `unpause()` -- Owner can re-enable operations.
- API read endpoints (`GET /api/packets/[id]`) -- Packet info remains queryable.

**Procedure:**

```bash
# 1. Pause the contract (requires owner private key)
cast send <contract-address> \
  "pause()" \
  --private-key <owner-private-key> \
  --rpc-url <rpc-url>

# 2. Verify the contract is paused
cast call <contract-address> "paused()" --rpc-url <rpc-url>
# Should return: true

# 3. Notify stakeholders
# - Post status update on project communication channels
# - If public-facing: update the frontend to display a maintenance message

# 4. Investigate the triggering incident (see Section 9)
```

### 3.2 Unpausing

**Prerequisites:**

- Root cause of the incident has been identified and resolved.
- If signer key was compromised: key has been rotated (Section 2).
- If contract bug was found: impact has been fully assessed and mitigated.
- Decision to unpause has been approved by [APPROVAL AUTHORITY].

**Procedure:**

```bash
# 1. Unpause the contract
cast send <contract-address> \
  "unpause()" \
  --private-key <owner-private-key> \
  --rpc-url <rpc-url>

# 2. Verify
cast call <contract-address> "paused()" --rpc-url <rpc-url>
# Should return: false

# 3. Test: create a small packet, claim it, refund it

# 4. Notify stakeholders that operations have resumed
```

---

## 4. Sanctions Country List Management

### 4.1 Adding a Sanctioned Country

**File:** `/Users/aaron/Documents/Vibecode/red-packets/src/middleware.ts`

**Procedure:**

1. Identify the ISO 3166-1 alpha-2 country code for the country to add.
2. Edit the `BLOCKED_COUNTRIES` set in `middleware.ts`:

```typescript
const BLOCKED_COUNTRIES = new Set([
  "CU", // Cuba
  "IR", // Iran
  "KP", // North Korea
  "SY", // Syria
  "RU", // Russia
  "XX", // <New Country> -- add with comment
]);
```

3. Test locally by manually setting the `x-vercel-ip-country` header:

```bash
curl -H "x-vercel-ip-country: XX" http://localhost:3000/
# Should return 403 with "Access Restricted" HTML
```

4. Deploy to production.
5. Verify by testing from a VPN exit in the added country (or by header manipulation in a preview deployment).

### 4.2 Removing a Sanctioned Country

Follow the same procedure as above, but remove the country code from the `BLOCKED_COUNTRIES` set. Ensure removal is authorized by compliance counsel before deploying.

### 4.3 Current Blocked Countries

| Code | Country | Sanctions Basis |
|---|---|---|
| CU | Cuba | OFAC (comprehensive) |
| IR | Iran | OFAC (comprehensive) |
| KP | North Korea | OFAC (comprehensive) |
| SY | Syria | OFAC (comprehensive) |
| RU | Russia | OFAC (comprehensive) |

**Review Cadence:** Review the sanctions list quarterly, or immediately upon the issuance of new OFAC directives or changes to applicable sanctions programs.

---

## 5. Anti-Bot Threshold Updates

### 5.1 Configuration

**File:** `/Users/aaron/Documents/Vibecode/red-packets/src/lib/constants.ts`

```typescript
export const ANTIBOT = {
  MIN_ACCOUNT_AGE_DAYS: 30,
  MIN_FOLLOWERS: 10,
  MAX_CLAIMS_PER_DAY: 10,
} as const;
```

### 5.2 Adjusting Thresholds

| Parameter | Current Value | Effect of Increase | Effect of Decrease |
|---|---|---|---|
| `MIN_ACCOUNT_AGE_DAYS` | 30 | More restrictive; blocks newer legitimate accounts | Less restrictive; allows newer bot accounts |
| `MIN_FOLLOWERS` | 10 | More restrictive; blocks low-engagement accounts | Less restrictive; allows more bot accounts |
| `MAX_CLAIMS_PER_DAY` | 10 | No change needed (already conservative) | Limits legitimate power users |

**Procedure:**

1. Edit the `ANTIBOT` object in `constants.ts`.
2. No contract redeployment required (anti-bot logic is off-chain).
3. Deploy the frontend update to Vercel.
4. Changes take effect immediately for all new claim requests.
5. Existing sessions are not affected until they make a new claim request.

### 5.3 Anti-Bot Check Behavior

All checks are **fail-closed**: if profile data is missing, unparseable, or unavailable, the claim is rejected. This is implemented in `/Users/aaron/Documents/Vibecode/red-packets/src/lib/antibot.ts`.

Check order:
1. Profile data presence check.
2. Account age check (`checkAccountAge`).
3. Follower count check (`checkFollowerCount`).
4. Duplicate claim check (`checkDuplicate` -- database query).
5. Rate limit check (`checkRateLimit` -- database query).

---

## 6. Database Maintenance

### 6.1 Connection

```bash
# Connect using psql (requires DATABASE_URL)
psql $DATABASE_URL

# Or use the Neon console: https://console.neon.tech
```

### 6.2 Rate Limit Table Cleanup

The `rate_limits` table accumulates entries over time. Only entries from the last 24 hours are functionally relevant. Periodic cleanup reduces storage costs and query times.

```sql
-- Preview: count stale entries
SELECT COUNT(*) FROM rate_limits
WHERE claimed_at < NOW() - INTERVAL '7 days';

-- Delete entries older than 7 days (preserves a buffer beyond the 24-hour window)
DELETE FROM rate_limits
WHERE claimed_at < NOW() - INTERVAL '7 days';

-- Verify
SELECT COUNT(*) FROM rate_limits;
```

**Recommended Cadence:** Weekly, or set up a scheduled cron job.

### 6.3 Claim Count Verification

Verify that off-chain claim counts match on-chain state:

```sql
-- Count claims per packet in the database
SELECT packet_id, COUNT(*) as db_claim_count
FROM claims
GROUP BY packet_id
ORDER BY packet_id;
```

```bash
# Compare with on-chain claimed count for a specific packet
cast call <contract-address> "packets(uint256)" <packet-id> --rpc-url <rpc-url>
# The 5th return value (uint16 claimedCount) should match the DB count
```

### 6.4 Checking for Orphaned Records

```sql
-- Claims with no corresponding packet metadata
SELECT c.packet_id, c.claimer_twitter_handle, c.claimed_at
FROM claims c
LEFT JOIN packets p ON c.packet_id = p.packet_id
WHERE p.id IS NULL;

-- Claims without confirmed amounts (signature issued but no on-chain confirmation)
SELECT packet_id, claimer_twitter_handle, nonce, claimed_at
FROM claims
WHERE amount IS NULL AND tx_hash IS NULL
ORDER BY claimed_at DESC
LIMIT 50;
```

### 6.5 Database Schema Reference

```sql
-- Packets table
CREATE TABLE IF NOT EXISTS packets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_id INTEGER UNIQUE NOT NULL,
  creator_address TEXT NOT NULL,
  creator_twitter_id TEXT NOT NULL,
  creator_twitter_handle TEXT NOT NULL,
  creator_twitter_avatar TEXT,
  tx_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Claims table
CREATE TABLE IF NOT EXISTS claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_id INTEGER NOT NULL,
  claimer_address TEXT NOT NULL,
  claimer_twitter_id TEXT NOT NULL,
  claimer_twitter_handle TEXT NOT NULL,
  nonce TEXT UNIQUE NOT NULL,
  signature TEXT NOT NULL,
  amount TEXT,
  tx_hash TEXT,
  claimed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(packet_id, claimer_twitter_id)
);

-- Rate limits table
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  twitter_user_id TEXT NOT NULL,
  claimed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup
ON rate_limits (twitter_user_id, claimed_at);
```

---

## 7. Monitoring

### 7.1 What to Watch

| Metric | Source | Alert Threshold | Check Method |
|---|---|---|---|
| **Contract USDC Balance** | Basescan / RPC | Sudden decrease >50% in 1 hour | `cast call <usdc-address> "balanceOf(address)" <contract-address>` |
| **Claim Rate** | Database | >100 claims in 10 minutes | `SELECT COUNT(*) FROM claims WHERE claimed_at > NOW() - INTERVAL '10 minutes'` |
| **Error Rate (API)** | Vercel Logs | >5% error responses | Vercel Dashboard > Logs > filter by 4xx/5xx |
| **Signature Issuance Rate** | Database | >50 signatures in 10 minutes | `SELECT COUNT(*) FROM claims WHERE signature != 'pending' AND claimed_at > NOW() - INTERVAL '10 minutes'` |
| **Failed Claims (no confirmation)** | Database | >20 unconfirmed claims in 1 hour | `SELECT COUNT(*) FROM claims WHERE amount IS NULL AND claimed_at > NOW() - INTERVAL '1 hour'` |
| **Database Connectivity** | Application | Any connection failure | Health check endpoint |
| **Twitter OAuth Failures** | Vercel Logs | >10 OAuth errors in 10 minutes | Log search for auth error patterns |
| **RPC Errors** | Vercel Logs | >5 RPC failures in 5 minutes | Log search for `readContract` errors |
| **Contract Paused State** | RPC | Unexpected pause | `cast call <contract-address> "paused()"` |
| **Signer Address Change** | Basescan Events | Any `SignerUpdated` event | Basescan event log or RPC log filter |

### 7.2 Recommended Monitoring Stack

For production, consider:

- **Vercel Analytics:** Built-in request metrics and error rates.
- **Basescan Alerts:** Email notifications for contract events and balance changes.
- **Uptime Monitoring:** External ping service (e.g., UptimeRobot, Pagerduty) on the production URL and health check endpoint.
- **Custom Dashboard:** Query the database for claim volume, active packets, and TVL metrics.
- **Log Aggregation:** Forward Vercel function logs to Datadog, Grafana Cloud, or a similar platform for search and alerting.

### 7.3 Useful Cast Commands for Spot Checks

```bash
# Check contract USDC balance
cast call <usdc-address> "balanceOf(address)" <contract-address> --rpc-url <rpc-url>

# Check total packets created
cast call <contract-address> "nextPacketId()" --rpc-url <rpc-url>

# Check a specific packet's state
cast call <contract-address> "packets(uint256)" <packet-id> --rpc-url <rpc-url>

# Check if contract is paused
cast call <contract-address> "paused()" --rpc-url <rpc-url>

# Check current signer
cast call <contract-address> "signer()" --rpc-url <rpc-url>

# Check current owner
cast call <contract-address> "owner()" --rpc-url <rpc-url>
```

---

## 8. Credential Rotation Schedule

| Credential | Storage Location | Rotation Cadence | Procedure |
|---|---|---|---|
| `SIGNER_PRIVATE_KEY` | Vercel env var | Every 90 days, or on suspected compromise | Section 2 |
| `AUTH_SECRET` (NextAuth) | Vercel env var | Every 180 days | Generate new secret (`npx auth secret`), update env, redeploy. Active sessions will be invalidated. |
| `AUTH_TWITTER_ID` / `AUTH_TWITTER_SECRET` | Vercel env var | Only on compromise or app regeneration | Regenerate in Twitter Developer Portal, update env, redeploy. |
| `DATABASE_URL` | Vercel env var | Every 180 days | Rotate Neon credentials in Neon console, update env, redeploy. |
| `NEXT_PUBLIC_ONCHAINKIT_API_KEY` | Vercel env var | Every 180 days | Regenerate in Coinbase Developer Platform, update env, redeploy. |
| Contract Owner Private Key | Offline / hardware wallet | Never rotated (use `transferOwnership` instead) | Section 9.1 |

**Best Practice:** All credential rotations should be logged in an internal change management system with the date, operator, and reason for rotation.

---

## 9. Incident Response Procedures

### 9.1 Signer Key Compromised

**Indicators:**

- Unauthorized claim transactions appearing on-chain.
- Claims succeeding without corresponding database records.
- Reports of users receiving funds from packets they did not create.

**Response:**

1. **Immediately pause the contract** (Section 3.1).
2. **Rotate the signer key** (Section 2).
3. Assess the scope of damage:
   - Query the contract for all `PacketClaimed` events during the compromise window.
   - Compare with database claim records to identify unauthorized claims.
   - Calculate total funds drained.
4. Contact affected packet creators.
5. If the owner key is also suspected compromised:
   - Transfer ownership to a new address immediately.
   - If the attacker has already changed the owner, the contract may be irrecoverable. Communicate to all creators to refund their packets via direct contract interaction.
6. File an incident report with timeline, root cause, and remediation steps.
7. Unpause only after the root cause is fully resolved and verified.

### 9.2 Smart Contract Bug Discovered

**Indicators:**

- Unexpected contract behavior reported by users.
- Claim amounts incorrect or inconsistent.
- Internal testing reveals an edge case failure.
- External security researcher reports a vulnerability.

**Response:**

1. **Assess severity:**
   - Can it result in fund loss? If yes, **pause immediately**.
   - Can it result in incorrect claim amounts? If yes, **pause immediately**.
   - Is it a non-critical UX issue? If yes, document and schedule a fix.
2. If paused, notify users that operations are temporarily suspended.
3. Analyze the bug:
   - Write a Foundry test that reproduces the issue.
   - Determine affected packets and users.
4. Develop and test a fix:
   - Since the contract is not upgradeable, a fix requires deploying a new contract.
   - Existing packets remain in the old contract and must be refunded by creators.
5. Deploy the new contract (Section 1.1).
6. Update the frontend to point to the new contract address.
7. Communicate to creators of active packets in the old contract that they should refund.
8. File an incident report.

### 9.3 Database Breach

**Indicators:**

- Unauthorized access to the Neon Postgres instance.
- Data exfiltration detected.
- Unusual query patterns in database logs.

**Response:**

1. **Rotate the `DATABASE_URL` credential immediately** (Neon console > Connection Settings).
2. Update the Vercel environment variable and redeploy.
3. Assess the scope:
   - What data was accessed? (Twitter user IDs, wallet addresses, claim records)
   - Were any records modified or deleted?
4. If records were modified:
   - Cross-reference claim records with on-chain events to verify integrity.
   - On-chain deduplication (`hasClaimed`, `twitterClaimed`) remains intact and unaffected by a database breach.
5. Notify affected users in accordance with applicable data breach notification laws.
6. Review and strengthen database access controls:
   - Restrict IP allowlist in Neon.
   - Audit who has access to the `DATABASE_URL`.
7. File an incident report.

**Data Exposure Impact Assessment:**

| Data Type | Sensitivity | Impact if Exposed |
|---|---|---|
| Twitter User IDs | Low (public data) | Minimal; can be used to link Twitter accounts to wallet addresses |
| Twitter Handles | Low (public data) | Minimal |
| Wallet Addresses | Low (public on-chain) | Minimal; already publicly visible on-chain |
| Claim Amounts | Low (public on-chain) | Minimal |
| Transaction Hashes | Low (public on-chain) | Minimal |
| EIP-712 Signatures | Medium | Nonces are consumed on-chain; replayed signatures will fail |
| Twitter Avatar URLs | Low (public) | Minimal |

The most significant risk from a database breach is the ability to **correlate** Twitter identities with wallet addresses, which is not individually sensitive data but creates a linkage between pseudonymous blockchain activity and named social media accounts.

### 9.4 Incident Report Template

```
## Incident Report

**Date/Time Detected:** YYYY-MM-DD HH:MM UTC
**Date/Time Resolved:** YYYY-MM-DD HH:MM UTC
**Severity:** Critical / High / Medium / Low
**Reported By:** [Name]

### Summary
[One-paragraph description of the incident]

### Timeline
- HH:MM -- [Event]
- HH:MM -- [Event]

### Root Cause
[Technical explanation of what went wrong]

### Impact
- Users affected: [count]
- Funds affected: [amount]
- Duration of impact: [hours/minutes]

### Resolution
[Steps taken to resolve the incident]

### Preventive Measures
[Changes to prevent recurrence]

### Lessons Learned
[What worked well, what could be improved]
```

---

> **Document Maintenance:** This runbook should be reviewed and updated after every production deployment, credential rotation, or incident. All operators should be familiar with these procedures before being granted production access.
