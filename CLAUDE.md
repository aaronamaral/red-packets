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
- **Share URL param**: `?bless=handle` instead of `?ref=handle` for thematic consistency
- **Wagmi v2**: Required for OnchainKit provider compatibility. Do not upgrade to wagmi v3.
- **No OnchainKit CSS**: Removed due to PostCSS conflict with Tailwind.

## Visual Theme

- **Colors**: Red `#CF202F`, Gold `#FBC293`, Dark background `#1A0808`, Cream `#FFF8E7`
- **Lanterns**: CSS-built Chinese lanterns (round, tall, drum, palace shapes) with subtle sway animation
- **Fire Horse**: Halftone dot pattern PNG background, gold-tinted via CSS mask, breathing glow animation
- **Coinbase branding**: White wordmark logo bottom-left of every packet card
