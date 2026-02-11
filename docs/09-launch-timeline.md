# Launch Timeline — Red Packets on Base

**Project:** Coinbase Lunar New Year USDC Red Packets on Base
**Document type:** Launch Plan
**Last updated:** 2026-02-11
**Status:** Pre-Launch

---

## Executive Summary

Red Packets on Base is a Coinbase-branded Lunar New Year campaign app that allows users to send USDC red packets on the Base network. Users create packets loaded with USDC, share links on X (Twitter), and recipients claim their share. The system includes Twitter OAuth gating, anti-bot protections, IP sanctions middleware, and EIP-712 signed claims.

This document outlines the phased timeline from current state to public launch and ongoing operations.

---

## Timeline Overview

| Week | Phase | Key Milestone |
|------|-------|---------------|
| **Pre** | Current State | Testnet contract deployed, frontend functional, anti-bot active |
| **W1** | Phase 1: Internal Review | Engineering, security, legal, and design sign-off |
| **W1-2** | Phase 2: Staging Deployment | Vercel staging environment live, E2E testing complete |
| **W2** | Phase 3: Mainnet Preparation | Contract deployed to Base mainnet, full flow verified |
| **W2-3** | Phase 4: Soft Launch | Internal team testing with real USDC, invite-only access |
| **W3-4** | Phase 5: Public Launch | Open access, social media announcement, monitoring |
| **W4+** | Phase 6: Post-Launch | Ongoing monitoring, iteration, future event planning |

### Visual Schedule

```
Week 1          Week 2          Week 3          Week 4          Ongoing
|───────────────|───────────────|───────────────|───────────────|──────────
[Phase 1: Review]
        [Phase 2: Staging       ]
                [Phase 3: Mainnet]
                        [Phase 4: Soft Launch   ]
                                [Phase 5: Public Launch         ]
                                                        [Phase 6: Post-Launch ──►
```

---

## Pre-Launch — Current State

All foundational development is complete. The following items are built, tested, and functioning in a development environment.

| Item | Status | Notes |
|------|--------|-------|
| Smart contract (`RedPacket.sol`) | Deployed on Base Sepolia | `0x1329B01e6fa433dB925426521d473131179c5738` |
| Unit tests (Foundry) | 56 tests passing | Full coverage: create, claim, refund, pause, ownership, accounting |
| Frontend (Next.js 15) | Functional on localhost | Landing, create, claim, my-packets pages |
| Twitter OAuth 2.0 (NextAuth v5) | Working | Sign in with X flow |
| OG image generation | Working | Dynamic template overlay with creator PFP and handle |
| Anti-bot system | Active | Account age, follower count, rate limiting, atomic claim locking |
| IP sanctions middleware | Active | OFAC country blocking via Vercel edge middleware |
| EIP-712 claim signing | Working | Backend-signed, contract-verified claims |
| Database schema (Neon Postgres) | Set up | Packets, claims, rate_limits tables |
| UUID-based claim URLs | Implemented | Prevents packet ID enumeration |
| Creator refund flow | Working | Immediate withdrawal, no expiry wait |

---

## Phase 1: Internal Review (Week 1)

Goal: Obtain all required sign-offs before deploying to any non-local environment.

| Task | Owner | Est. Duration | Dependency | Done |
|------|-------|---------------|------------|------|
| Engineering code review — frontend | TBD (Eng) | 2 days | None | [ ] |
| Engineering code review — API routes and middleware | TBD (Eng) | 2 days | None | [ ] |
| Smart contract security review | TBD (Security) | 3 days | None | [ ] |
| Anti-bot logic review (fail-closed behavior) | TBD (Security) | 1 day | None | [ ] |
| EIP-712 signing flow review | TBD (Security) | 1 day | Code review | [ ] |
| Compliance review — Terms and Conditions | TBD (Legal) | 3 days | None | [ ] |
| Compliance review — Privacy Policy (Twitter data) | TBD (Legal) | 3 days | None | [ ] |
| OFAC sanctions list verification | TBD (Compliance) | 1 day | None | [ ] |
| Legal sign-off on terms | TBD (Legal) | 2 days | Compliance review | [ ] |
| Design review — UI/UX polish | TBD (Design) | 2 days | None | [ ] |
| Accessibility audit (WCAG 2.1 AA) | TBD (Design) | 2 days | None | [ ] |
| Branding review — Coinbase logo usage | TBD (Brand) | 1 day | None | [ ] |
| Visual theme review — CNY cultural sensitivity | TBD (Marketing) | 1 day | None | [ ] |

### Phase 1 Exit Criteria

- [ ] All code review comments resolved
- [ ] Security team has approved smart contract for mainnet deployment
- [ ] Legal has signed off on all user-facing copy, T&Cs, and privacy policy
- [ ] Design has approved the visual experience
- [ ] No critical or high-severity findings remain open

---

## Phase 2: Staging Deployment (Week 1-2)

Goal: Stand up a fully functional staging environment on Vercel that mirrors production, still pointing at Base Sepolia.

| Task | Owner | Est. Duration | Dependency | Done |
|------|-------|---------------|------------|------|
| Deploy frontend to Vercel (staging) | TBD (Eng) | 0.5 day | Phase 1 sign-off | [ ] |
| Provision production Neon Postgres instance | TBD (Eng) | 0.5 day | None | [ ] |
| Run DB migrations (packets, claims, rate_limits) | TBD (Eng) | 0.5 day | Neon provisioned | [ ] |
| Set up Alchemy or QuickNode RPC endpoint | TBD (Eng) | 0.5 day | None | [ ] |
| Configure production Twitter OAuth callback URL | TBD (Eng) | 0.5 day | Vercel deployed | [ ] |
| Set all environment variables in Vercel | TBD (Eng) | 0.5 day | All infra ready | [ ] |
| End-to-end testing on Base Sepolia via staging URL | TBD (QA) | 2 days | Staging live | [ ] |
| Load testing — `/api/packets/[id]/claim` endpoint | TBD (Eng) | 1 day | Staging live | [ ] |
| Load testing — OG image generation endpoint | TBD (Eng) | 1 day | Staging live | [ ] |
| Verify IP sanctions blocking on Vercel edge | TBD (QA) | 0.5 day | Staging live | [ ] |
| Custom favicon and app icons finalization | TBD (Design) | 1 day | None | [ ] |
| Meta tags and SEO review | TBD (Eng) | 0.5 day | Staging live | [ ] |
| OG image preview testing across X, iMessage, Discord | TBD (QA) | 1 day | Staging live | [ ] |

### Phase 2 Exit Criteria

- [ ] Staging URL is accessible and all flows work end-to-end
- [ ] OG images render correctly when shared on X (verified via Twitter Card Validator)
- [ ] IP sanctions middleware blocks sanctioned countries on Vercel
- [ ] API endpoints handle concurrent load without errors
- [ ] No regressions from Phase 1 review fixes

---

## Phase 3: Mainnet Preparation (Week 2)

Goal: Deploy the smart contract to Base mainnet and verify the complete flow works with real USDC.

| Task | Owner | Est. Duration | Dependency | Done |
|------|-------|---------------|------------|------|
| Generate production signer keypair (not deployer key) | TBD (Security) | 0.5 day | Security sign-off | [ ] |
| Securely store signer private key (vault/KMS) | TBD (Security) | 0.5 day | Keypair generated | [ ] |
| Deploy `RedPacket.sol` to Base mainnet | TBD (Eng) | 0.5 day | Security sign-off | [ ] |
| Verify contract source on Basescan | TBD (Eng) | 0.5 day | Contract deployed | [ ] |
| Update environment variables for mainnet | TBD (Eng) | 0.5 day | Contract deployed | [ ] |
| — `NEXT_PUBLIC_CHAIN_ID` = `8453` | | | | [ ] |
| — `NEXT_PUBLIC_USDC_ADDRESS` = `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | | | | [ ] |
| — `NEXT_PUBLIC_RED_PACKET_CONTRACT` = new mainnet address | | | | [ ] |
| — `SIGNER_PRIVATE_KEY` = production signer | | | | [ ] |
| — `NEXT_PUBLIC_BASE_RPC_URL` = Alchemy/QuickNode mainnet | | | | [ ] |
| Full create flow test on mainnet (small amount) | TBD (Eng) | 0.5 day | Env vars updated | [ ] |
| Full claim flow test on mainnet | TBD (Eng) | 0.5 day | Packet created | [ ] |
| Full refund flow test on mainnet | TBD (Eng) | 0.5 day | Claim tested | [ ] |
| OG image verification via Twitter Card Validator | TBD (QA) | 0.5 day | Mainnet flow working | [ ] |
| Verify `pause()` and `unpause()` work from owner wallet | TBD (Eng) | 0.5 day | Contract deployed | [ ] |
| Verify `setSigner()` key rotation works | TBD (Eng) | 0.5 day | Contract deployed | [ ] |
| Document emergency runbook (pause, signer rotation) | TBD (Eng) | 1 day | All admin tested | [ ] |

### Phase 3 Exit Criteria

- [ ] Contract deployed to Base mainnet and verified on Basescan
- [ ] Production signer key is stored securely and is separate from deployer
- [ ] Full create, share, claim, and refund flow tested on mainnet with real USDC
- [ ] Emergency admin functions (`pause`, `setSigner`) tested and documented
- [ ] OG images confirmed rendering correctly when shared on X

---

## Phase 4: Soft Launch (Week 2-3)

Goal: Controlled internal rollout with real USDC to identify issues before public access.

| Task | Owner | Est. Duration | Dependency | Done |
|------|-------|---------------|------------|------|
| Enable invite-only access (allowlist or feature flag) | TBD (Eng) | 0.5 day | Phase 3 complete | [ ] |
| Distribute access to internal team (Coinbase employees) | TBD (PM) | 0.5 day | Invite-only active | [ ] |
| Internal team creates and sends real red packets | TBD (Team) | 3 days | Access distributed | [ ] |
| Monitor claim success/failure rates | TBD (Eng) | Ongoing | Soft launch active | [ ] |
| Monitor contract USDC balance vs expected | TBD (Eng) | Ongoing | Soft launch active | [ ] |
| Monitor error rates (API 4xx/5xx) | TBD (Eng) | Ongoing | Soft launch active | [ ] |
| Monitor anti-bot rejection rates | TBD (Eng) | Ongoing | Soft launch active | [ ] |
| Gather UX feedback from internal testers | TBD (PM) | 2 days | Testing underway | [ ] |
| Fix any P0/P1 issues found | TBD (Eng) | As needed | Issues identified | [ ] |
| Performance check — page load, claim latency | TBD (Eng) | 1 day | Soft launch active | [ ] |
| Confirm Vercel analytics and error tracking | TBD (Eng) | 0.5 day | Soft launch active | [ ] |

### Phase 4 Exit Criteria

- [ ] At least 10 packets created and claimed by internal testers
- [ ] No P0/P1 bugs remain open
- [ ] Claim success rate above 95% (for legitimate claims)
- [ ] Contract balance reconciles with expected values
- [ ] Internal team feedback addressed

---

## Phase 5: Public Launch (Week 3-4)

Goal: Open access to the public, announce via social channels, and monitor for abuse.

| Task | Owner | Est. Duration | Dependency | Done |
|------|-------|---------------|------------|------|
| Remove invite-only restriction | TBD (Eng) | 0.5 day | Phase 4 sign-off | [ ] |
| Final production environment check | TBD (Eng) | 0.5 day | Access opened | [ ] |
| Social media announcement on @CoinbaseAU | TBD (Marketing) | Launch day | Access opened | [ ] |
| Social media support on @Coinbase (if applicable) | TBD (Marketing) | Launch day | Marketing approval | [ ] |
| Community engagement — reply to early adopters | TBD (Marketing) | Ongoing | Announcement live | [ ] |
| Real-time monitoring dashboard | TBD (Eng) | Ongoing | Launch | [ ] |
| — Total packets created | | | | |
| — Total USDC deposited | | | | |
| — Total claims processed | | | | |
| — Anti-bot rejection count | | | | |
| — API error rate | | | | |
| Monitor for bot/abuse patterns | TBD (Eng) | Ongoing | Launch | [ ] |
| Standby to adjust anti-bot thresholds | TBD (Eng) | Ongoing | Launch | [ ] |
| Standby to `pause()` contract if critical issue found | TBD (Eng) | Ongoing | Launch | [ ] |
| Customer support readiness (FAQ, escalation path) | TBD (Support) | Launch day | FAQ created | [ ] |
| Post-launch daily status report (days 1-7) | TBD (PM) | 7 days | Launch | [ ] |

### Phase 5 Exit Criteria

- [ ] App is publicly accessible with no critical issues for 7 consecutive days
- [ ] No emergency pause required
- [ ] Anti-bot system effectively filtering automated claims
- [ ] Positive community reception on social media

---

## Phase 6: Post-Launch (Ongoing)

Goal: Operate, iterate, and plan for future events.

| Task | Owner | Est. Duration | Dependency | Done |
|------|-------|---------------|------------|------|
| Monitor anti-bot effectiveness weekly | TBD (Eng) | Ongoing | Launch stable | [ ] |
| Adjust anti-bot thresholds based on data | TBD (Eng) | As needed | Monitoring data | [ ] |
| Evaluate Coinbase Verified Account attestation integration | TBD (Eng) | 2 weeks | Post-launch data | [ ] |
| Evaluate Coinbase Smart Wallet support | TBD (Eng) | 2 weeks | Post-launch data | [ ] |
| User feedback collection and analysis | TBD (PM) | 2 weeks | Launch stable | [ ] |
| Consider expanding to additional regions/events | TBD (PM) | 4 weeks | Feedback analyzed | [ ] |
| Plan next holiday event (Mid-Autumn, Diwali, etc.) | TBD (PM) | 4 weeks | Performance reviewed | [ ] |
| Write post-mortem / retrospective | TBD (PM) | 1 week | Campaign ends | [ ] |
| Archive campaign metrics and learnings | TBD (PM) | 1 week | Retro complete | [ ] |
| Contract fund reconciliation and final accounting | TBD (Eng) | 1 week | Campaign ends | [ ] |

---

## Key Milestones

| Milestone | Target Date | Owner | Status |
|-----------|-------------|-------|--------|
| All internal reviews complete | End of Week 1 | TBD (PM) | Not started |
| Staging environment live on Vercel | Mid Week 2 | TBD (Eng) | Not started |
| Contract deployed to Base mainnet | End of Week 2 | TBD (Eng) | Not started |
| Full mainnet flow verified | End of Week 2 | TBD (QA) | Not started |
| Soft launch begins (internal) | Start of Week 3 | TBD (PM) | Not started |
| Soft launch sign-off | End of Week 3 | TBD (PM) | Not started |
| Public launch | Start of Week 4 | TBD (Marketing) | Not started |
| 7-day post-launch stability confirmed | End of Week 4 | TBD (Eng) | Not started |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Smart contract vulnerability discovered post-deploy | Low | Critical | Security review in Phase 1; `pause()` available; max $2,000 per packet caps exposure |
| Bot swarm drains packets before real users claim | Medium | High | Anti-bot system (account age, followers, rate limits); onchain Twitter dedup; can tighten thresholds |
| Twitter API rate limits during high traffic | Medium | Medium | Bearer token with elevated access; fail-closed design rejects rather than allows |
| Signer key compromise | Low | Critical | Key stored in secure vault; `pause()` + `setSigner()` for immediate rotation |
| Vercel outage during launch | Low | High | Vercel status monitoring; OG images cached at CDN layer |
| OFAC sanctions list update mid-campaign | Low | Medium | Country list in middleware is easy to update; redeploy takes minutes |
| Negative community reception | Low | Medium | Cultural sensitivity review in Phase 1; Marketing team engaged |
| High gas costs on Base during peak | Low | Low | Base L2 fees are consistently low; no action required unless Base congestion spike |

---

## Emergency Procedures

In the event of a critical issue during or after launch:

1. **Pause the contract** — Owner calls `pause()` to immediately block new packet creation and claims. Refunds remain available so creators can withdraw funds.
2. **Rotate the signer** — If the signing key is compromised, owner calls `setSigner(newAddress)` to invalidate all existing unsigned claims immediately.
3. **Disable frontend** — Set a maintenance flag in Vercel environment variables and redeploy, or temporarily password-protect the deployment.
4. **Communicate** — Post on @CoinbaseAU that the campaign is temporarily paused for maintenance. Do not disclose security details publicly until resolved.
5. **Investigate and remediate** — Identify root cause, apply fix, test on staging, then unpause.

**Emergency contacts:** TBD (populate with on-call engineers and PM before launch)

---

## Appendix: Environment Variable Checklist

All variables must be set in Vercel before each phase transition.

| Variable | Sepolia Value | Mainnet Value | Set |
|----------|---------------|---------------|-----|
| `NEXT_PUBLIC_CHAIN_ID` | `84532` | `8453` | [ ] |
| `NEXT_PUBLIC_USDC_ADDRESS` | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | [ ] |
| `NEXT_PUBLIC_RED_PACKET_CONTRACT` | `0x1329B01e6fa433dB925426521d473131179c5738` | TBD (after mainnet deploy) | [ ] |
| `NEXT_PUBLIC_BASE_RPC_URL` | Public Sepolia RPC | Alchemy/QuickNode mainnet | [ ] |
| `SIGNER_PRIVATE_KEY` | Dev signer | Production signer (vault) | [ ] |
| `DATABASE_URL` | Dev Neon instance | Production Neon instance | [ ] |
| `AUTH_URL` | `http://localhost:3002` | Production domain | [ ] |
| `AUTH_SECRET` | Dev secret | Production secret | [ ] |
| `AUTH_TWITTER_ID` | Dev app ID | Production app ID | [ ] |
| `AUTH_TWITTER_SECRET` | Dev app secret | Production app secret | [ ] |
| `TWITTER_BEARER_TOKEN` | Dev token | Production token | [ ] |
| `NEXT_PUBLIC_ONCHAINKIT_API_KEY` | Dev key | Production key | [ ] |
