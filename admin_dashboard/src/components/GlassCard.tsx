import { cn } from '@/lib/utils'

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
    hover?: boolean;
    size?: "sm" | "md" | "lg";
    variant?: "default" | "liquid";
    children?: React.ReactNode;
}

export function GlassCard({ 
    className, 
    hover = true,
    size = "md",
    variant = "default",
    children, 
    ...props 
}: GlassCardProps) {
    const getSizeClasses = () => {
        switch (size) {
            case "sm":
                return "rounded-[16px] p-3 backdrop-blur-[20px]";
            case "lg":
                return "rounded-[36px] p-6 backdrop-blur-[60px]";
            case "md":
            default:
                return "rounded-[24px] p-4 backdrop-blur-[40px]";
        }
    };

    return (
        <div
            className={cn(
                "glass-system-parent group",
                getSizeClasses(),
                hover && "transition-all duration-500 ease-out hover:scale-[1.01] hover:brightness-105",
                className
            )}
            {...props}
        >
            {/* Inner Gradient Tint (Liquid Flow Sampling) */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/5 dark:from-white/5 dark:via-transparent dark:to-black/20 pointer-events-none z-0" />
            
            {/* Top Edge Highlight Glow (40-70% white) */}
            <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/70 to-transparent pointer-events-none z-0 opacity-60 group-hover:opacity-100 transition-opacity duration-300" />

            {/* Specular Light Reflection (Soft Light Streak/Blob at Top-Left) */}
            <div className="absolute -top-12 -left-12 w-48 h-48 bg-white/30 dark:bg-white/10 blur-[50px] rounded-full pointer-events-none z-0 opacity-40 group-hover:opacity-80 transition-opacity duration-500 group-hover:translate-x-4 group-hover:translate-y-4" />

            {/* Content Container (elevated above effects) */}
            <div className="relative z-10 w-full h-full">
                {children}
            </div>
        </div>
    );
}
