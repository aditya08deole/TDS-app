import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'

interface PieChartData {
    name: string
    value: number
    color: string
}

interface EChartsNestedPieChartProps {
    connectivityData: PieChartData[]
    tdsData: PieChartData[]
}

/**
 * Enhanced Nested/Concentric Donut Chart
 * - Inner ring: TDS Status
 * - Outer ring: Connectivity Status
 * - No percentages in labels
 * - Shows device count on hover
 * - Beautiful animations and colors
 */
export function EChartsNestedPieChart({ connectivityData, tdsData }: EChartsNestedPieChartProps) {
    // Enhanced color palette
    const colorPalette = {
        online: '#00d4aa', // Vibrant teal
        offline: '#64748b', // Slate gray
        safeTDS: '#22c55e', // Vibrant green
        criticalTDS: '#ef4444' // Vibrant red
    }

    const option: EChartsOption = {
        backgroundColor: 'transparent',
        title: {
            text: 'Device Overview',
            left: 'center',
            top: '5%',
            textStyle: {
                color: '#fff',
                fontSize: 15,
                fontWeight: 700,
                textShadowColor: 'rgba(0, 0, 0, 0.5)',
                textShadowBlur: 4
            }
        },
        tooltip: {
            trigger: 'item',
            formatter: (params: any) => {
                const { name, value, percent } = params
                return `<div style="padding: 4px 8px;">
                    <div style="font-weight: 600; margin-bottom: 4px;">${name}</div>
                    <div style="font-size: 13px;">
                        <span style="color: #10b981;">Devices:</span> <strong>${value}</strong>
                        <span style="color: #64748b; margin-left: 8px;">(${percent}%)</span>
                    </div>
                </div>`
            },
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            borderColor: 'rgba(255, 255, 255, 0.15)',
            borderWidth: 1,
            textStyle: {
                color: '#fff',
                fontSize: 12
            },
            padding: [10, 14],
            extraCssText: 'backdrop-filter: blur(12px); border-radius: 10px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);'
        },
        legend: {
            orient: 'vertical',
            right: '8%',
            top: 'center',
            itemGap: 14,
            itemWidth: 16,
            itemHeight: 16,
            formatter: (name: string) => {
                const connectivityItem = connectivityData.find(d => d.name === name)
                const tdsItem = tdsData.find(d => d.name === name)
                const value = connectivityItem?.value || tdsItem?.value || 0
                return `{name|${name}}\n{value|${value} devices}`
            },
            textStyle: {
                rich: {
                    name: {
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#fff',
                        lineHeight: 18
                    },
                    value: {
                        fontSize: 11,
                        color: '#94a3b8',
                        lineHeight: 16
                    }
                }
            }
        },
        series: [
            // Inner ring - TDS Status
            {
                name: 'TDS Status',
                type: 'pie',
                radius: ['35%', '55%'],
                center: ['38%', '55%'],
                avoidLabelOverlap: true,
                itemStyle: {
                    borderRadius: 10,
                    borderColor: 'rgba(0, 0, 0, 0.6)',
                    borderWidth: 3,
                    shadowBlur: 20,
                    shadowColor: 'rgba(0, 0, 0, 0.6)'
                },
                label: {
                    show: false // Hide labels, show only on hover
                },
                emphasis: {
                    label: {
                        show: true,
                        fontSize: 15,
                        fontWeight: 'bold',
                        formatter: '{b}\n{c}',
                        color: '#fff',
                        textShadowColor: 'rgba(0, 0, 0, 0.8)',
                        textShadowBlur: 4
                    },
                    itemStyle: {
                        shadowBlur: 30,
                        shadowOffsetX: 0,
                        shadowColor: 'rgba(0, 0, 0, 0.9)'
                    },
                    scale: true,
                    scaleSize: 12
                },
                data: tdsData.map(item => {
                    const baseColor = item.name === 'Safe TDS' ? colorPalette.safeTDS : colorPalette.criticalTDS
                    return {
                        value: item.value,
                        name: item.name,
                        itemStyle: {
                            color: {
                                type: 'radial',
                                x: 0.5,
                                y: 0.5,
                                r: 0.5,
                                colorStops: [
                                    { offset: 0, color: adjustBrightness(baseColor, 40) },
                                    { offset: 0.6, color: baseColor },
                                    { offset: 1, color: adjustBrightness(baseColor, -30) }
                                ]
                            }
                        }
                    }
                }),
                animationType: 'expansion',
                animationEasing: 'cubicOut',
                animationDuration: 1200,
                animationDelay: (idx: number) => idx * 150
            },
            // Outer ring - Connectivity Status
            {
                name: 'Connectivity',
                type: 'pie',
                radius: ['60%', '80%'],
                center: ['38%', '55%'],
                avoidLabelOverlap: true,
                itemStyle: {
                    borderRadius: 10,
                    borderColor: 'rgba(0, 0, 0, 0.6)',
                    borderWidth: 3,
                    shadowBlur: 20,
                    shadowColor: 'rgba(0, 0, 0, 0.6)'
                },
                label: {
                    show: false // Hide labels, show only on hover
                },
                emphasis: {
                    label: {
                        show: true,
                        fontSize: 15,
                        fontWeight: 'bold',
                        formatter: '{b}\n{c}',
                        color: '#fff',
                        textShadowColor: 'rgba(0, 0, 0, 0.8)',
                        textShadowBlur: 4
                    },
                    itemStyle: {
                        shadowBlur: 30,
                        shadowOffsetX: 0,
                        shadowColor: 'rgba(0, 0, 0, 0.9)'
                    },
                    scale: true,
                    scaleSize: 12
                },
                data: connectivityData.map(item => {
                    const baseColor = item.name === 'Online' ? colorPalette.online : colorPalette.offline
                    return {
                        value: item.value,
                        name: item.name,
                        itemStyle: {
                            color: {
                                type: 'radial',
                                x: 0.5,
                                y: 0.5,
                                r: 0.5,
                                colorStops: [
                                    { offset: 0, color: adjustBrightness(baseColor, 40) },
                                    { offset: 0.6, color: baseColor },
                                    { offset: 1, color: adjustBrightness(baseColor, -30) }
                                ]
                            }
                        }
                    }
                }),
                animationType: 'expansion',
                animationEasing: 'cubicOut',
                animationDuration: 1200,
                animationDelay: (idx: number) => idx * 150 + 300
            }
        ]
    }

    return (
        <ReactECharts
            option={option}
            style={{ height: '300px', width: '100%' }}
            opts={{ renderer: 'canvas' }}
            notMerge={true}
            lazyUpdate={true}
        />
    )
}

/**
 * Adjust color brightness
 */
function adjustBrightness(color: string, amount: number): string {
    // Convert hex to RGB
    const hex = color.replace('#', '')
    const r = Math.max(0, Math.min(255, parseInt(hex.substring(0, 2), 16) + amount))
    const g = Math.max(0, Math.min(255, parseInt(hex.substring(2, 4), 16) + amount))
    const b = Math.max(0, Math.min(255, parseInt(hex.substring(4, 6), 16) + amount))

    // Convert back to hex
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}
