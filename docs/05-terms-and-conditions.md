# Terms & Conditions

**DRAFT -- Requires Legal Review**

> **Notice:** This document is an internal draft prepared by the engineering team. It has NOT been reviewed or approved by legal counsel. It must undergo formal legal review before publication. Do not publish or distribute this document in its current form.

**Last Updated:** [DATE]

---

## 1. Introduction

These Terms & Conditions ("Terms") govern your access to and use of the Red Packets on Base service ("Service"), a web application that enables users to send and receive USDC red packets on the Base blockchain network. By accessing or using the Service, you agree to be bound by these Terms. If you do not agree, do not use the Service.

The Service is operated by [ENTITY NAME] ("we," "us," or "our").

## 2. Service Description

The Service allows users to:

- **Create Red Packets:** Deposit USDC (up to $2,000 per packet) into a smart contract on the Base blockchain, specifying the number of recipients (up to 200), a distribution method (equal or random split), and an expiry window (up to 24 hours).
- **Share Red Packets:** Generate shareable links for distribution on Twitter/X and other platforms.
- **Claim Red Packets:** Receive a portion of the deposited USDC from a red packet after authenticating via Twitter/X and connecting a compatible cryptocurrency wallet.
- **Refund Red Packets:** Withdraw unclaimed USDC from a red packet at any time before all claims are fulfilled.

The Service interacts with the RedPacket smart contract deployed on the Base blockchain. All deposits, claims, and refunds are executed as on-chain transactions.

## 3. Eligibility

To use the Service, you must:

- Be at least 18 years of age, or the age of legal majority in your jurisdiction, whichever is greater.
- Not be a resident of, located in, or a national of any country or territory subject to comprehensive economic sanctions imposed by the United States (including but not limited to Cuba, Iran, North Korea, Syria, and Russia) or any other applicable sanctions regime.
- Not be listed on any applicable sanctions list, including but not limited to the U.S. Office of Foreign Assets Control (OFAC) Specially Designated Nationals and Blocked Persons List (SDN List), the EU Consolidated Financial Sanctions List, or the UK HM Treasury Sanctions List.
- Comply with all applicable laws and regulations in your jurisdiction, including those related to cryptocurrency, digital assets, and financial services.

We implement geo-blocking using IP-based country detection to restrict access from sanctioned jurisdictions. Circumvention of these controls (e.g., via VPN) constitutes a violation of these Terms and may subject you to legal liability.

## 4. Account Requirements

### 4.1 Twitter/X Account

The Service requires authentication via Twitter/X OAuth 2.0 to create or claim red packets. By authenticating, you authorize us to access your Twitter/X user ID, username, profile image URL, account creation date, and public follower count. This data is used solely for anti-bot verification, claim deduplication, and OG image generation.

Your Twitter/X account must meet minimum thresholds to claim red packets:

- Account age of at least 30 days.
- A minimum of 10 followers.

These thresholds are subject to change without notice and are designed to prevent bot abuse.

### 4.2 Cryptocurrency Wallet

You must connect a compatible Ethereum/Base wallet (e.g., Coinbase Wallet, MetaMask, or any injected EIP-1193 provider) to create, claim, or refund red packets. You are solely responsible for the security and management of your wallet, including its private keys and seed phrases.

## 5. How Red Packets Work

### 5.1 Creation

When you create a red packet, you approve and transfer USDC from your wallet to the RedPacket smart contract. The contract holds the funds in escrow. You specify:

- **Amount:** Between $0.01 and $2,000.00 in USDC (6 decimal precision).
- **Number of Claims:** Between 1 and 200 recipients.
- **Split Type:** Equal distribution or randomized distribution.
- **Expiry:** Between 1 and 24 hours from the time of creation.

The minimum amount per claim is $0.01 USDC. Creation requires an on-chain transaction and the payment of associated gas fees.

### 5.2 Claims

To claim a red packet, a user must:

1. Authenticate via Twitter/X.
2. Connect a cryptocurrency wallet.
3. Pass anti-bot verification checks.
4. Submit a claim transaction to the smart contract.

The backend server signs an EIP-712 typed data message authorizing the claim. The smart contract verifies this signature before releasing funds. Each Twitter/X account may claim a given red packet only once, and each wallet address may claim a given red packet only once. These restrictions are enforced both off-chain (database) and on-chain (smart contract mappings).

Claim amounts for random-split packets are determined pseudo-randomly on-chain and are bounded between 20% and 200% of the average share per recipient.

### 5.3 Refunds

The creator of a red packet may withdraw any unclaimed USDC at any time by calling the refund function on the smart contract. Refunds are executed as on-chain transactions and are subject to gas fees. Once a packet is refunded, no further claims may be made against it.

### 5.4 Expiry

Once a red packet's expiry time has passed, no further claims may be made. The creator may still refund unclaimed funds after expiry.

## 6. User Responsibilities

You acknowledge and agree that:

- You are solely responsible for the security of your cryptocurrency wallet, private keys, and seed phrases. We do not have access to and cannot recover your wallet credentials.
- You are responsible for paying all gas fees (denominated in ETH on the Base network) associated with your transactions, including creating, claiming, and refunding red packets.
- You are responsible for ensuring that your use of the Service complies with all applicable laws and regulations in your jurisdiction.
- You must not share or transfer your authentication credentials to third parties.
- You must not use automated tools, scripts, or bots to interact with the Service except through the provided user interface.

## 7. Prohibited Uses

You agree not to use the Service for any of the following purposes:

- **Money laundering** or the financing of terrorism, including structuring transactions to evade reporting thresholds.
- **Sanctions evasion**, including facilitating transactions for or on behalf of sanctioned persons, entities, or jurisdictions.
- **Fraud**, including creating red packets with the intent to deceive or defraud recipients.
- **Market manipulation** or any activity that would violate applicable securities laws.
- **Distribution of illegal content** via packet messages or associated social media posts.
- **Circumvention of access controls**, including geo-blocking, anti-bot measures, or claim deduplication mechanisms.
- **Sybil attacks**, including using multiple Twitter/X accounts or wallets to claim the same red packet more than once.
- **Exploitation of smart contract vulnerabilities**, including but not limited to reentrancy attacks, front-running, or manipulation of on-chain randomness.
- Any other activity that violates applicable law or these Terms.

## 8. Service Availability

The Service is provided on an "as-is" and "as-available" basis. We do not guarantee:

- Continuous, uninterrupted, or error-free operation of the Service.
- Availability of the Twitter/X OAuth service, the Base blockchain network, the Neon Postgres database, or any other third-party dependency.
- That the Service will be free of viruses, malware, or other harmful components.

We reserve the right to suspend or discontinue the Service, in whole or in part, at any time, with or without notice, for any reason, including but not limited to:

- Maintenance, upgrades, or security patches.
- Detection of fraudulent or abusive activity.
- Changes in applicable law or regulation.
- Exercise of the smart contract's emergency pause functionality.

## 9. Blockchain Risks

You acknowledge and accept the following risks inherent to blockchain-based services:

- **Irreversibility:** Blockchain transactions, once confirmed, cannot be reversed, cancelled, or modified. Funds sent to an incorrect address cannot be recovered.
- **Gas Costs:** All on-chain transactions require the payment of gas fees in ETH. Gas prices fluctuate and are outside our control.
- **Smart Contract Risk:** The RedPacket smart contract has been internally reviewed and tested with 56 unit tests using the Foundry framework. However, it has NOT undergone a formal third-party security audit. Smart contracts may contain undiscovered bugs or vulnerabilities that could result in the loss of funds.
- **Network Risk:** The Base blockchain may experience congestion, outages, forks, or other disruptions that could delay or prevent transaction execution.
- **Pseudo-Random Fairness:** For random-split red packets, claim amounts are determined using on-chain pseudo-random number generation (based on `blockhash`). This method is deterministic and may be influenced by block producers (sequencers). It is NOT cryptographically secure randomness.
- **Regulatory Risk:** The regulatory status of cryptocurrencies and blockchain-based services varies by jurisdiction and is subject to change. Changes in applicable law could affect the availability or legality of the Service.
- **Wallet Security:** Loss of wallet private keys or seed phrases results in permanent loss of access to associated funds. We cannot recover lost credentials.
- **Price Volatility:** While USDC is designed to maintain a 1:1 peg with the US Dollar, the actual value of USDC may fluctuate. We make no guarantees regarding the value of USDC.

## 10. Intellectual Property

### 10.1 Coinbase Branding

The Coinbase name, logo, wordmark, and associated brand assets are trademarks of Coinbase, Inc. Use of Coinbase branding within the Service is subject to the Coinbase Brand Guidelines and any applicable licensing agreements. You may not use, reproduce, or distribute Coinbase branding without express written authorization from Coinbase, Inc.

### 10.2 Service Content

All original content, code, design, and documentation associated with the Service (excluding third-party libraries and the Coinbase brand assets) are the property of [ENTITY NAME] or its licensors and are protected by applicable intellectual property laws.

### 10.3 Open-Source Components

The Service incorporates open-source software components, including but not limited to OpenZeppelin Contracts, Next.js, React, Wagmi, and Viem. These components are subject to their respective open-source licenses.

## 11. Limitation of Liability

TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW:

- WE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, LOSS OF DATA, LOSS OF FUNDS, OR LOSS OF GOODWILL, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICE.
- OUR TOTAL AGGREGATE LIABILITY FOR ALL CLAIMS ARISING OUT OF OR IN CONNECTION WITH THESE TERMS OR THE SERVICE SHALL NOT EXCEED THE GREATER OF (A) THE TOTAL AMOUNT OF USDC YOU HAVE DEPOSITED INTO RED PACKETS DURING THE 12 MONTHS PRECEDING THE CLAIM, OR (B) $100.00 USD.
- WE ARE NOT LIABLE FOR ANY LOSSES ARISING FROM SMART CONTRACT BUGS, BLOCKCHAIN NETWORK FAILURES, THIRD-PARTY SERVICE OUTAGES (INCLUDING TWITTER/X AND THE BASE NETWORK), OR UNAUTHORIZED ACCESS TO YOUR WALLET OR CREDENTIALS.

## 12. Indemnification

You agree to indemnify, defend, and hold harmless [ENTITY NAME], its officers, directors, employees, agents, and affiliates from and against any and all claims, damages, losses, liabilities, costs, and expenses (including reasonable attorneys' fees) arising out of or in connection with:

- Your use of the Service.
- Your violation of these Terms.
- Your violation of any applicable law, regulation, or the rights of any third party.
- Any transaction you initiate through the Service, including claims, refunds, and red packet creation.

## 13. Dispute Resolution

### 13.1 Governing Law

These Terms shall be governed by and construed in accordance with the laws of [JURISDICTION], without regard to its conflict of laws principles.

### 13.2 Arbitration

Any dispute, claim, or controversy arising out of or relating to these Terms or the Service shall be resolved by binding arbitration administered by [ARBITRATION BODY] in accordance with its then-current rules. The arbitration shall be conducted in [CITY, STATE/COUNTRY]. The language of the arbitration shall be English. The arbitrator's decision shall be final and binding.

### 13.3 Class Action Waiver

YOU AGREE THAT ANY DISPUTE RESOLUTION PROCEEDINGS WILL BE CONDUCTED ON AN INDIVIDUAL BASIS AND NOT IN A CLASS, CONSOLIDATED, OR REPRESENTATIVE ACTION. YOU WAIVE ANY RIGHT TO PARTICIPATE IN A CLASS ACTION LAWSUIT OR CLASS-WIDE ARBITRATION.

### 13.4 Exceptions

Notwithstanding the foregoing, either party may seek injunctive or equitable relief in any court of competent jurisdiction to prevent the actual or threatened infringement, misappropriation, or violation of intellectual property rights.

## 14. Modification of Terms

We reserve the right to modify these Terms at any time. If we make material changes, we will provide notice through the Service or by other means. Your continued use of the Service after such notice constitutes acceptance of the modified Terms.

Changes to these Terms will not apply retroactively to transactions completed before the effective date of the modification.

## 15. Severability

If any provision of these Terms is held to be invalid, illegal, or unenforceable, the remaining provisions shall continue in full force and effect.

## 16. Entire Agreement

These Terms, together with the Privacy Policy and any other documents incorporated by reference, constitute the entire agreement between you and [ENTITY NAME] regarding your use of the Service.

## 17. Contact Information

For questions or concerns regarding these Terms, please contact:

- **Email:** [CONTACT EMAIL]
- **Entity:** [ENTITY NAME]
- **Address:** [PHYSICAL ADDRESS]

---

> **DRAFT NOTICE:** This document is a preliminary draft and has not been reviewed by legal counsel. Placeholders marked with [BRACKETS] must be completed before publication. This document should not be relied upon as legal advice or published in any form without prior review and approval by qualified legal professionals. Key areas requiring legal review include: entity structure, jurisdictional analysis, regulatory compliance (money transmitter, securities), arbitration clause enforceability, GDPR/CCPA implications, and Coinbase brand licensing terms.
