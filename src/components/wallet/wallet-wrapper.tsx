"use client";

import { useState, useEffect } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";

function shortenAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function WalletWrapper() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Render connect button on server and until client mounts — prevents hydration mismatch
  if (!mounted) {
    return (
      <button
        className="inline-flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-xl bg-white/10 hover:bg-white/20 text-cream border border-white/20 transition-all duration-200"
      >
        Connect Wallet
      </button>
    );
  }

  if (isConnected && address) {
    return (
      <div className="relative group">
        <div className="text-sm text-cream/80 font-medium cursor-default px-3 py-1.5 rounded-xl border border-transparent group-hover:border-white/20 group-hover:bg-white/5 transition-all duration-150">
          {shortenAddress(address)}
        </div>
        <div className="absolute left-0 right-0 top-full opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 pt-0.5">
          <button
            onClick={() => disconnect()}
            className="w-full text-sm text-cream/60 hover:text-cream hover:bg-white/10 border border-white/20 rounded-xl px-3 py-1.5 bg-background/95 backdrop-blur-sm transition-colors text-center"
          >
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => connect({ connector: injected() })}
      className="inline-flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-xl bg-white/10 hover:bg-white/20 text-cream border border-white/20 transition-all duration-200"
    >
      Connect Wallet
    </button>
  );
}
