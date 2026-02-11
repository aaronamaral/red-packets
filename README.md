# Red Packets on Base

Lunar New Year-themed web app for sending USDC red packets on Base. Create packets loaded with USDC, share them on X, and let recipients open their blessing.

## Quick Start

```bash
cp .env.example .env.local   # Fill in credentials
npm install
npm run dev
```

## Documentation

- **[CLAUDE.md](./CLAUDE.md)** — Full architecture, user flows, security model, deployment checklist
- **[contracts/README.md](./contracts/README.md)** — Smart contract documentation, functions, and 56-test suite

## Stack

- **Frontend:** Next.js 15, React 19, TypeScript, Tailwind CSS, Framer Motion
- **Contract:** Solidity 0.8.24 (Foundry) on Base
- **Auth:** Twitter OAuth 2.0 via NextAuth v5
- **Database:** Neon Postgres (serverless)
- **Wallet:** Wagmi v2, Viem

## License

MIT
