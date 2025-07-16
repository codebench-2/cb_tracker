// src/widgets/MyDashboard/WorkSummaryChart.tsx
import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

interface FileSummary {
  name: string;
  minutes: number;
}

export const WorkSummaryChart = ({ data }: { data: FileSummary[] }) => {
  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#8dd1e1', '#a4de6c'];

  // Name-color mapping
  const nameColorMap: { [name: string]: string } = {};
  data.forEach((entry, index) => {
    nameColorMap[entry.name] = COLORS[index % COLORS.length];
  });

  return (
    <div style={{ width: '100%' }}>
      {/* Time Distribution Pie Chart */}
      {/* <div style={{ width: '100%', height: 300 }}>
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
                  <Cell key={`cell-${index}`} fill={nameColorMap[entry.name]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <p style={{ textAlign: 'center', paddingTop: '120px' }}>No data yet...</p>
        )}
      </div> */}

      {/* Minutes Spent per File Bar Chart */}
      <div style={{ marginTop: '1em', width: '100%', height: 300 }}>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={false} />
              <YAxis
                label={{ value: 'Minutes', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip />
              <Bar dataKey="minutes">
                {data.map((entry, index) => (
                  <Cell key={`bar-${index}`} fill={nameColorMap[entry.name]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p style={{ textAlign: 'center', paddingTop: '120px' }}>No data yet...</p>
        )}
      </div>
    </div>
  );
};