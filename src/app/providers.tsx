"use client";

import { ReactNode } from "react";
import { OnchainKitProvider } from "@coinbase/onchainkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { baseSepolia, base } from "wagmi/chains";
import { coinbaseWallet, injected } from "wagmi/connectors";
import { SessionProvider } from "next-auth/react";

const BASE_SEPOLIA_RPC = process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://sepolia.base.org";

const wagmiConfig = createConfig({
  chains: [baseSepolia, base],
  connectors: [
    injected(),
    coinbaseWallet({
      appName: "Red Packets",
      preference: "all",
    }),
  ],
  transports: {
    [baseSepolia.id]: http(BASE_SEPOLIA_RPC),
    [base.id]: http("https://mainnet.base.org"),
  },
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
      throwOnError: false,
    },
  },
});

const activeChain =
  process.env.NEXT_PUBLIC_CHAIN_ID === "8453" ? base : baseSepolia;

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <OnchainKitProvider
            chain={activeChain}
            apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
          >
            {children}
          </OnchainKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </SessionProvider>
  );
}
