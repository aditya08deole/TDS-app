import { cn } from '@/lib/utils';

interface CurvedBottomNavProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/**
 * CurvedBottomNav Component (Optimized 10% Height Adjustment)
 * Ultra-pure transparent glassmorphism with perfectly balanced vertical footprint.
 */
export function CurvedBottomNav({ children, className, ...props }: CurvedBottomNavProps) {
  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-[100] w-full',
        'rounded-t-[2rem] rounded-b-none overflow-hidden',
        'border-t border-white/35 dark:border-white/15',
        'bg-white/15 dark:bg-slate-950/50 backdrop-blur-3xl',
        'shadow-[0_-12px_35px_rgba(0,0,0,0.1)] dark:shadow-[0_-18px_45px_rgba(0,0,0,0.55)]',
        'pt-2.5 pb-[max(env(safe-area-inset-bottom),0.6rem)] px-5',
        className
      )}
      {...props}
    >
      {/* ── Top Specular Light Rim Reflection Streak ── */}
      <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-cyan-500/60 dark:via-cyan-400/80 to-transparent pointer-events-none z-10" />

      {/* ── Soft Ambient Glow Flare at Center ── */}
      <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-52 h-20 bg-cyan-500/10 dark:bg-cyan-500/15 blur-[35px] rounded-full pointer-events-none z-0" />

      {/* ── Content Row ── */}
      <div className="relative z-10 w-full max-w-md mx-auto flex items-center justify-between gap-1.5">
        {children}
      </div>
    </nav>
  );
}
