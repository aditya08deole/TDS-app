import { Component, type ErrorInfo, type ReactNode } from 'react'
import { db } from '../lib/firebase'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'

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

    public static getDerivedStateFromError(): State {
        return { hasError: true }
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo)

        // Log to Firestore
        addDoc(collection(db, 'frontend_errors'), {
            error: error.message,
            stack: errorInfo.componentStack,
            url: window.location.href,
            user_agent: navigator.userAgent,
            timestamp: serverTimestamp()
        }).catch((err) => {
            console.error('Failed to log error:', err)
        })
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
                    <div className="max-w-md w-full bg-card border border-border rounded-xl p-8 text-center shadow-2xl">
                        <h1 className="text-3xl font-bold text-red-500 mb-4">System Error</h1>
                        <p className="text-muted-foreground mb-6">
                            The application encountered a critical error. Our engineering team has been notified.
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 rounded-lg font-medium transition-colors"
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
