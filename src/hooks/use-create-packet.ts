"use client";

import { useState, useCallback } from "react";
import { useAccount, useSwitchChain, usePublicClient, useReadContract } from "wagmi";
import { useWriteContract } from "wagmi";
import { baseSepolia, base } from "wagmi/chains";
import { decodeEventLog } from "viem";
import { RED_PACKET_CONTRACT, RED_PACKET_ABI, USDC_ADDRESS, USDC_ABI, CHAIN_ID } from "@/lib/constants";
import { parseUSDC, getExpiryTimestamp } from "@/lib/utils";
import type { CreatePacketParams } from "@/lib/types";

const chain = CHAIN_ID === 8453 ? base : baseSepolia;

export function useCreatePacket() {
  const { address, chainId: walletChainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient({ chainId: chain.id });
  const { writeContractAsync } = useWriteContract();

  const [step, setStep] = useState<"idle" | "approving" | "creating" | "storing" | "done" | "error">("idle");
  const [packetUuid, setPacketUuid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: allowance } = useReadContract({
    chainId: chain.id,
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "allowance",
    args: address ? [address, RED_PACKET_CONTRACT] : undefined,
    query: { enabled: !!address, retry: 3, retryDelay: 1000, staleTime: 30_000 },
  });

  const { data: balance } = useReadContract({
    chainId: chain.id,
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, retry: 3, retryDelay: 1000, staleTime: 30_000 },
  });

  const submitPacket = useCallback(async (params: CreatePacketParams) => {
    if (!address || !publicClient) return;

    setError(null);
    const amountBigInt = parseUSDC(params.amount);
    const expiry = getExpiryTimestamp(params.expiryHours);

    try {
      // Switch chain if needed
      if (walletChainId !== chain.id) {
        await switchChainAsync({ chainId: chain.id });
      }

      // Check if approval is needed
      const currentAllowance = allowance as bigint | undefined;
      if (!currentAllowance || currentAllowance < amountBigInt) {
        setStep("approving");
        const approveTxHash = await writeContractAsync({
          chainId: chain.id,
          address: USDC_ADDRESS,
          abi: USDC_ABI,
          functionName: "approve",
          args: [RED_PACKET_CONTRACT, amountBigInt],
        });

        // Wait for approval to confirm
        const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveTxHash });
        if (approveReceipt.status === "reverted") {
          throw new Error("USDC approval transaction reverted");
        }
      }

      // Create packet
      setStep("creating");
      const createTxHash = await writeContractAsync({
        chainId: chain.id,
        address: RED_PACKET_CONTRACT,
        abi: RED_PACKET_ABI,
        functionName: "createPacket",
        args: [
          amountBigInt,
          params.recipients,
          params.splitType === "random",
          expiry,
        ],
      });

      // Wait for create tx and verify it succeeded
      const receipt = await publicClient.waitForTransactionReceipt({ hash: createTxHash });

      if (receipt.status === "reverted") {
        throw new Error("Transaction reverted — you may not have enough USDC or ETH for gas");
      }

      let onchainPacketId = -1;
      for (const log of receipt.logs) {
        try {
          const event = decodeEventLog({
            abi: RED_PACKET_ABI,
            data: log.data,
            topics: log.topics,
          });
          if (event.eventName === "PacketCreated") {
            onchainPacketId = Number((event.args as { packetId: bigint }).packetId);
            break;
          }
        } catch {
          // Not our event, skip
        }
      }

      if (onchainPacketId < 0) {
        throw new Error("Packet creation event not found in transaction");
      }

      // Store metadata in DB — only after confirmed onchain success
      setStep("storing");
      const res = await fetch("/api/packets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packetId: onchainPacketId,
          creatorAddress: address,
          txHash: createTxHash,
        }),
      });

      if (!res.ok) throw new Error("Failed to store metadata");

      const data = await res.json();
      setPacketUuid(data.uuid);
      setStep("done");
    } catch (err) {
      console.error("Create packet failed:", err);
      setStep("error");
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }, [address, publicClient, walletChainId, switchChainAsync, writeContractAsync, allowance]);

  function reset() {
    setStep("idle");
    setError(null);
    setPacketUuid(null);
  }

  return {
    step,
    packetUuid,
    error,
    reset,
    allowance: allowance as bigint | undefined,
    balance: balance as bigint | undefined,
    submitPacket,
  };
}
