# Architecture — Red Packets on Base

## System Overview

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
Click shared link → /claim/[packetId]
  → Fetch packet info (onchain + DB)
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

## Smart Contract Architecture

```solidity
contract RedPacket is EIP712, ReentrancyGuard {
    // State
    IERC20 public immutable usdc;
    address public signer;            // Backend EIP-712 signer
    address public owner;             // Admin (can pause, update signer)
    address public pendingOwner;      // Two-step transfer
    bool public paused;               // Emergency pause

    mapping(uint256 => Packet) public packets;
    mapping(uint256 => mapping(address => bool)) public hasClaimed;     // Per-address dedup
    mapping(bytes32 => bool) public twitterClaimed;                     // Per-Twitter dedup
    mapping(uint256 => bool) public usedNonces;                         // Replay prevention

    // Limits
    MAX_DEPOSIT = 2,000 USDC
    MAX_CLAIMS = 200 per packet
    MAX_EXPIRY = 24 hours
    MIN_PER_CLAIM = $0.01

    // Functions
    createPacket() → nonReentrant, whenNotPaused
    claim()        → nonReentrant, whenNotPaused, EIP-712 verified
    refund()       → nonReentrant, creator only, no expiry wait
    pause/unpause  → owner only
    setSigner      → owner only, no zero address
    transferOwnership/acceptOwnership → two-step
}
```

### Claim Signature Flow
```
1. Frontend: POST /api/packets/[id]/claim { claimerAddress }
2. Backend:
   a. Verify session (Twitter OAuth)
   b. Check onchain state (packet exists, not expired, not full)
   c. Run anti-bot (account age, followers, duplicate, rate limit)
   d. Atomic DB insert (locks slot before signing)
   e. Generate 256-bit random nonce
   f. Sign EIP-712: { packetId, claimer, twitterUserId, nonce }
   g. Return { signature, nonce, twitterUserId }
3. Frontend: Submit claim(packetId, twitterUserId, nonce, signature) to contract
4. Contract:
   a. Verify signature matches signer
   b. Check hasClaimed[packetId][msg.sender]
   c. Check twitterClaimed[keccak256(packetId, twitterUserId)]
   d. Calculate amount (equal or random split)
   e. Transfer USDC to claimer
   f. Emit PacketClaimed event
5. Frontend: Parse event → show amount → POST /api/packets/[id]/confirm { txHash }
6. Backend: Verify receipt on-chain → record amount in DB
```

## Database Schema

```sql
packets
  id UUID PRIMARY KEY
  packet_id INTEGER UNIQUE NOT NULL      -- onchain ID
  creator_address TEXT NOT NULL
  creator_twitter_id TEXT NOT NULL
  creator_twitter_handle TEXT NOT NULL
  creator_twitter_avatar TEXT
  tx_hash TEXT NOT NULL
  created_at TIMESTAMPTZ DEFAULT NOW()

claims
  id UUID PRIMARY KEY
  packet_id INTEGER NOT NULL
  claimer_address TEXT NOT NULL
  claimer_twitter_id TEXT NOT NULL
  claimer_twitter_handle TEXT NOT NULL
  nonce TEXT UNIQUE NOT NULL
  signature TEXT NOT NULL                -- 'pending' until signed
  amount TEXT                            -- filled by /confirm endpoint
  tx_hash TEXT                           -- filled by /confirm endpoint
  claimed_at TIMESTAMPTZ DEFAULT NOW()
  UNIQUE(packet_id, claimer_twitter_id)  -- prevents DB-level double claim

rate_limits
  id UUID PRIMARY KEY
  twitter_user_id TEXT NOT NULL
  claimed_at TIMESTAMPTZ DEFAULT NOW()
  INDEX on (twitter_user_id, claimed_at)
```

## Security Model

### Threat Mitigation

| Threat | Mitigation |
|--------|-----------|
| Bot claiming | Twitter OAuth + account age/follower checks (fail-closed) |
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

### Trust Assumptions

- Backend signer key is secure (stored as env var, no HSM)
- Twitter OAuth provides genuine identity signals
- Base L2 sequencer does not manipulate `blockhash` for random claims
- Neon Postgres is available for claim dedup (onchain dedup is backup)

## OG Image Generation

```
Template: assets/Card template.png (1200x675, designed in Figma)
    ↓
/api/og/[packetId] (edge runtime, next/og ImageResponse)
    ↓
Overlay: Creator's Twitter PFP (circular, positioned over template circle)
         Creator's handle (positioned after "from @" in template)
    ↓
Output: 1200x675 PNG served as og:image meta tag
```

The claim page layout.tsx sets dynamic `og:image` and `twitter:card` meta tags per packet, pointing to this endpoint. When the claim URL is shared on Twitter, Twitter's crawler fetches the OG image and renders it as a card preview.

## Frontend Component Architecture

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
        │
        ├── Create Page
        │     ├── Auth/Wallet gates
        │     ├── Form (amount, recipients, split, expiry)
        │     ├── StepIndicator (approve → create → finalize)
        │     └── Success: PacketCard + ShareCta (image preview + share)
        │
        ├── Claim Page (13 states)
        │     ├── loading → sealed → auth_required → connecting_wallet
        │     ├── ready → claiming → opening → revealed
        │     ├── already_claimed, expired, fully_claimed, auth_failed, error
        │     └── ClaimResult (count-up animation + confetti)
        │
        └── My Packets
              ├── PacketCard grid (mode="preview", 4 cols)
              ├── Status (claimed/total, progress bar)
              ├── Share buttons (X + copy)
              └── Withdraw button (gold, shows remaining USDC)
```

## Deployment Checklist (Production)

1. Deploy contract to Base mainnet with verified source
2. Update env vars: `CHAIN_ID=8453`, `USDC_ADDRESS=mainnet`, `CONTRACT=mainnet`
3. Set `NEXT_PUBLIC_BASE_RPC_URL` to Alchemy/QuickNode (not public RPC)
4. Set `NEXT_PUBLIC_ONCHAINKIT_API_KEY` for reliable RPC
5. Update `AUTH_URL` to production domain
6. Update Twitter OAuth callback URL to production domain
7. Ensure `SIGNER_PRIVATE_KEY` is not the deployer key
8. Deploy frontend to Vercel
9. Test: create → share → claim → refund full flow
10. Verify OG images render correctly (Twitter Card Validator)
