import { useState } from 'react'
import { Scanner } from '@yudiel/react-qr-scanner'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function ScanDevice() {
    const navigate = useNavigate()
    const [paused, setPaused] = useState(false)
    const [scannedResult, setScannedResult] = useState<string | null>(null)

    const handleScan = (text: string) => {
        if (text && !paused) {
            setPaused(true)
            setScannedResult(text)
            // Assuming QR code contains device ID
            // In a real app, we might parse a URL or just the ID
            // For now, let's assume it's simply the UUID
            setTimeout(() => {
                // Navigate to devices or map with this device selected
                // Ideally passing a query param or state
                alert(`Found Device: ${text}`)
                setPaused(false)
                // navigate(`/devices?id=${text}`) 
            }, 1000)
        }
    }

    return (
        <div className="h-[calc(100vh-64px)] flex flex-col bg-black">
            <div className="flex items-center justify-between p-4 bg-transparent z-10 absolute top-0 left-0 right-0">
                <button onClick={() => navigate(-1)} className="p-2 bg-black/50 rounded-full text-white backdrop-blur-md">
                    <ArrowLeft className="h-6 w-6" />
                </button>
                <h1 className="text-white font-bold text-lg drop-shadow-md">Scan Device</h1>
                <div className="w-10" /> {/* Spacer */}
            </div>

            <div className="flex-1 relative flex items-center justify-center overflow-hidden">
                <Scanner
                    onScan={(result) => {
                        if (result && result.length > 0) {
                            handleScan(result[0].rawValue)
                        }
                    }}
                    components={{
                        onOff: true,
                        torch: true,
                        zoom: true,
                        finder: true
                    }}
                    styles={{
                        container: { width: '100%', height: '100%' },
                        video: { objectFit: 'cover' }
                    }}
                />

                {scannedResult && (
                    <div className="absolute bottom-20 left-4 right-4 bg-emerald-500 text-white p-4 rounded-xl text-center font-bold animate-bounce shadow-xl">
                        Device Detected!
                    </div>
                )}
            </div>

            <div className="p-6 bg-slate-900 text-center">
                <p className="text-slate-400 text-sm">Align the QR code within the frame to scan.</p>
            </div>
        </div>
    )
}
