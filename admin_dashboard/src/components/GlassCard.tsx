import { cn } from "@/lib/utils";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
    hover?: boolean;
}

export function GlassCard({ className, hover, children, ...props }: GlassCardProps) {
    return (
        <div
            className={cn(
                "bg-[#1c1c1e]/60 backdrop-blur-xl border border-white/10 rounded-2xl transition-all duration-300",
                hover && "hover:bg-[#1c1c1e]/80 hover:scale-[1.02] hover:shadow-2xl hover:border-white/20",
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
}
