import { cn } from "@/lib/utils";

interface StatusIndicatorProps {
    status: 'online' | 'offline' | 'critical' | 'warning' | 'maintenance';
    size?: 'sm' | 'md' | 'lg';
    showLabel?: boolean;
    pulse?: boolean;
    className?: string;
}

export function StatusIndicator({ status, size = 'md', showLabel, className }: StatusIndicatorProps) {
    const getColor = (s: string) => {
        switch (s) {
            case 'online': return 'bg-[#30d158]';
            case 'critical': return 'bg-[#ff453a]';
            case 'warning': return 'bg-[#ffd60a]';
            case 'maintenance': return 'bg-blue-500';
            default: return 'bg-[#636366]';
        }
    };

    const getSize = (s: string) => {
        switch (s) {
            case 'sm': return 'w-2 h-2';
            case 'lg': return 'w-4 h-4';
            default: return 'w-3 h-3';
        }
    };

    return (
        <div className={cn("flex items-center gap-2", className)}>
            <span className="relative flex h-3 w-3">
                {(status === 'online' || status === 'critical') && (
                    <span className={cn(
                        "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                        getColor(status)
                    )}></span>
                )}
                <span className={cn(
                    "relative inline-flex rounded-full shadow-[0_0_8px_currentColor]",
                    getSize(size),
                    getColor(status)
                )}></span>
            </span>
            {showLabel && (
                <span className={cn(
                    "capitalize font-medium",
                    size === 'sm' ? 'text-xs' : 'text-sm',
                    status === 'critical' ? 'text-[#ff453a]' :
                        status === 'warning' ? 'text-[#ffd60a]' :
                            status === 'online' ? 'text-[#30d158]' :
                                'text-[#8e8e93]'
                )}>
                    {status}
                </span>
            )}
        </div>
    );
}
