import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
    "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-95 relative overflow-hidden border",
    {
        variants: {
            variant: {
                default: "glass-system-child text-foreground shadow-lg border-white/20",
                destructive:
                    "glass-system-child text-red-500 border-red-500/25 shadow-lg",
                outline:
                    "glass-system-child border-white/30 shadow-md",
                secondary:
                    "glass-system-child bg-white/5 text-secondary-foreground shadow-md backdrop-blur-md",
                ghost: "border border-transparent hover:glass-system-child",
                link: "text-primary underline-offset-4 hover:underline border-transparent",
                glass: "glass-system-child border-white/20 shadow-xl"
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

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : "button"
        
        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }), "group")}
                ref={ref}
                {...props}
            >
                {props.children}
            </Comp>
        )
    }
)
Button.displayName = "Button"

export { Button, buttonVariants }
