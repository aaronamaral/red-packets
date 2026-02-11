"use client";

import { cn } from "@/lib/utils";

interface PacketCardProps {
  state: "sealed" | "opening" | "opened";
  mode?: "claim" | "demo" | "preview";
  creatorHandle?: string;
  creatorAvatar?: string | null;
  onClick?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export function PacketCard({
  state,
  mode = "claim",
  creatorHandle,
  creatorAvatar,
  onClick,
  className,
  children,
}: PacketCardProps) {
  const isDemo = mode === "demo";
  const isPreview = mode === "preview";

  return (
    <div
      onClick={state === "sealed" ? onClick : undefined}
      className={cn(
        "relative w-full max-w-[320px] mx-auto rounded-2xl overflow-hidden transition-all duration-500",
        state === "sealed" && "cursor-pointer hover:scale-105 active:scale-95",
        state === "sealed" && "animate-float",
        "fire-glow",
        className
      )}
    >
      {/* Envelope body */}
      <div className="bg-envelope pattern-overlay relative">
        {/* Gold border accent */}
        <div className="absolute inset-2 border-2 border-gold/30 rounded-xl pointer-events-none" />

        {/* Gold coin medallion */}
        <div className="flex flex-col items-center py-20 px-8">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-gold via-gold-foil to-gold-dark flex items-center justify-center shadow-lg mb-6 relative p-1 overflow-hidden">
            {creatorAvatar ? (
              <img
                src={creatorAvatar.replace("_normal", "_400x400")}
                alt=""
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <span className="text-4xl font-bold text-red-dark">$</span>
            )}
          </div>

          {state === "sealed" && isDemo && (
            <>
              <h3 className="text-xl font-bold text-white mb-2">Create a Red Packet</h3>
              <p className="text-white/70 text-sm">
                Share a blessing
              </p>
            </>
          )}

          {state === "sealed" && isPreview && (
            <>
              <h3 className="text-xl font-bold text-white mb-2">Red Packet</h3>
              {creatorHandle && (
                <span className="text-sm text-white/70 mb-4">
                  from @{creatorHandle}
                </span>
              )}
              <p className="text-white/50 text-sm animate-pulse">
                Tap to preview
              </p>
            </>
          )}

          {state === "sealed" && !isDemo && !isPreview && (
            <>
              <h3 className="text-xl font-bold text-white mb-2">Red Packet</h3>
              {creatorHandle && (
                <span className="text-sm text-white/70 mb-4">
                  from @{creatorHandle}
                </span>
              )}
              <p className="text-white/50 text-sm animate-pulse">
                Tap to open
              </p>
            </>
          )}

          {state === "opened" && children}
        </div>

        {/* Coinbase logo — bottom left */}
        <div className="absolute bottom-6 left-6 z-10">
          <img
            src="/images/coinbase-logo.svg"
            alt="Coinbase"
            className="h-4 w-auto"
          />
        </div>

        {/* Bottom flap decoration */}
        <div className="h-4 bg-gradient-to-b from-transparent to-red-dark/30" />
      </div>

      {/* Envelope flap (top triangle) */}
      <div
        className={cn(
          "absolute top-0 left-0 right-0 h-20 origin-bottom transition-transform duration-700",
          state === "opening" && "animate-envelope-open"
        )}
        style={{
          background: "#B01A28",
          clipPath: "polygon(0 0, 100% 0, 50% 100%)",
        }}
      />
    </div>
  );
}
