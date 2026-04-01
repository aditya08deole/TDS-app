import { useTheme } from '../context/ThemeContext'

export default function PremiumBackground() {
    const { resolvedTheme } = useTheme()
    
    return (
        <div className={`fixed inset-0 w-full h-full -z-20 overflow-hidden transition-colors duration-1000 ${resolvedTheme === 'dark' ? 'bg-[#05070a]' : 'bg-white'}`}>
            {/* Liquid Glass Background Image */}
            <div 
                className="absolute inset-0 w-full h-full transition-opacity duration-1000 ease-in-out"
                style={{
                    backgroundImage: `url(${resolvedTheme === 'dark' ? '/bg-dark.png' : '/bg-light.jpg'})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    opacity: 1
                }}
            />
            
            {/* Subtle Grain Overlay */}
            <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none mix-blend-overlay"
                 style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />
        </div>
    )
}
