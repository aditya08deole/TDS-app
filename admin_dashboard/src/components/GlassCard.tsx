import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
    hover?: boolean;
}

export function GlassCard({ className, hover, children, ...props }: GlassCardProps) {
    return (
        <motion.div
            className={cn(
                "glass-card rounded-2xl relative overflow-hidden",
                // Advanced 'Real Glass' Inset Shadows
                "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08),_inset_0_0_20px_rgba(255,255,255,0.03)]",
                className
            )}
            whileHover={hover ? { 
                scale: 1.01,
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12), inset 0 0 30px rgba(255,255,255,0.06)",
                transition: { type: "spring", stiffness: 400, damping: 10 }
            } : {}}
            {...props}
        >
            {/* Refined Specular Light Sweep Effect - 45 Degree Angle */}
            <motion.div
                className="absolute inset-0 z-10 pointer-events-none"
                initial={{ x: "-100%", y: "-100%" }}
                animate={{ x: "200%", y: "200%" }}
                transition={{
                    duration: 6,
                    repeat: Infinity,
                    repeatDelay: 8,
                    ease: "easeInOut"
                }}
                style={{
                    background: "linear-gradient(135deg, transparent, rgba(255,255,255,0.02), transparent)",
                    width: "100%"
                }}
            />
            
            <div className="relative z-20 h-full w-full">
                {children}
            </div>
        </motion.div>
    );
}
