import React from 'react';
import { cn } from '@/lib/utils';

export type RoundingMode = 'header' | 'sheet' | 'asymmetric' | 'floating';

interface LiquidPopupCardProps extends React.HTMLAttributes<HTMLDivElement> {
  mode?: RoundingMode;
  hover?: boolean;
  glowColor?: 'cyan' | 'blue' | 'purple' | 'amber';
  children: React.ReactNode;
}

export function LiquidPopupCard({
  className,
  mode = 'floating',
  hover = true,
  glowColor = 'cyan',
  children,
  ...props
}: LiquidPopupCardProps) {
  const getRoundingClasses = () => {
    switch (mode) {
      case 'header':
        return 'rounded-b-[2.5rem] rounded-t-none';
      case 'sheet':
        return 'rounded-t-[2.5rem] rounded-b-none';
      case 'asymmetric':
        return 'rounded-tl-[2.5rem] rounded-br-[2.5rem] rounded-tr-xl rounded-bl-xl';
      case 'floating':
      default:
        return 'rounded-[2.5rem]';
    }
  };

  const getGlowClasses = () => {
    switch (glowColor) {
      case 'blue':
        return 'from-blue-500/10 via-indigo-600/5 to-slate-900/10 dark:from-blue-500/20 dark:via-indigo-600/5 dark:to-slate-900/40 shadow-blue-500/15';
      case 'purple':
        return 'from-purple-500/10 via-pink-600/5 to-slate-900/10 dark:from-purple-500/20 dark:via-pink-600/5 dark:to-slate-900/40 shadow-purple-500/15';
      case 'amber':
        return 'from-amber-500/10 via-orange-600/5 to-slate-900/10 dark:from-amber-500/20 dark:via-orange-600/5 dark:to-slate-900/40 shadow-amber-500/15';
      case 'cyan':
      default:
        return 'from-cyan-500/10 via-blue-600/5 to-indigo-900/10 dark:from-cyan-500/20 dark:via-blue-600/5 dark:to-indigo-900/40 shadow-cyan-500/15';
    }
  };

  return (
    <div
      className={cn(
        'relative overflow-hidden group border border-white/40 dark:border-white/10',
        'bg-white/60 dark:bg-slate-950/70 backdrop-blur-2xl',
        'shadow-[0_20px_50px_rgba(0,0,0,0.12)] dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6)]',
        getRoundingClasses(),
        hover && 'transition-all duration-500 ease-out hover:scale-[1.01] hover:border-cyan-400/40 hover:shadow-2xl',
        className
      )}
      {...props}
    >
      {/* ── Layer 1: Ambient Fluid Gradient Tint ── */}
      <div
        className={cn(
          'absolute inset-0 bg-gradient-to-br pointer-events-none z-0 opacity-80 group-hover:opacity-100 transition-opacity duration-500',
          getGlowClasses()
        )}
      />

      {/* ── Layer 2: Top Specular Light Rim Reflection ── */}
      <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/80 dark:via-white/70 to-transparent pointer-events-none z-10 opacity-70 group-hover:opacity-100 transition-opacity duration-300" />

      {/* ── Layer 3: Soft Top-Left Flare ── */}
      <div className="absolute -top-16 -left-16 w-56 h-56 bg-cyan-400/15 dark:bg-cyan-500/10 blur-[60px] rounded-full pointer-events-none z-0 group-hover:scale-125 transition-transform duration-700" />

      {/* ── Layer 4: Card Content ── */}
      <div className="relative z-10 w-full h-full p-6 md:p-8 text-foreground">
        {children}
      </div>
    </div>
  );
}
