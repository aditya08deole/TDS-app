import { cn } from '@/lib/utils'

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
    hover?: boolean;
    variant?: "default" | "liquid" | "dynamic" | "frosted";
    children?: React.ReactNode;
    depth?: 1 | 2 | 3 | 4;
    ripple?: boolean;
}

export function GlassCard({ 
    className, 
    hover = false,
    variant = "default", 
    depth = 1,
    ripple = false,
    children, 
    ...props 
}: GlassCardProps) {
    const getGlassClass = () => {
        switch (variant) {
            case "liquid":
                return "liquid-ios-glass";
            case "dynamic":
                return "glass-dynamic";
            case "frosted":
                return "glass-frosted";
            default:
                return "premium-glass";
        }
    };

    const getDepthClass = () => `glass-layer-${depth}`;
    
    return (
        <div
            className={cn(
                getGlassClass(),
                getDepthClass(),
                "rounded-2xl relative overflow-hidden",
                className
            )}
            {...props}
        >
            <div className="relative z-20 h-full w-full">
                {children}
            </div>
        </div>
    );
}
