import React from 'react';

export const LiquidBackground: React.FC = () => {
    return (
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-background">
            {/* The "Liquid" atmosphere - High blur vibrant blobs */}
            <div className="absolute inset-0">
                {/* Large Blue Center Blob */}
                <div 
                    className="absolute top-[20%] left-[10%] w-[60%] h-[60%] rounded-full opacity-30 blur-[120px] animate-liquid-slow"
                    style={{ background: 'radial-gradient(circle, #007AFF 0%, transparent 70%)' }}
                />
                
                {/* Cyan Side Blob */}
                <div 
                    className="absolute top-[-10%] right-[-5%] w-[50%] h-[50%] rounded-full opacity-20 blur-[100px] animate-liquid-fast"
                    style={{ background: 'radial-gradient(circle, #06B6D4 0%, transparent 70%)' }}
                />
                
                {/* Pink/Purple Accent */}
                <div 
                    className="absolute bottom-[-15%] left-[30%] w-[45%] h-[45%] rounded-full opacity-20 blur-[130px] animate-liquid-medium"
                    style={{ background: 'radial-gradient(circle, #D946EF 0%, transparent 70%)' }}
                />
                
                {/* Soft White Center Light */}
                <div 
                    className="absolute top-[40%] right-[20%] w-[35%] h-[35%] rounded-full opacity-10 blur-[150px] animate-pulse"
                    style={{ background: 'radial-gradient(circle, #FFFFFF 0%, transparent 70%)' }}
                />
            </div>

            {/* Subtle Texture Overlay - REMOVED for smooth glass */}
            {/* <div className="absolute inset-0 opacity-[0.03] contrast-200 brightness-50" 
                 style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />
            */}

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes liquid-slow {
                    0%, 100% { transform: translate(0, 0) scale(1); }
                    33% { transform: translate(5%, 10%) scale(1.1); }
                    66% { transform: translate(-5%, 5%) scale(0.9); }
                }
                @keyframes liquid-medium {
                    0%, 100% { transform: translate(0, 0) rotate(0deg); }
                    50% { transform: translate(-10%, -5%) rotate(180deg) scale(1.2); }
                }
                @keyframes liquid-fast {
                    0%, 100% { transform: translate(0, 0); }
                    25% { transform: translate(10%, -10%); }
                    75% { transform: translate(-10%, 10%); }
                }
                .animate-liquid-slow { animation: liquid-slow 25s infinite ease-in-out; }
                .animate-liquid-medium { animation: liquid-medium 35s infinite ease-in-out; }
                .animate-liquid-fast { animation: liquid-fast 18s infinite ease-in-out; }
            `}} />
        </div>
    );
};
