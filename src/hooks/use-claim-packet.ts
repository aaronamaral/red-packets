"use client";

import { useState } from "react";
import { useWriteContract, useAccount, useSwitchChain, usePublicClient } from "wagmi";
import { baseSepolia, base } from "wagmi/chains";
import { decodeEventLog, formatUnits } from "viem";
import { RED_PACKET_CONTRACT, RED_PACKET_ABI, CHAIN_ID, USDC_DECIMALS } from "@/lib/constants";
import type { ClaimState, ClaimSignatureResponse } from "@/lib/types";

const chain = CHAIN_ID === 8453 ? base : baseSepolia;

export function useClaimPacket(uuid: string, onchainPacketId: number) {
  const { chainId: walletChainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient({ chainId: chain.id });
  const { writeContractAsync } = useWriteContract();

  const [claimState, setClaimState] = useState<ClaimState>("loading");
  const [claimedAmount, setClaimedAmount] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function requestSignature(claimerAddress: string): Promise<ClaimSignatureResponse | null> {
    try {
      const res = await fetch(`/api/packets/${uuid}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimerAddress }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.reason === "already_claimed") {
          setClaimState("already_claimed");
        } else if (data.reason === "packet_expired") {
          setClaimState("expired");
        } else if (data.reason === "packet_full") {
          setClaimState("fully_claimed");
        } else {
          setClaimState("auth_failed");
          setError(data.reason || data.error);
        }
        return null;
      }

      return await res.json();
    } catch {
      setClaimState("error");
      setError("Failed to get claim signature");
      return null;
    }
  }

  async function executeClaim(
    claimerAddress: `0x${string}`,
    signatureData: ClaimSignatureResponse
  ) {
    if (!publicClient) return;
    setClaimState("claiming");

    try {
      if (walletChainId !== chain.id) {
        await switchChainAsync({ chainId: chain.id });
      }

      const txHash = await writeContractAsync({
        chainId: chain.id,
        address: RED_PACKET_CONTRACT,
        abi: RED_PACKET_ABI,
        functionName: "claim",
        args: [
          BigInt(onchainPacketId),
          signatureData.twitterUserId,
          BigInt(signatureData.nonce),
          signatureData.signature as `0x${string}`,
        ],
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

      let amount = "0.00";
      for (const log of receipt.logs) {
        try {
          const event = decodeEventLog({
            abi: RED_PACKET_ABI,
            data: log.data,
            topics: log.topics,
          });
          if (event.eventName === "PacketClaimed") {
            const args = event.args as { amount: bigint };
            amount = formatUnits(args.amount, USDC_DECIMALS);
            break;
          }
        } catch {
          // Not our event, skip
        }
      }

      setClaimedAmount(`$${parseFloat(amount).toFixed(2)}`);
      setClaimState("opening");

      // Verify on-chain and record amount in DB
      try {
        await fetch(`/api/packets/${uuid}/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ txHash }),
        });
      } catch {
        // Non-critical
      }

      setTimeout(() => {
        setClaimState("revealed");
      }, 1500);
    } catch (err) {
      console.error("Claim failed:", err);
      setClaimState("error");
      setError(err instanceof Error ? err.message : "Transaction failed");
    }
  }

  return {
    claimState,
    setClaimState,
    claimedAmount,
    error,
    requestSignature,
    executeClaim,
  };
}
