// ConsistencyStreak.tsx
import React from 'react';
import { FaFireAlt } from 'react-icons/fa';
import styled, { keyframes } from 'styled-components';

const pulse = keyframes`
  0%   { transform: scale(1);   opacity: 1; }
  50%  { transform: scale(1.2); opacity: 0.8; }
  100% { transform: scale(1);   opacity: 1; }
`;

// cast the icon to a generic ComponentType so styled() accepts it
const FireIcon = styled((FaFireAlt as unknown) as React.ComponentType<any>)`
  color: #ff5722;
  animation: ${pulse} 1.2s infinite;
  font-size: 2.5rem;
`;

const StreakContainer = styled.div`
  position: absolute;
  top: 1rem;
  right: 1rem;
  z-index: 9999;
  background: #fff5f0;
  border: 2px solid #ff5722;
  border-radius: 12px;
  padding: 0.8rem 1.2rem;
  display: flex;
  align-items: center;
  gap: 0.8rem;
  box-shadow: 0 4px 8px rgba(0,0,0,0.08);
`;

interface ConsistencyStreakProps {
  consistencyScore: number | null;
  streakDays: number;
}

export const ConsistencyStreak: React.FC<ConsistencyStreakProps> = ({
  consistencyScore,
  streakDays
}) => {
  const isActive = streakDays > 0;

  return (
    <StreakContainer>
      <FireIcon
        style={{ color: isActive ? '#ff5722' : '#ccc' }}
      />
      {consistencyScore !== null && isActive ? (
        <div>
          <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
            {streakDays} Day Streak
          </div>
          <div style={{ fontSize: '0.9rem', color: '#555' }}>
            Score: {consistencyScore.toFixed(1)}
          </div>
        </div>
      ) : (
        <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#999' }}>
          No activity yet
        </div>
      )}
    </StreakContainer>
  );
};