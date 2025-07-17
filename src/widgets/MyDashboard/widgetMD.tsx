import React, { useEffect, useState } from 'react';
import { fetchLogsFromCodeBench } from '../../api/codebench';
import { WorkSummaryChart } from './WorkSummaryChart';
import { EngagementStreakChart } from './EngagementStreakChart';
import { ConsistencyScoreChart } from './ConsistencyScoreChart';
import { Card } from './components/Card';
import { FaFireAlt } from 'react-icons/fa';
import styled, { keyframes } from 'styled-components';
import { FaChartLine } from 'react-icons/fa';
import { MdBarChart } from 'react-icons/md';
import { FaClipboardList, FaRegClock } from 'react-icons/fa';
import { COURSE_ID } from '../../common/config';

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
  const [student, setStudent] = useState<{ name: string; net_id: string; email: string } | null>(null);

  // For student profile
  useEffect(() => {
    fetch('http://localhost:8888/cb-server/students')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data.length > 0) {
          setStudent(data.data[0]);
        }
      })
      .catch(err => console.error('Failed to fetch student:', err));
  }, []);  

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
      
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const tomorrowStart = new Date(todayStart);
      tomorrowStart.setDate(todayStart.getDate() + 1);

      logs.forEach((log: any) => {
        const { log_info, time_stamp } = log;
        const ts = new Date(time_stamp);

        // Today's window time
        if (log_info.type === 'window' && ts >= todayStart && ts < tomorrowStart) {
          totalLabTime += log_info.duration;
        }

        // Today's notebook time
        if (
          log_info.type === 'notebook' &&
          log_info.notebook_id &&
          ts >= todayStart &&
          ts < tomorrowStart
        ) {
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
         <style
     dangerouslySetInnerHTML={{
       __html: `
         @keyframes shine {
           to {
             background-position: -200% center;
           }
         }
         @keyframes pulse {
           0%, 100% {
             opacity: 1;
           }
           50% {
             opacity: 0.5;
           }
         }
         @keyframes spin {
           0% {
             transform: rotate(0deg);
           }
           100% {
             transform: rotate(360deg);
           }
         }
       `
     }}
   />
      <div
        style={{
          backgroundColor: '#fff3f0',
          position: 'relative',
          padding: '1.5em',
          fontFamily: 'sans-serif',
          maxHeight: 'calc(100vh - 100px)',
          overflowY: 'auto'
        }}
      >
        {/* Student Profile Block */}
        <section
  style={{
    display: 'flex',
    flexWrap: 'wrap',
    gap: '2em',
    marginBottom: '2em',
    justifyContent: 'space-between',
  }}
>
<Card
  style={{
    flex: '1 1 300px', // allow shrinking/growing
    minWidth: '260px', // prevent too small
    padding: 0,
    borderRadius: '20px',
    overflow: 'hidden',
  }}
>
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
    <div style={{ fontWeight: 'bold', fontSize: '2em' }}>{student ? student.name : 'Loading...'}</div>
    <div style={{ fontSize: '1.5em', color: '#fcd5d5' }}>{COURSE_ID}</div>
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
  
{/* Right: Study Minutes */}
<div style={{ textAlign: 'right', color: '#333' }}>
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: '0.5em',
      marginBottom: '0.2em',
    }}
  >
         {React.createElement((FaRegClock as unknown) as React.ComponentType<any>, { style: { color: '#14b8a6', fontSize: '1.5em', animation: 'spin 2s linear infinite' } })}
    <span style={{ fontSize: '1em' }}>Today's Study</span>
  </div>
  <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#2a9d8f' }}>
    {labTime / 60 >= 60
      ? `${(labTime / 3600).toFixed(1)} hrs`
      : `${(labTime / 60).toFixed(1)} mins`}
  </div>
</div>
</div>
</Card>

{/* 🎯 Goal Planner row */}
<div
  style={{
    flex: '1 1 300px',
    minWidth: '260px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5em',
  }}
>
  {/* Goal Planner (上半區塊) */}
  <Card
  style={{
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

  {/* League + Last Notebook */}
  <div
  style={{
    display: 'flex',
    flexWrap: 'wrap',
    gap: '1.5em',
    width: '100%',
    justifyContent: 'space-between',
  }}
>
  {/* League Card */}
  <div style={{ flex: '1 1 250px', minWidth: '230px' }}>
    <Card
      style={{
        position: 'relative',
        height: '110px',
        padding: '0.8em 1em',
        borderRadius: '16px',
        backgroundColor: '#f3fff5',
        border: '2px solid #81c784',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {/* 📈 Icon in Top Left */}
      <div
        style={{
          position: 'absolute',
          top: '0.6em',
          left: '0.8em',
          fontSize: '4em',
        }}
      >
        📈
      </div>

      {/* Text content in center */}
      <div
        style={{
          marginLeft: '25%',
          width: '75%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <div style={{ marginLeft: '4em', paddingTop: '0.5em' }}>
        <div style={{ fontSize: '1.7em', fontWeight: 600, color: '#2e7d32' }}>
          Consistency Score
        </div>
        <div style={{ fontSize: '3em', fontWeight: 'bold', color: '#43a047' }}>
          {consistencyScore !== null ? consistencyScore.toFixed(1) : '--'}
        </div>
        </div>
      </div>
    </Card>
  </div>

  {/* Last Notebook Card */}
  <div
    style={{ flex: '1 1 250px', cursor: lastNotebookPath ? 'pointer' : 'default' }}
    onClick={() => {
      if (lastNotebookPath) window.open(lastNotebookPath, '_blank');
    }}
  >
    <Card
      style={{
        position: 'relative',
        height: '110px',
        padding: '0.8em 1em',
        borderRadius: '16px',
        backgroundColor: '#f3f6ff',
        border: '2px solid #90caf9',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {/* 📘 Icon in Top Left */}
      <div
        style={{
          position: 'absolute',
          top: '0.6em',
          left: '0.8em',
          fontSize: '4em',
        }}
      >
        📘
      </div>

      {/* Text content in center */}
      <div
        style={{
          marginLeft: '25%',
          width: '75%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <div style={{ marginLeft: '4em', paddingTop: '0.5em' }}>
        <div style={{ fontSize: '1.7em', fontWeight: 600, color: '#1a237e' }}>
          Last Opened Notebook
        </div>
        <div style={{ fontSize: '1.1em', color: '#1a237e' }}>
          {lastNotebookTitle || 'No notebook yet'}
        </div>
        {lastNotebookPath && (
          <div style={{ fontSize: '0.9em', color: '#5c6bc0' }}>
            Click to open
          </div>
        )}
        </div>
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
<Card 
style={{
  flex: 1,
  padding: '1.5em 2em',
  borderRadius: '20px',
  border: '1px solid #f4a261',
  boxShadow: '0 4px 10px rgba(0, 0, 0, 0.06)',
  backgroundColor: 'white',
}}
>
  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1em' }}>
    {React.createElement((FaChartLine as unknown) as React.ComponentType<any>, { style: { color: '#e76f51', fontSize: '1.5em', marginRight: '0.5em' } })}
    <h3 style={{ fontSize: '1.3em', fontWeight: 600, color: '#264653', margin: 0 }}>
      Consistency Score (past 150 days)
    </h3>
  </div>
  <ConsistencyScoreChart scores={longTermConsistency} />
</Card>
</section>
  
        {/* Engagement Streak */}
        <section>
        <Card
  style={{
    flex: 1,
    padding: '1.5em 2em',
    borderRadius: '20px',
    border: '1px solid #f4a261',
    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.06)',
    backgroundColor: 'white',
    marginTop: '1em',
  }}
>
  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5em' }}>
    {React.createElement((FaChartLine as unknown) as React.ComponentType<any>, { size: 22, style: { color: '#2a9d8f', marginRight: '0.5em' } })}
    <h3 style={{ fontSize: '1.3em', fontWeight: 600, color: '#264653', margin: '0.5em'}}>
      Engagement Streak (active time per day)
    </h3>
  </div>
  <div style={{ height: '250px' }}>
    <EngagementStreakChart data={dailyActiveMinutes} />
  </div>
</Card>
        </section>
        
        {/* Time Distribution */}
        <section style={{ marginTop: '2em', display: 'flex', gap: '2em', flexWrap: 'wrap' }}>
  {activebookChartData.length > 0 && (
    <Card style={{ flex: '1 1 45%', padding: '1.5em 2em', borderRadius: '20px', border: '2px solid #f4a261', boxShadow: '4px 4px 12px rgba(0,0,0,0.08)', background: 'white' }}>
             <h2 style={{ color: '#264653', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5em' }}>
         {React.createElement((MdBarChart as unknown) as React.ComponentType<any>, { style: { color: '#e76f51' } })}
         Time Distribution for Activebook
       </h2>

       {/* Total Time Summary */}
    <p style={{ marginTop: '-0.5em', marginBottom: '1em', color: '#555', fontSize: '1.3em' }}>
      Total Active Time: {activebookChartData.reduce((sum, entry) => sum + entry.minutes, 0).toFixed(1)} min
    </p>

      <WorkSummaryChart data={activebookChartData as any} />
    </Card>
  )}

  {regularChartData.length > 0 && (
    <Card style={{ flex: '1 1 45%', padding: '1.5em 2em', borderRadius: '20px', border: '2px solid #f4a261', boxShadow: '4px 4px 12px rgba(0,0,0,0.08)', background: 'white' }}>
             <h2 style={{ color: '#264653', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5em' }}>
         {React.createElement((MdBarChart as unknown) as React.ComponentType<any>, { style: { color: '#2a9d8f' } })}
         Time Distribution for Assignments and Others
       </h2>

       {/* Total Time Summary */}
    <p style={{ marginTop: '-0.5em', marginBottom: '1em', color: '#555', fontSize: '1.3em' }}>
      Total Active Time: {regularChartData.reduce((sum, entry) => sum + entry.minutes, 0).toFixed(1)} min
    </p>

      <WorkSummaryChart data={regularChartData as any} />
    </Card>
  )}
</section>
  
        {/* Summary of Work Today */}
        <section style={{ marginTop: '1em' }}>
        <Card>
  <section>
         <h2
       style={{
         fontSize: '1.5em',
         fontWeight: 700,
         display: 'flex',
         alignItems: 'center',
         gap: '0.5em',
         color: '#1f2937',
         marginBottom: '1em',
       }}
     >
       {React.createElement((FaClipboardList as unknown) as React.ComponentType<any>, { style: { color: '#3b82f6' } })}
       Summary of Work Today
     </h2>
    {summaries.length === 0 ? (
      <p style={{ color: '#6b7280' }}>No session data yet.</p>
    ) : (
      <ul style={{ paddingLeft: '1.2em', fontSize: '0.95em', color: '#374151' }}>
        {summaries.map((summary, idx) => (
          <li
            key={idx}
            style={{
              marginBottom: '0.4em',
              lineHeight: '1.6',
              fontFamily: 'system-ui',
              padding: '0.2em 0',
            }}
          >
            Worked on{' '}
            <span style={{ fontWeight: 600 }}>{summary.notebookId}</span> for{' '}
            <span style={{ fontWeight: 600, color: '#f97316' }}>
              {(summary.duration / 60).toFixed(1)} minutes
            </span>{' '}
            today.
          </li>
        ))}
      </ul>
    )}
  </section>
</Card>
        </section>
  
        {/* Personalized Suggestion */}
        <section style={{ textAlign: 'center', marginTop: '5em', marginBottom: '4em' }}>
  <h2
  style={{
    fontSize: '2.5em',
    fontWeight: 800,
    background: 'linear-gradient(90deg, #00bcd4, #3f51b5, #9c27b0)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundSize: '200% auto',
    animation: 'shine 3s linear infinite',
    display: 'block',
    marginBottom: '0.5em',
  }}
>
  Personalized Suggestion
</h2>

  {labTime >= 600 ? (
    <>
      <img
        src="https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExd2s4YjFtNmJxeG5zdHJyN2wyYXBrdzQ1Ymp1ZnhjMXVsM2ZsNWFlcyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/mkfTnlBlIeNIA/giphy.gif"
        alt="Celebration Meme"
        style={{ maxWidth: '300px', borderRadius: '12px', marginTop: '1em' }}
      />
      <p style={{ fontSize: '1.3em', fontWeight: 700, color: '#10b981', marginTop: '1em' }}>
        Learning streak unlocked! 🔥
      </p>
      <p style={{ fontSize: '1.1em', color: '#4b5563' }}>You're crushing it — keep going! 💪</p>
    </>
  ) : (
    <>
      <img
        src="https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExZHZoejRuZWZuc2EzbjhjbXRtcnIwcTZpMmU5cjc1OGZqdWJxbG5paSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/cr9vIO7NsP5cY/giphy.gif"
        alt="Work harder meme"
        style={{ maxWidth: '300px', borderRadius: '12px', marginTop: '1em' }}
      />
      <p style={{ fontSize: '1.3em', fontWeight: 700, color: '#f59e0b', marginTop: '1em' }}>
        Just getting started... 🐢
      </p>
      <p style={{ fontSize: '1.1em', color: '#6b7280' }}>Try to hit at least 10 minutes today!</p>
    </>
  )}
</section>
      </div>
    </>
  );  
};