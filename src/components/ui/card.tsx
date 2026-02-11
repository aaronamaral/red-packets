"use client";

import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl p-6 bg-white/5 border border-white/10 backdrop-blur-sm",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
