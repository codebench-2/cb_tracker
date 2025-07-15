import React, { useEffect, useState } from 'react';
import { fetchLogsFromCodeBench } from '../../api/codebench';
import { WorkSummaryChart } from './WorkSummaryChart';
import { EngagementStreakChart } from './EngagementStreakChart';
import { ConsistencyScoreChart } from './ConsistencyScoreChart';
import { Card } from './components/Card';
import { FaFireAlt } from 'react-icons/fa';
import styled, { keyframes } from 'styled-components';

const pulse = keyframes`
  0%   { transform: scale(1);   opacity: 1; }
  50%  { transform: scale(1.2); opacity: 0.8; }
  100% { transform: scale(1);   opacity: 1; }
`;

const FireIcon = styled((FaFireAlt as unknown) as React.ComponentType<any>)`
  color: #e76f51;
  animation: ${pulse} 1.2s infinite;
  font-size: 1.8em;
`;

export const MyDashboard = () => {
  const [labTime, setLabTime] = useState(0);
  const [summaries, setSummaries] = useState<{ notebookId: string, duration: number }[]>([]);
  const [dailyActiveMinutes, setDailyActiveMinutes] = useState<number[]>([]);
  const [consistencyScore, setConsistencyScore] = useState<number | null>(null);
  const [consistencyStreak, setConsistencyStreak] = useState<{ day: string; value: number }[]>([]);
  const [activebookChartData, setActivebookChartData] = useState<{ name: string; minutes: number }[]>([]);
  const [regularChartData, setRegularChartData] = useState<{ name: string; minutes: number }[]>([]);
  const [targetMinutes, setTargetMinutes] = useState(30);
  const [goalStatus, setGoalStatus] = useState('');
  const [bonusPoints, setBonusPoints] = useState(0);
  const [goalAwarded, setGoalAwarded] = useState(false);
  const todayKey = `goal-${new Date().toLocaleDateString()}`;
  const [isGoalLocked, setIsGoalLocked] = useState(() => !!localStorage.getItem(todayKey));
  const todayMinutes = labTime / 60;
  const [longTermConsistency, setLongTermConsistency] = useState<{ day: string; value: number }[]>([]);
  const [lastNotebookPath, setLastNotebookPath] = useState<string | null>(null);
  const [lastNotebookTitle, setLastNotebookTitle] = useState<string | null>(null);

  // For last notebook
  useEffect(() => {
    async function loadLogs() {
      const allLogs = await fetchLogsFromCodeBench();
      const notebookLogs = allLogs
        .filter((log: any) => log.log_info.type === 'notebook')
        .sort((a: any, b: any) => new Date(b.time_stamp).getTime() - new Date(a.time_stamp).getTime());

      if (notebookLogs.length > 0) {
        const recent = notebookLogs[0];
        setLastNotebookPath(`/lab/tree/${recent.notebook_id}`);
        const parts = recent.notebook_id.split('/');
        setLastNotebookTitle(parts[parts.length - 1]);
      }
    }
    loadLogs();
  }, []);

  // For Goal Planner
  useEffect(() => {
    if (todayMinutes >= targetMinutes && !goalAwarded) {
      setGoalStatus('🎉 Goal achieved! Bonus +1');
      setBonusPoints(prev => prev + 1);
      setGoalAwarded(true);
    } else if (todayMinutes < targetMinutes) {
      setGoalStatus('❌ Below goal');
      setGoalAwarded(false);
    }
  }, [todayMinutes, targetMinutes, goalAwarded]);

  // For streaks & engagement chart
  useEffect(() => {
    async function loadData() {
      console.log("Fetching logs from CodeBench server...");
      const logs = await fetchLogsFromCodeBench();
      console.log("Fetched logs:", logs);
  
      // Calculate active minutes per day
      const today = new Date();
      const dailyMap: { [date: string]: number } = {};
  
      logs.forEach((log: any) => {
        const { log_info, time_stamp } = log;
        if (['window', 'notebook', 'cell'].includes(log_info.type)) {
          const date = new Date(time_stamp).toLocaleDateString();
          dailyMap[date] = (dailyMap[date] || 0) + (log_info.duration || 0);
        }
      });

      // Get last 7 days
      const last7Days: number[] = [];
      const last7DaysData: { day: string; value: number }[] = [];

      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const key = d.toLocaleDateString();
        const minutes = Math.round((dailyMap[key] || 0) / 60);
        last7Days.push(minutes);
        last7DaysData.push({ day: key.slice(0, 5), value: minutes });
      }
      setDailyActiveMinutes(last7Days);

      // Get last 150 days
      const last150Days: number[] = [];
      const last150DaysData: { day: string; value: number }[] = [];

      for (let i = 149; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const key = d.toLocaleDateString();
        const minutes = Math.round((dailyMap[key] || 0) / 60);
        last150Days.push(minutes);
        last150DaysData.push({ day: key.slice(0, 5), value: minutes });
      }

      // Consistency score for 150 days
      const semesterDays = 150;
      const expectedEffort = 60;
      const maxBonus = 10;
      const epsilon = 0.01;
      const rMax = 1;
      const alpha = 1 - Math.pow(epsilon, 1 / semesterDays);

      const smoothedScores: { day: string; value: number }[] = [];
      let prevScore = 0;

      for (let i = 0; i < last150DaysData.length; i++) {
        const minutes = last150DaysData[i].value;
        const r = Math.max(0, Math.min(minutes / expectedEffort, rMax));
        let score = (1 - alpha) * prevScore + alpha * r * maxBonus;
        score = Math.max(0, Math.min(score, maxBonus)); // clamp
        smoothedScores.push({
          day: last150DaysData[i].day,
          value: parseFloat(score.toFixed(2)),
        });
        prevScore = score;
      }

      setLongTermConsistency(smoothedScores); // For chart
      setConsistencyScore(smoothedScores[smoothedScores.length - 1].value); // Current value

      // Consecutive streak (only use last 7 days)
      let historicalStreak = 0;
      for (let i = last7Days.length - 2; i >= 0; i--) {
        if (last7Days[i] >= 10) {
          historicalStreak += 1;
        } else {
          break;
        }
      }
      const todayMinutes = last7Days[last7Days.length - 1];
      const todayContribution = todayMinutes >= 10 ? 1 : 0;
      const streak = historicalStreak + todayContribution;
      setConsistencyStreak([{ day: 'Current', value: streak }]);

      // Set engagement chart data (7 days)
      setDailyActiveMinutes(last7Days); 
    }

    loadData();
  }, []);

  // For summary of work today
  useEffect(() => {
    async function loadData() {
      const logs = await fetchLogsFromCodeBench();

      console.log("Fetching logs from CodeBench server...");
      console.log(logs);

      let totalLabTime = 0;
      // Map: notebookId -> { duration, latestTimestamp }
      const notebookSummary: Record<string, { duration: number; latestTimestamp: number }> = {};
      const minutesByActivebook: Record<string, number> = {};
      const minutesByRegular: Record<string, number> = {};

      logs.forEach((log: any) => {
        const { log_info, time_stamp } = log;
        if (log_info.type === 'window') {
          totalLabTime += log_info.duration;
        }
        if (log_info.type === 'notebook' && log_info.notebook_id) {
          const name = log_info.name || log_info.notebook_id;
          const type = (log.notebook_type || '').toLowerCase(); // 'activebook' or 'regular'

          if (!name.includes('Launcher') && !name.includes('My Dashboard') && !name.includes('Console')) {
            // Track total duration and latest timestamp for each notebook
            if (!notebookSummary[name]) {
              notebookSummary[name] = { duration: 0, latestTimestamp: 0 };
            }
            notebookSummary[name].duration += log_info.duration;
            const ts = new Date(time_stamp).getTime();
            if (ts > notebookSummary[name].latestTimestamp) {
              notebookSummary[name].latestTimestamp = ts;
            }

            if (type === 'activebook') {
              minutesByActivebook[name] = (minutesByActivebook[name] || 0) + log_info.duration;
            } else {
              minutesByRegular[name] = (minutesByRegular[name] || 0) + log_info.duration;
            }
          }
        }
      });

      setLabTime(totalLabTime);

      // Load saved target if exists
      const savedTarget = localStorage.getItem(todayKey);
      if (savedTarget) {
        setTargetMinutes(Number(savedTarget));
        setIsGoalLocked(true);
      }

      // For summaries table (all combined for list)
      const summaryArray = Object.entries(notebookSummary)
        .map(([notebookId, { duration, latestTimestamp }]) => ({
          notebookId,
          duration,
          latestTimestamp
        }))
        .sort((a, b) => b.latestTimestamp - a.latestTimestamp);
 
      setSummaries(summaryArray);

      // For Activebook chart
      const activebookData = Object.entries(minutesByActivebook)
        .map(([name, duration]) => ({
          name,
          minutes: parseFloat((duration / 60).toFixed(1))
        }))
        .filter(entry => entry.minutes > 0);

      // For Regular chart
      const regularData = Object.entries(minutesByRegular)
        .map(([name, duration]) => ({
          name,
          minutes: parseFloat((duration / 60).toFixed(1))
        }))
        .filter(entry => entry.minutes > 0);

      setActivebookChartData(activebookData);
      setRegularChartData(regularData);
    }

    loadData();
  }, []);

  return (
    <>
      <div
        style={{
          position: 'relative',
          padding: '1.5em',
          fontFamily: 'sans-serif',
          maxHeight: 'calc(100vh - 100px)',
          overflowY: 'auto'
        }}
      >
        {/* Student Profile Block */}
        <section style={{ display: 'flex', gap: '2em', marginBottom: '2em' }}>
          <Card style={{ width: '650px', padding: 0, borderRadius: '20px', overflow: 'hidden' }}>
            {/* 🔺 Top Red Section */}
            <div style={{ backgroundColor: '#e63946', padding: '2.5em 0 2em', textAlign: 'center', color: 'white' }}>
              <div
              style={{
                width: '100px',
        height: '100px',
        borderRadius: '50%',
        background: '#ccc',
        margin: '0 auto 1em',
        fontSize: '2.8em',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      👩‍💻
    </div>
    <div style={{ fontWeight: 'bold', fontSize: '1.6em' }}>Fiona Lai</div>
    <div style={{ fontSize: '1.1em', color: '#fcd5d5' }}>Rutgers CS210</div>
  </div>

{/* 🔻 Bottom White Section */}
<div style={{
  backgroundColor: 'white',
  padding: '1.5em',
  borderBottomLeftRadius: '20px',
  borderBottomRightRadius: '20px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontSize: '1.2em',
  fontWeight: 500,
}}>
  {/* Left: Streak */}
  <div style={{ textAlign: 'left', color: '#333' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em', marginBottom: '0.2em' }}>
      <FireIcon />
      <span style={{ fontSize: '1em' }}>Learning Streak</span>
    </div>
    <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#e76f51' }}>
      {consistencyStreak[0]?.value ?? 0} days
    </div>
  </div>

  {/* Right: Study Minutes */}
  <div style={{ textAlign: 'right', color: '#333' }}>
    <div style={{ marginBottom: '0.2em' }}>Today's Study</div>
    <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#2a9d8f' }}>
      {(labTime / 60).toFixed(1)} mins
    </div>
  </div>
</div>
</Card>

{/* 🎯 Goal Planner row */}
<div style={{ display: 'flex', flexDirection: 'column', gap: '1.5em' }}>
  {/* Goal Planner (上半區塊) */}
  <Card
    style={{
      width: '635px',
      padding: '2.5em 2em',
      borderRadius: '20px',
      backgroundColor: '#fffaf0',
      border: '3px solid #ffcb69',
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      gap: '1.2em',
    }}
  >
    <div
      style={{
        fontSize: '1.6em',
        fontWeight: 'bold',
        color: '#e76f51',
        display: 'flex',
        alignItems: 'center',
        gap: '0.4em',
      }}
    >
      🎯 Goal Planner
    </div>

    <div style={{ fontSize: '1.2em', color: '#444' }}>
      <div style={{ marginBottom: '0.7em' }}>
        <strong>Target:</strong> Study{' '}
        <input
          type="number"
          value={targetMinutes}
          min={30}
          disabled={isGoalLocked}
          onChange={e => {
            const value = Number(e.target.value);
            const fixedValue = value < 30 ? 30 : value;
            setTargetMinutes(fixedValue);
            localStorage.setItem(todayKey, fixedValue.toString());
            setIsGoalLocked(true);
          }}
          style={{
            width: '60px',
            padding: '0.4em',
            fontSize: '1em',
            border: '1px solid #ccc',
            borderRadius: '6px',
            margin: '0 0.4em',
          }}
        />{' '}
        mins
      </div>
      <div style={{ marginBottom: '0.7em' }}>
        <strong>Status:</strong>{' '}
        <span style={{ color: 'green', fontWeight: 'bold' }}>{goalStatus}</span>
      </div>
      <div>
        <strong>Bonus:</strong>{' '}
        <span style={{ color: '#e76f51', fontWeight: 'bold' }}>{bonusPoints}</span>
      </div>
    </div>
  </Card>

  {/* 📊 League + Last Notebook */}
  <div style={{ display: 'flex', gap: '1.5em' }}>
    {/* League Card */}
    <Card
      style={{
        width: '290px',
        height: '100px',
        padding: '1em 1.5em',
        borderRadius: '16px',
        backgroundColor: '#f7fef7',
        border: '2px solid #a5d6a7',
        boxShadow: '0 4px 10px rgba(0, 0, 0, 0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <div
        style={{
          width: '60px',
          height: '60px',
          border: '2px solid #4caf50',
          background: '#e8f5e9',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 600,
          color: '#388e3c',
          fontSize: '1em',
        }}
      >
        League
      </div>
      <div style={{ textAlign: 'right', flex: 1, marginLeft: '1em' }}>
        <div
          style={{
            fontSize: '1.8em',
            fontWeight: 'bold',
            color: '#6a1b9a',
            lineHeight: 1,
          }}
        >
          {consistencyScore !== null ? consistencyScore.toFixed(1) : '--'}
        </div>
        <div style={{ fontSize: '1em', color: '#6a1b9a', marginTop: '0.2em' }}>
          Consistency Score
        </div>
      </div>
    </Card>

    {/* Last Notebook */}
    <div
      style={{ cursor: lastNotebookPath ? 'pointer' : 'default' }}
      onClick={() => {
        if (lastNotebookPath) {
          window.open(lastNotebookPath, '_blank');
        }
      }}
    >
      <Card
        style={{
          width: '290px',
          height: '100px',
          padding: '1em 1.5em',
          borderRadius: '16px',
          backgroundColor: '#eef2ff',
          border: '2px solid #9fa8da',
          boxShadow: '0 4px 10px rgba(0, 0, 0, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '0.6em',
        }}
      >
        <div style={{ fontSize: '1em', color: '#3f51b5', fontWeight: 'bold' }}>
          📘 Last Opened Notebook
        </div>
        <div
          style={{
            fontSize: '1.1em',
            fontWeight: 500,
            color: '#1a237e',
            wordBreak: 'break-all',
          }}
        >
          {lastNotebookTitle || 'No notebook yet'}
        </div>
        <div style={{ fontSize: '0.85em', color: '#5c6bc0' }}>
          {lastNotebookPath ? 'Click to open' : ''}
        </div>
      </Card>
    </div>
  </div>
</div>
  
        </section>
  
        {/* Consistency Score Chart */}
        <section
          style={{
            marginTop: '2em',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '1.5em',
          }}
        >
  
          <div style={{ flex: 1 }}>
            <h4 style={{ marginBottom: '0.5em' }}>📈 Consistency Score (past 150 days)</h4>
            <ConsistencyScoreChart scores={longTermConsistency} />
          </div>
        </section>
  
        {/* Remaining sections (unchanged) */}
        <section style={{ marginTop: '1em' }}>
          <h3>📈 Engagement Streak</h3>
          <p>Active minutes in the last 7 days:</p>
          <div style={{ height: '250px' }}>
            <EngagementStreakChart data={dailyActiveMinutes} />
          </div>
        </section>
  
        <section style={{ marginTop: '2em' }}>
          <h3>📈 Time Distribution</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '2em', flexWrap: 'wrap' }}>
            {activebookChartData.length > 0 && (
              <div style={{ flex: '1 1 45%', minWidth: '300px' }}>
                <h4 style={{ textAlign: 'center' }}>📕 Activebook</h4>
                <WorkSummaryChart data={activebookChartData as any} />
              </div>
            )}
  
            {regularChartData.length > 0 && (
              <div style={{ flex: '1 1 45%', minWidth: '300px' }}>
                <h4 style={{ textAlign: 'center' }}>📘 Assignments and Others</h4>
                <WorkSummaryChart data={regularChartData as any} />
              </div>
            )}
  
            {activebookChartData.length === 0 && regularChartData.length === 0 && (
              <div style={{ flex: '1 1 100%', minWidth: '300px' }}>
                <p>No work done today.</p>
              </div>
            )}
          </div>
        </section>
  
        <section style={{ marginTop: '1em' }}>
          <h3>📄 Summary of Work Today</h3>
          {summaries.length === 0 ? (
            <p>No session data yet.</p>
          ) : (
            <ul style={{ paddingLeft: '1em', fontSize: '0.95em' }}>
              {summaries.map((summary, idx) => (
                <li key={idx} style={{ marginBottom: '0.5em' }}>
                  🗂️ You worked on <strong>{summary.notebookId}</strong> for{' '}
                  <b>{(summary.duration / 60).toFixed(1)}</b> minutes today.
                </li>
              ))}
            </ul>
          )}
        </section>
  
        <section style={{ marginTop: '1em' }}>
          <h3>🎯 Personalized Suggestion</h3>
          <p>
            ✅ {labTime < 600
              ? 'Try to spend 10+ min learning today for consistent streaks!'
              : 'Great job maintaining your learning streak!'}
          </p>
        </section>
      </div>
    </>
  );  
};