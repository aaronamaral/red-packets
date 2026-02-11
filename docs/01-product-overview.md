# Product Overview

## What It Is

Red Packets on Base is a web application that lets users send USDC-funded digital red envelopes (red packets) on the Base blockchain. Built for the Lunar New Year 2026 -- the Year of the Fire Horse -- it combines the Chinese tradition of gifting money in red envelopes with onchain stablecoin transfers and social distribution through Twitter/X.

A creator deposits USDC into a smart contract, receives a shareable link, posts it on X, and recipients open the link to claim their portion. The entire flow is Coinbase-branded, runs on Base (Coinbase's L2), and settles in USDC.

**Key facts:**

- Token: USDC (6 decimals) on Base
- Maximum deposit: $2,000 per packet
- Maximum recipients: 200 per packet
- Maximum expiry: 24 hours
- Split modes: Equal or random
- Distribution: Twitter/X share links with OG image cards
- Anti-bot: Twitter OAuth + account age/follower checks + rate limiting

---

## User Personas

### Creator (Sends Blessings)

A crypto-native individual or brand representative who wants to distribute USDC to their Twitter/X audience as a Lunar New Year gesture. The creator has a Base-compatible wallet funded with USDC, a Twitter/X account, and the intent to gift money socially.

**Motivations:** Community engagement, generosity, brand promotion, cultural celebration.

### Claimer (Opens a Packet)

A Twitter/X user who sees a shared red packet link in their feed or DMs. May or may not already have a crypto wallet. Needs a Twitter/X account that meets anti-bot thresholds (30+ days old, 10+ followers) and a Base-compatible wallet to receive USDC.

**Motivations:** Free USDC, curiosity, social participation.

### Returning User (Manages Packets)

A creator returning to review packets they have sent. Can view claim progress across all their packets, see how many blessings remain, and withdraw unclaimed funds at any time via the My Packets dashboard.

**Motivations:** Monitoring distribution, recovering unused funds.

---

## User Flows

### Creator Flow

```
1. Land on homepage (/)
2. Sign in with Twitter/X (OAuth 2.0)
3. Connect wallet (Coinbase Wallet, MetaMask, or injected provider)
4. Navigate to /create
5. Configure packet:
   - Total USDC amount (up to $2,000)
   - Number of recipients (1-200)
   - Split type (equal or random)
   - Expiry window (1h, 6h, 12h, or 24h)
6. Approve USDC spending (wallet transaction)
7. Create packet (wallet transaction -- calls createPacket on the smart contract)
8. Frontend parses the PacketCreated event from the transaction receipt
9. Packet metadata (onchain ID, creator's Twitter info, tx hash) is stored in Postgres
10. Database returns a UUID -- this becomes the shareable claim URL
11. Success screen shows:
    - Packet card preview with the creator's avatar and handle
    - "Save Image" button
    - "Share on X" button (opens Twitter intent with pre-filled text)
    - "Copy Link" button
```

### Claimer Flow

```
1. Click a shared link: /claim/[uuid]
2. Frontend fetches packet info (UUID -> Postgres -> onchain state)
3. Packet card renders in "sealed" state showing creator's handle and avatar
4. Tap to open the packet
5. If not signed in: prompted to sign in with Twitter/X
6. If no wallet connected: prompted to connect wallet
7. Frontend sends POST /api/packets/[uuid]/claim with the claimer's wallet address
8. Backend performs:
   a. UUID -> onchain packet_id resolution via Postgres
   b. Twitter session verification
   c. Onchain state check (exists, not expired, not full, not refunded)
   d. Anti-bot checks (account age, followers, duplicate, rate limit)
   e. Atomic DB insert (locks claim slot before signing)
   f. EIP-712 signature generation
9. Frontend receives { signature, nonce, twitterUserId }
10. Frontend submits claim() transaction to the smart contract
11. Contract verifies signature, checks dedup mappings, calculates amount, transfers USDC
12. Frontend parses PacketClaimed event, displays amount with count-up animation and confetti
13. Frontend sends POST /api/packets/[uuid]/confirm with the tx hash
14. Backend verifies the transaction on-chain (receipt status, event logs) and records the amount in Postgres
15. Share CTA appears: save image, share on X, copy link
```

### Refund Flow

```
1. Navigate to /my-packets
2. View all created packets with claim progress (claimed/total, progress bar)
3. For any packet with remaining USDC balance, a "Withdraw X USDC" button appears
4. Click the button
5. Submit refund() transaction to the smart contract
6. Contract sets refunded=true, transfers remaining USDC to the creator
7. Future claims against this packet are blocked
```

---

## Visual Theme: Lunar New Year / Fire Horse 2026

The application celebrates the Year of the Fire Horse (2026) with a cohesive Chinese New Year aesthetic:

### Color Palette

| Color | Hex | Usage |
|-------|-----|-------|
| Red Packet Red | `#CF202F` | Primary accent, packet cards, lantern bodies |
| Gold | `#FBC293` | Text highlights, borders, badges, fire horse tint |
| Dark Background | `#1A0808` | Page background |
| Cream | `#FFF8E7` | Body text, secondary text at various opacities |

### Visual Elements

- **Chinese Lanterns:** Ten CSS-rendered lanterns in four shapes (round, tall, drum, palace) with the character "fu" (fortune/blessing), vertical and horizontal ribs, tassels, and a subtle sway animation. Positioned along the left third of the viewport.
- **Fire Horse:** A halftone dot-pattern PNG of a horse, gold-tinted using a CSS mask overlay (`background-color: #FBC293` with the image as a mask), with a breathing glow pulse animation. Positioned on the right third of the viewport on desktop.
- **Animations:** Framer Motion entrance animations (fade-in, scale-up) on the hero section, how-it-works cards, and packet card. Lanterns have continuous CSS `animate-sway`. The fire horse has a CSS `horse-glow` pulse.

### Packet Card

The `PacketCard` component renders in three modes:

| Mode | Context | Display |
|------|---------|---------|
| `demo` | Landing page | "Create a Red Packet / Share a blessing" |
| `claim` | Claim page | "from @handle / Tap to open" |
| `preview` | My Packets | "from @handle / Tap to preview" |

---

## Coinbase Branding

- **Coinbase wordmark:** White Coinbase logo rendered at the bottom-left of every packet card.
- **"Powered by Base":** Displayed in the site footer with the Base name styled in blue.
- **OnchainKit:** The application wraps all components in the `OnchainKitProvider` from `@coinbase/onchainkit`, connecting to the Base chain.
- **Coinbase Wallet:** Listed as a primary wallet connector alongside injected wallets (MetaMask, etc.).
- **OG Image Template:** A designer-created 1200x675 PNG (Figma-designed) with Coinbase and Base branding baked in. The creator's Twitter avatar and handle are dynamically overlaid.

---

## Key Features

### Equal and Random Splits

Creators choose how USDC is distributed:

- **Equal split:** Each claimer receives `remainingAmount / remainingClaims`. The last claimer absorbs any rounding remainder, ensuring zero dust is left in the contract.
- **Random split:** Each claim amount is pseudo-randomly distributed between 20% and 200% of the current average. A reserve is maintained so that later claimers always receive at least a minimum amount. When the average drops below 5 token units, the algorithm falls back to equal split for safety. The last claimer receives all remaining funds.

### Twitter/X Sharing

- **Share on X button:** Opens a Twitter intent URL with pre-filled tweet text including the claim link and a Lunar New Year blessing message.
- **Share URL format:** `/claim/[uuid]?bless=handle` -- the `bless` parameter attributes the referral to the creator for thematic consistency ("bless" instead of "ref").
- **Claimer sharing:** After claiming, recipients see a different tweet template: "I just received $X USDC blessing from a red packet on Base! Open yours before they're gone."

### OG Image Cards

Each packet generates a dynamic Open Graph image at `/api/og/[uuid]`:

- **Template:** A 1200x675 PNG designed in Figma with Coinbase/Base branding, red envelope imagery, and placeholder positions for dynamic content.
- **Dynamic overlay:** The creator's Twitter profile picture (fetched at 400x400 resolution, rendered as a circle) and their handle are composited onto the template using `next/og` (`ImageResponse`) at the edge runtime.
- **Meta tags:** The claim page layout (`/claim/[packetId]/layout.tsx`) sets `og:image` and `twitter:image` meta tags pointing to the OG image endpoint, enabling rich link previews on Twitter/X and other platforms.
- **Twitter card type:** `summary_large_image` for maximum visual impact in the feed.

### Anti-Bot Protection

A multi-layered defense system prevents automated or fraudulent claiming:

| Layer | Check | Threshold | Failure Mode |
|-------|-------|-----------|--------------|
| 1 | Twitter account age | 30+ days | Fail-closed (rejects if data unavailable) |
| 2 | Twitter follower count | 10+ followers | Fail-closed (rejects if data unavailable) |
| 3 | Duplicate claim (DB) | 1 claim per Twitter user per packet | Atomic INSERT before signing |
| 4 | Rate limit | 10 claims per Twitter account per 24h | DB query on `rate_limits` table |
| 5 | Duplicate claim (onchain) | `hasClaimed` mapping per wallet | Smart contract enforcement |
| 6 | Twitter sybil (onchain) | `twitterClaimed` mapping per Twitter user | Smart contract enforcement |
| 7 | Nonce replay | `usedNonces` mapping | Smart contract enforcement |

The system is **fail-closed**: if Twitter profile data (account age, follower count) is missing or unparseable, the claim is rejected rather than allowed. This prevents bypass via malformed OAuth responses.

**Race condition protection:** The claim API route performs an atomic `INSERT ... ON CONFLICT DO NOTHING ... RETURNING id` before generating the EIP-712 signature. If a concurrent request already inserted a row for the same `(packet_id, claimer_twitter_id)`, the INSERT returns zero rows and no signature is issued.

### IP Sanctions / Geo-blocking

Next.js edge middleware (`src/middleware.ts`) blocks access from OFAC-sanctioned countries using Vercel's `x-vercel-ip-country` header. Blocked regions: Cuba (CU), Iran (IR), North Korea (KP), Syria (SY), Russia (RU). Returns a 403 HTML page. Runs before any page renders with zero latency cost. Excludes `/api/auth` routes to avoid breaking OAuth callbacks.

### Creator Withdrawal

Creators can withdraw unclaimed USDC at any time -- there is no requirement to wait for the packet to expire. Calling `refund()` on the smart contract sets the packet as refunded, blocks all future claims, and transfers the remaining balance to the creator in a single transaction.
