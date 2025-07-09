// src/widgets/AssignmentProgressTracker/widgetAPT.tsx
import React, { useEffect, useState } from 'react';

export const AssignmentProgressTracker = ({ totalTasks = 10 }: { totalTasks: number }) => {
  const [completedCount, setCompletedCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const stored = (window as any)._aptState || {};
      setCompletedCount((stored.completedCells?.size ?? 0));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const percent = Math.min(100, Math.round((completedCount / totalTasks) * 100));

  let message = '';
  if (percent === 0) {
    message = 'Just started — let’s go!';
  } else if (percent < 50) {
    message = `You’re doing ${completedCount}/${totalTasks} — keep it up 💪`;
  } else if (percent < 100) {
    message = `You’re doing ${completedCount}/${totalTasks} — almost done, fighting🔥`;
  } else {
    message = `🎉 Completed all ${totalTasks} tasks!`;
  }

  return (
    <div style={{ padding: '1em' }}>
      <h3>📚 Assignment Progress</h3>
      <div style={{ fontSize: '0.9em' }}>{message}</div>
      <div style={{ background: '#eee', borderRadius: '5px', overflow: 'hidden', marginTop: '8px' }}>
        <div
          style={{
            width: `${percent}%`,
            background: '#4caf50',
            color: 'white',
            padding: '2px 8px',
            fontSize: '0.75em'
          }}
        >
          {percent}%
        </div>
      </div>
    </div>
  );
};