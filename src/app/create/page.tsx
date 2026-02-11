"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TwitterSignIn } from "@/components/auth/twitter-sign-in";
import { WalletWrapper } from "@/components/wallet/wallet-wrapper";
import { ShareCta } from "@/components/red-packet/share-cta";
import { PacketCard } from "@/components/red-packet/packet-card";
import { useCreatePacket } from "@/hooks/use-create-packet";
import { formatUSDC, parseUSDC } from "@/lib/utils";
import { EXPIRY_OPTIONS, PACKET_LIMITS } from "@/lib/constants";
import type { SplitType } from "@/lib/types";
import Link from "next/link";

function StepIndicator({ step }: { step: string }) {
  const steps = [
    { key: "approving", label: "Approve USDC", description: "Allow the contract to transfer your USDC" },
    { key: "creating", label: "Create Packet", description: "Deposit USDC into the red packet" },
    { key: "storing", label: "Finalize", description: "Saving packet details" },
  ];

  const currentIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="space-y-3 mb-6">
      {steps.map((s, i) => {
        const isActive = s.key === step;
        const isDone = i < currentIndex;
        return (
          <div key={s.key} className="flex items-center gap-3">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                isDone
                  ? "bg-green-500/20 text-green-400 border border-green-500/40"
                  : isActive
                  ? "bg-gold/20 text-gold border border-gold/40"
                  : "bg-white/5 text-cream/30 border border-white/10"
              }`}
            >
              {isDone ? "✓" : i + 1}
            </div>
            <div className="flex-1">
              <p className={`text-sm font-medium ${isActive ? "text-gold-light" : isDone ? "text-green-400" : "text-cream/30"}`}>
                {s.label}
              </p>
              {isActive && (
                <p className="text-xs text-cream/50 mt-0.5">{s.description}</p>
              )}
            </div>
            {isActive && (
              <div className="w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function CreatePage() {
  const { data: session } = useSession();
  const { isConnected } = useAccount();
  const { step, packetUuid, error, allowance, balance, submitPacket, reset } = useCreatePacket();

  const [amount, setAmount] = useState("");
  const [recipients, setRecipients] = useState("10");
  const [splitType, setSplitType] = useState<SplitType>("random");
  const [expiryHours, setExpiryHours] = useState(24);

  const amountBigInt = amount ? parseUSDC(amount) : BigInt(0);
  const needsApproval = allowance !== undefined && amountBigInt > allowance;
  const perPerson = recipients && amount
    ? (parseFloat(amount) / parseInt(recipients)).toFixed(2)
    : "0.00";

  const isProcessing = step === "approving" || step === "creating" || step === "storing";

  function renderBody() {
    if (!session?.user) {
      return (
        <div className="flex-1 flex items-center justify-center px-6">
          <Card className="max-w-md w-full text-center">
            <h2 className="text-2xl font-bold text-cream mb-4">Sign in to create</h2>
            <p className="text-cream/60 mb-6">Connect your X account to create red packets</p>
            <TwitterSignIn />
          </Card>
        </div>
      );
    }

    if (!isConnected) {
      return (
        <div className="flex-1 flex items-center justify-center px-6">
          <Card className="max-w-md w-full text-center">
            <h2 className="text-2xl font-bold text-cream mb-4">Connect wallet</h2>
            <p className="text-cream/60 mb-6">Connect your wallet to deposit USDC</p>
            <div className="flex justify-center">
              <WalletWrapper />
            </div>
          </Card>
        </div>
      );
    }

    if (step === "done" && packetUuid) {
      return (
        <div className="flex-1 flex items-center justify-center px-6 py-8">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-10 max-w-4xl w-full">
            {/* Left — Red packet */}
            <div className="shrink-0 w-[320px]">
              <PacketCard
                state="sealed"
                mode="claim"
                creatorHandle={session.user.twitterHandle}
                creatorAvatar={session.user.image}
              />
            </div>

            {/* Right — Text + share */}
            <div className="flex-1 max-w-md w-full">
              <h2 className="text-2xl font-bold text-cream mb-1">Red Packet created!</h2>
              <p className="text-cream/50 text-sm mb-2">Share it on X to spread the blessing</p>
              <ShareCta
                packetId={packetUuid}
                handle={session.user.twitterHandle}
                showCreateLink={false}
              />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <Card className="max-w-lg w-full">
          <h2 className="text-2xl font-bold text-cream mb-6">Create a Red Packet</h2>

          {isProcessing ? (
            <>
              {/* Transaction summary */}
              <div className="rounded-xl border border-gold/20 bg-gold/5 p-4 mb-6">
                <p className="text-xs text-cream/50 uppercase tracking-wide mb-3">Transaction Summary</p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-cream/70">Amount</span>
                    <span className="text-sm font-semibold text-gold-light">{parseFloat(amount)} USDC</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-cream/70">Recipients</span>
                    <span className="text-sm text-cream">{recipients}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-cream/70">Per person</span>
                    <span className="text-sm text-cream">~${perPerson} {splitType === "random" ? "(avg)" : ""}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-cream/70">Split</span>
                    <span className="text-sm text-cream capitalize">{splitType}</span>
                  </div>
                </div>
              </div>

              {/* Step progress */}
              <StepIndicator step={step} />

              <div className="rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-center">
                <p className="text-xs text-cream/50">
                  {step === "approving"
                    ? "Please confirm the USDC approval in your wallet. This allows the red packet contract to transfer your USDC."
                    : step === "creating"
                    ? `Please confirm the deposit of ${parseFloat(amount)} USDC into the red packet contract.`
                    : "Saving your packet details..."}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="mb-5">
                <label className="block text-sm text-cream/70 mb-2">Total amount (USDC)</label>
                <Input
                  type="number"
                  placeholder="10.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="0.01"
                  step="0.01"
                />
                {balance !== undefined && (
                  <p className="text-xs text-cream/40 mt-1">
                    Balance: {formatUSDC(balance)}
                  </p>
                )}
                {amount && parseFloat(amount) > PACKET_LIMITS.MAX_DEPOSIT && (
                  <p className="text-xs text-red-light mt-1">
                    Maximum deposit is ${PACKET_LIMITS.MAX_DEPOSIT.toLocaleString()} USDC
                  </p>
                )}
              </div>

              <div className="mb-5">
                <label className="block text-sm text-cream/70 mb-2">Number of recipients</label>
                <Input
                  type="number"
                  placeholder="10"
                  value={recipients}
                  onChange={(e) => setRecipients(e.target.value)}
                  min="1"
                  max="200"
                />
                {amount && recipients && (
                  <p className="text-xs text-cream/40 mt-1">
                    ~${perPerson} per person {splitType === "random" && "(avg)"}
                  </p>
                )}
              </div>

              <div className="mb-5">
                <label className="block text-sm text-cream/70 mb-2">Split type</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setSplitType("random")}
                    className={`flex-1 rounded-xl py-3 px-4 border transition-all text-sm ${
                      splitType === "random"
                        ? "border-gold bg-gold/10 text-gold-light"
                        : "border-white/20 text-cream/60 hover:border-white/40"
                    }`}
                  >
                    <div className="font-semibold mb-1">Random</div>
                    <div className="text-xs opacity-70">Lucky draw amounts</div>
                  </button>
                  <button
                    onClick={() => setSplitType("equal")}
                    className={`flex-1 rounded-xl py-3 px-4 border transition-all text-sm ${
                      splitType === "equal"
                        ? "border-gold bg-gold/10 text-gold-light"
                        : "border-white/20 text-cream/60 hover:border-white/40"
                    }`}
                  >
                    <div className="font-semibold mb-1">Equal</div>
                    <div className="text-xs opacity-70">Same for everyone</div>
                  </button>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm text-cream/70 mb-2">Expires in</label>
                <div className="flex flex-wrap gap-2">
                  {EXPIRY_OPTIONS.map((opt) => (
                    <button
                      key={opt.hours}
                      onClick={() => setExpiryHours(opt.hours)}
                      className={`rounded-lg py-1.5 px-3 text-sm border transition-all ${
                        expiryHours === opt.hours
                          ? "border-gold bg-gold/10 text-gold-light"
                          : "border-white/20 text-cream/60 hover:border-white/40"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pre-submit summary */}
              {amount && parseFloat(amount) > 0 && recipients && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-cream/50">You deposit</span>
                    <span className="text-lg font-bold text-gold-light">{parseFloat(amount)} USDC</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-cream/40">
                      {recipients} {parseInt(recipients) === 1 ? "recipient gets" : "recipients get"} ~${perPerson}{parseInt(recipients) > 1 ? " each" : ""} {splitType === "random" && parseInt(recipients) > 1 && "(avg)"}
                    </span>
                  </div>
                  {needsApproval && (
                    <p className="text-xs text-cream/40 mt-3 pt-3 border-t border-white/10">
                      Two transactions required: USDC approval + deposit
                    </p>
                  )}
                </div>
              )}

              {error && (
                <div className="mb-4">
                  <p className="text-red-light text-sm mb-2">{error}</p>
                  <button onClick={reset} className="text-xs text-cream/50 hover:text-cream/80 underline">
                    Try again
                  </button>
                </div>
              )}

              <Button
                variant="gold"
                size="lg"
                className="w-full"
                onClick={() =>
                  submitPacket({
                    amount,
                    recipients: parseInt(recipients),
                    splitType,
                    expiryHours,
                  })
                }
                disabled={!amount || parseFloat(amount) <= 0 || parseFloat(amount) > PACKET_LIMITS.MAX_DEPOSIT || !recipients}
              >
                {needsApproval ? "Approve USDC & Create Packet" : "Create Red Packet"}
              </Button>
            </>
          )}
        </Card>
      </div>
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
          <Link href="/my-packets" className="inline-flex items-center px-4 py-1.5 text-sm font-semibold rounded-xl bg-gold/15 border border-gold/30 text-gold hover:bg-gold/25 transition-all">
            My Packets
          </Link>
          <TwitterSignIn />
          <WalletWrapper />
        </div>
      </header>
      {renderBody()}
    </main>
  );
}
