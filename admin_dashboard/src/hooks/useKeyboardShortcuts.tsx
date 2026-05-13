import { useEffect, useCallback, useMemo } from 'react'
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
    const shortcuts: KeyboardShortcut[] = useMemo(() => [
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
    ], [navigate])

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
    }, [enabled, shortcuts])

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [handleKeyDown])

    return { shortcuts }
}
