/**
 * Error Tracking Module
 * 
 * Centralized error tracking and reporting
 */

interface ErrorReport {
    message: string
    stack?: string
    componentStack?: string
    timestamp: string
    url: string
    userAgent: string
    type: 'error' | 'unhandledRejection' | 'react'
}

const errorReports: ErrorReport[] = []
const MAX_ERRORS = 50 // Keep last 50 errors

/**
 * Track an error
 */
export function trackError(
    error: Error,
    errorInfo?: { componentStack?: string },
    type: 'error' | 'unhandledRejection' | 'react' = 'error'
) {
    const report: ErrorReport = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo?.componentStack,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        type
    }

    errorReports.push(report)

    // Keep only last MAX_ERRORS
    if (errorReports.length > MAX_ERRORS) {
        errorReports.shift()
    }

    // Log to console in development
    if (import.meta.env.DEV) {
        console.error('❌ Error tracked:', report)
    }

    // Send to error tracking service (Sentry, LogRocket, etc.)
    // if (window.Sentry) {
    //   window.Sentry.captureException(error, {
    //     contexts: {
    //       react: { componentStack: errorInfo?.componentStack }
    //     }
    //   })
    // }

    // Send to custom endpoint
    // fetch('/api/errors', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(report)
    // }).catch(console.error)
}

/**
 * Initialize global error handlers
 */
export function initErrorTracking() {
    // Global error handler
    window.addEventListener('error', (event) => {
        trackError(new Error(event.message), undefined, 'error')
    })

    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
        trackError(
            new Error(event.reason?.message || 'Unhandled Promise Rejection'),
            undefined,
            'unhandledRejection'
        )
    })

    console.log('✅ Error tracking initialized')
}

/**
 * Get all error reports
 */
export function getErrorReports(): ErrorReport[] {
    return errorReports
}

/**
 * Get error summary
 */
export function getErrorSummary() {
    return {
        total: errorReports.length,
        byType: {
            error: errorReports.filter(e => e.type === 'error').length,
            unhandledRejection: errorReports.filter(e => e.type === 'unhandledRejection').length,
            react: errorReports.filter(e => e.type === 'react').length
        },
        recent: errorReports.slice(-5) // Last 5 errors
    }
}

/**
 * Clear error reports
 */
export function clearErrorReports() {
    errorReports.length = 0
}
