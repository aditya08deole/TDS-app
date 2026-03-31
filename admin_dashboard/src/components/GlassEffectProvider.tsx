import React, { useState, useEffect, useRef } from 'react';

interface GlassEffectProviderProps {
    children: React.ReactNode;
}

export const GlassEffectProvider: React.FC<GlassEffectProviderProps> = ({ children }) => {
    const [mousePosition, setMousePosition] = useState({ x: 50, y: 50 });
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleMouseMove = (event: MouseEvent) => {
            if (!containerRef.current) return;

            const rect = containerRef.current.getBoundingClientRect();
            const x = ((event.clientX - rect.left) / rect.width) * 100;
            const y = ((event.clientY - rect.top) / rect.height) * 100;

            setMousePosition({
                x: Math.max(0, Math.min(100, x)),
                y: Math.max(0, Math.min(100, y))
            });
        };

        const container = containerRef.current;
        if (container) {
            container.addEventListener('mousemove', handleMouseMove);
            return () => container.removeEventListener('mousemove', handleMouseMove);
        }
    }, []);

    useEffect(() => {
        // Update CSS custom properties for dynamic light effects
        const root = document.documentElement;
        root.style.setProperty('--mouse-x', `${mousePosition.x}%`);
        root.style.setProperty('--mouse-y', `${mousePosition.y}%`);
    }, [mousePosition]);

    return (
        <div ref={containerRef} className="relative w-full h-full">
            {children}
        </div>
    );
};

// Hook for components to access mouse position
export const useMousePosition = () => {
    const [mousePosition, setMousePosition] = useState({ x: 50, y: 50 });

    useEffect(() => {
        const handleMouseMove = (event: MouseEvent) => {
            setMousePosition({
                x: event.clientX,
                y: event.clientY
            });
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    return mousePosition;
};
