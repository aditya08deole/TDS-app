import { useState, useEffect } from 'react'
import { collection, query as firestoreQuery, where, getDocs, limit } from 'firebase/firestore'
import { Search, Command, ArrowRight, Monitor, AlertTriangle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { db } from '../lib/firebase'
import { useUI } from '../context/UIContext'

interface SearchResult {
    id: string
    type: 'device' | 'alert' | 'nav'
    title: string
    subtitle?: string
    metadata?: any
    url?: string
}

export default function CommandPalette() {
    const [isOpen, setIsOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<SearchResult[]>([])
    const [selectedIndex, setSelectedIndex] = useState(0)
    const navigate = useNavigate()

    // Shortcuts
    useEffect(() => {
        const handleDown = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                setIsOpen(prev => !prev)
            }
            if (!isOpen) return

            if (e.key === 'Escape') {
                setIsOpen(false)
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSelectedIndex(prev => (prev + 1) % results.length)
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSelectedIndex(prev => (prev - 1 + results.length) % results.length)
            }
            if (e.key === 'Enter') {
                e.preventDefault()
                if (results[selectedIndex]) {
                    handleSelect(results[selectedIndex])
                }
            }
        }
        document.addEventListener('keydown', handleDown)
        return () => document.removeEventListener('keydown', handleDown)
    }, [isOpen, results, selectedIndex])

    // Search Logic
    useEffect(() => {
        if (!isOpen) return

        const search = async () => {
            if (query.trim() === '') {
                setResults([
                    { id: 'nav-map', type: 'nav', title: 'Go to Map', url: '/map', subtitle: 'View geolocation' },
                    { id: 'nav-alerts', type: 'nav', title: 'Go to Alerts', url: '/alerts', subtitle: 'View system warnings' },
                    { id: 'nav-devices', type: 'nav', title: 'Go to Devices', url: '/devices', subtitle: 'Manage inventory' },
                ])
                return
            }

            try {
                // Since Firestore doesn't have a native global search RPC like PostgREST,
                // we'll perform a query on the devices collection.
                const q = firestoreQuery(
                    collection(db, 'devices'),
                    where('name', '>=', query),
                    where('name', '<=', query + '\uf8ff'),
                    limit(5)
                )
                
                const querySnapshot = await getDocs(q)
                const deviceResults: SearchResult[] = []
                
                querySnapshot.forEach((doc) => {
                    const d = doc.data() as any
                    deviceResults.push({
                        id: doc.id,
                        type: 'device',
                        title: d.name || 'Unnamed Device',
                        subtitle: d.location_name || 'No location',
                        metadata: { status: d.status }
                    })
                })
                
                setResults(deviceResults.length > 0 ? deviceResults : [
                    { id: 'nav-map', type: 'nav', title: 'Go to Map', url: '/map', subtitle: 'View geolocation' },
                    { id: 'nav-alerts', type: 'nav', title: 'Go to Alerts', url: '/alerts', subtitle: 'View system warnings' },
                    { id: 'nav-devices', type: 'nav', title: 'Go to Devices', url: '/devices', subtitle: 'Manage inventory' },
                ])
            } catch (e) {
                console.error('Search error:', e)
            }
        }

        const timeout = setTimeout(search, 300)
        return () => clearTimeout(timeout)
    }, [query, isOpen])

    const { openInspector } = useUI()

    const handleSelect = (result: SearchResult) => {
        if (result.type === 'nav' && result.url) {
            navigate(result.url)
        } else if (result.type === 'device') {
            openInspector(result.id)
        }
        setIsOpen(false)
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh] px-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsOpen(false)} />

            <div className="relative w-full max-w-xl bg-[#1c1c1e] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-scale-in">
                {/* Search Input */}
                <div className="flex items-center px-4 py-4 border-b border-white/5">
                    <Search className="w-5 h-5 text-slate-400 mr-3" />
                    <input
                        autoFocus
                        type="text"
                        placeholder="Search devices, alerts, or commands..."
                        className="bg-transparent text-white text-lg placeholder:text-slate-500 w-full outline-none"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    <div className="flex gap-2">
                        <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 bg-white/5 rounded text-[10px] text-slate-400 font-mono">
                            ESC
                        </kbd>
                    </div>
                </div>

                {/* Results */}
                <div className="max-h-[60vh] overflow-y-auto p-2">
                    {results.length === 0 ? (
                        <div className="p-8 text-center text-slate-500 text-sm">
                            No results found for "{query}"
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {results.map((result, i) => (
                                <button
                                    key={result.id}
                                    onClick={() => handleSelect(result)}
                                    className={`w-full flex items-center justify-between px-3 py-3 rounded-lg group transition-colors ${i === selectedIndex ? 'bg-blue-600' : 'hover:bg-white/5'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-md ${i === selectedIndex ? 'bg-white/20' : 'bg-white/5'}`}>
                                            {result.type === 'device' ? <Monitor className="w-4 h-4 text-white" /> :
                                                result.type === 'alert' ? <AlertTriangle className="w-4 h-4 text-amber-400" /> :
                                                    <Command className="w-4 h-4 text-slate-400" />}
                                        </div>
                                        <div className="text-left">
                                            <p className={`text-sm font-medium ${i === selectedIndex ? 'text-white' : 'text-slate-200'}`}>
                                                {result.title}
                                            </p>
                                            {result.subtitle && (
                                                <p className={`text-xs ${i === selectedIndex ? 'text-blue-200' : 'text-slate-500'}`}>
                                                    {result.subtitle}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    {i === selectedIndex && <ArrowRight className="w-4 h-4 text-white" />}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-4 py-2 bg-black/20 text-[10px] text-slate-500 border-t border-white/5 flex justify-between">
                    <span>ProTip: Search "Offline" to filter lists</span>
                    <span>EvaraTDS v1.0</span>
                </div>
            </div>
        </div>
    )
}
