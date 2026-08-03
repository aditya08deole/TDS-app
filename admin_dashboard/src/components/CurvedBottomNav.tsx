import { cn } from '@/lib/utils';

interface CurvedBottomNavProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/**
 * CurvedBottomNav Component
 * Modeled directly after the bottom panels in the reference UI design:
 * - Large smooth top-rounded corners (`rounded-t-[2.5rem] rounded-b-none`)
 * - Theme adaptive liquid glass backdrop-blur (Translucent White in Light Mode, High-Density Dark in Dark Mode)
 * - Top specular rim light streak highlight
 * - Deep ambient drop shadow
 */
export function CurvedBottomNav({ children, className, ...props }: CurvedBottomNavProps) {
  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-[100] w-full',
        'rounded-t-[2.5rem] rounded-b-none overflow-hidden',
        'border-t border-white/40 dark:border-white/15',
        'bg-white/65 dark:bg-slate-950/85 backdrop-blur-2xl',
        'shadow-[0_-15px_40px_rgba(0,0,0,0.15)] dark:shadow-[0_-20px_50px_rgba(0,0,0,0.6)]',
        'pt-4 pb-[max(env(safe-area-inset-bottom),1rem)] px-6',
        className
      )}
      {...props}
    >
      {/* ── Top Specular Light Rim Reflection Streak ── */}
      <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-cyan-500/60 dark:via-cyan-400/80 to-transparent pointer-events-none z-10" />

      {/* ── Soft Ambient Glow Flare at Center ── */}
      <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-64 h-24 bg-cyan-500/10 dark:bg-cyan-500/15 blur-[40px] rounded-full pointer-events-none z-0" />

      {/* ── Content Row ── */}
      <div className="relative z-10 w-full max-w-lg mx-auto flex items-center justify-between">
        {children}
      </div>
    </nav>
  );
}
