import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts';

interface EngagementStreakChartProps {
  data: number[]; // Array of daily active minutes, length 7
}

export const EngagementStreakChart: React.FC<EngagementStreakChartProps> = ({ data }) => {
  // Prepare data with day labels
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date().getDay();
  const chartData = data.map((minutes, idx) => ({
    day: days[(today - 6 + idx + 7) % 7], // last 7 days ending today
    minutes
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="day" />
        <YAxis label={{ value: 'Minutes', angle: -90, position: 'insideLeft' }} />
        <Tooltip formatter={(value) => `${value} min`} />
        <Bar dataKey="minutes" fill="#4caf50" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};