import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { useTheme } from '../context/ThemeContext'

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
    const { resolvedTheme } = useTheme()
    const isDark = resolvedTheme === 'dark'

    // High-Saturation Neon Color Palette
    const colorPalette = {
        online: '#00f2ff',
        offline: isDark ? '#475569' : '#94a3b8',
        safeTDS: '#00df81',
        criticalTDS: '#ff0055',
    }

    const option: EChartsOption = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'item',
            formatter: (params: any) => {
                const { name, value, percent } = params
                const bgColor = isDark ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.7)'
                const textColor = isDark ? '#fff' : '#0f172a'
                const mutedColor = isDark ? '#94a3b8' : '#64748b'
                const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'

                return `<div style="padding: 10px 16px; border-radius: 12px; background: ${bgColor}; backdrop-filter: blur(16px); border: 1px solid ${borderColor}; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
                    <div style="font-weight: 700; color: ${textColor}; margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">
                        <span style="width: 8px; height: 8px; border-radius: 50%; background: ${params.color};"></span>
                        ${name}
                    </div>
                    <div style="font-size: 13px; color: ${mutedColor};">
                        Devices: <strong style="color: ${textColor};">${value}</strong>
                        <span style="margin-left: 8px;">(${percent}%)</span>
                    </div>
                </div>`
            },
            backgroundColor: 'transparent',
            borderColor: 'transparent',
            borderWidth: 0,
            textStyle: { color: isDark ? '#fff' : '#000' },
            padding: 0,
            extraCssText: 'box-shadow: none;'
        },
        legend: {
            orient: 'horizontal',
            bottom: '25',
            left: 'center',
            itemGap: 15,
            itemWidth: 10,
            itemHeight: 10,
            icon: 'circle',
            formatter: (name: string) => {
                const connectivityItem = connectivityData.find(d => d.name === name)
                const tdsItem = tdsData.find(d => d.name === name)
                const value = connectivityItem?.value || tdsItem?.value || 0
                return `{n|${name}} {v|(${value})}`
            },
            textStyle: {
                rich: {
                    n: {
                        color: isDark ? '#94a3b8' : '#64748b',
                        fontSize: 11,
                        fontWeight: 500
                    },
                    v: {
                        color: isDark ? '#f8fafc' : '#0f172a',
                        fontSize: 11,
                        fontWeight: 700
                    }
                }
            }
        },
        series: [
            // Inner ring - TDS Status
            {
                name: 'TDS Status',
                type: 'pie',
                radius: ['35%', '52%'],
                center: ['50%', '45%'],
                avoidLabelOverlap: true,
                itemStyle: {
                    borderRadius: 10,
                    borderColor: isDark ? '#000' : '#fff',
                    borderWidth: 2,
                },
                label: { show: false },
                emphasis: {
                    itemStyle: {
                        shadowBlur: 20,
                        shadowColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                    },
                    scale: true,
                    scaleSize: 5
                },
                data: tdsData.map(item => {
                    const isSafe = item.name === 'Safe TDS'
                    const baseColor = isSafe ? colorPalette.safeTDS : colorPalette.criticalTDS
                    return {
                        value: item.value,
                        name: item.name,
                        itemStyle: {
                            color: baseColor
                        }
                    }
                }),
                animationType: 'expansion',
                animationDuration: 1200,
                animationEasing: 'cubicOut'
            },
            // Outer ring - Connectivity Status
            {
                name: 'Connectivity',
                type: 'pie',
                radius: ['60%', '78%'],
                center: ['50%', '45%'],
                avoidLabelOverlap: true,
                itemStyle: {
                    borderRadius: 10,
                    borderColor: isDark ? '#000' : '#fff',
                    borderWidth: 2,
                },
                label: { show: false },
                emphasis: {
                    itemStyle: {
                        shadowBlur: 20,
                        shadowColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                    },
                    scale: true,
                    scaleSize: 5
                },
                data: connectivityData.map(item => {
                    const isOnline = item.name === 'Online'
                    const baseColor = isOnline ? colorPalette.online : colorPalette.offline
                    return {
                        value: item.value,
                        name: item.name,
                        itemStyle: {
                            color: baseColor
                        }
                    }
                }),
                animationType: 'expansion',
                animationDuration: 1200,
                animationEasing: 'cubicOut',
                animationDelay: 400
            }
        ]
    }

    return (
        <ReactECharts
            option={option}
            style={{ height: '420px', width: '100%' }}
            opts={{ renderer: 'canvas' }}
            notMerge={true}
            lazyUpdate={true}
        />
    )
}
