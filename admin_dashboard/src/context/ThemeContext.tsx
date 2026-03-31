import React, { createContext, useContext, useState, useEffect } from 'react'

type Theme = 'dark' | 'light'

interface ThemeContextType {
    theme: Theme
    resolvedTheme: 'dark' | 'light'
    setTheme: (theme: Theme) => void
    toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>(() => {
        const saved = localStorage.getItem('theme') as Theme
        return saved || 'light'
    })

    const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('light')

    // Always resolve to the selected theme
    useEffect(() => {
        setResolvedTheme(theme)
    }, [theme])

    // Apply theme to document
    useEffect(() => {
        const root = document.documentElement
        
        // 2. Apply theme
        if (resolvedTheme === 'dark') {
            root.classList.add('dark')
            root.classList.remove('light')
        } else {
            root.classList.add('light')
            root.classList.remove('dark')
        }

        // 3. Update meta theme-color

        // 4. Update meta theme-color
        const metaThemeColor = document.querySelector('meta[name="theme-color"]')
        if (metaThemeColor) {
            metaThemeColor.setAttribute('content', resolvedTheme === 'dark' ? '#000000' : '#ffffff')
        }
    }, [resolvedTheme])

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme)
        localStorage.setItem('theme', newTheme)
    }

    const toggleTheme = () => {
        const next = resolvedTheme === 'dark' ? 'light' : 'dark'
        setTheme(next)
    }

    return (
        <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
    const context = useContext(ThemeContext)
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider')
    }
    return context
}
