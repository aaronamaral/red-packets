"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface ClaimResultProps {
  amount: string;
}

export function ClaimResult({ amount }: ClaimResultProps) {
  const [displayAmount, setDisplayAmount] = useState("$0.00");
  const numericAmount = parseFloat(amount.replace("$", ""));

  useEffect(() => {
    const duration = 1000;
    const steps = 30;
    const stepDuration = duration / steps;
    let current = 0;

    const timer = setInterval(() => {
      current++;
      const progress = current / steps;
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = numericAmount * eased;
      setDisplayAmount(`$${value.toFixed(2)}`);

      if (current >= steps) {
        clearInterval(timer);
        setDisplayAmount(amount);
      }
    }, stepDuration);

    return () => clearInterval(timer);
  }, [amount, numericAmount]);

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", damping: 15, stiffness: 200, delay: 0.3 }}
      className="flex flex-col items-center"
    >
      <p className="text-sm text-gold-light/70 mb-2">You received</p>
      <p className="text-5xl font-bold text-shimmer mb-1">{displayAmount}</p>
      <p className="text-sm text-gold-light/70">USDC</p>

      {/* Confetti particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full"
            style={{
              backgroundColor: ["#FFD700", "#C41E3A", "#F5D061", "#DC143C"][i % 4],
              left: `${Math.random() * 100}%`,
              top: "-10px",
            }}
            initial={{ y: 0, opacity: 1, rotate: 0 }}
            animate={{
              y: 400 + Math.random() * 200,
              opacity: 0,
              rotate: Math.random() * 720,
              x: (Math.random() - 0.5) * 200,
            }}
            transition={{
              duration: 1.5 + Math.random() * 1,
              delay: Math.random() * 0.5,
              ease: "easeIn",
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}
