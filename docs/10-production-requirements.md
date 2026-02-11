# Production Requirements

## Overview

This document outlines every requirement that must be met before the Red Packets application can be deployed to production on Base mainnet. Items are categorized by workstream and priority.

---

## 1. Smart Contract

| # | Requirement | Status | Owner | Notes |
|---|-------------|--------|-------|-------|
| 1.1 | Formal third-party security audit | Not started | TBD | Current state: 56 Foundry tests + internal review. A professional audit firm (Trail of Bits, OpenZeppelin, Halborn) should review RedPacket.sol before mainnet deployment with real funds. |
| 1.2 | Deploy contract to Base mainnet | Not started | TBD | `forge script script/Deploy.s.sol --rpc-url https://mainnet.base.org --private-key $DEPLOYER_PRIVATE_KEY --broadcast --verify --etherscan-api-key $BASESCAN_API_KEY` |
| 1.3 | Verify contract on Basescan | Not started | TBD | Required for transparency. Use `--verify` flag during deployment or verify manually via Basescan. |
| 1.4 | Generate production signer key | Not started | TBD | `cast wallet new`. Must be a fresh key, NOT the deployer key. Store the private key securely (Vercel env vars at minimum, ideally AWS KMS or HashiCorp Vault). |
| 1.5 | Validate contract state post-deploy | Not started | TBD | Verify: `owner()` is correct, `signer()` is correct, `usdc()` points to mainnet USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`), `paused()` is false, `nextPacketId()` is 0. |
| 1.6 | Fund deployer wallet with ETH | Not started | TBD | Base mainnet deployer needs ETH for gas. Estimate: ~0.001 ETH for deployment. |
| 1.7 | Test all contract functions on mainnet | Not started | TBD | Create a small test packet ($1), claim it, refund another. Verify events emit correctly. |

---

## 2. Infrastructure

| # | Requirement | Status | Owner | Notes |
|---|-------------|--------|-------|-------|
| 2.1 | Vercel project setup | Not started | TBD | Create production Vercel project linked to GitHub repo. |
| 2.2 | Production domain | Not started | TBD | Configure custom domain (e.g., `redpackets.coinbase.com` or similar). Set up DNS, SSL certificate (automatic via Vercel). |
| 2.3 | Paid RPC provider | Not started | TBD | Sign up for Alchemy or QuickNode. Get a Base mainnet RPC URL. Free tier is insufficient for production traffic. Set as `NEXT_PUBLIC_BASE_RPC_URL`. |
| 2.4 | OnchainKit API key | Not started | TBD | Get from Coinbase Developer Platform (portal.cdp.coinbase.com). Set as `NEXT_PUBLIC_ONCHAINKIT_API_KEY`. Provides reliable RPC for wallet components. |
| 2.5 | Production Neon Postgres | Not started | TBD | Current DB is on Neon free tier. For production: upgrade to Neon Pro plan for higher connection limits, automatic backups, and better availability. Consider region closest to users. |
| 2.6 | Database tables | Not started | TBD | Run `initDb()` or manually create tables on production database. Schema in contracts/README.md and CLAUDE.md. |
| 2.7 | CDN for static assets | Done (Vercel) | — | Vercel automatically serves `public/` assets via CDN. No additional setup needed. |

---

## 3. Environment Variables

All must be set in Vercel project settings (Settings → Environment Variables).

| Variable | Sepolia Value | Mainnet Value | Action Required |
|----------|--------------|---------------|-----------------|
| `AUTH_SECRET` | `6iV3yk9H...` | Generate new | `npx auth secret` — must be unique per environment |
| `AUTH_TWITTER_ID` | `bk5Ubz...` | Same (or new app) | If using same Twitter app, no change. If new app, create in Twitter Developer Portal. |
| `AUTH_TWITTER_SECRET` | `k2iGE7...` | Same (or new app) | Must match the Twitter app used for AUTH_TWITTER_ID. |
| `AUTH_URL` | `http://localhost:3002` | `https://redpackets.example.com` | Must match the production domain exactly. |
| `TWITTER_BEARER_TOKEN` | Current token | Same | Same Twitter API project. |
| `NEXT_PUBLIC_ONCHAINKIT_API_KEY` | Empty | CDP key | Get from Coinbase Developer Platform. |
| `DATABASE_URL` | Neon Sepolia string | Neon production string | New database or same database (separate schema recommended). |
| `SIGNER_PRIVATE_KEY` | `51f3e2...` | New key | Must be freshly generated. Never reuse testnet keys. |
| `NEXT_PUBLIC_RED_PACKET_CONTRACT` | `0x1329B0...` | New mainnet address | From step 1.2 deployment. |
| `NEXT_PUBLIC_USDC_ADDRESS` | `0x036CbD...` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | Base mainnet USDC. |
| `NEXT_PUBLIC_CHAIN_ID` | `84532` | `8453` | Base mainnet chain ID. |
| `NEXT_PUBLIC_BASE_RPC_URL` | `https://sepolia.base.org` | Alchemy/QuickNode URL | Paid RPC endpoint from step 2.3. |

---

## 4. Twitter OAuth

| # | Requirement | Status | Owner | Notes |
|---|-------------|--------|-------|-------|
| 4.1 | Update callback URL | Not started | TBD | In Twitter Developer Portal → App → User authentication settings → Callback URL: `https://redpackets.example.com/api/auth/callback/twitter` |
| 4.2 | Add production website URL | Not started | TBD | Same settings page → Website URL: `https://redpackets.example.com` |
| 4.3 | Verify app permissions | Not started | TBD | Must be "Read" (not "Read and Write"). Scopes: `users.read`, `tweet.read`, `offline.access`. |
| 4.4 | App type | Not started | TBD | Must be "Web App" (confidential client), not "Native App" or "Single page app". |
| 4.5 | Production API rate limits | Not started | TBD | Twitter API free tier: 100 requests/month for user lookup. May need Basic ($100/mo) or Pro tier depending on traffic. |

---

## 5. Security

| # | Requirement | Status | Owner | Notes |
|---|-------------|--------|-------|-------|
| 5.1 | Rotate all testnet credentials | Not started | TBD | AUTH_SECRET, SIGNER_PRIVATE_KEY — generate fresh for production. Never reuse testnet values. |
| 5.2 | Security headers verified | Done | — | X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy configured in next.config.mjs. |
| 5.3 | IP sanctions middleware | Done | — | OFAC countries blocked: CU, IR, KP, SY, RU. |
| 5.4 | HTTPS enforced | Done (Vercel) | — | Vercel enforces HTTPS automatically. |
| 5.5 | Rate limiting on API routes | Not started | TBD | Consider Vercel Rate Limiting (paid) or Upstash Redis rate limiter for `/api/packets/[id]/claim` and `/api/og/[packetId]` (CPU-intensive). |
| 5.6 | Error monitoring | Not started | TBD | Set up Sentry or similar for runtime error tracking. Critical for a financial app. |
| 5.7 | Remove development console.logs | Done | — | Auth logging gated behind `NODE_ENV === "development"`. |
| 5.8 | Verify .gitignore completeness | Done | — | `.env*.local`, `.env`, `contracts/out/`, `contracts/cache/`, `contracts/broadcast/`, `contracts/lib/` all excluded. |

---

## 6. Legal & Compliance

| # | Requirement | Status | Owner | Notes |
|---|-------------|--------|-------|-------|
| 6.1 | Terms & Conditions legal review | Not started | Legal | Draft exists at `docs/05-terms-and-conditions.md`. Requires legal sign-off before public launch. |
| 6.2 | Privacy Policy legal review | Not started | Legal | Draft exists at `docs/06-privacy-policy.md`. Must comply with GDPR if serving EU users. |
| 6.3 | T&Cs page on the app | Not started | TBD | Add `/terms` page and link from footer. Users should agree to terms before creating or claiming. |
| 6.4 | Privacy Policy page on the app | Not started | TBD | Add `/privacy` page and link from footer. |
| 6.5 | Cookie consent banner | Not started | TBD | May be required depending on jurisdiction. NextAuth uses session cookies. |
| 6.6 | Sanctions list review | Not started | Legal | Verify the blocked country list (CU, IR, KP, SY, RU) matches current OFAC/Coinbase requirements. May need to add Crimea/Donetsk/Luhansk regions. |
| 6.7 | Money transmission analysis | Not started | Legal | Determine if the app qualifies as money transmission in any jurisdiction. The contract is non-custodial (funds go directly creator→claimer), but the backend-signed claims create a gatekeeper role. |

---

## 7. Branding & Design

| # | Requirement | Status | Owner | Notes |
|---|-------------|--------|-------|-------|
| 7.1 | Custom favicon | Not started | Design | Current favicon is the default Next.js icon. Need a red packet or Coinbase-branded favicon. |
| 7.2 | OG image template finalization | Done | — | Card template designed in Figma at 1200x675. Dynamic PFP + handle overlay working. |
| 7.3 | Coinbase brand review | Not started | Brand | Verify Coinbase logo usage, color palette, and "Powered by Base" text comply with brand guidelines. |
| 7.4 | Mobile responsiveness | Not started | TBD | Test all pages on iOS Safari, Android Chrome. Claim page is the most critical (mobile-first audience from Twitter links). |
| 7.5 | Accessibility pass | Not started | TBD | Missing: form label associations, ARIA attributes on toggle buttons, SVG accessible names, skip-to-content link. |

---

## 8. Testing

| # | Requirement | Status | Owner | Notes |
|---|-------------|--------|-------|-------|
| 8.1 | Smart contract tests | Done | — | 56 Foundry tests, all passing. |
| 8.2 | End-to-end test on mainnet | Not started | TBD | Full flow: create packet → share link → claim on different account → refund remaining. Use small amounts ($1-$5). |
| 8.3 | OG image verification | Not started | TBD | Test via Twitter Card Validator (cards-dev.twitter.com/validator) or Open Graph debugger. Verify image renders correctly when link is shared. |
| 8.4 | Multi-browser testing | Not started | TBD | Test on Chrome, Firefox, Safari. Wallet connection, transaction signing, animations. |
| 8.5 | Load testing | Not started | TBD | Simulate concurrent claim requests to verify atomic DB insert prevents race conditions under load. |
| 8.6 | Sanctions middleware testing | Not started | TBD | Verify geo-blocking works on Vercel (requires deploying to staging first — `x-vercel-ip-country` header only present in Vercel deployments). |

---

## 9. Monitoring & Observability

| # | Requirement | Status | Owner | Notes |
|---|-------------|--------|-------|-------|
| 9.1 | Contract monitoring | Not started | TBD | Monitor contract balance, claim rates, unusual patterns. Tools: Basescan alerts, Tenderly, or custom script using `cast`. |
| 9.2 | Application error tracking | Not started | TBD | Sentry or Vercel Analytics for runtime errors, API failures. |
| 9.3 | Uptime monitoring | Not started | TBD | Set up uptime checks for the production URL and critical API endpoints. |
| 9.4 | Database monitoring | Not started | TBD | Neon dashboard for connection counts, query latency, storage usage. |
| 9.5 | Alert channels | Not started | TBD | Set up Slack/PagerDuty alerts for: contract pause events, high error rates, claim rate anomalies, database issues. |

---

## 10. Post-Deployment Verification

After deploying to production, verify each item:

- [ ] Landing page loads at production URL
- [ ] Twitter OAuth sign-in works with production callback URL
- [ ] Wallet connection works (MetaMask, Coinbase Wallet)
- [ ] Create packet with $1 USDC — approve + create transactions succeed
- [ ] Share link contains UUID (not sequential ID)
- [ ] OG image generates correctly (visit `/api/og/[uuid]`)
- [ ] Claim packet from different account — anti-bot checks pass, claim succeeds
- [ ] Claimed amount recorded in database via `/confirm` endpoint
- [ ] My Packets page shows created packet with correct status
- [ ] Withdraw remaining USDC from My Packets
- [ ] Sanctioned country IP returns 403 (test via VPN if possible)
- [ ] Security headers present (check via securityheaders.com)
- [ ] `X-Powered-By` header is absent
- [ ] No console errors in production build
- [ ] Twitter card preview renders when sharing claim link

---

## 11. Go/No-Go Checklist

Final sign-off required from each stakeholder before public launch:

| Stakeholder | Sign-off | Date |
|-------------|----------|------|
| Engineering Lead | ☐ Code review complete, all tests passing | |
| Security | ☐ Contract audit complete (or risk accepted), credentials rotated | |
| Legal | ☐ T&Cs and Privacy Policy approved | |
| Compliance | ☐ Sanctions list verified, money transmission analysis complete | |
| Brand | ☐ Coinbase branding reviewed and approved | |
| Product | ☐ E2E flow tested on mainnet, UX approved | |
| Operations | ☐ Monitoring in place, runbook reviewed, incident response plan ready | |

---

## Appendix: Quick Deploy Commands

```bash
# 1. Deploy contract to Base mainnet
cd contracts
export DEPLOYER_PRIVATE_KEY=<mainnet deployer key>
export USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
export SIGNER_ADDRESS=<production signer public address>
forge script script/Deploy.s.sol \
  --rpc-url https://mainnet.base.org \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast --verify \
  --etherscan-api-key $BASESCAN_API_KEY

# 2. Verify contract state
cast call <CONTRACT_ADDRESS> "owner()(address)" --rpc-url https://mainnet.base.org
cast call <CONTRACT_ADDRESS> "signer()(address)" --rpc-url https://mainnet.base.org
cast call <CONTRACT_ADDRESS> "usdc()(address)" --rpc-url https://mainnet.base.org
cast call <CONTRACT_ADDRESS> "paused()(bool)" --rpc-url https://mainnet.base.org

# 3. Deploy frontend
# Push to main → Vercel auto-deploys (if connected)
# Or: vercel --prod

# 4. Create test packet on mainnet
# Visit production URL → sign in → create → claim → verify
```
