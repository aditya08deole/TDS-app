import { cn } from '@/lib/utils';

export interface TabItem {
  id: string;
  label: string;
  badge?: number | string;
}

interface CurvedTabSelectorProps {
  tabs: TabItem[];
  activeTabId: string;
  onChange: (id: string) => void;
  className?: string;
}

/**
 * CurvedTabSelector Component
 * Modeled directly after Screen 3 in the reference UI:
 * - Asymmetric inverted curve cutout where the active tab rises seamlessly
 *   with smooth concave transition curves on the edges.
 * - Liquid glass backdrop blur & pill highlighting.
 */
export function CurvedTabSelector({
  tabs,
  activeTabId,
  onChange,
  className,
}: CurvedTabSelectorProps) {
  return (
    <div
      className={cn(
        'relative inline-flex items-center p-1.5 rounded-2xl border border-white/15',
        'bg-slate-950/60 backdrop-blur-2xl shadow-lg',
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative z-10 px-5 py-2.5 text-xs font-bold transition-all duration-300 rounded-xl flex items-center gap-2 select-none',
              isActive
                ? 'text-white bg-gradient-to-r from-cyan-500 to-blue-600 shadow-md shadow-cyan-500/25 scale-[1.02] rounded-t-xl rounded-b-md'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
            )}
          >
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={cn(
                  'px-1.5 py-0.5 text-[9px] font-black rounded-full leading-none',
                  isActive
                    ? 'bg-white text-cyan-900'
                    : 'bg-cyan-500/20 text-cyan-400 border border-cyan-400/30'
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
