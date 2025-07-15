// components/Card.tsx
import React from 'react';

export const Card: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ children, style }) => (
  <div
    style={{
      background: '#fff',
      borderRadius: '16px',
      padding: '1.2em',
      boxShadow: '0 4px 10px rgba(0,0,0,0.08)',
      ...style,
    }}
  >
    {children}
  </div>
);