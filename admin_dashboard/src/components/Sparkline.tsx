import { ResponsiveContainer, LineChart, Line } from 'recharts';

interface SparklineProps {
    data: number[];
    color?: string;
    height?: number;
}

export function Sparkline({ data, color = '#30d158', height = 40 }: SparklineProps) {
    const chartData = data.map((val, i) => ({ i, val }));

    return (
        <div style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                    <Line
                        type="monotone"
                        dataKey="val"
                        stroke={color}
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
