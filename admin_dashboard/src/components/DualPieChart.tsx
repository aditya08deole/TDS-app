import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

interface DualPieChartProps {
    connectivityData: Array<{ name: string; value: number; fill: string }>
    tdsData: Array<{ name: string; value: number; fill: string }>
}

/**
 * Dual Pie Chart Component
 * 
 * Features:
 * - Inner ring: Online/Offline connectivity status
 * - Outer ring: Safe/Critical TDS categorization
 * - Custom tooltips with device counts
 * - Percentage labels
 * - Responsive sizing
 */
export function DualPieChart({ connectivityData, tdsData }: DualPieChartProps) {
    // Custom tooltip
    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0]
            const total = connectivityData.reduce((sum, item) => sum + item.value, 0) +
                tdsData.reduce((sum, item) => sum + item.value, 0)
            const percentage = ((data.value / total) * 100).toFixed(1)

            return (
                <div className="px-3 py-2 rounded-lg border border-white/10 shadow-xl backdrop-blur-xl bg-black/90">
                    <div className="flex items-center gap-2">
                        <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: data.payload.fill }}
                        />
                        <span className="text-white text-sm font-medium">{data.name}</span>
                    </div>
                    <p className="text-white/80 text-xs mt-1">
                        {data.value} devices ({percentage}%)
                    </p>
                </div>
            )
        }
        return null
    }

    // Custom label for percentages
    const renderLabel = (entry: any) => {
        const total = entry.payload.payload.reduce((sum: number, item: any) => sum + item.value, 0)
        const percentage = parseFloat(((entry.value / total) * 100).toFixed(0))
        return percentage > 5 ? `${percentage}%` : '' // Only show if > 5%
    }

    return (
        <div className="relative h-full">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    {/* Inner Ring - Connectivity Status */}
                    <Pie
                        data={connectivityData}
                        dataKey="value"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={2}
                        strokeWidth={0}
                        label={renderLabel}
                        labelLine={false}
                    >
                        {connectivityData.map((entry, index) => (
                            <Cell key={`connectivity-${index}`} fill={entry.fill} />
                        ))}
                    </Pie>

                    {/* Outer Ring - TDS Category */}
                    <Pie
                        data={tdsData}
                        dataKey="value"
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={100}
                        paddingAngle={2}
                        strokeWidth={0}
                        label={renderLabel}
                        labelLine={false}
                    >
                        {tdsData.map((entry, index) => (
                            <Cell key={`tds-${index}`} fill={entry.fill} />
                        ))}
                    </Pie>

                    <Tooltip content={<CustomTooltip />} />
                </PieChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div className="absolute bottom-0 left-0 right-0 flex flex-col gap-2 text-xs">
                {/* Inner Ring Legend */}
                <div className="flex items-center justify-center gap-3">
                    <span className="text-white/40 text-[10px]">Inner:</span>
                    {connectivityData.map((item, index) => (
                        <div key={`legend-conn-${index}`} className="flex items-center gap-1.5">
                            <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: item.fill }}
                            />
                            <span className="text-white/60 text-[10px]">{item.name}</span>
                        </div>
                    ))}
                </div>

                {/* Outer Ring Legend */}
                <div className="flex items-center justify-center gap-3">
                    <span className="text-white/40 text-[10px]">Outer:</span>
                    {tdsData.map((item, index) => (
                        <div key={`legend-tds-${index}`} className="flex items-center gap-1.5">
                            <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: item.fill }}
                            />
                            <span className="text-white/60 text-[10px]">{item.name}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
