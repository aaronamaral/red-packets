"use client";

interface PacketStatusProps {
  claimed: number;
  total: number;
  isRandom: boolean;
}

export function PacketStatus({ claimed, total, isRandom }: PacketStatusProps) {
  const percentage = total > 0 ? (claimed / total) * 100 : 0;

  return (
    <div className="w-full">
      <div className="flex justify-between text-sm text-gold-light/70 mb-2">
        <span>
          {claimed}/{total} claimed
        </span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-white/10">
          {isRandom ? "Random" : "Equal"} split
        </span>
      </div>
      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-gold-dark to-gold-foil rounded-full transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
