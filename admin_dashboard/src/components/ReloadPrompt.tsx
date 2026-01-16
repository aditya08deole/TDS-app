import { useRegisterSW } from 'virtual:pwa-register/react'

export default function ReloadPrompt() {
    const {
        offlineReady: [offlineReady, setOfflineReady],
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r) {
            console.log('SW Registered: ' + r)
        },
        onRegisterError(error) {
            console.log('SW registration error', error)
        },
    })

    const close = () => {
        setOfflineReady(false)
        setNeedRefresh(false)
    }

    return (
        <div className="ReloadPrompt-container">
            {(offlineReady || needRefresh) && (
                <div className="fixed bottom-4 right-4 p-4 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 flex flex-col gap-2 max-w-sm animate-in slide-in-from-bottom tracking-tight">
                    <div className="text-slate-200 font-medium">
                        {offlineReady
                            ? 'App ready to work offline'
                            : 'New content available, click on reload button to update.'}
                    </div>
                    <div className="flex gap-2 mt-2">
                        {needRefresh && (
                            <button className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-sm rounded-lg font-medium transition-colors" onClick={() => updateServiceWorker(true)}>
                                Reload
                            </button>
                        )}
                        <button className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg font-medium transition-colors" onClick={() => close()}>
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
