import { AlertTriangle, CheckCircle, WifiOff } from 'lucide-react'

interface ConfidenceRingProps {
    score: number
    size?: number
    status?: string
}

export default function ConfidenceRing({ score, size = 40, status }: ConfidenceRingProps) {
    // Normalize score
    const safeScore = Math.min(100, Math.max(0, score || 0))

    // Circle math
    const strokeWidth = 3
    const radius = (size - strokeWidth) / 2
    const circumference = radius * 2 * Math.PI
    const offset = circumference - (safeScore / 100) * circumference

    // Color logic
    const getColor = () => {
        if (status === 'offline') return '#ef4444' // Red
        if (safeScore >= 80) return '#10b981' // Emerald
        if (safeScore >= 50) return '#f59e0b' // Amber
        return '#ef4444' // Red
    }

    const getIcon = () => {
        if (status === 'offline') return <WifiOff size={size * 0.4} className="text-red-500" />
        if (safeScore >= 80) return <CheckCircle size={size * 0.4} className="text-emerald-500" />
        if (safeScore >= 50) return <AlertTriangle size={size * 0.4} className="text-amber-500" />
        return <AlertTriangle size={size * 0.4} className="text-red-500" />
    }

    const color = getColor()

    return (
        <div className="relative flex items-center justify-center font-mono font-bold" style={{ width: size, height: size }}>
            {/* Background Ring */}
            <svg className="absolute transform -rotate-90" width={size} height={size}>
                <circle
                    stroke="#1e293b"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                />
                {/* Progress Ring */}
                <circle
                    stroke={color}
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                />
            </svg>

            {/* Inner Content - Icon or Text? Let's do Icon for small, Text for large */}
            <div className="z-10 flex flex-col items-center justify-center">
                {size > 50 ? (
                    <span className="text-[10px] text-slate-300">{safeScore}%</span>
                ) : (
                    getIcon()
                )}
            </div>

            {/* Tooltip trigger wrapper could go here */}
        </div>
    )
}
