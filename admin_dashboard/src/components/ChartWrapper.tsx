/**
 * Chart Error Boundary & Mobile Optimization Wrapper
 * Fix #9: Prevent chart rendering crashes and optimize for mobile screens
 */

import React, { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { isNativeApp } from '../lib/platform';

interface ChartErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error) => void;
}

interface ChartErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary for chart components
 * Catches rendering errors and shows fallback UI
 */
export class ChartErrorBoundary extends React.Component<
  ChartErrorBoundaryProps,
  ChartErrorBoundaryState
> {
  constructor(props: ChartErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ChartErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('❌ [CHART-ERROR]', error, errorInfo);
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex flex-col items-center justify-center p-8 bg-red-500/5 border border-red-200 dark:border-red-800 rounded-lg">
            <AlertTriangle className="w-8 h-8 text-red-500 mb-2" />
            <h3 className="font-semibold text-red-700 dark:text-red-400 mb-1">Chart Rendering Error</h3>
            <p className="text-sm text-red-600 dark:text-red-300">{this.state.error?.message || 'Failed to render chart'}</p>
            <p className="text-xs text-red-500 mt-2 font-mono">Try refreshing the page</p>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

interface ResponsiveChartContainerProps {
  children: ReactNode;
  title?: string;
  minHeight?: string;
  maxHeight?: string;
}

/**
 * Responsive container that adapts chart size based on screen
 * Includes resize listener for dynamic adjustments
 */
export const ResponsiveChartContainer: React.FC<ResponsiveChartContainerProps> = ({
  children,
  title,
  minHeight = '300px',
  maxHeight = '600px',
}) => {
  // @ts-ignore
  const [width, setWidth] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 1000);
  const [isMobile, setIsMobile] = useState<boolean>(isNativeApp());

  useEffect(() => {
    const handleResize = () => {
      setWidth(window.innerWidth);
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Reduce chart size on mobile for better performance
  const chartScale = isMobile ? 0.85 : 1;
  const chartHeight = isMobile ? '250px' : maxHeight;
  const chartPadding = isMobile ? 'p-2' : 'p-4';

  return (
    <div className={`${chartPadding} bg-secondary/50 rounded-lg border border-accent overflow-auto`}>
      {title && (
        <h3 className="text-sm font-semibold text-foreground mb-3 sticky top-0 z-10">{title}</h3>
      )}
      <div
        style={{
          minHeight,
          maxHeight: chartHeight,
          transform: `scale(${chartScale})`,
          transformOrigin: 'top left',
          width: `${100 / chartScale}%`,
        }}
        className="overflow-hidden"
      >
        {children}
      </div>
    </div>
  );
};

interface ChartWrapperProps extends ResponsiveChartContainerProps {
  fallback?: ReactNode;
}

/**
 * Combined wrapper: Error boundary + Responsive container
 * Use this for all chart renders
 */
export const ChartWrapper: React.FC<ChartWrapperProps> = ({
  children,
  title,
  minHeight,
  maxHeight,
  fallback,
}) => {
  return (
    <ChartErrorBoundary
      fallback={
        fallback || (
          <div className="flex items-center justify-center p-8 bg-secondary/50 rounded-lg border border-accent">
            <div className="text-center">
              <AlertTriangle className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Chart data unavailable</p>
            </div>
          </div>
        )
      }
    >
      <ResponsiveChartContainer title={title} minHeight={minHeight} maxHeight={maxHeight}>
        {children}
      </ResponsiveChartContainer>
    </ChartErrorBoundary>
  );
};

/**
 * Mobile chart fallback - shows table instead of chart
 * Useful for mobile users who can't view complex charts
 */
export interface TableRow {
  label: string;
  value: string | number;
  color?: string;
}

interface ChartTableFallbackProps {
  title: string;
  data: TableRow[];
}

export const ChartTableFallback: React.FC<ChartTableFallbackProps> = ({ title, data }) => {
  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3">{title}</h3>
      <div className="space-y-2">
        {data.map((row, idx) => (
          <div key={idx} className="flex justify-between items-center p-2 bg-secondary/50 rounded border border-accent/50">
            <span className="text-xs text-muted-foreground">{row.label}</span>
            <span className={`font-mono font-semibold ${row.color || 'text-foreground'}`}>{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Skeleton loader for charts while data is loading
 */
export const ChartSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-8 bg-secondary/50 rounded animate-pulse" />
      ))}
    </div>
  );
};

/**
 * Utility: Simplify chart data for mobile
 * Reduces number of data points to improve performance
 */
export function simplifyChartData<T extends { timestamp?: string; date?: string; [key: string]: any }>(
  data: T[],
  maxPoints: number = 20
): T[] {
  if (data.length <= maxPoints) return data;

  const step = Math.ceil(data.length / maxPoints);
  return data.filter((_, i) => i % step === 0);
}

/**
 * Utility: Get responsive chart height
 */
export function getResponsiveChartHeight(isMobile: boolean): number {
  return isMobile ? 250 : 400;
}

/**
 * Utility: Get responsive chart width
 */
export function getResponsiveChartWidth(containerWidth: number, isMobile: boolean): number {
  return isMobile ? Math.max(containerWidth - 32, 200) : containerWidth - 32;
}

export default {
  ChartErrorBoundary,
  ResponsiveChartContainer,
  ChartWrapper,
  ChartTableFallback,
  ChartSkeleton,
  simplifyChartData,
  getResponsiveChartHeight,
  getResponsiveChartWidth,
};
