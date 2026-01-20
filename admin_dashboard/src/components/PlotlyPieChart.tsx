import Plot from 'react-plotly.js'

interface PlotlyPieChartProps {
    connectivityData: Array<{ name: string; value: number; color: string }>
    tdsData: Array<{ name: string; value: number; color: string }>
}

/**
 * Professional Plotly Pie Chart Component
 * 
 * Features:
 * - Dual nested rings (inner: connectivity, outer: TDS)
 * - No percentage labels (clean design)
 * - Custom non-overlapping legend
 * - Interactive hover tooltips
 * - Professional styling with iOS theme
 */
export function PlotlyPieChart({ connectivityData, tdsData }: PlotlyPieChartProps) {
    // Inner ring - Connectivity Status (Online/Offline)
    const innerTrace: any = {
        values: connectivityData.map(d => d.value),
        labels: connectivityData.map(d => d.name),
        marker: {
            colors: connectivityData.map(d => d.color),
            line: {
                color: 'rgba(0,0,0,0.8)',
                width: 2
            }
        },
        domain: { x: [0.2, 0.8], y: [0.2, 0.8] },
        hole: 0.65,
        type: 'pie',
        textinfo: 'none',
        hovertemplate: '<b>%{label}</b><br>%{value} devices<extra></extra>',
        showlegend: false,
        sort: false
    }

    // Outer ring - TDS Category (Safe/Critical)
    const outerTrace: any = {
        values: tdsData.map(d => d.value),
        labels: tdsData.map(d => d.name),
        marker: {
            colors: tdsData.map(d => d.color),
            line: {
                color: 'rgba(0,0,0,0.8)',
                width: 2
            }
        },
        domain: { x: [0, 1], y: [0, 1] },
        hole: 0.82,
        type: 'pie',
        textinfo: 'none',
        hovertemplate: '<b>%{label}</b><br>%{value} devices<extra></extra>',
        showlegend: false,
        sort: false
    }

    return (
        <div className="relative w-full h-full">
            <Plot
                data={[innerTrace, outerTrace]}
                layout={{
                    paper_bgcolor: 'transparent',
                    plot_bgcolor: 'transparent',
                    margin: { t: 10, b: 60, l: 10, r: 10 },
                    height: 280,
                    showlegend: false,
                    font: {
                        color: '#ffffff',
                        size: 11,
                        family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                    },
                    hoverlabel: {
                        bgcolor: 'rgba(0,0,0,0.95)',
                        bordercolor: 'rgba(255,255,255,0.2)',
                        font: {
                            color: '#ffffff',
                            size: 12
                        }
                    }
                }}
                config={{
                    displayModeBar: false,
                    responsive: true
                }}
                style={{ width: '100%', height: '280px' }}
            />

            {/* Custom Legend - Grid Layout (No Overlap) */}
            <div className="absolute bottom-0 left-0 right-0 px-4 pb-2">
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                    {/* Inner Ring Legend */}
                    <div>
                        <div className="text-white/40 text-[9px] uppercase tracking-wider mb-1.5 font-medium">
                            Inner Ring
                        </div>
                        <div className="space-y-1">
                            {connectivityData.map((item, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <div
                                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: item.color }}
                                    />
                                    <span className="text-white/70 text-[10px] font-medium">
                                        {item.name}
                                    </span>
                                    <span className="text-white/40 text-[9px] ml-auto">
                                        {item.value}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Outer Ring Legend */}
                    <div>
                        <div className="text-white/40 text-[9px] uppercase tracking-wider mb-1.5 font-medium">
                            Outer Ring
                        </div>
                        <div className="space-y-1">
                            {tdsData.map((item, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <div
                                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: item.color }}
                                    />
                                    <span className="text-white/70 text-[10px] font-medium">
                                        {item.name}
                                    </span>
                                    <span className="text-white/40 text-[9px] ml-auto">
                                        {item.value}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
