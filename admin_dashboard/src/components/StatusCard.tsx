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
        slate: 'bg-slate-800/50 text-slate-400 border-slate-700/50',
        emerald: 'bg-emerald-900/20 text-emerald-400 border-emerald-500/20',
        orange: 'bg-orange-900/20 text-orange-400 border-orange-500/20',
        red: 'bg-red-900/20 text-red-400 border-red-500/20',
        cyan: 'bg-cyan-900/20 text-cyan-400 border-cyan-500/20'
    }

    const iconBgClasses = {
        slate: 'bg-slate-800 text-slate-300',
        emerald: 'bg-emerald-500/20 text-emerald-400',
        orange: 'bg-orange-500/20 text-orange-400',
        red: 'bg-red-500/20 text-red-400',
        cyan: 'bg-cyan-500/20 text-cyan-400'
    }

    return (
        <div className={`relative p-5 rounded-2xl border backdrop-blur-sm shadow-xl transition-all hover:scale-[1.02] ${colorClasses[color]}`}>
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-sm font-medium opacity-80 uppercase tracking-wide">{title}</h3>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-white">{value}</span>
                        {subtext && <span className="text-xs opacity-70">{subtext}</span>}
                    </div>
                </div>
                <div className={`p-2.5 rounded-xl ${iconBgClasses[color]}`}>
                    <Icon className="h-6 w-6" />
                </div>
            </div>
        </div>
    )
}
