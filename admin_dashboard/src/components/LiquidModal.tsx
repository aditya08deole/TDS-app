import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { LiquidPopupCard, type RoundingMode } from './LiquidPopupCard';
import { cn } from '@/lib/utils';

interface LiquidModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  mode?: RoundingMode; // 'sheet' | 'floating' | 'header' | 'asymmetric'
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
}

export function LiquidModal({
  isOpen,
  onClose,
  title,
  subtitle,
  mode = 'floating',
  maxWidth = 'md',
  children,
}: LiquidModalProps) {
  // ESC key listener to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getMaxWidthClass = () => {
    switch (maxWidth) {
      case 'sm': return 'max-w-sm';
      case 'lg': return 'max-w-xl';
      case 'xl': return 'max-w-2xl';
      case 'md':
      default: return 'max-w-md';
    }
  };

  const isSheet = mode === 'sheet';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto selection:bg-cyan-500/30">
      {/* ── High Blur Dark Backdrop ── */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-md transition-opacity animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* ── Modal Container ── */}
      <div
        className={cn(
          'w-full relative z-10 my-auto animate-in duration-500',
          isSheet ? 'slide-in-from-bottom-6 duration-500 mb-0 mt-auto' : 'zoom-in-95 fade-in',
          getMaxWidthClass()
        )}
      >
        <LiquidPopupCard mode={mode} hover={false} className="p-0 border-white/25">
          {/* Header Row */}
          {(title || subtitle) && (
            <div className="flex items-start justify-between p-6 pb-4 border-b border-white/10">
              <div>
                {title && (
                  <h3 className="text-xl font-bold text-foreground tracking-tight leading-none">
                    {title}
                  </h3>
                )}
                {subtitle && (
                  <p className="text-xs text-muted-foreground/80 font-medium mt-1.5 uppercase tracking-wider">
                    {subtitle}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Modal Body */}
          <div className="p-6 md:p-8">
            {children}
          </div>
        </LiquidPopupCard>
      </div>
    </div>
  );
}
