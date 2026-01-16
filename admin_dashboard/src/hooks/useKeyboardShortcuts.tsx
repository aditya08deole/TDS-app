import { useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

interface KeyboardShortcut {
    key: string
    ctrlKey?: boolean
    shiftKey?: boolean
    altKey?: boolean
    action: () => void
    description: string
}

interface UseKeyboardShortcutsOptions {
    enabled?: boolean
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions = {}) {
    const { enabled = true } = options
    const navigate = useNavigate()

    // Default shortcuts
    const shortcuts: KeyboardShortcut[] = [
        {
            key: 'd',
            action: () => navigate('/'),
            description: 'Go to Dashboard'
        },
        {
            key: 'm',
            action: () => navigate('/map'),
            description: 'Go to Map'
        },
        {
            key: 'v',
            action: () => navigate('/devices'),
            description: 'Go to Devices'
        },
        {
            key: 'a',
            action: () => navigate('/alerts'),
            description: 'Go to Alerts'
        },
        {
            key: 's',
            action: () => navigate('/settings'),
            description: 'Go to Settings'
        },
        {
            key: '/',
            action: () => {
                // Focus search input if it exists
                const searchInput = document.querySelector('input[type="text"][placeholder*="Search"]') as HTMLInputElement
                if (searchInput) {
                    searchInput.focus()
                }
            },
            description: 'Focus Search'
        },
        {
            key: 'Escape',
            action: () => {
                // Close any open modals
                const closeButton = document.querySelector('[data-dismiss="modal"]') as HTMLButtonElement
                if (closeButton) {
                    closeButton.click()
                }
                // Blur focused element
                if (document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur()
                }
            },
            description: 'Close Modal / Clear Focus'
        },
        {
            key: 'r',
            ctrlKey: false,
            shiftKey: true,
            action: () => {
                // Refresh current page data
                window.dispatchEvent(new CustomEvent('refresh-data'))
            },
            description: 'Refresh Data'
        }
    ]

    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        if (!enabled) return

        // Ignore if typing in an input
        const target = event.target as HTMLElement
        const isTyping = target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable

        // Allow some shortcuts even when typing
        const allowedWhileTyping = ['Escape']

        if (isTyping && !allowedWhileTyping.includes(event.key)) {
            return
        }

        // Find matching shortcut
        const shortcut = shortcuts.find(s =>
            s.key.toLowerCase() === event.key.toLowerCase() &&
            !!s.ctrlKey === event.ctrlKey &&
            !!s.shiftKey === event.shiftKey &&
            !!s.altKey === event.altKey
        )

        if (shortcut) {
            event.preventDefault()
            shortcut.action()
        }
    }, [enabled, shortcuts, navigate])

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [handleKeyDown])

    return { shortcuts }
}

// Keyboard shortcuts help component
export function KeyboardShortcutsHelp({ onClose }: { onClose: () => void }) {
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
