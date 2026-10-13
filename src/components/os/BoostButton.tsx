'use client';

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Zap, Loader, ShieldCheck, Flame } from "lucide-react";
import type { BoostStatus } from "@/hooks/use-system-metrics";
import { soundFx } from "@/lib/audio-synth";

interface BoostButtonProps {
  boostStatus: BoostStatus;
  onClick: () => void;
}

const BoostButton = ({ boostStatus, onClick }: BoostButtonProps) => {
  const isIdle = boostStatus === 'idle';
  const isBoosting = boostStatus === 'boosting';
  const isCooling = boostStatus === 'cooling';

  const Icon = isBoosting ? Flame : isCooling ? ShieldCheck : Zap;
  const text = isBoosting ? "REACTOR OVERCLOCKING..." : isCooling ? "THERMAL DISSIPATION" : "HYPER-BOOST SYSTEM";

  return (
    <Button
      onClick={() => {
        soundFx.playBoost();
        onClick();
      }}
      onMouseEnter={() => isIdle && soundFx.playHover()}
      disabled={!isIdle}
      className={cn(
        "relative w-72 h-12 text-sm font-bold tracking-widest uppercase transition-all duration-300 overflow-hidden",
        "bg-primary/10 text-primary border-2 border-primary/50 hover:bg-primary/25 hover:border-accent hover:shadow-[0_0_25px_hsl(var(--primary)/0.6)]",
        "disabled:opacity-80",
        {
          "animate-pulse border-accent bg-accent/20 text-accent shadow-[0_0_35px_5px_hsl(var(--primary))]": isBoosting,
          "border-emerald-400 text-emerald-400 bg-emerald-950/20 shadow-[0_0_15px_hsl(142_71%_45%/0.3)]": isCooling,
        }
      )}
    >
      {/* Animated scanline across button */}
      {isIdle && (
        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/20 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-1000" />
      )}
      <Icon
        size={18}
        className={cn("mr-2", {
          "animate-bounce text-accent": isBoosting,
          "text-emerald-400": isCooling,
        })}
      />
      <span>{text}</span>
    </Button>
  );
};

export default BoostButton;
