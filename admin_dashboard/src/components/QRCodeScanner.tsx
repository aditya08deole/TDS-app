import { useState, useEffect } from 'react'
import { Scanner } from '@yudiel/react-qr-scanner'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Camera, AlertCircle, CheckCircle, XCircle } from 'lucide-react'

interface ScanResult {
    name: string
    location_name: string
    node_number: string
    latitude: string
    longitude: string
    sim_number: string
    thingspeak_channel_id: string
    thingspeak_read_key: string
    tds_field?: number
    temp_field?: number
    voltage_field?: number
    safe_tds_min?: number
    safe_tds_max?: number
}

interface QRCodeScannerProps {
    isOpen: boolean
    onClose: () => void
    onScan: (data: ScanResult) => void
}

export function QRCodeScanner({ isOpen, onClose, onScan }: QRCodeScannerProps) {
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt')

    useEffect(() => {
        if (isOpen) {
            // Check camera permission safely
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                navigator.mediaDevices.getUserMedia({ video: true })
                    .then(() => setCameraPermission('granted'))
                    .catch(() => setCameraPermission('denied'))
            } else {
                setCameraPermission('denied')
            }
        }
    }, [isOpen])

    const handleScan = (result: string) => {
        try {
            // Decode Base64
            const decoded = JSON.parse(atob(result))

            // Validate schema
            if (decoded.type !== 'evara_device' || !decoded.data) {
                throw new Error('Invalid QR code format')
            }

            // Extract device data
            const deviceData: ScanResult = {
                name: decoded.data.name || '',
                location_name: decoded.data.location || '',
                node_number: decoded.data.node || '',
                latitude: String(decoded.data.lat || ''),
                longitude: String(decoded.data.lng || ''),
                sim_number: decoded.data.sim || '',
                thingspeak_channel_id: String(decoded.data.channel_id || ''),
                thingspeak_read_key: decoded.data.api_key || '',
                tds_field: decoded.data.f_tds || 1,
                temp_field: decoded.data.f_temp || 2,
                voltage_field: decoded.data.f_volt || 3,
                safe_tds_min: decoded.data.s_min || 35,
                safe_tds_max: decoded.data.s_max || 175
            }

            setSuccess(true)
            setError(null)

            // Callback with parsed data after brief success animation
            setTimeout(() => {
                onScan(deviceData)
                onClose()
                setSuccess(false)
            }, 1000)

        } catch {
            setError('Invalid QR code. Please scan an EvaraTDS device QR.')
            setTimeout(() => setError(null), 3000)
        }
    }

    const handleClose = () => {
        setError(null)
        setSuccess(false)
        onClose()
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-lg bg-card border-border">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-foreground">
                        <Camera className="h-5 w-5 text-primary" />
                        Scan Device QR Code
                    </DialogTitle>
                </DialogHeader>

                <div className="relative aspect-square w-full bg-black rounded-xl overflow-hidden">
                    {cameraPermission === 'denied' ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-4">
                            <XCircle className="h-12 w-12 mb-4 text-red-400" />
                            <p className="text-center text-sm">
                                Camera permission denied. Please enable camera access in your browser settings.
                            </p>
                        </div>
                    ) : success ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-green-500/20">
                            <CheckCircle className="h-16 w-16 text-green-500 mb-4 animate-pulse" />
                            <p className="text-green-400 font-medium">QR Code Scanned Successfully!</p>
                            <p className="text-green-400/70 text-sm mt-1">Auto-filling form...</p>
                        </div>
                    ) : (
                        <>
                            <Scanner
                                onScan={(result) => {
                                    if (result && result[0]?.rawValue) {
                                        handleScan(result[0].rawValue)
                                    }
                                }}
                                onError={(err: unknown) => setError(err instanceof Error ? err.message : 'Camera error')}
                                styles={{
                                    container: { width: '100%', height: '100%' },
                                    video: { width: '100%', height: '100%', objectFit: 'cover' }
                                }}
                            />

                            {/* Scan overlay frame */}
                            <div className="absolute inset-0 pointer-events-none">
                                {/* Corner markers */}
                                <div className="absolute top-8 left-8 w-12 h-12 border-t-2 border-l-2 border-blue-400 rounded-tl-lg" />
                                <div className="absolute top-8 right-8 w-12 h-12 border-t-2 border-r-2 border-blue-400 rounded-tr-lg" />
                                <div className="absolute bottom-8 left-8 w-12 h-12 border-b-2 border-l-2 border-blue-400 rounded-bl-lg" />
                                <div className="absolute bottom-8 right-8 w-12 h-12 border-b-2 border-r-2 border-blue-400 rounded-br-lg" />

                                {/* Scan line animation */}
                                <div className="absolute top-1/2 left-8 right-8 h-0.5 bg-blue-400/50 animate-pulse" />
                            </div>
                        </>
                    )}
                </div>

                {/* Error message */}
                {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
                        <AlertCircle className="h-4 w-4 flex-shrink-0" />
                        <span className="text-sm">{error}</span>
                    </div>
                )}

                <p className="text-sm text-muted-foreground text-center">
                    Position the QR code within the frame. The form will auto-fill once scanned.
                </p>
            </DialogContent>
        </Dialog>
    )
}
