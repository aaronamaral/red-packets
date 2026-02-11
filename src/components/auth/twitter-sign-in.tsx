"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function TwitterSignIn() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <Button variant="secondary" disabled>
        Loading...
      </Button>
    );
  }

  if (session?.user) {
    return (
      <div className="relative group">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-transparent group-hover:border-white/20 group-hover:bg-white/5 transition-all duration-150 cursor-default">
          {session.user.image && (
            <img
              src={session.user.image}
              alt=""
              className="w-6 h-6 rounded-full border border-gold/30 shrink-0"
            />
          )}
          <span className="text-sm text-cream/80 font-medium">@{session.user.twitterHandle}</span>
        </div>
        <div className="absolute left-0 right-0 top-full opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 pt-0.5">
          <button
            onClick={() => signOut()}
            className="w-full text-sm text-cream/60 hover:text-cream hover:bg-white/10 border border-white/20 rounded-xl px-3 py-1.5 bg-background/95 backdrop-blur-sm transition-colors text-center"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => signIn("twitter")}
      className="gap-2"
    >
      Sign in with
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    </Button>
  );
}
