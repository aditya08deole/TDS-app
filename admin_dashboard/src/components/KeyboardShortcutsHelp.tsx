import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'

interface KeyboardShortcutsHelpProps {
    onClose: () => void
}

export function KeyboardShortcutsHelp({ onClose }: KeyboardShortcutsHelpProps) {
    const { shortcuts } = useKeyboardShortcuts({ enabled: false })

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full mx-4">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-white">Keyboard Shortcuts</h2>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white p-1"
                    >
                        ✕
                    </button>
                </div>
                <div className="space-y-2">
                    {shortcuts.map((shortcut, index) => (
                        <div key={index} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                            <span className="text-slate-300 text-sm">{shortcut.description}</span>
                            <kbd className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-400 font-mono">
                                {shortcut.ctrlKey && 'Ctrl + '}
                                {shortcut.shiftKey && 'Shift + '}
                                {shortcut.altKey && 'Alt + '}
                                {shortcut.key.toUpperCase()}
                            </kbd>
                        </div>
                    ))}
                </div>
                <p className="text-xs text-slate-500 mt-4 text-center">
                    Press <kbd className="px-1 bg-slate-800 rounded">?</kbd> to show this help
                </p>
            </div>
        </div>
    )
}
