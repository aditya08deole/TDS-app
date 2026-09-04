import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { useTheme } from '../context/ThemeContext'

interface PieChartData {
    name: string
    value: number
    color?: string
    [key: string]: unknown
}

interface DualPieChartProps {
    connectivityData: PieChartData[]
    tdsData: PieChartData[]
}

/**
 * Dual/Nested Donut Chart — inner ring: TDS safety status, outer ring:
 * device connectivity. Ported from an echarts implementation (see git
 * history) to Recharts so the app only ships one charting library; the
 * same theme-aware color palette and ring proportions are preserved.
 */
const COLOR_PALETTE: Record<string, string | ((isDark: boolean) => string)> = {
    'Online': '#818cf8',
    'Offline': (isDark: boolean) => (isDark ? '#475569' : '#94a3b8'),
    'Safe TDS': '#00df81',
    'Critical TDS': '#ff0055',
}

function colorFor(name: string, isDark: boolean, fallback?: string): string {
    const entry = COLOR_PALETTE[name];
    if (typeof entry === 'function') return entry(isDark);
    if (typeof entry === 'string') return entry;
    return fallback || (isDark ? '#94a3b8' : '#64748b');
}

interface CustomTooltipProps {
    active?: boolean;
    payload?: Array<{ name: string; value: number; payload: PieChartData }>;
    allData: PieChartData[];
    isDark: boolean;
}

const CustomTooltip = ({ active, payload, allData, isDark }: CustomTooltipProps) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0];
    if (!data) return null;
    const total = allData.reduce((sum, item) => sum + item.value, 0);
    const percentage = total > 0 ? ((data.value / total) * 100).toFixed(1) : '0.0';
    const color = colorFor(data.name, isDark, data.payload.color);

    return (
        <div className="px-3 py-2 rounded-xl border border-border shadow-xl backdrop-blur-xl bg-popover">
            <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-popover-foreground text-sm font-semibold">{data.name}</span>
            </div>
            <p className="text-muted-foreground text-xs mt-1">
                {data.value} device{data.value === 1 ? '' : 's'} ({percentage}%)
            </p>
        </div>
    );
};

export function DualPieChart({ connectivityData, tdsData }: DualPieChartProps) {
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === 'dark';
    const allData = [...tdsData, ...connectivityData];

    return (
        <div className="relative h-full min-h-[420px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={420}>
                <PieChart>
                    {/* Inner Ring — TDS Status */}
                    <Pie
                        data={tdsData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="45%"
                        innerRadius="35%"
                        outerRadius="52%"
                        paddingAngle={2}
                        cornerRadius={6}
                        strokeWidth={2}
                        stroke={isDark ? '#000' : '#fff'}
                        isAnimationActive
                        animationDuration={800}
                    >
                        {tdsData.map((entry, index) => (
                            <Cell key={`tds-${index}`} fill={colorFor(entry.name, isDark, entry.color)} />
                        ))}
                    </Pie>

                    {/* Outer Ring — Connectivity Status */}
                    <Pie
                        data={connectivityData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="45%"
                        innerRadius="60%"
                        outerRadius="78%"
                        paddingAngle={2}
                        cornerRadius={6}
                        strokeWidth={2}
                        stroke={isDark ? '#000' : '#fff'}
                        isAnimationActive
                        animationDuration={800}
                        animationBegin={200}
                    >
                        {connectivityData.map((entry, index) => (
                            <Cell key={`connectivity-${index}`} fill={colorFor(entry.name, isDark, entry.color)} />
                        ))}
                    </Pie>

                    <Tooltip content={<CustomTooltip allData={allData} isDark={isDark} />} />
                </PieChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div className="absolute bottom-0 left-0 right-0 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs">
                {allData.map((item, index) => (
                    <div key={`legend-${index}`} className="flex items-center gap-1.5">
                        <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: colorFor(item.name, isDark, item.color) }}
                        />
                        <span className="text-muted-foreground text-[11px]">{item.name}</span>
                        <span className="text-foreground text-[11px] font-semibold">({item.value})</span>
                    </div>
                ))}
            </div>
        </div>
    )
}
