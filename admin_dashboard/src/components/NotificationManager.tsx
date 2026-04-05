import { useEffect, useState, useCallback } from 'react'
import { db } from '../lib/firebase'
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore'
import { Bell, X, AlertTriangle, CheckCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'

interface Toast {
    id: string
    type: 'info' | 'success' | 'warning' | 'error'
    title: string
    message: string
    timestamp: Date
}

// Sound effects using Web Audio API

export default function NotificationManager() {
    const { user } = useAuth()
    const { soundEnabled, permission, playSound } = useNotification()
    const [toasts, setToasts] = useState<Toast[]>([])

    const showToast = useCallback((toast: Omit<Toast, 'id' | 'timestamp'>) => {
        const id = Math.random().toString(36).substr(2, 9)
        const newToast: Toast = { ...toast, id, timestamp: new Date() }
        setToasts(prev => [...prev, newToast])

        if (soundEnabled) {
            if (toast.type === 'error') playSound('error')
            else if (toast.type === 'warning') playSound('warning')
            else if (toast.type === 'success') playSound('success')
        }

        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id))
        }, 5000)
    }, [soundEnabled, playSound])

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }, [])

    const showDesktopNotification = useCallback((title: string, body: string, icon?: string) => {
        if (permission === 'granted' && document.hidden) {
            new Notification(title, {
                body,
                icon: icon || '/pwa-192x192.png',
                tag: 'evaratds-alert'
            })
        }
    }, [permission])

    useEffect(() => {
        if (!user) return
        const q = query(collection(db, 'alerts'), orderBy('created_at', 'desc'), limit(1))
        const unsubscribe = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const alert = change.doc.data() as { severity?: string; message?: string; type?: string; created_at?: any; tds_value?: number }
                    const isNew = alert.created_at?.toDate ? (new Date().getTime() - alert.created_at.toDate().getTime()) < 5000 : true
                    if (!isNew) return
                    
                    // ═══ FILTER: Skip showing alerts with invalid TDS values (≥500)
                    // These are likely voltage/temp misreads, not real critical alerts
                    const tdsValue = alert.tds_value
                    if (tdsValue !== undefined && tdsValue >= 500) {
                        console.warn(`🚫 Filtered invalid alert: TDS ${tdsValue} ppm (likely misread)`)
                        return
                    }

                    const severity = alert.severity?.toLowerCase()
                    const type = severity === 'critical' ? 'error' :
                        severity === 'high' ? 'warning' :
                            severity === 'medium' ? 'warning' : 'info'

                    showToast({
                        type,
                        title: `${alert.type || 'Alert'}`.toUpperCase(),
                        message: alert.message || 'New alert received'
                    })

                    if (severity === 'critical' || severity === 'high') {
                        showDesktopNotification(`⚠️ ${alert.type || 'Critical Alert'}`, alert.message || 'Immediate attention required')
                    }
                }
            })
        })
        return () => unsubscribe()
    }, [user, showToast, showDesktopNotification])

    const getToastStyles = (type: Toast['type']) => {
        switch (type) {
            case 'error': return 'border-red-500/50 bg-red-500/10'
            case 'warning': return 'border-orange-500/50 bg-orange-500/10'
            case 'success': return 'border-emerald-500/50 bg-emerald-500/10'
            default: return 'border-cyan-500/50 bg-cyan-500/10'
        }
    }

    const getToastIcon = (type: Toast['type']) => {
        switch (type) {
            case 'error': return <AlertTriangle className="h-5 w-5 text-red-400" />
            case 'warning': return <AlertTriangle className="h-5 w-5 text-orange-400" />
            case 'success': return <CheckCircle className="h-5 w-5 text-emerald-400" />
            default: return <Bell className="h-5 w-5 text-cyan-400" />
        }
    }

    if (!user) return null

    return (
        <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
            {toasts.map(toast => (
                <div key={toast.id} className={`flex items-start gap-3 p-4 rounded-xl border backdrop-blur-sm animate-slide-in-right ${getToastStyles(toast.type)}`}>
                    {getToastIcon(toast.type)}
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white">{toast.title}</p>
                        <p className="text-xs text-slate-400 truncate">{toast.message}</p>
                    </div>
                    <button onClick={() => removeToast(toast.id)} className="text-slate-500 hover:text-white p-1">
                        <X className="h-4 w-4" />
                    </button>
                </div>
            ))}
        </div>
    )
}
