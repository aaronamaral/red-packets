"use client";

import { Button } from "@/components/ui/button";
import { generateTweetText, generateTweetIntentUrl, generateShareUrl } from "@/lib/utils";
import { useState } from "react";

interface ShareCtaProps {
  packetId: string | number;
  handle: string;
  amount?: string;
  showCreateLink?: boolean;
}

export function ShareCta({ packetId, handle, amount, showCreateLink = true }: ShareCtaProps) {
  const [copied, setCopied] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const tweetText = generateTweetText(packetId, handle, amount);
  const shareUrl = generateShareUrl(packetId, handle);
  const ogImageUrl = `/api/og/${packetId}`;
  const intentUrl = generateTweetIntentUrl(tweetText);

  function handleCopy() {
    try {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for HTTP/unsupported contexts
      window.prompt("Copy this link:", shareUrl);
    }
  }

  async function handleSaveImage() {
    setSaving(true);
    try {
      const res = await fetch(ogImageUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `red-packet-${packetId}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSaved(true);
    } catch {
      window.open(ogImageUrl, "_blank");
    }
    setSaving(false);
  }

  return (
    <div className="flex flex-col items-center gap-3 w-full mt-4">
      {/* Auto-loading image preview */}
      <div className="w-full rounded-xl overflow-hidden border border-white/10 relative">
        {!imageLoaded && (
          <div className="flex items-center justify-center py-14 bg-white/5">
            <div className="flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-cream/40">Generating shareable card...</p>
            </div>
          </div>
        )}
        <img
          src={ogImageUrl}
          alt="Share preview"
          className={`w-full h-auto ${imageLoaded ? "" : "hidden"}`}
          onLoad={() => setImageLoaded(true)}
        />
      </div>

      {/* Buttons */}
      <div className="w-full flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="flex-1"
          onClick={handleSaveImage}
          disabled={saving || !imageLoaded}
        >
          {saving ? "Saving..." : saved ? "Saved!" : "Save image"}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="flex-1"
          onClick={handleCopy}
        >
          {copied ? "Copied!" : "Copy link"}
        </Button>
      </div>

      <a
        href={intentUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full"
      >
        <Button variant="gold" size="lg" className="w-full gap-2">
          Share on
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        </Button>
      </a>

      <p className="text-[11px] text-cream/30 text-center leading-snug">
        Save the image and attach it to your post, or just share the link — a preview card will appear automatically
      </p>

      {showCreateLink && (
        <a href="/create" className="text-sm text-gold-light/60 hover:text-gold-light transition-colors">
          Share your own blessings
        </a>
      )}
    </div>
  );
}
