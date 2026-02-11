"use client";

import { motion } from "framer-motion";
import { PacketCard } from "@/components/red-packet/packet-card";
import { TwitterSignIn } from "@/components/auth/twitter-sign-in";
import { WalletWrapper } from "@/components/wallet/wallet-wrapper";
import Link from "next/link";

type LanternShape = "round" | "tall" | "drum" | "palace";
type LanternSize = "xs" | "sm" | "md" | "lg" | "xl" | "xxl";

/*
 * round  = classic sphere lantern
 * tall   = elongated oval lantern
 * drum   = squat barrel shape, wider than tall, tapered edges
 * palace = rectangular palace lantern with visible frame/ribs
 */

const LANTERN_BODY: Record<LanternShape, Record<LanternSize, string>> = {
  round:  { xs: "w-8 h-10 rounded-full",   sm: "w-10 h-12 rounded-full",  md: "w-14 h-16 rounded-full",  lg: "w-18 h-20 rounded-full",  xl: "w-28 h-32 rounded-full",  xxl: "w-36 h-40 rounded-full" },
  tall:   { xs: "w-7 h-12 rounded-full",    sm: "w-9 h-16 rounded-full",   md: "w-12 h-20 rounded-full",  lg: "w-14 h-24 rounded-full",  xl: "w-20 h-36 rounded-full",  xxl: "w-24 h-44 rounded-full" },
  drum:   { xs: "w-11 h-9 rounded-full",    sm: "w-14 h-11 rounded-full",  md: "w-18 h-14 rounded-full",  lg: "w-24 h-20 rounded-full",  xl: "w-32 h-26 rounded-full",  xxl: "w-40 h-34 rounded-full" },
  palace: { xs: "w-8 h-12 rounded-lg",      sm: "w-10 h-16 rounded-xl",    md: "w-14 h-20 rounded-xl",    lg: "w-16 h-24 rounded-xl",    xl: "w-24 h-36 rounded-2xl",   xxl: "w-32 h-44 rounded-2xl" },
};

const LANTERN_CAP: Record<LanternSize, string> = {
  xs: "w-6 h-1",  sm: "w-7 h-1.5",  md: "w-10 h-2",  lg: "w-12 h-2",  xl: "w-18 h-2.5",  xxl: "w-22 h-3",
};

const LANTERN_ROPE: Record<LanternSize, string> = {
  xs: "h-3",  sm: "h-4",  md: "h-6",  lg: "h-8",  xl: "h-10",  xxl: "h-12",
};

const LANTERN_TEXT: Record<LanternSize, string> = {
  xs: "text-[10px]",  sm: "text-sm",  md: "text-base",  lg: "text-xl",  xl: "text-3xl",  xxl: "text-5xl",
};

function Lantern({ size = "md", shape = "round", className }: { size?: LanternSize; shape?: LanternShape; className?: string }) {
  const body = LANTERN_BODY[shape][size];
  const cap = LANTERN_CAP[size];
  const rope = LANTERN_ROPE[size];
  const text = LANTERN_TEXT[size];
  const isPalace = shape === "palace";
  const isDrum = shape === "drum";
  const ribCount = isPalace ? 4 : isDrum ? 5 : shape === "tall" ? 3 : 4;

  return (
    <div className={`lantern-glow ${className || ""}`}>
      <div className="animate-sway inline-block origin-top">
        <div className={`w-px ${rope} bg-gold/25 mx-auto`} />
        <div className={`${cap} bg-gold-dark/80 ${isPalace ? "rounded-t" : "rounded-t-sm"} mx-auto`} />
        <div className={`${body} bg-red-packet border border-gold/20 flex items-center justify-center relative overflow-hidden mx-auto`}>
          {/* Character */}
          <span className={`text-gold/80 ${text} font-bold relative z-10`}>福</span>
          {/* Vertical ribs */}
          <div className="absolute inset-0 flex justify-evenly pointer-events-none">
            {Array.from({ length: ribCount }).map((_, i) => (
              <div key={i} className="w-px h-full bg-white/[0.12]" />
            ))}
          </div>
          {/* Horizontal ribs — all shapes */}
          <div className="absolute inset-x-0 top-[25%] h-px bg-white/[0.10]" />
          <div className="absolute inset-x-0 top-[50%] h-px bg-white/[0.08]" />
          <div className="absolute inset-x-0 top-[75%] h-px bg-white/[0.10]" />
          {/* Palace extra: gold frame band */}
          {isPalace && (
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[30%] border-y border-gold/15" />
          )}
        </div>
        <div className={`${cap} bg-gold-dark/80 ${isPalace ? "rounded-b" : "rounded-b-sm"} mx-auto`} />
        {/* Tassel */}
        <div className="flex flex-col items-center">
          <div className="w-px h-2.5 bg-gold/25" />
          <div className="w-1 h-1.5 bg-gold-dark/50 rounded-full" />
        </div>
      </div>
    </div>
  );
}

/* Fire horse background image served from /public/images/fire-horse-bg.png */

const steps = [
  {
    number: "1",
    title: "Create",
    description: "Fill a red packet with USDC and choose how many blessings to share",
  },
  {
    number: "2",
    title: "Share",
    description: "Post your red packet on X and spread the fortune",
  },
  {
    number: "3",
    title: "Open",
    description: "Recipients sign in with X and open their blessing",
  },
  {
    number: "4",
    title: "Pass it on",
    description: "Pay it forward — send your own blessings to others",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Background decorations */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {/* Fire horse — right column, tinted to match gold #FBC293 */}
        <div className="absolute top-16 right-0 bottom-0 w-1/3 flex items-center justify-center hidden md:flex">
          <div className="relative max-h-[80vh] w-auto horse-glow">
            <img
              src="/images/fire-horse-bg.png"
              alt=""
              className="max-h-[80vh] w-auto object-contain opacity-0"
              draggable={false}
            />
            {/* Gold tint overlay using the image as a mask */}
            <div
              className="absolute inset-0"
              style={{
                backgroundColor: "#FBC293",
                maskImage: "url(/images/fire-horse-bg.png)",
                WebkitMaskImage: "url(/images/fire-horse-bg.png)",
                maskSize: "contain",
                WebkitMaskSize: "contain",
                maskRepeat: "no-repeat",
                WebkitMaskRepeat: "no-repeat",
                maskPosition: "center",
                WebkitMaskPosition: "center",
              }}
            />
          </div>
        </div>

        {/* Lanterns — left third, no overlaps */}

        {/* Top row */}
        <div className="absolute top-[10%] left-[2%]">
          <Lantern size="md" shape="round" />
        </div>
        <div className="absolute top-[11%] left-[20%] hidden md:block">
          <Lantern size="sm" shape="drum" />
        </div>

        {/* Upper */}
        <div className="absolute top-[23%] left-[11%] hidden md:block">
          <Lantern size="md" shape="tall" />
        </div>
        <div className="absolute top-[25%] left-[24%] hidden lg:block">
          <Lantern size="xs" shape="round" />
        </div>

        {/* Center — hero palace lantern, right of center in left third */}
        <div className="absolute top-[40%] left-[14%]">
          <Lantern size="xxl" shape="palace" />
        </div>

        {/* Mid-left accent */}
        <div className="absolute top-[44%] left-[2%]">
          <Lantern size="xs" shape="round" />
        </div>

        {/* Lower */}
        <div className="absolute top-[62%] left-[3%] hidden md:block">
          <Lantern size="lg" shape="drum" />
        </div>
        <div className="absolute top-[64%] left-[26%]">
          <Lantern size="sm" shape="round" />
        </div>

        {/* Bottom */}
        <div className="absolute top-[78%] left-[14%]">
          <Lantern size="md" shape="tall" />
        </div>
      </div>

      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5 border-b border-white/10 relative z-10 bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">🧧</span>
          <span className="font-bold text-xl text-cream">Red Packets</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/my-packets" className="inline-flex items-center px-4 py-1.5 text-sm font-semibold rounded-xl bg-gold/15 border border-gold/30 text-gold hover:bg-gold/25 transition-all">
            My Packets
          </Link>
          <TwitterSignIn />
          <WalletWrapper />
        </div>
      </header>

      {/* Hero */}
      <section className="flex flex-col items-center px-6 pt-10 pb-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-3"
        >
          <h1 className="text-5xl md:text-7xl font-bold mb-4">
            <span className="text-gold">Red Packets</span>
          </h1>
          <h2 className="text-xl md:text-2xl text-cream/80 mb-2">
            Share blessings on Base
          </h2>
          <p className="text-sm text-cream/50 max-w-md mx-auto">
            Celebrate the Lunar New Year by sending USDC red packets.
            Share them on X and spread prosperity to your community.
          </p>
        </motion.div>
      </section>

      {/* How it works */}
      <section className="px-6 py-1 relative z-10">
        <div className="max-w-2xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {steps.map((step, i) => {
            const colors = [
              { border: "border-gold/15", bg: "bg-background/80 backdrop-blur-sm", badge: "bg-gold/10 text-gold/50", extra: "" },
              { border: "border-gold/20", bg: "bg-background/80 backdrop-blur-sm", badge: "bg-gold/15 text-gold/65", extra: "" },
              { border: "border-red-packet/40", bg: "bg-background/80 backdrop-blur-sm", badge: "bg-gold/20 text-gold/80", extra: "shadow-[0_0_12px_rgba(207,32,47,0.15)]" },
              { border: "border-gold/35", bg: "bg-background/80 backdrop-blur-sm", badge: "bg-gold/25 text-gold", extra: "" },
            ][i];
            return (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.08 * i }}
                className={`rounded-xl border ${colors.border} ${colors.bg} ${colors.extra} px-3 pt-2 pb-2.5`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${colors.badge} text-[10px] font-bold shrink-0`}>
                    {step.number}
                  </span>
                  <h4 className="font-semibold text-cream/90 text-sm">{step.title}</h4>
                </div>
                <p className="text-[11px] text-cream/40 leading-snug pl-[26px]">{step.description}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Demo packet + CTA */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 pt-8 pb-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Link href="/create">
            <PacketCard state="sealed" mode="demo" />
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-white/10 text-center relative z-10 bg-background/80 backdrop-blur-sm">
        <div className="flex items-center justify-center gap-2 text-sm text-cream/40">
          <span>Powered by</span>
          <span className="font-semibold text-blue-400">Base</span>
        </div>
      </footer>
    </main>
  );
}
