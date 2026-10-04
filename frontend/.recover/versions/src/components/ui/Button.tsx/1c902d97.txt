"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { forwardRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { CompassSpinner } from "./Loader";

export type ButtonVariant = "brass" | "parchment" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "xl";

export interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
  children?: ReactNode;
}

const VARIANTS: Record<ButtonVariant, string> = {
  brass:
    "brass-surface text-ink border border-brass-dark/80 hover:brightness-110 [text-shadow:0_1px_0_rgba(255,240,200,0.5)]",
  parchment:
    "parchment text-ink border border-parchment-burnt/60 hover:brightness-105",
  ghost:
    "bg-abyss/60 text-brass-light border border-brass/50 hover:border-brass-light hover:bg-brass/10 hover:text-gold",
  danger:
    "bg-[linear-gradient(180deg,#c2392f_0%,#8e1f1a_55%,#5c120e_100%)] text-parchment-light border border-[#3d0a08] shadow-[0_10px_30px_-10px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,200,180,0.35)] hover:brightness-110",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-[0.7rem] gap-2 tracking-[0.18em]",
  md: "h-11 px-6 text-xs gap-2.5 tracking-[0.22em]",
  lg: "h-14 px-8 text-sm gap-3 tracking-[0.26em]",
  xl: "h-16 px-12 text-base gap-3 tracking-[0.32em]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "brass",
    size = "md",
    loading,
    icon,
    iconRight,
    fullWidth,
    disabled,
    className,
    children,
    type = "button",
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading;
  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      whileHover={isDisabled ? undefined : { y: -2 }}
      whileTap={isDisabled ? undefined : { scale: 0.97, y: 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 24 }}
      className={cn(
        "group relative inline-flex select-none items-center justify-center overflow-hidden rounded-[4px]",
        "font-ui font-bold uppercase transition-[filter,background-color,border-color,color] duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/80 focus-visible:ring-offset-2 focus-visible:ring-offset-abyss",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:saturate-50",
        variant === "brass" && !isDisabled && "animate-glint",
        VARIANTS[variant],
        SIZES[size],
        fullWidth && "w-full",
        className,
      )}
      {...rest}
    >
      {(variant === "brass" || variant === "danger") && (
        <>
          <Rivet className="left-1.5" />
          <Rivet className="right-1.5" />
        </>
      )}
      {loading ? <CompassSpinner size={size === "sm" ? 14 : 18} /> : icon}
      <span className="relative">{children}</span>
      {!loading && iconRight}
    </motion.button>
  );
});

function Rivet({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_35%_35%,#fff3cc,#7a5520)] shadow-[0_1px_1px_rgba(0,0,0,0.6)]",
        className,
      )}
    />
  );
}
