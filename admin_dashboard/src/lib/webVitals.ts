import { onCLS, onINP, onFCP, onLCP, onTTFB, type Metric } from 'web-vitals'

/**
 * Web Vitals Tracking
 * 
 * Tracks Core Web Vitals and sends to console/analytics
 * 
 * Metrics tracked:
 * - CLS: Cumulative Layout Shift
 * - FID: First Input Delay
 * - FCP: First Contentful Paint
 * - LCP: Largest Contentful Paint
 * - TTFB: Time to First Byte
 */

interface VitalsData {
    name: string
    value: number
    rating: 'good' | 'needs-improvement' | 'poor'
    delta: number
    id: string
}

// Store vitals for reporting
const vitalsData: VitalsData[] = []

/**
 * Send metric to analytics
 * Replace with your analytics service (Google Analytics, Mixpanel, etc.)
 */
function sendToAnalytics(metric: Metric) {
    const { name, value, rating, delta, id } = metric

    const vitalsEntry: VitalsData = {
        name,
        value,
        rating,
        delta,
        id
    }

    vitalsData.push(vitalsEntry)

    // Log to console in development
    if (import.meta.env.DEV) {
        console.log(`📊 Web Vital: ${name}`, {
            value: `${Math.round(value)}ms`,
            rating,
            delta: `${Math.round(delta)}ms`,
            id
        })
    }

    // Send to analytics service (example)
    // if (window.gtag) {
    //   window.gtag('event', name, {
    //     value: Math.round(value),
    //     event_category: 'Web Vitals',
    //     event_label: id,
    //     non_interaction: true,
    //   })
    // }

    // Send to custom endpoint
    // fetch('/api/analytics/vitals', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(vitalsEntry)
    // }).catch(console.error)
}

/**
 * Initialize web vitals tracking
 */
export function initWebVitals() {
    onCLS(sendToAnalytics)
    onINP(sendToAnalytics)
    onFCP(sendToAnalytics)
    onLCP(sendToAnalytics)
    onTTFB(sendToAnalytics)

    console.log('✅ Web Vitals tracking initialized')
}

/**
 * Get all collected vitals data
 */
export function getVitalsData(): VitalsData[] {
    return vitalsData
}

/**
 * Get vitals summary
 */
export function getVitalsSummary() {
    const summary = {
        good: 0,
        needsImprovement: 0,
        poor: 0,
        metrics: vitalsData
    }

    vitalsData.forEach(vital => {
        if (vital.rating === 'good') summary.good++
        else if (vital.rating === 'needs-improvement') summary.needsImprovement++
        else summary.poor++
    })

    return summary
}

/**
 * Performance thresholds (Google's recommendations)
 */
export const VITALS_THRESHOLDS = {
    LCP: { good: 2500, poor: 4000 },      // Largest Contentful Paint
    FID: { good: 100, poor: 300 },        // First Input Delay
    CLS: { good: 0.1, poor: 0.25 },       // Cumulative Layout Shift
    FCP: { good: 1800, poor: 3000 },      // First Contentful Paint
    TTFB: { good: 800, poor: 1800 }       // Time to First Byte
}
