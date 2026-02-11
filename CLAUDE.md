# CLAUDE.md — Red Packets on Base

## Project Overview

Lunar New Year-themed web app for sending USDC red packets on Base. Users create packets loaded with USDC, share links on Twitter/X, and recipients open their blessing. Twitter OAuth gates claims for anti-bot protection. Coinbase branded. Fire Horse (Year of the Horse 2026) visual theme.

## Tech Stack

- **Frontend:** Next.js 15, React 19, TypeScript, Tailwind CSS, Framer Motion
- **Wallet:** Wagmi v2 + viem (custom wallet wrapper, no OnchainKit wallet components)
- **Auth:** NextAuth.js v5 beta (Twitter OAuth 2.0)
- **Contract:** Solidity 0.8.24 (Foundry), deployed on Base Sepolia
- **Database:** Neon Postgres (@neondatabase/serverless)
- **Deploy:** Vercel

## Commands

```bash
npm install        # Install dependencies
npm run dev        # Dev server (uses next available port if 3000 is taken)
npm run build      # Production build
npm run lint       # ESLint
```

## Current Deployment

- **Contract:** `0x1329B01e6fa433dB925426521d473131179c5738` (Base Sepolia)
- **Signer:** `0xddc4b677c11300811bCF6e6dbb135360bb54e244`
- **USDC:** `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (Base Sepolia)
- **Chain ID:** 84532 (Base Sepolia)

## Project Structure

```
red-packets/
├── assets/
│   ├── Card template.png              # OG image template (1200x675)
│   ├── Coinbase_Wordmark_White.svg    # Coinbase logo
│   └── Social Post_X/                 # Fire horse halftone graphic
├── contracts/
│   ├── src/RedPacket.sol              # Smart contract
│   ├── script/Deploy.s.sol            # Deployment script
│   └── foundry.toml
├── public/images/
│   ├── card-template.png              # OG image template (served)
│   ├── coinbase-logo.svg              # Coinbase logo (served)
│   └── fire-horse-bg.png              # Fire horse background
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # Root layout with Providers
│   │   ├── page.tsx                   # Landing page (lanterns, horse, how-it-works)
│   │   ├── providers.tsx              # Wagmi + NextAuth + React Query + OnchainKit
│   │   ├── globals.css                # CNY theme (red/gold), horse glow, lantern glow
│   │   ├── create/page.tsx            # Create packet flow
│   │   ├── claim/[packetId]/
│   │   │   ├── page.tsx               # Claim flow (13 states)
│   │   │   └── layout.tsx             # Dynamic OG meta tags per packet
│   │   ├── my-packets/page.tsx        # Creator dashboard with refund
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts  # Twitter OAuth
│   │       ├── packets/route.ts             # GET: user's packets, POST: store metadata
│   │       ├── packets/[id]/route.ts        # GET: packet info (public)
│   │       ├── packets/[id]/claim/route.ts  # POST: anti-bot + EIP-712 sign
│   │       ├── packets/[id]/confirm/route.ts # POST: verify claim on-chain, record amount
│   │       └── og/[packetId]/route.tsx      # Dynamic OG image with template + pfp overlay
│   ├── components/
│   │   ├── ui/ (button, card, input)
│   │   ├── red-packet/ (packet-card, claim-result, share-cta, packet-status)
│   │   ├── wallet/ (wallet-wrapper)
│   │   └── auth/ (twitter-sign-in)
│   ├── hooks/
│   │   ├── use-red-packet.ts          # Read packet state from contract
│   │   ├── use-claim-packet.ts        # Claim flow with chain switching
│   │   └── use-create-packet.ts       # Create flow: approve → create → store
│   ├── lib/
│   │   ├── types.ts                   # TypeScript types
│   │   ├── constants.ts               # ABIs, addresses, limits, expiry options
│   │   ├── utils.ts                   # formatUSDC, share URLs, tweet text
│   │   ├── eip712.ts                  # Backend EIP-712 claim signing
│   │   ├── db.ts                      # Neon Postgres connection + schema
│   │   └── antibot.ts                 # Anti-bot validation (fail-closed)
│   └── auth.ts                        # NextAuth config with Twitter OAuth
└── CLAUDE.md
```

## Smart Contract

`contracts/src/RedPacket.sol` — audited, includes:

**Core functions:**
- `createPacket(amount, totalClaims, isRandom, expiry)` — deposit USDC, max $2000, max 200 claims, max 24h expiry
- `claim(packetId, twitterUserId, nonce, signature)` — EIP-712 verified, onchain Twitter dedup via `twitterClaimed` mapping
- `refund(packetId)` — creator can withdraw remaining at any time (no expiry wait)

**Security features:**
- `nonReentrant` on all state-changing functions
- `whenNotPaused` modifier on create/claim
- `pause()` / `unpause()` emergency controls
- Two-step ownership transfer (`transferOwnership` + `acceptOwnership`)
- Zero-address checks on constructor, `setSigner`, `transferOwnership`
- Onchain Twitter user dedup prevents same Twitter user claiming with different wallets
- Division-by-zero guards in random split calculation
- Minimum claim amount enforced (never returns 0)

**Random splits:** Deterministic pseudo-random bounded to 20-200% of average per claim. Falls back to equal split when average drops below 5 units.

## Anti-Bot System

All in `src/lib/antibot.ts`, enforced in `POST /api/packets/[id]/claim`:

- Twitter account age ≥ 30 days (fail-closed if data unavailable)
- Twitter follower count ≥ 10 (fail-closed if data unavailable)
- One claim per Twitter user ID per packet (atomic DB insert before signing)
- Max 10 claims per Twitter account per 24 hours
- Backend signs EIP-712 message — contract verifies before releasing funds
- Onchain `twitterClaimed` mapping as defense-in-depth

**Race condition protection:** Claim route does atomic `INSERT ... RETURNING id` before generating the signature. If a concurrent request already inserted for the same (packet_id, twitter_user_id), no signature is issued.

## API Routes

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/auth/[...nextauth]` | GET/POST | - | Twitter OAuth handler |
| `/api/packets` | GET | Yes | User's created packets |
| `/api/packets` | POST | Yes | Store packet metadata after onchain creation |
| `/api/packets/[id]` | GET | No | Public packet info (no claim details exposed) |
| `/api/packets/[id]/claim` | POST | Yes | Anti-bot checks → EIP-712 signature |
| `/api/packets/[id]/confirm` | POST | Yes | Verify claim tx on-chain, record amount in DB |
| `/api/og/[packetId]` | GET | No | Dynamic OG image (template + pfp overlay) |

## PacketCard Modes

The `PacketCard` component has three modes:
- `mode="demo"` — Landing page: "Create a Red Packet / Share a blessing"
- `mode="claim"` — Claim page: "from @handle / Tap to open"
- `mode="preview"` — My Packets page: "from @handle / Tap to preview"

## Environment Variables

```
AUTH_SECRET                        # npx auth secret
AUTH_TWITTER_ID                    # Twitter OAuth 2.0 Client ID
AUTH_TWITTER_SECRET                # Twitter OAuth 2.0 Client Secret
AUTH_URL=http://localhost:3002     # Must match running port
TWITTER_BEARER_TOKEN               # Twitter API v2 bearer token
NEXT_PUBLIC_ONCHAINKIT_API_KEY     # Coinbase Developer Platform (optional for testing)
DATABASE_URL                       # Neon Postgres connection string
SIGNER_PRIVATE_KEY                 # EIP-712 signer (hex, no 0x prefix)
NEXT_PUBLIC_RED_PACKET_CONTRACT    # Deployed contract address
NEXT_PUBLIC_USDC_ADDRESS           # USDC contract address
NEXT_PUBLIC_CHAIN_ID               # 84532 (Sepolia) or 8453 (mainnet)
NEXT_PUBLIC_BASE_RPC_URL           # Base RPC endpoint
```

## Key Architecture Decisions

- **Backend-signed claims**: Anti-bot logic lives offchain (tunable without redeploying) but fund release is onchain (trustless)
- **Custom wallet wrapper**: Replaced OnchainKit wallet components with plain wagmi hooks to avoid positioning/styling issues
- **Fail-closed anti-bot**: Missing Twitter profile data rejects claims rather than allowing them
- **Atomic claim locking**: DB insert happens before signature generation to prevent race condition double-claims
- **Onchain Twitter dedup**: `twitterClaimed` mapping prevents same Twitter user from claiming with multiple wallets
- **Creator withdrawal anytime**: No expiry wait for refunds — creator can pull remaining funds immediately
- **OG image template**: Designer-created PNG template with dynamic pfp + handle overlay via next/og
- **UUID claim URLs**: Claim URLs use the DB UUID (`/claim/[uuid]`), not the sequential onchain packet ID. Prevents enumeration attacks where someone could guess `/claim/0`, `/claim/1`, etc. All API routes resolve UUID → onchain `packet_id` via DB lookup.
- **Share URL param**: `?bless=handle` instead of `?ref=handle` for thematic consistency
- **Wagmi v2**: Required for OnchainKit provider compatibility. Do not upgrade to wagmi v3.
- **No OnchainKit CSS**: Removed due to PostCSS conflict with Tailwind.

## Visual Theme

- **Colors**: Red `#CF202F`, Gold `#FBC293`, Dark background `#1A0808`, Cream `#FFF8E7`
- **Lanterns**: CSS-built Chinese lanterns (round, tall, drum, palace shapes) with subtle sway animation
- **Fire Horse**: Halftone dot pattern PNG background, gold-tinted via CSS mask, breathing glow animation
- **Coinbase branding**: White wordmark logo bottom-left of every packet card

## System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js 15)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │ Landing  │  │ Create   │  │  Claim   │  │   My Packets     │ │
│  │   /      │  │ /create  │  │/claim/[id]│  │  /my-packets     │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │
│                         │                                        │
│  ┌──────────────────────┴────────────────────────────────────┐  │
│  │              Wagmi v2 + Viem (wallet interactions)         │  │
│  └───────────────────────┬───────────────────────────────────┘  │
└──────────────────────────┼──────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
     ┌─────▼─────┐  ┌─────▼─────┐  ┌─────▼─────┐
     │  Twitter   │  │   Neon    │  │   Base    │
     │  OAuth 2.0 │  │ Postgres  │  │ Sepolia   │
     │            │  │           │  │           │
     │ - Auth     │  │ - packets │  │ RedPacket │
     │ - Profile  │  │ - claims  │  │ Contract  │
     │ - Anti-bot │  │ - rates   │  │           │
     └───────────┘  └───────────┘  └───────────┘
```

## User Flows

### Creator Flow
```
Landing → Sign in with X → Connect Wallet → /create
  → Enter amount, recipients, split type, expiry
  → Approve USDC (wallet tx)
  → Create Packet (wallet tx)
  → Parse PacketCreated event → Store metadata in DB
  → Show share card preview + Save image / Share on X / Copy link
```

### Claimer Flow
```
Click shared link → /claim/[uuid]
  → Fetch packet info (UUID → DB → onchain)
  → Tap to open → Sign in with X (if not already)
  → Connect wallet (if not already)
  → Backend: anti-bot checks → EIP-712 signature
  → Submit claim tx (wallet) → Wait for receipt
  → Parse PacketClaimed event → Show amount with confetti
  → POST /confirm → Backend verifies on-chain, records amount
  → Share CTA: save image / share on X / copy link
```

### Refund Flow
```
My Packets → See all created packets
  → Packet with remaining balance shows "Withdraw X USDC" button
  → Click → Submit refund tx (wallet)
  → Funds returned to creator
```

## Claim Signature Flow (Detailed)

```
1. Frontend: POST /api/packets/[uuid]/claim { claimerAddress }
2. Backend:
   a. Resolve UUID → onchain packet_id via DB
   b. Verify session (Twitter OAuth)
   c. Check onchain state (packet exists, not expired, not full)
   d. Run anti-bot (account age, followers, duplicate, rate limit)
   e. Atomic DB insert (locks slot before signing)
   f. Generate 256-bit random nonce
   g. Sign EIP-712: { packetId, claimer, twitterUserId, nonce }
   h. Return { signature, nonce, twitterUserId }
3. Frontend: Submit claim(packetId, twitterUserId, nonce, signature) to contract
4. Contract:
   a. Verify signature matches signer
   b. Check hasClaimed[packetId][msg.sender]
   c. Check twitterClaimed[keccak256(packetId, twitterUserId)]
   d. Calculate amount (equal or random split)
   e. Transfer USDC to claimer
   f. Emit PacketClaimed event
5. Frontend: Parse event → show amount → POST /api/packets/[uuid]/confirm { txHash }
6. Backend: Verify receipt on-chain → record amount in DB
```

## Database Schema

```sql
packets
  id UUID PRIMARY KEY                    -- used in claim URLs (unguessable)
  packet_id INTEGER UNIQUE NOT NULL      -- onchain sequential ID (internal only)
  creator_address TEXT NOT NULL
  creator_twitter_id TEXT NOT NULL
  creator_twitter_handle TEXT NOT NULL
  creator_twitter_avatar TEXT
  tx_hash TEXT NOT NULL
  created_at TIMESTAMPTZ DEFAULT NOW()

claims
  id UUID PRIMARY KEY
  packet_id INTEGER NOT NULL
  claimer_address TEXT NOT NULL           -- stored lowercase
  claimer_twitter_id TEXT NOT NULL
  claimer_twitter_handle TEXT NOT NULL
  nonce TEXT UNIQUE NOT NULL
  signature TEXT NOT NULL                 -- 'pending' until signed
  amount TEXT                             -- filled by /confirm endpoint
  tx_hash TEXT                            -- filled by /confirm endpoint
  claimed_at TIMESTAMPTZ DEFAULT NOW()
  UNIQUE(packet_id, claimer_twitter_id)   -- prevents DB-level double claim

rate_limits
  id UUID PRIMARY KEY
  twitter_user_id TEXT NOT NULL
  claimed_at TIMESTAMPTZ DEFAULT NOW()
  INDEX on (twitter_user_id, claimed_at)
```

## Security Threat Model

| Threat | Mitigation |
|--------|-----------|
| Bot claiming | Twitter OAuth + account age/follower checks (fail-closed) |
| Packet enumeration | UUID-based URLs, sequential IDs never exposed in URLs |
| Double claim (same wallet) | `hasClaimed` onchain mapping |
| Double claim (same Twitter, diff wallets) | `twitterClaimed` onchain + DB UNIQUE constraint |
| Race condition double-claim | Atomic DB INSERT before signature generation |
| Signature replay | Global `usedNonces` mapping + 256-bit random nonces |
| Cross-chain replay | EIP-712 domain includes chainId + contract address |
| Signer key compromise | `pause()` + `setSigner()` for key rotation |
| Division by zero (random split) | Guards: `range == 0`, `minAmount == 0`, `average < 5` fallbacks |
| Zero-amount claims | `require(claimAmount > 0)` + minimum enforced |
| Ownership loss | Two-step transfer with `acceptOwnership()` |
| Reentrancy | `nonReentrant` on all fund-moving functions + CEI pattern |
| API data exposure | Public endpoints return only aggregate data, no individual claims |
| Claim amount spoofing | `/confirm` endpoint verifies txHash on-chain, reads amount from event logs |
| Reverted tx ghost data | Receipt status checked before DB write; PacketCreated event required |

## Frontend Component Tree

```
Providers (SessionProvider > WagmiProvider > QueryClient > OnchainKit)
  └── Layout (Geist fonts, dark theme)
        ├── Landing Page
        │     ├── Header (logo, My Packets, TwitterSignIn, WalletWrapper)
        │     ├── Hero (title, subtitle, description)
        │     ├── How It Works (4 gold-gradient boxes)
        │     ├── PacketCard (mode="demo")
        │     ├── Lanterns (10 CSS lanterns, 4 shapes, varied sizes)
        │     └── Fire Horse (PNG with CSS mask gold tint + glow pulse)
        ├── Create Page
        │     ├── Auth/Wallet gates
        │     ├── Form (amount, recipients, split, expiry)
        │     ├── StepIndicator (approve → create → finalize)
        │     └── Success: PacketCard + ShareCta (image preview + share)
        ├── Claim Page (13 states)
        │     ├── loading → sealed → auth_required → connecting_wallet
        │     ├── ready → claiming → opening → revealed
        │     ├── already_claimed, expired, fully_claimed, auth_failed, error
        │     └── ClaimResult (count-up animation + confetti)
        └── My Packets
              ├── PacketCard grid (mode="preview", 4 cols)
              ├── Status (claimed/total, progress bar)
              ├── Share buttons (X + copy)
              └── Withdraw button (gold, shows remaining USDC)
```

## OG Image Generation

```
Template: assets/Card template.png (1200x675, designed in Figma)
    ↓
/api/og/[uuid] (edge runtime, next/og ImageResponse)
    ↓
Overlay: Creator's Twitter PFP (circular, positioned over template circle)
         Creator's handle (positioned after "from @" in template)
    ↓
Output: 1200x675 PNG served as og:image meta tag
```

## Deployment Checklist (Production)

1. Deploy contract to Base mainnet with verified source
2. Update env vars: `CHAIN_ID=8453`, `USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, `CONTRACT=<mainnet>`
3. Set `NEXT_PUBLIC_BASE_RPC_URL` to Alchemy/QuickNode (not public RPC)
4. Set `NEXT_PUBLIC_ONCHAINKIT_API_KEY` for reliable RPC
5. Update `AUTH_URL` to production domain
6. Update Twitter OAuth callback URL to production domain
7. Ensure `SIGNER_PRIVATE_KEY` is not the deployer key
8. Deploy frontend to Vercel
9. Test: create → share → claim → refund full flow
10. Verify OG images render correctly (Twitter Card Validator)

## Contract Testing

```bash
cd contracts
forge install OpenZeppelin/openzeppelin-contracts --no-git
forge test -v    # 56 tests, all passing
```

See `contracts/README.md` for detailed contract documentation.
