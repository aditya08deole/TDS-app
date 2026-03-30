"use client"

import { useEffect, useState } from "react"
import { motion, useSpring, useMotionValue } from "framer-motion"
import { useTheme } from "@/context/ThemeContext"

export default function CursorGlow() {
    const { theme } = useTheme()
    const mouseX = useMotionValue(0)
    const mouseY = useMotionValue(0)

    // Smooth physics for the glow
    const springX = useSpring(mouseX, { stiffness: 500, damping: 50 })
    const springY = useSpring(mouseY, { stiffness: 500, damping: 50 })

    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            mouseX.set(e.clientX)
            mouseY.set(e.clientY)
            if (!isVisible) setIsVisible(true)
        }

        const handleMouseLeave = () => setIsVisible(false)
        const handleMouseEnter = () => setIsVisible(true)

        window.addEventListener("mousemove", handleMouseMove)
        document.body.addEventListener("mouseleave", handleMouseLeave)
        document.body.addEventListener("mouseenter", handleMouseEnter)

        return () => {
            window.removeEventListener("mousemove", handleMouseMove)
            document.body.removeEventListener("mouseleave", handleMouseLeave)
            document.body.removeEventListener("mouseenter", handleMouseEnter)
        }
    }, [mouseX, mouseY, isVisible])

    // Theme-based colors and styles
    const isDark = theme === "dark"
    const glowColor = isDark 
        ? "rgba(255, 255, 255, 0.12)" // Soft White for Darkmode
        : "rgba(0, 122, 255, 0.1)"  // Base Blue for Lightmode rays

    return (
        <motion.div
            className="fixed inset-0 pointer-events-none z-[2]"
            style={{
                opacity: isVisible ? 1 : 0,
                transition: "opacity 0.3s ease"
            }}
        >
            {/* Core Radial Glow */}
            <motion.div
                className="absolute rounded-full blur-[100px]"
                style={{
                    x: springX,
                    y: springY,
                    translateX: "-50%",
                    translateY: "-50%",
                    width: "400px",
                    height: "400px",
                    background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
                }}
            />

            {/* "Ray Type" effect for Light Mode */}
            {!isDark && (
                <motion.div
                    className="absolute inset-0 z-10"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    style={{
                        x: springX,
                        y: springY,
                        translateX: "-50%",
                        translateY: "-50%",
                        width: "600px",
                        height: "600px",
                        background: `conic-gradient(from 0deg, transparent 0%, ${glowColor} 2%, transparent 4%, transparent 10%, ${glowColor} 12%, transparent 14%, transparent 20%, ${glowColor} 22%, transparent 24%)`,
                        opacity: 0.4,
                        maskImage: 'radial-gradient(circle, black 0%, transparent 60%)',
                        WebkitMaskImage: 'radial-gradient(circle, black 0%, transparent 60%)'
                    }}
                />
            )}
        </motion.div>
    )
}
