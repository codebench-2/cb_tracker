import React, { useEffect, useState } from 'react';
import { fetchLogsFromCodeBench } from '../../api/codebench';
import { WorkSummaryChart } from './WorkSummaryChart';
import { EngagementStreakChart } from './EngagementStreakChart';
import { ConsistencyStreak } from './ConsistencyStreak';
import { ConsistencyScoreChart } from './ConsistencyScoreChart';

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

      <ConsistencyStreak
        consistencyScore={consistencyScore}
        streakDays={consistencyStreak[0]?.value ?? 0}
      />

        <h2>📊 My Dashboard</h2>

        <section
          style={{
            marginTop: '2em',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}
        > 
          <div
            style={{
              backgroundColor: '#e0ffe6',
              padding: '1em 2em',
              borderRadius: '12px',
              fontSize: '1.4em',
              fontWeight: 'bold',
              color: '#2b9348',
              boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
              textAlign: 'center',
            }}
          >
            ✅ You used JupyterLab <b>{(labTime / 60).toFixed(1)}</b> minutes today
          </div>
        </section>

        <section 
          style={{
            marginTop: '2em',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '1.5em',
          }}
        >        
          <div
            style={{
              width: '500px',
              border: '2px solid #ffcb69',
              borderRadius: '10px',
              backgroundColor: '#fffaf0',
              padding: '1.5em',
              boxShadow: '0 4px 8px rgba(0,0,0,0.08)',
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '1.2em' }}>
              <h3 style={{ color: '#e76f51', margin: 0 }}>🎯 Goal Planner</h3>
              <p style={{ fontSize: '0.95em', color: '#333' }}>
                Set a learning goal for today and track your progress:
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: '1em',
                alignItems: 'center',
                justifyItems: 'center',
                fontSize: '1em',
                fontWeight: 500,
              }}
            >
              <div style={{ color: '#444' }}>Target</div>
              <div style={{ color: '#444' }}>Status</div>
              <div style={{ color: '#444' }}>🎁 Bonus Points</div>
 
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4em' }}>
                <span>Study</span>
                <input
                  type="number"
                  min={30}
                  value={targetMinutes}
                  onChange={e => {
                    if (isGoalLocked) return;
            
                    const value = Number(e.target.value);
                    const fixedValue = value < 30 ? 30 : value;
          
                    setTargetMinutes(fixedValue);
                    localStorage.setItem(todayKey, fixedValue.toString());
                    setIsGoalLocked(true);
                  }}
                  disabled={isGoalLocked}          
                  style={{
                    width: '60px',
                    padding: '0.3em',
                    borderRadius: '6px',
                    border: '1px solid #ccc',
                    fontSize: '1em',
                  }}
                />
                <span>mins today</span>
              </div>
              <div
                style={{
                  fontWeight: 'bold',
                  color: goalStatus.includes('🎉') ? 'green' : 'red',
                }}
              >
                {goalStatus}
              </div>

              <div style={{ fontWeight: 'bold' }}>{bonusPoints}</div>
            </div>
          </div>
          {/* Consistency Score Chart */}
          <div style={{ flex: 1 }}>
    <h4 style={{ marginBottom: '0.5em' }}>📈 Consistency Score (past 150 days)</h4>
    <ConsistencyScoreChart scores={longTermConsistency} />
  </div>
       </section>

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
            {/* Activebook Chart - only if there are activebooks */}
            {activebookChartData.length > 0 && (
              <div style={{ flex: '1 1 45%', minWidth: '300px' }}>
                <h4 style={{ textAlign: 'center' }}>📕 Activebook</h4>
                <WorkSummaryChart data={activebookChartData as any} />
              </div>
            )}

            {/* Regular Notebook Chart - only if there are regular notebooks */}
            {regularChartData.length > 0 && (
              <div style={{ flex: '1 1 45%', minWidth: '300px' }}>
                <h4 style={{ textAlign: 'center' }}>📘 Assignments and Others</h4>
                <WorkSummaryChart data={regularChartData as any} />
              </div>
            )}
    
            {/* if both are empty, show a message */}
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
          <p>✅ {labTime < 600 ? "Try to spend 10+ min learning today for consistent streaks!" : "Great job maintaining your learning streak!"}</p>
        </section>
      </div>
    </>
  );
};