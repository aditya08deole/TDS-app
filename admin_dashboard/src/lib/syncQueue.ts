/**
 * Offline Sync Queue
 * Queues actions while offline and syncs when back online
 */

interface QueuedAction {
    id: string
    type: string
    payload: unknown
    timestamp: number
    retries: number
}

// Storage key
const QUEUE_KEY = 'offline-sync-queue'

// Get queue from storage
function getQueue(): QueuedAction[] {
    try {
        const stored = localStorage.getItem(QUEUE_KEY)
        return stored ? JSON.parse(stored) : []
    } catch {
        return []
    }
}

// Save queue to storage
function saveQueue(queue: QueuedAction[]): void {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

/**
 * Add an action to the sync queue
 */
export function queueAction(type: string, payload: unknown): string {
    const id = Math.random().toString(36).substr(2, 9)
    const action: QueuedAction = {
        id,
        type,
        payload,
        timestamp: Date.now(),
        retries: 0
    }

    const queue = getQueue()
    queue.push(action)
    saveQueue(queue)

    // Try to sync immediately if online
    if (navigator.onLine) {
        processQueue()
    }

    return id
}

/**
 * Remove an action from the queue
 */
export function removeFromQueue(id: string): void {
    const queue = getQueue().filter(action => action.id !== id)
    saveQueue(queue)
}

/**
 * Process the sync queue
 * Call this when coming back online
 */
export async function processQueue(): Promise<{ processed: number; failed: number }> {
    const queue = getQueue()
    let processed = 0
    let failed = 0

    for (const action of queue) {
        try {
            await executeAction(action)
            removeFromQueue(action.id)
            processed++
        } catch (error) {
            console.error('Failed to process queued action:', error)

            // Increment retry count
            action.retries++

            // Remove if too many retries
            if (action.retries >= 3) {
                removeFromQueue(action.id)
                failed++
            } else {
                // Update retry count in queue
                const currentQueue = getQueue()
                const index = currentQueue.findIndex(a => a.id === action.id)
                if (index !== -1) {
                    currentQueue[index] = action
                    saveQueue(currentQueue)
                }
            }
        }
    }

    return { processed, failed }
}

/**
 * Execute a queued action
 * Add your action handlers here
 */
async function executeAction(action: QueuedAction): Promise<void> {
    const { db } = await import('./firebase')
    const { doc, updateDoc, addDoc, collection, setDoc } = await import('firebase/firestore')

    switch (action.type) {
        case 'UPDATE_DEVICE_STATUS': {
            const { deviceId, status } = action.payload as { deviceId: string; status: string }
            const docRef = doc(db, 'devices', deviceId)
            await updateDoc(docRef, { status })
            break
        }

        case 'ADD_MAINTENANCE_LOG': {
            const logData = action.payload as Record<string, unknown>
            await addDoc(collection(db, 'maintenance_logs'), {
                ...logData,
                created_at: new Date().toISOString()
            })
            break
        }

        case 'UPDATE_SETTINGS': {
            const { userId, settings } = action.payload as { userId: string; settings: Record<string, unknown> }
            const docRef = doc(db, 'users', userId)
            await setDoc(docRef, settings, { merge: true })
            break
        }

        case 'ACKNOWLEDGE_ALERT': {
            const { alertId, userId } = action.payload as { alertId: string; userId: string }
            const docRef = doc(db, 'alerts', alertId)
            await updateDoc(docRef, {
                status: 'acknowledged',
                acknowledged_by: userId,
                acknowledged_at: new Date().toISOString()
            })
            break
        }

        default:
            console.warn('Unknown action type:', action.type)
    }
}

/**
 * Get pending actions count
 */
export function getPendingCount(): number {
    return getQueue().length
}

/**
 * Clear all pending actions
 */
export function clearQueue(): void {
    saveQueue([])
}

/**
 * Initialize offline sync
 * Sets up listeners for online/offline events
 */
export function initOfflineSync(): () => void {
    const handleOnline = async () => {
        console.log('Back online, processing sync queue...')
        const result = await processQueue()
        console.log(`Sync complete: ${result.processed} processed, ${result.failed} failed`)

        // Dispatch event for UI updates
        window.dispatchEvent(new CustomEvent('sync-complete', { detail: result }))
    }

    const handleOffline = () => {
        console.log('Offline mode activated')
        window.dispatchEvent(new CustomEvent('offline-mode'))
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Process any pending items on init if online
    if (navigator.onLine && getPendingCount() > 0) {
        handleOnline()
    }

    // Return cleanup function
    return () => {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
    }
}
