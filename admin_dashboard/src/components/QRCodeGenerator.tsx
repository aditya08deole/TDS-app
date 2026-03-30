import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Download, Copy, Check, QrCode, UploadCloud } from 'lucide-react'
import { storage } from '../lib/firebase'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'

interface DeviceData {
    name: string
    location_name: string
    node_number: string
    latitude: string
    longitude: string
    sim_number: string
    thingspeak_channel_id: string
    thingspeak_read_key: string
    // Field mappings
    tds_field?: number
    temp_field?: number
    voltage_field?: number
    safe_tds_min: string
    safe_tds_max: string
}

interface QRCodeGeneratorProps {
    deviceData: DeviceData
    isOpen: boolean
    onClose: () => void
}

export function QRCodeGenerator({ deviceData, isOpen, onClose }: QRCodeGeneratorProps) {
    const [copied, setCopied] = useState(false)
    const [uploading, setUploading] = useState(false)

    // Generate QR payload with device data
    const generatePayload = () => {
        const payload = {
            v: 1,
            type: 'evara_device',
            ts: Math.floor(Date.now() / 1000),
            data: {
                name: deviceData.name,
                location: deviceData.location_name,
                node: deviceData.node_number,
                lat: parseFloat(deviceData.latitude) || 0,
                lng: parseFloat(deviceData.longitude) || 0,
                sim: deviceData.sim_number,
                channel_id: deviceData.thingspeak_channel_id,
                api_key: deviceData.thingspeak_read_key,
                // Field mappings
                f_tds: deviceData.tds_field || 1,
                f_temp: deviceData.temp_field || 2,
                f_volt: deviceData.voltage_field || 3,
                s_min: parseFloat(deviceData.safe_tds_min) || 35,
                s_max: parseFloat(deviceData.safe_tds_max) || 175
            }
        }
        return btoa(JSON.stringify(payload))
    }

    const qrData = generatePayload()

    // Check if form has enough data to generate QR
    const hasData = deviceData.name && deviceData.thingspeak_read_key

    const generateBlob = async (): Promise<Blob | null> => {
        const svg = document.getElementById('evara-qr-code')
        if (!svg) return null

        const svgData = new XMLSerializer().serializeToString(svg)
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        const img = new Image()

        return new Promise((resolve) => {
            img.onload = () => {
                canvas.width = 512
                canvas.height = 512
                // White background
                ctx!.fillStyle = '#FFFFFF'
                ctx?.fillRect(0, 0, 512, 512)
                ctx?.drawImage(img, 0, 0, 512, 512)

                canvas.toBlob((blob) => {
                    resolve(blob)
                }, 'image/png')
            }
            img.src = 'data:image/svg+xml;base64,' + btoa(svgData)
        })
    }

    const downloadQR = async () => {
        const blob = await generateBlob()
        if (!blob) return

        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.download = `evara-${deviceData.name.replace(/\s+/g, '-').toLowerCase()}-qr.png`
        a.href = url
        a.click()
        URL.revokeObjectURL(url)
    }

    const saveToFirebase = async () => {
        if (!deviceData.name) return
        setUploading(true)
        try {
            const blob = await generateBlob()
            if (!blob) throw new Error('Failed to generate image')

            const fileName = `qr_codes/${deviceData.name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.png`
            const storageRef = ref(storage, fileName)
            
            await uploadBytes(storageRef, blob)
            const publicUrl = await getDownloadURL(storageRef)

            alert(`✅ QR Code saved to cloud successfully!\nURL: ${publicUrl}`)
        } catch (error: any) {
            console.error('Upload failed:', error)
            alert(`Upload failed: ${error.message || 'Unknown error'}`)
        } finally {
            setUploading(false)
        }
    }

    const copyData = () => {
        navigator.clipboard.writeText(qrData)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md bg-card border-border">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-foreground">
                        <QrCode className="h-5 w-5 text-primary" />
                        Device QR Code
                    </DialogTitle>
                </DialogHeader>

                <div className="flex flex-col items-center gap-4 p-4">
                    {hasData ? (
                        <>
                            {/* QR Code Display */}
                            <div className="bg-white p-4 rounded-xl shadow-lg">
                                <QRCodeSVG
                                    id="evara-qr-code"
                                    value={qrData}
                                    size={256}
                                    level="M"
                                    includeMargin
                                    bgColor="#FFFFFF"
                                    fgColor="#000000"
                                />
                            </div>

                            {/* Device Info Summary */}
                            <div className="w-full space-y-2 text-sm">
                                {deviceData.name && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Device:</span>
                                        <span className="text-foreground font-medium">{deviceData.name}</span>
                                    </div>
                                )}
                                {deviceData.location_name && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Location:</span>
                                        <span className="text-foreground font-medium">{deviceData.location_name}</span>
                                    </div>
                                )}
                                {deviceData.node_number && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Node:</span>
                                        <span className="text-foreground font-medium">{deviceData.node_number}</span>
                                    </div>
                                )}
                            </div>

                            <p className="text-sm text-muted-foreground text-center">
                                Scan this QR code with the EvaraTDS mobile app to auto-fill device registration
                            </p>

                            {/* Action Buttons */}
                            <div className="flex flex-col gap-2 w-full">
                                <div className="flex gap-2 w-full">
                                    <Button
                                        variant="outline"
                                        className="flex-1"
                                        onClick={downloadQR}
                                    >
                                        <Download className="h-4 w-4 mr-2" />
                                        Download PNG
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="flex-1"
                                        onClick={saveToFirebase}
                                        disabled={uploading}
                                    >
                                        <UploadCloud className="h-4 w-4 mr-2" />
                                        {uploading ? 'Saving...' : 'Save to Cloud'}
                                    </Button>
                                </div>
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    onClick={copyData}
                                >
                                    {copied ? (
                                        <Check className="h-4 w-4 mr-2 text-green-500" />
                                    ) : (
                                        <Copy className="h-4 w-4 mr-2" />
                                    )}
                                    {copied ? 'Copied!' : 'Copy Data'}
                                </Button>
                            </div>
                        </>
                    ) : (
                        <div className="py-8 text-center">
                            <QrCode className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                            <p className="text-muted-foreground">
                                Fill in at least the device name to generate a QR code
                            </p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
