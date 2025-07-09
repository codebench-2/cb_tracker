import React from 'react';

export const ToolbarAPT = ({
  current,
  total
}: {
  current: number;
  total: number;
}) => {
  return (
    <div style={{ fontSize: '0.75em', whiteSpace: 'nowrap' }}>
      🪄 You’re doing <b>{current}</b> / {total} cells
    </div>
  );
};