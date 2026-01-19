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
                    <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-lg p-4">
                        <div className="flex items-start gap-3">
                            <div className="flex-1">
                                {offlineReady ? (
                                    <p className="text-sm text-slate-200">
                                        App ready to work offline
                                    </p>
                                ) : (
                                    <p className="text-sm text-slate-200">
                                        New content available, click reload to update.
                                    </p>
                                )}
                            </div>
                            <div className="flex gap-2">
                                {needRefresh && (
                                    <button
                                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                                        onClick={() => updateServiceWorker(true)}
                                    >
                                        Reload
                                    </button>
                                )}
                                <button
                                    className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition-colors"
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
