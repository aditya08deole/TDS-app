/**
 * MapPageWrapper - Handles mobile/desktop map rendering
 * Detects platform and either shows map or fallback
 */

import { isNativeApp } from '../lib/platform';
import { AlertTriangle, MapPin } from 'lucide-react';

interface MapPageWrapperProps {
  children: React.ReactNode;
}

/**
 * Wraps map page with error boundary for mobile
 */
export function MapPageWrapper({ children }: MapPageWrapperProps) {
  // On native/mobile, show warning about map not fully supported yet
  if (isNativeApp()) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 to-slate-900">
        <div className="text-center space-y-4 max-w-md px-6">
          <div className="flex justify-center">
            <div className="p-4 rounded-full bg-yellow-500/10 border border-yellow-500/20">
              <AlertTriangle className="w-8 h-8 text-yellow-500" />
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-white">Maps Coming Soon</h2>
          
          <p className="text-muted-foreground">
            Map view is currently being optimized for mobile. 
            Use the <strong>Device List</strong> to view and monitor devices.
          </p>

          <div className="pt-4 space-y-2">
            <p className="text-sm text-muted-foreground">✅ Web version: Maps work great</p>
            <p className="text-sm text-muted-foreground">📱 Mobile version: Coming in next update</p>
          </div>

          <a
            href="/"
            className="inline-block mt-6 px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  // On web, render the map normally
  return <>{children}</>;
}

/**
 * MapPageErrorBoundary - Catches map crashes
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class MapPageErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('❌ Map page crashed:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 to-slate-900">
          <div className="text-center space-y-4 max-w-md px-6">
            <div className="flex justify-center">
              <div className="p-4 rounded-full bg-red-500/10 border border-red-500/20">
                <MapPin className="w-8 h-8 text-red-500" />
              </div>
            </div>
            
            <h2 className="text-2xl font-bold text-white">Map Error</h2>
            
            <p className="text-muted-foreground">
              The map encountered an error and couldn't load. 
              Please try refreshing the page.
            </p>

            <details className="mt-4 text-left bg-slate-800/50 p-3 rounded text-xs text-muted-foreground overflow-auto max-h-20">
              <summary className="cursor-pointer font-mono">Error details</summary>
              <pre className="mt-2">{this.state.error?.message}</pre>
            </details>

            <div className="pt-4 flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
              >
                Refresh Page
              </button>
              <a
                href="/"
                className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors"
              >
                Go Home
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Need this import for React.Component
import React from 'react';
