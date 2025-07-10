import React, { useEffect, useState } from 'react';
import { fetchLogsFromCodeBench } from '../../api/codebench';
import { WorkSummaryChart } from './WorkSummaryChart';
import { EngagementStreakChart } from './EngagementStreakChart';
import { ConsistencyStreak } from './ConsistencyStreak';

export const MyDashboard = () => {
  const [labTime, setLabTime] = useState(0);
  const [focusCount] = useState(0);
  const [summaries, setSummaries] = useState<{ notebookId: string, duration: number }[]>([]);
  const [dailyActiveMinutes, setDailyActiveMinutes] = useState<number[]>([]);
  const [consistencyScore, setConsistencyScore] = useState<number | null>(null);
  const [consistencyStreak, setConsistencyStreak] = useState<{ day: string; value: number }[]>([]);
  const [typeChartData, setTypeChartData] = useState<{ name: string; minutes: number }[]>([]);
  
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
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const key = d.toLocaleDateString();
        const minutes = Math.round((dailyMap[key] || 0) / 60); // convert to minutes
        last7Days.push(minutes);
      }
  
      setDailyActiveMinutes(last7Days);

      // Calculate Consistency Score = mean / (1+var) * 100
      const total = last7Days.reduce((a, b) => a + b, 0);
      const mean = total / 7;

      if (mean === 0) {
        setConsistencyScore(0);
        console.log("No activity, consistency score is 0.");
      } else {
        const variance = last7Days.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / 7;
        const stdDev = Math.sqrt(variance);
        const consistencyFactor = 1 / (1 + (stdDev / mean)); // always between 0 and 1
        const score = mean * consistencyFactor;
        setConsistencyScore(score);
        console.log("Calculated Consistency Score:", score);
      }

      // Calculate consecutive streak based on last7Days where minutes >= 10
      let streak = 0;
      for (let i = last7Days.length - 1; i >= 0; i--) {
        if (last7Days[i] >= 10) {
          streak += 1;
        } else {
          break; // stop counting when a day is inactive
        }
      }
      console.log("Consecutive active streak days:", streak);

      // Update consistencyStreak for your ConsistencyStreak component
      setConsistencyStreak([{ day: 'Current', value: streak }]);
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
    const minutesByName: Record<string, number> = {};
    const minutesByType: Record<string, number> = {};

    logs.forEach((log: any) => {
      const { log_info } = log;
      if (log_info.type === 'window') {
        totalLabTime += log_info.duration;
      }
      if (log_info.type === 'notebook' && log_info.notebook_id) {
        const name = log_info.name || log_info.notebook_id;
        const type = log_info.type_detail || log_info.type || 'unknown'; // fallback
        if (!name.includes('Launcher') && !name.includes('My Dashboard') && !name.includes('Console')) {
          minutesByName[name] = (minutesByName[name] || 0) + log_info.duration;
          minutesByType[type] = (minutesByType[type] || 0) + log_info.duration;
        }
      }
    });

    setLabTime(totalLabTime);

    // ✅ For summaries table and pie chart by notebook name
    const summaryArray = Object.entries(minutesByName)
      .map(([name, duration]) => ({
        notebookId: name, // ✅ matches your useState type
        duration
      }))
      .sort((a, b) => b.duration - a.duration);

    setSummaries(summaryArray);

    // ✅ For pie chart by notebook type
    const typeDataArray = Object.entries(minutesByType)
      .map(([type, duration]) => ({
        name: type,
        minutes: parseFloat((duration / 60).toFixed(1))
      }))
      .filter(entry => entry.minutes > 0);

    setTypeChartData(typeDataArray);
  }

  loadData();
}, []);

// ✅ One clean mapping for notebook pie chart
const workDataByName = summaries
  .map(summary => ({
    name: summary.notebookId,
    minutes: parseFloat((summary.duration / 60).toFixed(1))
  }))
  .filter(entry => entry.minutes > 0);

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

        <section style={{ marginTop: '1em' }}>
          <h3>🧠 JupyterLab Usage</h3>
          <p>
            ✅ You used JupyterLab <b>{(labTime / 60).toFixed(1)}</b> minutes today.
          </p>
          <p>🔁 You switched windows <b>{focusCount}</b> times today</p>
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

        <section style={{ marginTop: '1em', display: 'flex', gap: '1em', flexWrap: 'wrap' }}>
  <div style={{ flex: '1 1 45%', minWidth: '300px' }}>
    <h3>📈 Time Distribution by Notebook Name</h3>
    <WorkSummaryChart data={workDataByName as any} />
  </div>
  
  <div style={{ flex: '1 1 45%', minWidth: '300px' }}>
    <h3>📈 Time Distribution by Notebook Type</h3>
    <WorkSummaryChart data={typeChartData as any} />
  </div>
</section>

        <section style={{ marginTop: '1em' }}>
          <h3>📈 Engagement Streak</h3>
          <p>Active minutes in the last 7 days:</p>
          <div style={{ height: '250px' }}>
            <EngagementStreakChart data={dailyActiveMinutes} />
          </div>
        </section>

        <section style={{ marginTop: '1em' }}>
          <h3>🎯 Personalized Suggestion</h3>
          <p>✅ {labTime < 600 ? "Try to spend 10+ min learning today for consistent streaks!" : "Great job maintaining your learning streak!"}</p>
        </section>
      </div>
    </>
  );
};