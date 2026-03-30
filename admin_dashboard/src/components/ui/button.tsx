import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
    "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-95",
    {
        variants: {
            variant: {
                default: "bg-primary text-primary-foreground border border-black/10 shadow-md hover:shadow-lg",
                destructive:
                    "bg-destructive text-destructive-foreground border border-black/10 shadow-md hover:shadow-lg",
                outline:
                    "glass-card border border-black/10 shadow-sm hover:shadow-md hover:bg-accent hover:text-accent-foreground",
                secondary:
                    "bg-secondary text-secondary-foreground border border-black/5 shadow-sm hover:bg-secondary/80",
                ghost: "hover:bg-accent hover:text-accent-foreground",
                link: "text-primary underline-offset-4 hover:underline",
            },
            size: {
                default: "h-10 px-4 py-2",
                sm: "h-9 rounded-md px-3",
                lg: "h-11 rounded-md px-8",
                icon: "h-10 w-10",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
)

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    asChild?: boolean
}

import { motion, useSpring, useMotionValue, useTransform } from "framer-motion"

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const mouseX = useMotionValue(0)
        const mouseY = useMotionValue(0)

        // Ultra-soft physics for magnetism
        const springX = useSpring(mouseX, { stiffness: 100, damping: 15 })
        const springY = useSpring(mouseY, { stiffness: 100, damping: 15 })

        // Translate the content by max 4px
        const transX = useTransform(springX, (v) => v * 4)
        const transY = useTransform(springY, (v) => v * 4)

        const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const x = (e.clientX - rect.left) / rect.width - 0.5
            const y = (e.clientY - rect.top) / rect.height - 0.5
            mouseX.set(x)
            mouseY.set(y)
        }

        const handleMouseLeave = () => {
            mouseX.set(0)
            mouseY.set(0)
        }

        const Comp = asChild ? Slot : "button"
        
        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }), "relative overflow-hidden group")}
                ref={ref}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                {...props}
            >
                <motion.div style={{ x: transX, y: transY }} className="flex items-center justify-center w-full h-full gap-2 pointer-events-none">
                    {props.children}
                </motion.div>
            </Comp>
        )
    }
)
Button.displayName = "Button"

export { Button, buttonVariants }
