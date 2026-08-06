"use client"

import { Toaster as Sonner } from "sonner"
import { useTheme } from "../../context/ThemeContext"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
    const { resolvedTheme } = useTheme()

    return (
        <Sonner
            theme={resolvedTheme as ToasterProps["theme"]}
            className="toaster group"
            toastOptions={{
                classNames: {
                    toast:
                        "group toast group-[.toaster]:glass-system group-[.toaster]:backdrop-blur-2xl group-[.toaster]:bg-background/60 group-[.toaster]:text-foreground group-[.toaster]:border-t group-[.toaster]:border-white/30 group-[.toaster]:border-l group-[.toaster]:border-white/20 group-[.toaster]:shadow-[0_20px_50px_rgba(0,0,0,0.3)] group-[.toaster]:rounded-2xl group-[.toaster]:p-4",
                    description: "group-[.toast]:text-muted-foreground group-[.toast]:text-xs font-medium",
                    actionButton:
                        "group-[.toast]:bg-gradient-to-r group-[.toast]:from-cyan-500 group-[.toast]:to-blue-600 group-[.toast]:text-white group-[.toast]:rounded-xl font-bold group-[.toast]:shadow-md group-[.toast]:shadow-cyan-500/20",
                    cancelButton:
                        "group-[.toast]:bg-white/10 group-[.toast]:text-foreground group-[.toast]:rounded-xl",
                },
            }}
            {...props}
        />
    )
}

export { Toaster }
