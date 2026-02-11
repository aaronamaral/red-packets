# Technical Architecture

## System Diagram

```
                           +----------------------------------------------+
                           |          Frontend (Next.js 15 on Vercel)      |
                           |                                              |
                           |  /            Landing page                   |
                           |  /create      Packet creation form           |
                           |  /claim/[uuid] Claim flow (13 states)       |
                           |  /my-packets  Creator dashboard              |
                           |                                              |
                           |  +------------------------------------------+|
                           |  | Wagmi v2 + Viem (wallet interactions)    ||
                           |  +---------------------+--------------------+|
                           +-------------------------+---------------------+
                                                     |
                    +--------------------------------+-------------------------------+
                    |                                |                               |
          +---------v---------+           +----------v----------+         +----------v-----------+
          |    Twitter/X      |           |     Neon Postgres    |         |    Base Blockchain    |
          |                   |           |                      |         |                       |
          | - OAuth 2.0       |           |  Tables:             |         |  RedPacket.sol        |
          |   (NextAuth v5)   |           |  - packets           |         |  - createPacket()     |
          | - Profile data    |           |  - claims            |         |  - claim()            |
          |   (account age,   |           |  - rate_limits       |         |  - refund()           |
          |    followers)     |           |                      |         |                       |
          | - Bearer token    |           |  UUID -> packet_id   |         |  USDC (ERC-20)        |
          |   (anti-bot)      |           |  mapping             |         |  EIP-712 verification |
          +-------------------+           +----------------------+         +-----------------------+

                                                     |
                                            +--------v--------+
                                            | Edge Middleware  |
                                            | (Geo-blocking)   |
                                            | OFAC sanctions   |
                                            +-----------------+
```

**Request flow summary:**

1. The frontend communicates with Next.js API routes (server-side).
2. API routes query Neon Postgres for UUID resolution, claim records, and rate limits.
3. API routes query the Base blockchain (via Viem public client) for onchain packet state.
4. API routes use the Twitter Bearer Token to validate user profiles for anti-bot checks.
5. Wallet transactions (create, claim, refund) go directly from the user's browser to the Base blockchain via Wagmi/Viem.
6. Vercel edge middleware intercepts all requests to enforce geo-blocking before any route handler executes.

---

## Tech Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Framework | Next.js | 15.5 | App Router, API routes, edge runtime |
| UI Library | React | 19.2 | Component rendering |
| Language | TypeScript | 5.x | Type safety across frontend and API |
| Styling | Tailwind CSS | 3.4 | Utility-first CSS |
| Animation | Framer Motion | 12.34 | Page transitions, entrance animations |
| Wallet | Wagmi | 2.19 (v2) | React hooks for wallet connection, contract reads/writes |
| Blockchain Client | Viem | 2.45 | Low-level EVM interactions, ABI encoding, public client |
| Onchain UI | OnchainKit | 1.1 | Provider wrapper for Base chain configuration |
| Auth | NextAuth.js | 5.0.0-beta.30 (v5) | Twitter OAuth 2.0, JWT sessions |
| Database | Neon Postgres | @neondatabase/serverless 1.0 | Serverless Postgres (HTTP driver) |
| Query Cache | TanStack React Query | 5.90 | Client-side data fetching and caching |
| Smart Contract | Solidity | 0.8.24 | RedPacket contract with EIP-712 |
| Contract Toolchain | Foundry | (forge, anvil) | Compilation, testing (56 tests), deployment |
| OpenZeppelin | Contracts | (EIP712, ReentrancyGuard) | Audited base contracts |
| Deployment | Vercel | Edge + Serverless | Frontend hosting, API routes, edge middleware |
| CSS Utilities | clsx + tailwind-merge | 2.1 / 3.4 | Conditional class merging |

**Notable constraints:**
- Wagmi is pinned to v2 (not v3) for OnchainKit provider compatibility.
- OnchainKit CSS is excluded due to a PostCSS conflict with Tailwind.
- Wallet UI uses a custom wrapper around plain Wagmi hooks, not OnchainKit wallet components.

---

## UUID Routing

Claim URLs use a database-generated UUID (`/claim/[uuid]`), **not** the sequential onchain packet ID. This is a deliberate security decision.

**Why:**
- Onchain packet IDs are auto-incrementing integers (`nextPacketId` counter). If claim URLs used these IDs, an attacker could enumerate all packets by trying `/claim/0`, `/claim/1`, `/claim/2`, etc.
- UUIDs (v4) are 128-bit random identifiers with 2^122 bits of entropy, making enumeration infeasible.
- The sequential onchain `packet_id` is used only internally -- it is never exposed in URLs, share links, or public API responses.

**Resolution path:**
```
Claim URL: /claim/abc123-def456-...
    |
    v
API route extracts UUID from URL path
    |
    v
SELECT packet_id FROM packets WHERE id = 'abc123-def456-...'
    |
    v
Use packet_id (integer) for all onchain contract calls
```

---

## Data Flow Diagrams

### Create Flow

```
User (Browser)                   API Route                    Blockchain              Database
     |                              |                             |                      |
     |-- Approve USDC (wallet) ---->|                             |                      |
     |                              |                         [ERC-20 approve]           |
     |                              |                             |                      |
     |-- createPacket (wallet) ---->|                             |                      |
     |                              |                    [createPacket()]                 |
     |                              |                    [emit PacketCreated]             |
     |                              |                             |                      |
     |<-- tx receipt + events ------|                             |                      |
     |                              |                             |                      |
     |-- POST /api/packets -------->|                             |                      |
     |   { packetId, address,       |                             |                      |
     |     txHash }                 |                             |                      |
     |                              |-- INSERT packets --------------------------------->|
     |                              |<-- RETURNING id (UUID) ----------------------------|
     |<-- { packetId, uuid } -------|                             |                      |
     |                              |                             |                      |
     |  [Render share card          |                             |                      |
     |   with UUID-based link]      |                             |                      |
```

### Claim Flow

```
User (Browser)                   API Route                    Blockchain              Database
     |                              |                             |                      |
     |-- GET /api/packets/[uuid] -->|                             |                      |
     |                              |-- SELECT packet_id -------------------------------->|
     |                              |-- readContract(packets) --->|                      |
     |                              |<-- onchain state -----------|                      |
     |<-- packet info --------------|                             |                      |
     |                              |                             |                      |
     |-- POST /claim { address } -->|                             |                      |
     |                              |-- SELECT packet_id -------------------------------->|
     |                              |-- readContract(packets) --->|                      |
     |                              |   [verify: exists, not expired, not full]          |
     |                              |-- runAntiBotChecks -------------------------------->|
     |                              |   [account age, followers, duplicate, rate limit]  |
     |                              |-- INSERT claims (atomic) -------------------------->|
     |                              |   ON CONFLICT DO NOTHING                            |
     |                              |   RETURNING id                                     |
     |                              |-- INSERT rate_limits ------------------------------>|
     |                              |-- signClaim (EIP-712) --|                          |
     |<-- { signature, nonce } -----|                         |                          |
     |                              |                             |                      |
     |-- claim(packetId, twitter,   |                             |                      |
     |    nonce, sig) (wallet) ---->|                         [claim()]                  |
     |                              |                    [verify EIP-712 sig]             |
     |                              |                    [check hasClaimed]               |
     |                              |                    [check twitterClaimed]           |
     |                              |                    [calculate amount]               |
     |                              |                    [transfer USDC]                  |
     |                              |                    [emit PacketClaimed]             |
     |<-- tx receipt + events ------|                             |                      |
     |                              |                             |                      |
     |-- POST /confirm { txHash } ->|                             |                      |
     |                              |-- getTransactionReceipt --->|                      |
     |                              |   [verify status, parse event, read amount]        |
     |                              |-- UPDATE claims (amount, tx_hash) ----------------->|
     |<-- { amount } ---------------|                             |                      |
```

### Refund Flow

```
User (Browser)                   API Route                    Blockchain
     |                              |                             |
     |-- refund(packetId) --------->|                             |
     |   (wallet tx)                |                         [refund()]
     |                              |                    [verify: creator, not refunded]
     |                              |                    [set refunded = true]
     |                              |                    [transfer remaining USDC]
     |                              |                    [emit PacketRefunded]
     |<-- tx receipt + event -------|                             |
```

---

## API Routes

| Route | Method | Auth Required | Purpose |
|-------|--------|---------------|---------|
| `/api/auth/[...nextauth]` | GET, POST | No | Twitter OAuth 2.0 handler (sign-in, callback, session, CSRF) |
| `/api/packets` | GET | Yes (session) | Fetch the authenticated user's created and claimed packets |
| `/api/packets` | POST | Yes (session) | Store packet metadata after onchain creation (packetId, address, txHash) |
| `/api/packets/[id]` | GET | No | Public packet info: creator handle/avatar, total amount, claim progress, expiry, split type. Does not expose individual claim records. |
| `/api/packets/[id]/claim` | POST | Yes (session) | Anti-bot validation, atomic claim slot reservation, EIP-712 signature generation. Returns `{ signature, nonce, twitterUserId }`. |
| `/api/packets/[id]/confirm` | POST | Yes (session) | Verify claim transaction on-chain (receipt status, event logs), record claimed amount and tx hash in Postgres. |
| `/api/og/[packetId]` | GET | No | Dynamic OG image generation (edge runtime). Composites creator's Twitter PFP and handle onto a 1200x675 Figma-designed template. |

**Note:** All `[id]` parameters in API routes are UUIDs, not onchain integer IDs. UUID-to-packetId resolution happens inside each route handler via a Postgres lookup.

**Auth details:** Authentication is handled by NextAuth.js v5 with JWT strategy. The Twitter OAuth 2.0 flow requests `users.read`, `tweet.read`, and `offline.access` scopes. Profile data (`created_at`, `public_metrics.followers_count`, `profile_image_url`) is fetched from the Twitter v2 Users API and stored in the JWT for anti-bot checks.

---

## Database Schema

The application uses three tables in Neon Postgres, connected via the `@neondatabase/serverless` HTTP driver.

### `packets`

Stores metadata for each created red packet. The `id` (UUID) is the primary key used in claim URLs.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, auto-generated | Unguessable identifier used in claim URLs |
| `packet_id` | INTEGER | UNIQUE, NOT NULL | Onchain sequential ID (internal only) |
| `creator_address` | TEXT | NOT NULL | Creator's wallet address |
| `creator_twitter_id` | TEXT | NOT NULL | Creator's Twitter user ID |
| `creator_twitter_handle` | TEXT | NOT NULL | Creator's Twitter handle (for display) |
| `creator_twitter_avatar` | TEXT | nullable | Creator's Twitter profile image URL |
| `tx_hash` | TEXT | NOT NULL | Creation transaction hash |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Row creation timestamp |

### `claims`

Records each claim attempt. A row is inserted atomically before the EIP-712 signature is generated to prevent race conditions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, auto-generated | Claim record identifier |
| `packet_id` | INTEGER | NOT NULL | Onchain packet ID (FK to packets.packet_id) |
| `claimer_address` | TEXT | NOT NULL | Claimer's wallet address (stored lowercase) |
| `claimer_twitter_id` | TEXT | NOT NULL | Claimer's Twitter user ID |
| `claimer_twitter_handle` | TEXT | NOT NULL | Claimer's Twitter handle |
| `nonce` | TEXT | UNIQUE, NOT NULL | 256-bit random nonce for EIP-712 signature |
| `signature` | TEXT | NOT NULL | EIP-712 signature ('pending' until signed) |
| `amount` | TEXT | nullable | USDC amount claimed (filled by /confirm) |
| `tx_hash` | TEXT | nullable | Claim transaction hash (filled by /confirm) |
| `claimed_at` | TIMESTAMPTZ | DEFAULT NOW() | Row creation timestamp |

**Unique constraint:** `UNIQUE(packet_id, claimer_twitter_id)` -- prevents the same Twitter user from claiming the same packet twice at the database level, independent of onchain checks.

### `rate_limits`

Tracks claim frequency per Twitter account for rate limiting.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, auto-generated | Row identifier |
| `twitter_user_id` | TEXT | NOT NULL | Twitter user ID |
| `claimed_at` | TIMESTAMPTZ | DEFAULT NOW() | Timestamp of the claim |

**Index:** `(twitter_user_id, claimed_at)` -- enables efficient lookups for the 24-hour sliding window rate limit query.

---

## Smart Contract Summary

**Contract:** `RedPacket.sol` (Solidity 0.8.24)
**Deployed:** Base Sepolia at `0x1329B01e6fa433dB925426521d473131179c5738`
**Inheritance:** OpenZeppelin `EIP712` + `ReentrancyGuard`
**Test coverage:** 56 Foundry tests covering all functions, edge cases, and invariants

| Function | Access | Description |
|----------|--------|-------------|
| `createPacket(amount, totalClaims, isRandom, expiry)` | Public, whenNotPaused | Deposit USDC, create packet |
| `claim(packetId, twitterUserId, nonce, signature)` | Public, whenNotPaused | Verify EIP-712 sig, transfer USDC share |
| `refund(packetId)` | Creator only | Withdraw unclaimed USDC, block future claims |
| `pause()` / `unpause()` | Owner only | Emergency kill switch (refund still allowed) |
| `setSigner(address)` | Owner only | Rotate backend signer key |
| `transferOwnership(address)` | Owner only | Initiate two-step ownership transfer |
| `acceptOwnership()` | Pending owner only | Complete ownership transfer |

**Limits:** $2,000 max deposit, 200 max claims, 24h max expiry, $0.01 min per claim.

**Fund traceability:** Every dollar is fully traceable on-chain via `PacketCreated`, `PacketClaimed`, and `PacketRefunded` events. The contract is not a mixer. Funds are isolated per packet with a full audit trail -- no commingling, no anonymity set.

For the complete contract specification, see [`contracts/README.md`](../contracts/README.md).

---

## EIP-712 Signature Flow

The claim authorization uses EIP-712 typed structured data signing. The backend holds the signer private key and issues signatures only after anti-bot checks pass. The smart contract verifies signatures before releasing funds.

### Detailed 6-Step Flow

**Step 1 -- Frontend requests a claim signature:**

The frontend sends `POST /api/packets/[uuid]/claim` with the claimer's wallet address. This request requires an active NextAuth session (Twitter OAuth).

**Step 2 -- Backend validates and prepares:**

The API route performs the following checks in order:

1. Verify the user has a valid Twitter session (`session.user.twitterId`).
2. Resolve the UUID to an onchain `packet_id` via Postgres.
3. Read onchain state via Viem public client: verify the packet exists (creator is not the zero address), is not refunded, is not expired, and is not fully claimed.
4. Run anti-bot checks: account age (30+ days), follower count (10+), duplicate check (Postgres), rate limit (10/24h).
5. Perform atomic claim slot reservation: `INSERT INTO claims ... ON CONFLICT (packet_id, claimer_twitter_id) DO NOTHING RETURNING id`. If the INSERT returns zero rows, a concurrent request already claimed this slot -- reject.
6. Insert a rate limit record: `INSERT INTO rate_limits (twitter_user_id)`.

**Step 3 -- Backend signs the EIP-712 message:**

Using Viem's `signTypedData`, the backend signs the following EIP-712 structure:

```
Domain:
  name: "RedPacket"
  version: "1"
  chainId: 84532 (Sepolia) or 8453 (mainnet)
  verifyingContract: <contract address>

Types:
  Claim(uint256 packetId, address claimer, string twitterUserId, uint256 nonce)

Message:
  packetId: <onchain integer ID>
  claimer: <wallet address>
  twitterUserId: <Twitter user ID string>
  nonce: <256-bit cryptographically random value>
```

The nonce is generated using `crypto.getRandomValues(new Uint8Array(32))`, converted to a BigInt. The signature is stored in the `claims` table (replacing the initial `'pending'` value).

The API returns `{ signature, nonce, twitterUserId }` to the frontend.

**Step 4 -- Frontend submits the claim transaction:**

The frontend calls `claim(packetId, twitterUserId, nonce, signature)` on the RedPacket contract via Wagmi's `writeContract`. The user approves the transaction in their wallet.

**Step 5 -- Contract verifies and distributes:**

The smart contract performs these checks:

1. Recover the signer address from the EIP-712 signature using OpenZeppelin's `_hashTypedDataV4` + `ECDSA.recover`.
2. Verify the recovered address matches the contract's `signer` state variable.
3. Check `hasClaimed[packetId][msg.sender]` is false (wallet-level dedup).
4. Check `twitterClaimed[keccak256(packetId, twitterUserId)]` is false (Twitter-level dedup).
5. Mark `usedNonces[nonce] = true` (prevents signature replay).
6. Calculate the claim amount (equal or random split).
7. Transfer USDC to the claimer via `SafeERC20.safeTransfer`.
8. Emit `PacketClaimed(packetId, claimer, amount, claimIndex)`.

**Step 6 -- Frontend confirms on-chain:**

After the transaction is mined:

1. The frontend parses the `PacketClaimed` event from the transaction receipt to extract the claimed amount.
2. The frontend sends `POST /api/packets/[uuid]/confirm` with the transaction hash.
3. The backend fetches the transaction receipt via Viem, verifies `receipt.status === "success"`, verifies the `to` address is the RedPacket contract, decodes the `PacketClaimed` event from the logs, and extracts the amount.
4. The backend updates the claim record in Postgres with the verified amount and transaction hash.
5. The response `{ amount }` is returned to the frontend for display.

### Security Properties

| Property | Mechanism |
|----------|-----------|
| No replay | `usedNonces` mapping -- each nonce can only be used once |
| No transfer | Signature binds to a specific `claimer` address -- cannot be used by another wallet |
| No cross-chain replay | EIP-712 domain includes `chainId` and `verifyingContract` |
| No sybil (wallet) | `hasClaimed` mapping per wallet address |
| No sybil (Twitter) | `twitterClaimed` mapping per Twitter user ID |
| No race condition | Atomic DB INSERT before signature generation |
| Key rotation | `setSigner()` invalidates all previous signatures immediately |

---

## OG Image Generation

Dynamic Open Graph images provide rich link previews when packets are shared on Twitter/X.

### Pipeline

```
1. Template: /public/images/card-template.png
   - Dimensions: 1200 x 675 pixels
   - Designed in Figma with Coinbase/Base branding, red envelope imagery
   - Includes a placeholder circle for the creator's avatar
   - Includes a placeholder position for the creator's handle

2. API Route: /api/og/[uuid]
   - Runtime: Edge (next/og ImageResponse)
   - Fetches creator's Twitter handle and avatar URL from Postgres
   - Upgrades avatar URL from _normal to _400x400 resolution

3. Compositing:
   - Base layer: Template PNG (full 1200x675)
   - Avatar layer: Creator's Twitter PFP
     - Size: 310x310 pixels, circular (borderRadius: 50%)
     - Position: centered at (772, 338) on the template
   - Handle layer: Creator's Twitter handle
     - Font: 36px sans-serif, white
     - Position: (277, 365) on the template

4. Output: 1200 x 675 PNG
   - Served as the og:image and twitter:image meta tag
   - Twitter card type: summary_large_image
```

### Meta Tag Integration

The claim page layout (`/claim/[packetId]/layout.tsx`) uses Next.js `generateMetadata` to set:

```html
<meta property="og:image" content="https://domain.com/api/og/[uuid]" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="675" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:image" content="https://domain.com/api/og/[uuid]" />
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH_SECRET` | Yes | NextAuth.js secret (generate with `npx auth secret`) |
| `AUTH_TWITTER_ID` | Yes | Twitter OAuth 2.0 Client ID |
| `AUTH_TWITTER_SECRET` | Yes | Twitter OAuth 2.0 Client Secret |
| `AUTH_URL` | Yes | Application URL (must match running port, e.g., `http://localhost:3002`) |
| `TWITTER_BEARER_TOKEN` | Yes | Twitter API v2 bearer token (used for profile lookups in anti-bot) |
| `DATABASE_URL` | Yes | Neon Postgres connection string |
| `SIGNER_PRIVATE_KEY` | Yes | EIP-712 signer private key (hex string, no `0x` prefix) |
| `NEXT_PUBLIC_RED_PACKET_CONTRACT` | Yes | Deployed RedPacket contract address |
| `NEXT_PUBLIC_USDC_ADDRESS` | Yes | USDC token contract address on Base |
| `NEXT_PUBLIC_CHAIN_ID` | Yes | `84532` (Base Sepolia) or `8453` (Base mainnet) |
| `NEXT_PUBLIC_BASE_RPC_URL` | Yes | Base RPC endpoint (Alchemy/QuickNode recommended for production) |
| `NEXT_PUBLIC_ONCHAINKIT_API_KEY` | Optional | Coinbase Developer Platform API key (OnchainKit provider) |

**Security notes:**
- `SIGNER_PRIVATE_KEY` must not be the contract deployer key.
- `AUTH_URL` must match the Twitter OAuth callback URL configured in the Twitter Developer Portal.
- `NEXT_PUBLIC_*` variables are exposed to the browser. All others are server-only.

---

## Frontend Component Tree

```
Providers
  SessionProvider (NextAuth -- Twitter OAuth session)
    WagmiProvider (wallet connection, chain config)
      QueryClientProvider (TanStack React Query)
        OnchainKitProvider (Base chain, CDP API key)
          Layout (Geist fonts, dark theme, global CSS)
            |
            +-- Landing Page (/)
            |     +-- Header
            |     |     +-- Logo ("Red Packets")
            |     |     +-- Link to /my-packets
            |     |     +-- TwitterSignIn (sign-in / sign-out button)
            |     |     +-- WalletWrapper (connect / disconnect wallet)
            |     +-- Hero Section
            |     |     +-- Title ("Red Packets")
            |     |     +-- Subtitle ("Share blessings on Base")
            |     |     +-- Description
            |     +-- How It Works (4 gold-gradient cards)
            |     |     +-- Step 1: Create
            |     |     +-- Step 2: Share
            |     |     +-- Step 3: Open
            |     |     +-- Step 4: Pass it on
            |     +-- PacketCard (mode="demo")
            |     +-- Lanterns (10 CSS lanterns, 4 shapes, varied sizes)
            |     +-- Fire Horse (PNG with CSS mask gold tint + glow pulse)
            |     +-- Footer ("Powered by Base")
            |
            +-- Create Page (/create)
            |     +-- Auth gate (requires Twitter session)
            |     +-- Wallet gate (requires connected wallet)
            |     +-- Form
            |     |     +-- Amount input (USDC)
            |     |     +-- Recipients input (1-200)
            |     |     +-- Split type selector (equal / random)
            |     |     +-- Expiry selector (1h, 6h, 12h, 24h)
            |     +-- StepIndicator (approve -> create -> finalize)
            |     +-- Success state
            |           +-- PacketCard (mode="preview")
            |           +-- ShareCta (save image, share on X, copy link)
            |
            +-- Claim Page (/claim/[uuid])
            |     +-- 13 states:
            |     |     loading, sealed, auth_required, connecting_wallet,
            |     |     ready, claiming, opening, revealed,
            |     |     already_claimed, expired, fully_claimed, auth_failed, error
            |     +-- PacketCard (mode="claim")
            |     +-- ClaimResult
            |     |     +-- Count-up animation (dollar amount)
            |     |     +-- Confetti effect
            |     +-- ShareCta (save image, share on X, copy link)
            |
            +-- My Packets Page (/my-packets)
                  +-- PacketCard grid (mode="preview", 4 columns)
                  +-- Per-packet status
                  |     +-- Claimed count / total (progress bar)
                  |     +-- Expiry status
                  +-- Share buttons (X + copy link)
                  +-- Withdraw button (gold, shows remaining USDC amount)
```

### Key Component Responsibilities

| Component | File | Purpose |
|-----------|------|---------|
| `Providers` | `src/app/providers.tsx` | Wraps app in SessionProvider, WagmiProvider, QueryClientProvider, OnchainKitProvider |
| `PacketCard` | `src/components/red-packet/packet-card.tsx` | Renders red packet card in demo, claim, or preview mode. Displays Coinbase logo. |
| `ClaimResult` | `src/components/red-packet/claim-result.tsx` | Animated USDC amount reveal with confetti |
| `ShareCta` | `src/components/red-packet/share-cta.tsx` | Save image, share on X, copy link actions |
| `PacketStatus` | `src/components/red-packet/packet-status.tsx` | Claim progress and status display |
| `WalletWrapper` | `src/components/wallet/wallet-wrapper.tsx` | Custom wallet connect/disconnect using plain Wagmi hooks |
| `TwitterSignIn` | `src/components/auth/twitter-sign-in.tsx` | Twitter OAuth sign-in/sign-out button |

### Key Hooks

| Hook | File | Purpose |
|------|------|---------|
| `useRedPacket` | `src/hooks/use-red-packet.ts` | Reads packet state from the smart contract |
| `useClaimPacket` | `src/hooks/use-claim-packet.ts` | Orchestrates the claim flow with chain switching |
| `useCreatePacket` | `src/hooks/use-create-packet.ts` | Orchestrates the create flow: approve -> create -> store metadata |

---

## Security Threat Model

| Threat | Mitigation |
|--------|-----------|
| Bot claiming | Twitter OAuth + account age (30d) + follower count (10+), fail-closed |
| Packet enumeration | UUID-based URLs; sequential onchain IDs never exposed in URLs or public API |
| Double claim (same wallet) | `hasClaimed` onchain mapping |
| Double claim (same Twitter, different wallets) | `twitterClaimed` onchain mapping + DB UNIQUE constraint |
| Race condition double-claim | Atomic `INSERT ... ON CONFLICT DO NOTHING RETURNING id` before signature |
| Signature replay | Global `usedNonces` mapping + 256-bit random nonces |
| Cross-chain replay | EIP-712 domain includes `chainId` + `verifyingContract` |
| Signer key compromise | `pause()` halts claims, `setSigner()` rotates key |
| Division by zero (random split) | Guards: `range == 0`, `minAmount == 0`, `average < 5` fallbacks |
| Zero-amount claims | `require(claimAmount > 0)` + minimum enforced |
| Ownership loss | Two-step transfer: `transferOwnership()` + `acceptOwnership()` |
| Reentrancy | `nonReentrant` modifier on all fund-moving functions + CEI pattern |
| API data exposure | Public endpoints return aggregate data only; no individual claim records |
| Claim amount spoofing | `/confirm` endpoint verifies tx hash on-chain, reads amount from event logs |
| Reverted tx ghost data | Receipt status checked before DB write; `PacketCreated` event required |
| Sanctioned country access | Edge middleware geo-blocks CU, IR, KP, SY, RU via Vercel `x-vercel-ip-country` |
