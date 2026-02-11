import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { USDC_DECIMALS } from "./constants";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatUSDC(amount: bigint): string {
  const whole = amount / BigInt(10 ** USDC_DECIMALS);
  const fraction = amount % BigInt(10 ** USDC_DECIMALS);
  const fractionStr = fraction.toString().padStart(USDC_DECIMALS, "0").slice(0, 2);
  return `$${whole.toString()}.${fractionStr}`;
}

export function parseUSDC(amount: string): bigint {
  const [whole, fraction = ""] = amount.split(".");
  const paddedFraction = fraction.padEnd(USDC_DECIMALS, "0").slice(0, USDC_DECIMALS);
  return BigInt(whole + paddedFraction);
}

export function generateShareUrl(packetId: string | number, refHandle?: string): string {
  const base = typeof window !== "undefined" ? window.location.origin : process.env.AUTH_URL || "";
  const url = `${base}/claim/${packetId}`;
  return refHandle ? `${url}?bless=${encodeURIComponent(refHandle)}` : url;
}

export function generateTweetText(packetId: string | number, handle: string, amount?: string): string {
  const url = generateShareUrl(packetId, handle);
  if (amount) {
    return `I just received a ${amount} USDC blessing from a red packet on Base! Open yours before they're gone:\n\n${url}`;
  }
  return `Wishing you prosperity this Lunar New Year! I'm sharing red packet blessings on Base. Open yours:\n\n${url}`;
}

export function generateTweetIntentUrl(text: string): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}

export function getExpiryTimestamp(hours: number): number {
  return Math.floor(Date.now() / 1000) + hours * 3600;
}
