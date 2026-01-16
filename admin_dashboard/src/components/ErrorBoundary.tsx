import { Component, type ErrorInfo, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'

interface Props {
    children: ReactNode
}

interface State {
    hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    }

    public static getDerivedStateFromError(_: Error): State {
        return { hasError: true }
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo)

        // Log to Supabase
        supabase.from('frontend_errors').insert({
            error: error.message,
            stack: errorInfo.componentStack,
            url: window.location.href,
            user_agent: navigator.userAgent
        }).then(({ error }) => {
            if (error) console.error('Failed to log error:', error)
        })
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-4">
                    <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-xl p-8 text-center shadow-2xl">
                        <h1 className="text-3xl font-bold text-red-500 mb-4">System Error</h1>
                        <p className="text-slate-400 mb-6">
                            The application encountered a critical error. Our engineering team has been notified.
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                        >
                            Reload System
                        </button>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}
