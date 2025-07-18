import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

interface EngagementStreakChartProps {
  data: number[]; // Array of daily active minutes, length 7
}

export const EngagementStreakChart: React.FC<EngagementStreakChartProps> = ({ data }) => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date().getDay();
  const chartData = data.map((minutes, idx) => ({
    day: days[(today - 6 + idx + 7) % 7],
    minutes,
  }));

  return (
    <ResponsiveContainer width="100%" height={250}>
      <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2a9d8f" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#2a9d8f" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="day" />
        <YAxis label={{ value: 'Minutes', angle: -90, position: 'insideLeft' }} />
        <Tooltip formatter={(value) => `${value} min`} />
        <Area
          type="natural"
          dataKey="minutes"
          stroke="#2a9d8f"
          strokeWidth={3}
          fill="url(#areaGradient)"
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};