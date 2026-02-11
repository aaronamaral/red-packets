"use client";

import { useEffect, useState, use } from "react";
import { useSession } from "next-auth/react";
import { useAccount } from "wagmi";
import { motion, AnimatePresence } from "framer-motion";
import { PacketCard } from "@/components/red-packet/packet-card";
import { ClaimResult } from "@/components/red-packet/claim-result";
import { ShareCta } from "@/components/red-packet/share-cta";
import { PacketStatus } from "@/components/red-packet/packet-status";
import { TwitterSignIn } from "@/components/auth/twitter-sign-in";
import { WalletWrapper } from "@/components/wallet/wallet-wrapper";
import { Button } from "@/components/ui/button";
import { useClaimPacket } from "@/hooks/use-claim-packet";
import type { PacketInfo } from "@/lib/types";
import Link from "next/link";

export default function ClaimPage({ params }: { params: Promise<{ packetId: string }> }) {
  const { packetId: uuid } = use(params);

  const { data: session } = useSession();
  const { address, isConnected } = useAccount();
  const [packetInfo, setPacketInfo] = useState<PacketInfo | null>(null);
  const [onchainPacketId, setOnchainPacketId] = useState<number>(0);

  const {
    claimState,
    setClaimState,
    claimedAmount,
    error,
    requestSignature,
    executeClaim,
  } = useClaimPacket(uuid, onchainPacketId);

  useEffect(() => {
    async function fetchPacket() {
      try {
        const res = await fetch(`/api/packets/${uuid}`);
        if (!res.ok) {
          setClaimState("error");
          return;
        }
        const data = await res.json();
        setPacketInfo(data);
        setOnchainPacketId(data.packetId);

        if (data.isExpired) {
          setClaimState("expired");
        } else if (data.isFullyClaimed) {
          setClaimState("fully_claimed");
        } else {
          setClaimState("sealed");
        }
      } catch {
        setClaimState("error");
      }
    }
    fetchPacket();
  }, [uuid, setClaimState]);

  async function handleOpen() {
    if (!session?.user) {
      setClaimState("auth_required");
      return;
    }
    if (!isConnected || !address) {
      setClaimState("connecting_wallet");
      return;
    }

    setClaimState("ready");
    const sigData = await requestSignature(address);
    if (sigData) {
      await executeClaim(address, sigData);
    }
  }

  function renderContent() {
    switch (claimState) {
      case "loading":
        return (
          <div className="text-center py-20">
            <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-cream/60">Loading red packet...</p>
          </div>
        );

      case "sealed":
        return (
          <div className="flex flex-col items-center">
            <PacketCard
              state="sealed"
              creatorHandle={packetInfo?.creator?.twitterHandle}
              creatorAvatar={packetInfo?.creator?.twitterAvatar}
              onClick={handleOpen}
            />
            {packetInfo && (
              <div className="mt-6 w-full max-w-[320px]">
                <PacketStatus
                  claimed={packetInfo.claimedCount}
                  total={packetInfo.totalClaims}
                  isRandom={packetInfo.isRandom}
                />
              </div>
            )}
          </div>
        );

      case "auth_required":
        return (
          <div className="flex flex-col items-center gap-6">
            <PacketCard state="sealed" creatorHandle={packetInfo?.creator?.twitterHandle} />
            <div className="text-center">
              <p className="text-gold-light mb-4">Sign in with X to claim</p>
              <TwitterSignIn />
            </div>
          </div>
        );

      case "auth_failed":
        return (
          <div className="flex flex-col items-center text-center">
            <PacketCard state="sealed" creatorHandle={packetInfo?.creator?.twitterHandle} />
            <div className="mt-6 max-w-sm">
              <p className="text-red-light font-semibold mb-2">Unable to claim</p>
              <p className="text-cream/60 text-sm">
                {error === "account_too_new"
                  ? "Your X account must be at least 30 days old."
                  : error === "insufficient_followers"
                  ? "You need at least 10 followers to claim."
                  : error === "rate_limited"
                  ? "You've claimed too many packets today. Try again tomorrow."
                  : error === "missing_profile_data"
                  ? "Unable to verify your account. Please try again."
                  : error || "Something went wrong."}
              </p>
            </div>
          </div>
        );

      case "connecting_wallet":
        return (
          <div className="flex flex-col items-center">
            <PacketCard state="sealed" creatorHandle={packetInfo?.creator?.twitterHandle} />
            <div className="mt-6 text-center">
              <p className="text-cream/60 mb-4">Connect your wallet to receive USDC</p>
              <WalletWrapper />
            </div>
          </div>
        );

      case "ready":
      case "claiming":
        return (
          <div className="flex flex-col items-center">
            <PacketCard state="sealed" creatorHandle={packetInfo?.creator?.twitterHandle} />
            <div className="mt-6">
              <Button variant="gold" size="lg" disabled>
                {claimState === "ready" ? "Preparing..." : "Claiming..."}
              </Button>
            </div>
          </div>
        );

      case "opening":
        return (
          <motion.div
            initial={{ scale: 1 }}
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center"
          >
            <PacketCard state="opening" creatorHandle={packetInfo?.creator?.twitterHandle} />
          </motion.div>
        );

      case "revealed":
        return (
          <div className="flex flex-col items-center relative">
            <PacketCard state="opened" creatorHandle={packetInfo?.creator?.twitterHandle}>
              <ClaimResult amount={claimedAmount || "$0.00"} />
            </PacketCard>
            <div className="mt-6 w-full max-w-[320px]">
              <ShareCta
                packetId={uuid}
                handle={session?.user?.twitterHandle || ""}
                amount={claimedAmount || undefined}
              />
            </div>
          </div>
        );

      case "already_claimed":
        return (
          <div className="flex flex-col items-center text-center">
            <PacketCard state="opened" creatorHandle={packetInfo?.creator?.twitterHandle}>
              <div>
                <p className="text-gold-light text-lg font-semibold">Already claimed</p>
                <p className="text-gold-light/60 text-sm mt-1">You&apos;ve already opened this packet</p>
              </div>
            </PacketCard>
            <div className="mt-6">
              <Link href="/create">
                <Button variant="gold">Share your own blessings</Button>
              </Link>
            </div>
          </div>
        );

      case "expired":
        return (
          <div className="flex flex-col items-center text-center">
            <div className="text-4xl mb-4">⏰</div>
            <h2 className="text-xl font-bold text-cream mb-2">Packet expired</h2>
            <p className="text-cream/60 mb-6">This red packet has expired</p>
            <Link href="/create">
              <Button variant="gold">Create your own</Button>
            </Link>
          </div>
        );

      case "fully_claimed":
        return (
          <div className="flex flex-col items-center text-center">
            <div className="text-4xl mb-4">🎊</div>
            <h2 className="text-xl font-bold text-cream mb-2">All claimed!</h2>
            <p className="text-cream/60 mb-6">This red packet has been fully claimed</p>
            <Link href="/create">
              <Button variant="gold">Share your own blessings</Button>
            </Link>
          </div>
        );

      case "error":
        return (
          <div className="flex flex-col items-center text-center">
            <div className="text-4xl mb-4">😕</div>
            <h2 className="text-xl font-bold text-cream mb-2">Something went wrong</h2>
            <p className="text-cream/60 mb-6">{error || "Failed to load red packet"}</p>
            <Button variant="secondary" onClick={() => window.location.reload()}>
              Try again
            </Button>
          </div>
        );
    }
  }

  return (
    <main className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-8 py-5 border-b border-white/10">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl">🧧</span>
          <span className="font-bold text-xl text-cream">Red Packets</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/my-packets" className="inline-flex items-center px-4 py-1.5 text-sm font-semibold rounded-xl bg-gold/15 border border-gold/30 text-gold hover:bg-gold/25 transition-all">
            My Packets
          </Link>
          <TwitterSignIn />
          {claimState !== "auth_required" && claimState !== "connecting_wallet" && (
            <WalletWrapper />
          )}
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={claimState}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-lg"
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </div>

      <footer className="px-6 py-6 border-t border-white/10 text-center">
        <div className="flex items-center justify-center gap-2 text-xs text-cream/30">
          <span>Powered by</span>
          <span className="font-semibold text-cream/50">Coinbase</span>
          <span>on</span>
          <span className="font-semibold text-blue-400/60">Base</span>
        </div>
      </footer>
    </main>
  );
}
