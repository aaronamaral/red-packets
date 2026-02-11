"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useAccount, useWriteContract, useSwitchChain } from "wagmi";
import { baseSepolia, base } from "wagmi/chains";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TwitterSignIn } from "@/components/auth/twitter-sign-in";
import { WalletWrapper } from "@/components/wallet/wallet-wrapper";
import { PacketCard } from "@/components/red-packet/packet-card";
import { useRedPacket } from "@/hooks/use-red-packet";
import { formatUSDC, generateShareUrl, generateTweetText, generateTweetIntentUrl } from "@/lib/utils";
import { RED_PACKET_CONTRACT, RED_PACKET_ABI, CHAIN_ID } from "@/lib/constants";
import Link from "next/link";

const chain = CHAIN_ID === 8453 ? base : baseSepolia;

interface CreatedPacket {
  id: string; // UUID
  packet_id: number;
  creator_address: string;
  creator_twitter_handle: string;
  tx_hash: string;
  created_at: string;
}

function PacketTile({ packet }: { packet: CreatedPacket }) {
  const { packet: onchain } = useRedPacket(packet.packet_id);
  const { chainId: walletChainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [refunding, setRefunding] = useState(false);
  const [refunded, setRefunded] = useState(false);
  const [copied, setCopied] = useState(false);

  const isExpired = onchain ? Date.now() / 1000 >= onchain.expiry : false;
  const isFullyClaimed = onchain ? onchain.claimedCount >= onchain.totalClaims : false;
  const hasRemaining = onchain ? onchain.remainingAmount > BigInt(0) : false;
  const canRefund = onchain && !onchain.refunded && !refunded && hasRemaining;

  const shareUrl = generateShareUrl(packet.id, packet.creator_twitter_handle);
  const tweetText = generateTweetText(packet.id, packet.creator_twitter_handle);
  const tweetUrl = generateTweetIntentUrl(tweetText);

  async function handleRefund() {
    setRefunding(true);
    try {
      if (walletChainId !== chain.id) {
        await switchChainAsync({ chainId: chain.id });
      }
      await writeContractAsync({
        chainId: chain.id,
        address: RED_PACKET_CONTRACT,
        abi: RED_PACKET_ABI,
        functionName: "refund",
        args: [BigInt(packet.packet_id)],
      });
      setRefunded(true);
    } catch (err) {
      console.error("Refund failed:", err);
    }
    setRefunding(false);
  }

  function handleCopy() {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col w-[280px]">
      {/* Packet card with number overlay — both float together */}
      <div className="relative animate-float">
        <Link href={`/claim/${packet.id}?bless=${encodeURIComponent(packet.creator_twitter_handle)}`}>
          <PacketCard
            state="sealed"
            mode="preview"
            creatorHandle={packet.creator_twitter_handle}
            className="!max-w-none !animate-none hover:!scale-100 active:!scale-100"
          />
        </Link>
        {/* Number circle — top left */}
        <div className="absolute -top-3 -left-3 z-20 w-8 h-8 rounded-full bg-background border-2 border-gold/40 flex items-center justify-center shadow-lg">
          <span className="text-sm font-bold text-gold">{packet.packet_id + 1}</span>
        </div>
      </div>

      {/* Info + actions below the card */}
      <div className="mt-3 space-y-2 w-full">
        {/* Status bar */}
        {onchain && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-cream/50">
              {formatUSDC(onchain.totalAmount - onchain.remainingAmount)}/{formatUSDC(onchain.totalAmount)} USDC claimed
            </span>
            <span className={`font-medium ${
              refunded || onchain.refunded ? "text-cream/40" :
              isFullyClaimed ? "text-green-400" :
              isExpired ? "text-gold" :
              "text-green-400"
            }`}>
              {refunded || onchain.refunded ? "Refunded" :
               isFullyClaimed ? "Complete" :
               isExpired ? "Expired" :
               `${onchain.claimedCount}/${onchain.totalClaims} opened`}
            </span>
          </div>
        )}

        {/* Progress bar */}
        {onchain && (
          <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gold/70 rounded-full transition-all duration-500"
              style={{ width: `${(onchain.claimedCount / onchain.totalClaims) * 100}%` }}
            />
          </div>
        )}

        {/* Share buttons */}
        <div className="flex gap-1.5">
          <a href={tweetUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
            <Button variant="secondary" size="sm" className="w-full gap-1.5 text-xs">
              Share
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </Button>
          </a>
          <Button variant="secondary" size="sm" className="text-xs" onClick={handleCopy}>
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>

        {/* Refund / Withdraw */}
        {canRefund && (
          <Button
            variant="gold"
            size="sm"
            className="w-full"
            onClick={handleRefund}
            disabled={refunding}
          >
            {refunding ? "Withdrawing..." : `Withdraw ${onchain ? formatUSDC(onchain.remainingAmount) : ""} USDC`}
          </Button>
        )}
        {(refunded || onchain?.refunded) && (
          <p className="text-center text-xs text-cream/40">Remaining withdrawn</p>
        )}
      </div>
    </div>
  );
}

export default function MyPacketsPage() {
  const { data: session } = useSession();
  const { isConnected } = useAccount();
  const [created, setCreated] = useState<CreatedPacket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user) return;

    async function fetchPackets() {
      try {
        const res = await fetch("/api/packets");
        if (res.ok) {
          const data = await res.json();
          setCreated(data.created || []);
        }
      } catch (err) {
        console.error("Failed to fetch packets:", err);
      }
      setLoading(false);
    }
    fetchPackets();
  }, [session]);

  if (!session?.user) {
    return (
      <main className="min-h-screen flex flex-col">
        <header className="flex items-center justify-between px-8 py-5 border-b border-white/10">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🧧</span>
            <span className="font-bold text-xl text-cream">Red Packets</span>
          </Link>
          <div className="flex items-center gap-2">
            <TwitterSignIn />
            <WalletWrapper />
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center px-6">
          <Card className="max-w-md w-full text-center">
            <h2 className="text-2xl font-bold text-cream mb-4">Sign in to view</h2>
            <p className="text-cream/60 mb-6">Connect your X account to see your packets</p>
            <TwitterSignIn />
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-8 py-5 border-b border-white/10">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl">🧧</span>
          <span className="font-bold text-xl text-cream">Red Packets</span>
        </Link>
        <div className="flex items-center gap-2">
          <TwitterSignIn />
          <WalletWrapper />
        </div>
      </header>

      <div className="flex-1 px-6 py-12 max-w-6xl mx-auto w-full">
        <h1 className="text-3xl font-bold text-cream mb-8">My Packets</h1>

        {!isConnected && created.length > 0 && (
          <Card className="text-center mb-8">
            <p className="text-cream/60 mb-3 text-sm">Connect your wallet to withdraw remaining funds</p>
            <WalletWrapper />
          </Card>
        )}

        {loading ? (
          <div className="text-center py-20">
            <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-cream/60">Loading your packets...</p>
          </div>
        ) : created.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-y-20 gap-x-12 [&>*]:mx-auto">
            {created.map((p) => (
              <PacketTile key={p.id} packet={p} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center py-16">
            <Link href="/create">
              <PacketCard state="sealed" mode="demo" className="!max-w-none w-[280px]" />
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
