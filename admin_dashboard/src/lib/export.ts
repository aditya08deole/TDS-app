/**
 * Export Utilities for EvaraTDS Dashboard
 * Provides functions to export data as CSV, Excel, and PDF
 */

// CSV Export
export function exportToCSV<T extends Record<string, unknown>>(
    data: T[],
    filename: string,
    columns?: { key: keyof T; label: string }[]
): void {
    if (data.length === 0) {
        console.warn('No data to export')
        return
    }

    // Determine columns
    const cols = columns ||
        Object.keys(data[0]).map(key => ({ key: key as keyof T, label: key }))

    // Create header row
    const headers = cols.map(col => col.label)

    // Create data rows
    const rows = data.map(item =>
        cols.map(col => {
            const value = item[col.key]
            // Handle special cases
            if (value === null || value === undefined) return ''
            if (typeof value === 'object') return JSON.stringify(value)
            if (typeof value === 'string' && value.includes(',')) return `"${value}"`
            return String(value)
        })
    )

    // Combine into CSV content
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n')

    // Download
    downloadFile(csvContent, `${filename}.csv`, 'text/csv;charset=utf-8;')
}

// Excel Export (using simple CSV format that Excel can open)
export function exportToExcel<T extends Record<string, unknown>>(
    data: T[],
    filename: string,
    sheetName: string = 'Sheet1',
    columns?: { key: keyof T; label: string }[]
): void {
    if (data.length === 0) {
        console.warn('No data to export')
        return
    }

    // Determine columns
    const cols = columns ||
        Object.keys(data[0]).map(key => ({ key: key as keyof T, label: key }))

    // Create XML for Excel format
    const xmlHeader = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
    xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="${sheetName}">
<Table>`

    // Header row
    const headerRow = `<Row>${cols.map(col => `<Cell><Data ss:Type="String">${col.label}</Data></Cell>`).join('')}</Row>`

    // Data rows
    const dataRows = data.map(item => {
        const cells = cols.map(col => {
            const value = item[col.key]
            const type = typeof value === 'number' ? 'Number' : 'String'
            const cellValue = value === null || value === undefined ? '' : String(value)
            return `<Cell><Data ss:Type="${type}">${escapeXml(cellValue)}</Data></Cell>`
        }).join('')
        return `<Row>${cells}</Row>`
    }).join('\n')

    const xmlFooter = `</Table>
</Worksheet>
</Workbook>`

    const xmlContent = xmlHeader + headerRow + dataRows + xmlFooter

    downloadFile(xmlContent, `${filename}.xls`, 'application/vnd.ms-excel')
}

// PDF Report Generation (Simple HTML-based approach)
export function generatePDFReport(
    title: string,
    data: { label: string; value: string | number }[],
    tableData?: { headers: string[]; rows: (string | number)[][] },
    metadata?: { generatedAt?: Date; generatedBy?: string }
): void {
    const now = metadata?.generatedAt || new Date()

    let htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 40px;
            color: #1e293b;
        }
        .header { 
            border-bottom: 2px solid #0891b2;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .header h1 { 
            color: #0891b2;
            font-size: 24px;
            margin-bottom: 8px;
        }
        .header .meta { 
            color: #64748b;
            font-size: 12px;
        }
        .summary { 
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            margin-bottom: 30px;
        }
        .summary-item {
            background: #f1f5f9;
            padding: 16px;
            border-radius: 8px;
        }
        .summary-item .label { 
            color: #64748b;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .summary-item .value { 
            color: #0f172a;
            font-size: 24px;
            font-weight: bold;
            margin-top: 4px;
        }
        table { 
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        th, td { 
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e2e8f0;
        }
        th { 
            background: #f1f5f9;
            font-weight: 600;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #64748b;
        }
        td { 
            font-size: 14px;
        }
        tr:hover { background: #f8fafc; }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            color: #94a3b8;
            font-size: 11px;
            text-align: center;
        }
        @media print {
            body { padding: 20px; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${title}</h1>
        <div class="meta">
            Generated: ${now.toLocaleString()}
            ${metadata?.generatedBy ? ` | By: ${metadata.generatedBy}` : ''}
        </div>
    </div>
    
    <div class="summary">
        ${data.map(item => `
            <div class="summary-item">
                <div class="label">${item.label}</div>
                <div class="value">${item.value}</div>
            </div>
        `).join('')}
    </div>`

    if (tableData) {
        htmlContent += `
    <table>
        <thead>
            <tr>
                ${tableData.headers.map(h => `<th>${h}</th>`).join('')}
            </tr>
        </thead>
        <tbody>
            ${tableData.rows.map(row => `
                <tr>
                    ${row.map(cell => `<td>${cell}</td>`).join('')}
                </tr>
            `).join('')}
        </tbody>
    </table>`
    }

    htmlContent += `
    <div class="footer">
        EvaraTDS Dashboard | © ${now.getFullYear()} All Rights Reserved
    </div>
    
    <script>
        // Auto-print when opened
        window.onload = function() { window.print(); }
    </script>
</body>
</html>`

    // Open in new window for printing
    const printWindow = window.open('', '_blank')
    if (printWindow) {
        printWindow.document.write(htmlContent)
        printWindow.document.close()
    }
}

// Helper function to download file
function downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.style.display = 'none'

    document.body.appendChild(link)
    link.click()

    // Cleanup
    setTimeout(() => {
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
    }, 100)
}

// Helper function to escape XML special characters
function escapeXml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
}

// Utility: Format date for filename
export function formatDateForFilename(date: Date = new Date()): string {
    return date.toISOString().split('T')[0]
}

// Pre-built export functions for common use cases
export const exportAlerts = (alerts: unknown[]) => {
    exportToCSV(alerts as Record<string, unknown>[], `alerts_${formatDateForFilename()}`, [
        { key: 'id', label: 'Alert ID' },
        { key: 'device_id', label: 'Device ID' },
        { key: 'type', label: 'Type' },
        { key: 'severity', label: 'Severity' },
        { key: 'message', label: 'Message' },
        { key: 'created_at', label: 'Created At' },
        { key: 'resolved_at', label: 'Resolved At' }
    ])
}

export const exportDevices = (devices: unknown[]) => {
    exportToCSV(devices as Record<string, unknown>[], `devices_${formatDateForFilename()}`, [
        { key: 'id', label: 'Device ID' },
        { key: 'name', label: 'Name' },
        { key: 'status', label: 'Status' },
        { key: 'latitude', label: 'Latitude' },
        { key: 'longitude', label: 'Longitude' },
        { key: 'battery_level', label: 'Battery %' },
        { key: 'last_seen', label: 'Last Seen' }
    ])
}

export const exportSensorData = (data: unknown[]) => {
    exportToCSV(data as Record<string, unknown>[], `sensor_data_${formatDateForFilename()}`, [
        { key: 'device_id', label: 'Device ID' },
        { key: 'tds', label: 'TDS Value' },
        { key: 'temperature', label: 'Temperature' },
        { key: 'recorded_at', label: 'Recorded At' }
    ])
}
