"use client";

import { useReadContract } from "wagmi";
import { baseSepolia, base } from "wagmi/chains";
import { RED_PACKET_CONTRACT, RED_PACKET_ABI, CHAIN_ID } from "@/lib/constants";
import type { Packet } from "@/lib/types";

const chain = CHAIN_ID === 8453 ? base : baseSepolia;

export function useRedPacket(packetId: number) {
  const { data, isLoading, error, refetch } = useReadContract({
    chainId: chain.id,
    address: RED_PACKET_CONTRACT,
    abi: RED_PACKET_ABI,
    functionName: "packets",
    args: [BigInt(packetId)],
  });

  const d = data as unknown as unknown[] | undefined;
  const packet: Packet | null = d
    ? {
        packetId,
        creator: d[0] as string,
        totalAmount: d[1] as bigint,
        remainingAmount: d[2] as bigint,
        totalClaims: Number(d[3]),
        claimedCount: Number(d[4]),
        expiry: Number(d[5]),
        isRandom: d[6] as boolean,
        refunded: d[7] as boolean,
      }
    : null;

  return { packet, isLoading, error, refetch };
}
