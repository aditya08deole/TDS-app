import type { LucideIcon } from 'lucide-react'

interface StatusCardProps {
    title: string
    value: number | string
    icon: LucideIcon
    color: 'slate' | 'emerald' | 'orange' | 'red' | 'cyan'
    subtext?: string
}

export default function StatusCard({ title, value, icon: Icon, color, subtext }: StatusCardProps) {
    const colorClasses = {
        slate: 'bg-accent/10 text-slate-600 border-slate-300/50 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700/50',
        emerald: 'bg-emerald-100/50 text-emerald-600 border-emerald-300/30 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-500/20',
        orange: 'bg-orange-100/50 text-orange-600 border-orange-300/30 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-500/20',
        red: 'bg-red-100/50 text-red-600 border-red-300/30 dark:bg-red-900/20 dark:text-red-400 dark:border-red-500/20',
        cyan: 'bg-cyan-100/50 text-cyan-600 border-cyan-300/30 dark:bg-cyan-900/20 dark:text-cyan-400 dark:border-cyan-500/20'
    }

    const iconBgClasses = {
        slate: 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
        emerald: 'bg-emerald-200/50 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400',
        orange: 'bg-orange-200/50 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400',
        red: 'bg-red-200/50 text-red-600 dark:bg-red-500/20 dark:text-red-400',
        cyan: 'bg-cyan-200/50 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400'
    }

    return (
        <div className={`relative p-5 rounded-2xl border backdrop-blur-sm shadow-xl transition-all hover:scale-[1.02] ${colorClasses[color]}`}>
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">{title}</h3>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-foreground">{value}</span>
                        {subtext && <span className="text-xs text-muted-foreground">{subtext}</span>}
                    </div>
                </div>
                <div className={`p-2.5 rounded-xl ${iconBgClasses[color]}`}>
                    <Icon className="h-6 w-6" />
                </div>
            </div>
        </div>
    )
}
