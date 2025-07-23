import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

interface FileSummary {
  name: string;
  minutes: number;
}

interface WorkSummaryChartProps {
  data: FileSummary[];
  barColor: string;
}

export const WorkSummaryChart: React.FC<WorkSummaryChartProps> = ({ data, barColor }) => {
  return (
    <div style={{ width: '100%' }}>
      <div style={{ marginTop: '1em', width: '100%', height: 300 }}>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={false} />
              <YAxis label={{ value: 'Minutes', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Bar dataKey="minutes" radius={[10, 10, 0, 0]} fill={barColor} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p style={{ textAlign: 'center', paddingTop: '120px' }}>No data yet...</p>
        )}
      </div>
    </div>
  );
};