import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

/**
 * Saves a Blob so the user can actually find it.
 *
 * On the web, the classic Blob-URL + <a download> trick works fine — the
 * browser's own download manager handles it and the user knows where their
 * downloads folder is.
 *
 * Inside the Capacitor Android app, that same trick does nothing useful:
 * WebViews don't reliably honor the `download` attribute, and even when a
 * click "succeeds" there's no visible destination — the file effectively
 * vanishes, which is exactly what was reported ("the CSV isn't showing up
 * anywhere"). The fix is to write the file with the Filesystem plugin, then
 * hand it to the native share sheet so the user explicitly picks where it
 * goes (Downloads, Drive, email, Excel, etc.) instead of guessing.
 */
export async function saveOrShareBlob(blob: Blob, filename: string): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
        return
    }

    const base64Data = await blobToBase64(blob)

    const written = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
    })

    await Share.share({
        title: filename,
        url: written.uri,
    })
}

function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
            // reader.result is "data:<mime>;base64,<data>" — Filesystem wants
            // just the base64 payload, not the data: URL wrapper.
            const result = reader.result as string
            const base64 = result.split(',')[1] ?? ''
            resolve(base64)
        }
        reader.onerror = reject
        reader.readAsDataURL(blob)
    })
}
