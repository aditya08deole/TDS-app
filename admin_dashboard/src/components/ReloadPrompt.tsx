import { useRegisterSW } from 'virtual:pwa-register/react'

/**
 * ReloadPrompt Component
 * Shows a toast notification when a new version of the app is available
 */
export default function ReloadPrompt() {
    const {
        offlineReady: [offlineReady, setOfflineReady],
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r) {
            console.log('✅ SW Registered:', r)
        },
        onRegisterError(error) {
            console.error('❌ SW registration error', error)
        },
    })

    const close = () => {
        setOfflineReady(false)
        setNeedRefresh(false)
    }

    return (
        <>
            {(offlineReady || needRefresh) && (
                <div className="fixed bottom-4 right-4 z-50 max-w-md">
                    <div className="bg-card border border-border rounded-lg shadow-lg p-4">
                        <div className="flex items-start gap-3">
                            <div className="flex-1">
                                {offlineReady ? (
                                    <p className="text-sm text-foreground">
                                        App ready to work offline
                                    </p>
                                ) : (
                                    <p className="text-sm text-foreground">
                                        New content available, click reload to update.
                                    </p>
                                )}
                            </div>
                            <div className="flex gap-2">
                                {needRefresh && (
                                    <button
                                        className="px-3 py-1 bg-primary hover:bg-primary/90 text-primary-foreground text-sm rounded transition-colors"
                                        onClick={() => updateServiceWorker(true)}
                                    >
                                        Reload
                                    </button>
                                )}
                                <button
                                    className="px-3 py-1 bg-accent hover:bg-accent/90 text-accent-foreground text-sm rounded transition-colors"
                                    onClick={close}
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
