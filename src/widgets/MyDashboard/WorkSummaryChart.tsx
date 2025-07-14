// src/widgets/MyDashboard/WorkSummaryChart.tsx
import React from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer
} from 'recharts';

interface FileSummary {
  name: string;
  minutes: number;
}

export const WorkSummaryChart = ({ data }: { data: FileSummary[] }) => {
  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#8dd1e1', '#a4de6c'];

  return (
    <div style={{ width: '100%' }}>
      {/* Time Distribution Pie Chart */}
      <div style={{ width: '100%', height: 300 }}>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="minutes"
                nameKey="name"
                outerRadius={100}
                fill="#8884d8"
                label
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <p style={{ textAlign: 'center', paddingTop: '120px' }}>No data yet...</p>
        )}
      </div>

      {/* Minutes Spent per File Bar Chart */}
      <div style={{ marginTop: '1em', width: '100%', height: 300 }}>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis
                label={{ value: 'Minutes', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip />
              <Legend />
              <Bar dataKey="minutes" fill="#82ca9d" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p style={{ textAlign: 'center', paddingTop: '120px' }}>No data yet...</p>
        )}
      </div>
    </div>
  );
};