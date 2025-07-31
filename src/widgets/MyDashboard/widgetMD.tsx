import React, { useEffect, useState, useRef } from 'react';
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
import { TbTargetArrow } from 'react-icons/tb';
import { GiBookCover } from 'react-icons/gi';
import { FaLock as FaLockIcon, FaUnlock as FaUnlockIcon } from 'react-icons/fa';
import { BsPersonWorkspace } from "react-icons/bs";
import confetti from 'canvas-confetti';

import iron from '../../common/images/badges/iron.png';
import bronze from '../../common/images/badges/bronze.png';
import silver from '../../common/images/badges/silver.png';
import gold from '../../common/images/badges/gold.png';
import platinum from '../../common/images/badges/platinum.png';
import emerald from '../../common/images/badges/emerald.png';
import diamond from '../../common/images/badges/diamond.png';
import master from '../../common/images/badges/master.png';
import grandmaster from '../../common/images/badges/grandmaster.png';
import challenger from '../../common/images/badges/challenger.png';

function LockIcon({ onUnlock }: { onUnlock: () => void }) {
  const [isLocked, setIsLocked] = useState(true);
  const [pressing, setPressing] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleDown = () => {
    setPressing(true);
    timeoutRef.current = setTimeout(() => {
      setIsLocked(false);
      onUnlock();
    }, 2000); // Unlock after 2 seconds
  };

  const handleUp = () => {
    setPressing(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  return (
    <span
      onMouseDown={handleDown}
      onMouseUp={handleUp}
      onMouseLeave={handleUp}
      onTouchStart={handleDown}
      onTouchEnd={handleUp}
      style={{
        marginLeft: '0.5em',
        color: isLocked ? '#000000' : '#4caf50',
        cursor: 'pointer',
        fontSize: '1.2em',
        transform: pressing ? 'scale(1.2)' : 'scale(1)',
        transition: 'transform 0.2s'
      }}
      title={isLocked ? 'Hold to unlock' : 'Unlocked'}
    >
      {isLocked ? 
        React.createElement(FaLockIcon as unknown as React.ComponentType<any>) : 
        React.createElement(FaUnlockIcon as unknown as React.ComponentType<any>)
      }
    </span>
  );
}

const iconStyle: React.CSSProperties = {
  animation: 'goalPulse 1.8s infinite ease-in-out',
  color: '#e63946'
};

const bookFlip = keyframes`
  0% { transform: rotateY(0deg); }
  50% { transform: rotateY(15deg); }
  100% { transform: rotateY(0deg); }
`;

const AnimatedBookIcon = styled.div<{ color?: string }>`
  font-size: 4em;
  color: ${({ color }) => color || '#4E9FA2'};
  animation: ${bookFlip} 2s infinite ease-in-out;
`;

const badgeMap: { [tier: string]: string } = {
  iron,
  bronze,
  silver,
  gold,
  platinum,
  emerald,
  diamond,
  master,
  grandmaster,
  challenger
};

function getBadge(streak: number): { icon: React.ReactNode; level: string } {
  let tier = 'iron';

  if (streak >= 100) tier = 'challenger';
  else if (streak >= 90) tier = 'grandmaster';
  else if (streak >= 70) tier = 'master';
  else if (streak >= 50) tier = 'diamond';
  else if (streak >= 30) tier = 'emerald';
  else if (streak >= 14) tier = 'platinum';
  else if (streak >= 7) tier = 'gold';
  else if (streak >= 5) tier = 'silver';
  else if (streak >= 2) tier = 'bronze';

  return {
    icon: (
      <img
        src={badgeMap[tier]}
        alt={`${tier} badge`}
        style={{ width: '80px', height: '80px' }}
      />
    ),
    level: tier
  };
}

function getLevelNumber(streak: number): string {
  if (streak >= 100) return 'X';         // Challenger
  else if (streak >= 90) return 'IX';    // Grandmaster
  else if (streak >= 70) return 'VIII';   // Master
  else if (streak >= 50) return 'VII';    // Diamond
  else if (streak >= 30) return 'VI';     // Emerald
  else if (streak >= 14) return 'V';    // Platinum
  else if (streak >= 7) return 'IV';    // Gold
  else if (streak >= 5) return 'III';   // Silver
  else if (streak >= 2) return 'II';     // Bronze
  return 'I';                            // Iron
}

const pulse = keyframes`
  0%   { transform: scale(1);   opacity: 1; }
  50%  { transform: scale(1.2); opacity: 0.8; }
  100% { transform: scale(1);   opacity: 1; }
`;

const FireIcon = styled(FaFireAlt as unknown as React.ComponentType<any>)`
  color: #FF8551;
  animation: ${pulse} 1.2s infinite;
  font-size: 1.8em;
`;

export const MyDashboard = () => {
  const [labTime, setLabTime] = useState(0);
  const [summaries, setSummaries] = useState<
    { notebookId: string; duration: number }[]
  >([]);
  const [dailyActiveMinutes, setDailyActiveMinutes] = useState<number[]>([]);
  const [consistencyScore, setConsistencyScore] = useState<number | null>(null);
  const [consistencyStreak, setConsistencyStreak] = useState<
    { day: string; value: number }[]
  >([]);
  const [activebookChartData, setActivebookChartData] = useState<
    { name: string; minutes: number }[]
  >([]);
  const [regularChartData, setRegularChartData] = useState<
    { name: string; minutes: number }[]
  >([]);
  const [targetMinutes, setTargetMinutes] = useState(30);
  const [goalStatus, setGoalStatus] = useState('');
  // const [bonusPoints, setBonusPoints] = useState(0);
  const [goalAwarded, setGoalAwarded] = useState(false);
  const todayKey = `goal-${new Date().toLocaleDateString()}`;
  const [isGoalLocked, setIsGoalLocked] = useState(
    () => !!localStorage.getItem(todayKey)
  );
  const todayMinutes = labTime / 60;
  const [longTermConsistency, setLongTermConsistency] = useState<
    { day: string; value: number }[]
  >([]);
  // const [lastNotebookPath, setLastNotebookPath] = useState<string | null>(null);
  // const [lastNotebookTitle, setLastNotebookTitle] = useState<string | null>(
  //   null
  // );
  const [student, setStudent] = useState<{
    name: string;
    net_id: string;
    email: string;
  } | null>(null);
  
  const [medianEngagement, setMedianEngagement] = useState<number | null>(null);

  const fetchDashboardData = async () => {
    const logs = await fetchLogsFromCodeBench();
  
    // ----- Student Info -----
    const studentRes = await fetch('http://localhost:8888/cb-server/students');
    const studentData = await studentRes.json();
    if (studentData.success && studentData.data.length > 0) {
      setStudent(studentData.data[0]);
    }    
  
    // ----- Today's Time -----
    let windowTime = 0;
    let launcherTime = 0;
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
  
      if (log_info.type === 'window' && ts >= todayStart && ts < tomorrowStart) {
        if (log_info.tab === 'launcher') {
          launcherTime += log_info.duration;
        }
        windowTime += log_info.duration;
      }
  
      if (
        log_info.type === 'notebook' &&
        log_info.notebook_id &&
        ts >= todayStart &&
        ts < tomorrowStart
      ) {
        const name = log_info.name || log_info.notebook_id;
        const type = (log.notebook_type || '').toLowerCase();
        if (!name.includes('Launcher') && !name.includes('My Dashboard') && !name.includes('Console')) {
          if (!notebookSummary[name]) {
            notebookSummary[name] = { duration: 0, latestTimestamp: 0 };
          }
          notebookSummary[name].duration += log_info.duration;
          const tsMs = new Date(time_stamp).getTime();
          if (tsMs > notebookSummary[name].latestTimestamp) {
            notebookSummary[name].latestTimestamp = tsMs;
          }
          if (type === 'activebook') {
            minutesByActivebook[name] = (minutesByActivebook[name] || 0) + log_info.duration;
          } else {
            minutesByRegular[name] = (minutesByRegular[name] || 0) + log_info.duration;
          }
        }
      }
    });
  
    const totalLab = Math.max(0, windowTime - launcherTime);
    setLabTime(totalLab);
  
    // Summary table
    const summaryArray = Object.entries(notebookSummary)
      .map(([notebookId, { duration, latestTimestamp }]) => ({
        notebookId,
        duration,
        latestTimestamp
      }))
      .sort((a, b) => b.latestTimestamp - a.latestTimestamp);
    setSummaries(summaryArray);
  
    // Activebook + Regular data
    setActivebookChartData(Object.entries(minutesByActivebook).map(([name, duration]) => ({
      name,
      minutes: parseFloat((duration / 60).toFixed(1))
    })).filter(e => e.minutes > 0));
    setRegularChartData(Object.entries(minutesByRegular).map(([name, duration]) => ({
      name,
      minutes: parseFloat((duration / 60).toFixed(1))
    })).filter(e => e.minutes > 0));
  
    // Load goal target
    const todayKey = `goal-${new Date().toLocaleDateString()}`;
    const savedTarget = localStorage.getItem(todayKey);
    if (savedTarget) {
      setTargetMinutes(Number(savedTarget));
      setIsGoalLocked(true);
    }
  
    // ----- Charts: Consistency, Engagement -----
    const today = new Date();
    const dailyMap: { [date: string]: number } = {};
    logs.forEach((log: any) => {
      const { log_info, time_stamp } = log;
      if (log_info.type === 'window') {
        const date = new Date(time_stamp).toLocaleDateString();
        dailyMap[date] = (dailyMap[date] || 0) + (log_info.duration || 0);
      }
    });
  
    const last7Days: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const key = d.toLocaleDateString();
      const minutes = parseFloat(((dailyMap[key] || 0) / 60).toFixed(1));
      last7Days.push(minutes);
    }
    setDailyActiveMinutes(last7Days);
  
    const last120Days: number[] = [];
    const last120DaysData: { day: string; value: number }[] = [];
    for (let i = 119; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const key = d.toLocaleDateString();
      const minutes = Math.round((dailyMap[key] || 0) / 60);
      last120Days.push(minutes);
      last120DaysData.push({ day: key.slice(0, 5), value: minutes });
    }
  
    const semesterDays = 120;
    const expectedEffort = 60;
    const maxBonus = 10;
    const epsilon = 0.01;
    const alpha = 1 - Math.pow(epsilon, 1 / semesterDays);
    let prevScore = 0;
    const smoothedScores = last120DaysData.map(({ day, value }) => {
      const r = Math.max(0, Math.min(value / expectedEffort, 1));
      const score = Math.max(0, Math.min((1 - alpha) * prevScore + alpha * r * maxBonus, maxBonus));
      prevScore = score;
      return { day, value: parseFloat(score.toFixed(2)) };
    });
  
    setLongTermConsistency(smoothedScores);
    setConsistencyScore(
      smoothedScores.length > 0 ? smoothedScores[smoothedScores.length - 1].value : 0
    );    
  
    // ----- Streak -----
    let historicalStreak = 0;
for (let i = last120Days.length - 2; i >= 0; i--) {
  if (last120Days[i] >= 10) {
    historicalStreak += 1;
  } else {
    break;
  }
}
const todayMinutes = last120Days[last120Days.length - 1];
const todayContribution = todayMinutes >= 10 ? 1 : 0;
const streak = historicalStreak + todayContribution;
setConsistencyStreak([{ day: 'Current', value: streak }]);

// ----- Median Engagement Time -----
const sortedDates = Object.keys(dailyMap).sort(
  (a, b) => new Date(a).getTime() - new Date(b).getTime()
);

const startIndex = sortedDates.findIndex(date => dailyMap[date] > 0);
const fromFirstUseDates = sortedDates.slice(startIndex);

const fromFirstUseMinutes: number[] = fromFirstUseDates.map(date =>
  parseFloat(((dailyMap[date] || 0) / 60).toFixed(1))
);

if (fromFirstUseMinutes.length > 0) {
  const sortedMinutes = [...fromFirstUseMinutes].sort((a, b) => a - b);
  const mid = Math.floor(sortedMinutes.length / 2);
  let median = 0;
  if (sortedMinutes.length % 2 === 0) {
    median = (sortedMinutes[mid - 1] + sortedMinutes[mid]) / 2;
  } else {
    median = sortedMinutes[mid];
  }
  setMedianEngagement(parseFloat(median.toFixed(1)));
} else {
  setMedianEngagement(null);
}
  };

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

  // // For last notebook
  // useEffect(() => {
  //   async function loadLogs() {
  //     const allLogs = await fetchLogsFromCodeBench();
  //     const notebookLogs = allLogs
  //       .filter((log: any) => log.log_info.type === 'notebook')
  //       .sort(
  //         (a: any, b: any) =>
  //           new Date(b.time_stamp).getTime() - new Date(a.time_stamp).getTime()
  //       );

  //     if (notebookLogs.length > 0) {
  //       const recent = notebookLogs[0];
  //       setLastNotebookPath(`/lab/tree/${recent.notebook_id}`);
  //       const parts = recent.notebook_id.split('/');
  //       setLastNotebookTitle(parts[parts.length - 1]);
  //     }
  //   }
  //   loadLogs();
  // }, []);

  // For Goal Planner
  useEffect(() => {
    const percent = (todayMinutes / targetMinutes) * 100;
  
    let newStatus = '';
    let achieved = goalAwarded;
  
    if (percent >= 100) {
      newStatus = 'Goal achieved! 🎉';
      if (!goalAwarded) {
        achieved = true;
        launchConfetti(); // 🎉 只触发一次
      }
    } else if (percent >= 70) {
      newStatus = 'Almost there 💪';
      achieved = false;
    } else if (percent >= 50) {
      newStatus = 'Halfway there ✨';
      achieved = false;
    } else {
      newStatus = 'Just started 🚀';
      achieved = false;
    }
  
    // 避免重复 setState 造成闪烁
    if (newStatus !== goalStatus) {
      setGoalStatus(newStatus);
    }
    if (achieved !== goalAwarded) {
      setGoalAwarded(achieved);
    }
  }, [todayMinutes, targetMinutes, goalStatus, goalAwarded]);  

  const launchConfetti = () => {
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
  
    const frame = () => {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#FF8551', '#4E9FA2', '#FFD700', '#FFDEDE']
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#FF8551', '#4E9FA2', '#FFD700', '#FFDEDE']
      });
  
      if (Date.now() < animationEnd) {
        requestAnimationFrame(frame);
      }
    };
  
    frame();
  };

  // For streaks & engagement chart
  useEffect(() => {
    async function loadData() {
      console.log('Fetching logs from CodeBench server...');
      const logs = await fetchLogsFromCodeBench();
      console.log('Fetched logs:', logs);

      // Calculate active minutes per day
      const today = new Date();
      const dailyMap: { [date: string]: number } = {};

      logs.forEach((log: any) => {
        const { log_info, time_stamp } = log;
        if (['window'].includes(log_info.type)) {
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
        const minutes = parseFloat(((dailyMap[key] || 0) / 60).toFixed(1));
        last7Days.push(minutes);
        last7DaysData.push({ day: key.slice(0, 5), value: minutes });
      }
      setDailyActiveMinutes(last7Days);

      // Get last 120 days
      const last120Days: number[] = [];
      const last120DaysData: { day: string; value: number }[] = [];

      for (let i = 119; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const key = d.toLocaleDateString();
        const minutes = Math.round((dailyMap[key] || 0) / 60);
        last120Days.push(minutes);
        last120DaysData.push({ day: key.slice(0, 5), value: minutes });
      }

      // Consistency score for 120 days
      const semesterDays = 120;
      const expectedEffort = 60;
      const maxBonus = 10;
      const epsilon = 0.01;
      const rMax = 1;
      const alpha = 1 - Math.pow(epsilon, 1 / semesterDays);

      const smoothedScores: { day: string; value: number }[] = [];
      let prevScore = 0;

      for (let i = 0; i < last120DaysData.length; i++) {
        const minutes = last120DaysData[i].value;
        const r = Math.max(0, Math.min(minutes / expectedEffort, rMax));
        let score = (1 - alpha) * prevScore + alpha * r * maxBonus;
        score = Math.max(0, Math.min(score, maxBonus)); // clamp
        smoothedScores.push({
          day: last120DaysData[i].day,
          value: parseFloat(score.toFixed(2))
        });
        prevScore = score;
      }

      setLongTermConsistency(smoothedScores); // For chart
      setConsistencyScore(smoothedScores[smoothedScores.length - 1].value); // Current value

      // Learning streak (120 days)
      let historicalStreak = 0;
      for (let i = last120Days.length - 2; i >= 0; i--) {
        if (last120Days[i] >= 10) {
          historicalStreak += 1;
        } else {
          break;
        }
      }
      const todayMinutes = last120Days[last120Days.length - 1];
      const todayContribution = todayMinutes >= 10 ? 1 : 0;
      const streak = historicalStreak + todayContribution;
      setConsistencyStreak([{ day: 'Current', value: streak }]);

      // Engagement time chart data (7 days)
      setDailyActiveMinutes(last7Days);

      // Median engagement time
      // Get all dates with logs sorted
      const sortedDates = Object.keys(dailyMap).sort(
        (a, b) => new Date(a).getTime() - new Date(b).getTime()
      );

// Find first non-zero engagement day
const startIndex = sortedDates.findIndex(date => dailyMap[date] > 0);
const fromFirstUseDates = sortedDates.slice(startIndex);

// Convert to minutes list
const fromFirstUseMinutes: number[] = fromFirstUseDates.map(date =>
  parseFloat(((dailyMap[date] || 0) / 60).toFixed(1))
);

// Calculate median
const sortedMinutes = [...fromFirstUseMinutes].sort((a, b) => a - b);
let median = 0;
const mid = Math.floor(sortedMinutes.length / 2);

if (sortedMinutes.length % 2 === 0) {
  median = (sortedMinutes[mid - 1] + sortedMinutes[mid]) / 2;
} else {
  median = sortedMinutes[mid];
}
median = parseFloat(median.toFixed(1));

// Save it to state
setMedianEngagement(median);
    }

    loadData();
  }, []);

  // For summary of work today
  useEffect(() => {
    async function loadData() {
      const logs = await fetchLogsFromCodeBench();

      console.log('Fetching logs from CodeBench server...');
      console.log(logs);

      let windowTime = 0;
      let launcherTime = 0;
      // Map: notebookId -> { duration, latestTimestamp }
      const notebookSummary: Record<
        string,
        { duration: number; latestTimestamp: number }
      > = {};
      const minutesByActivebook: Record<string, number> = {};
      const minutesByRegular: Record<string, number> = {};

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const tomorrowStart = new Date(todayStart);
      tomorrowStart.setDate(todayStart.getDate() + 1);

      logs.forEach((log: any) => {
        const { log_info, time_stamp } = log;
        const ts = new Date(time_stamp);

        // Today's window time (exclude launcher)
        if (
          log_info.type === 'window' &&
          ts >= todayStart &&
          ts < tomorrowStart
        ) {
          if (log_info.tab === 'launcher') {
            launcherTime += log_info.duration;
          }
          windowTime += log_info.duration;
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

          if (
            !name.includes('Launcher') &&
            !name.includes('My Dashboard') &&
            !name.includes('Console')
          ) {
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
              minutesByActivebook[name] =
                (minutesByActivebook[name] || 0) + log_info.duration;
            } else {
              minutesByRegular[name] =
                (minutesByRegular[name] || 0) + log_info.duration;
            }
          }
        }
      });

      setLabTime(Math.max(0, windowTime - launcherTime));

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

  useEffect(() => {
    fetchDashboardData();
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
          backgroundColor: '#FAF0E4',
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
            justifyContent: 'space-between'
          }}
        >
          <Card
            style={{
              flex: '1 1 300px', // allow shrinking/growing
              minWidth: '260px', // prevent too small
              padding: 0,
              borderRadius: '20px',
              overflow: 'hidden'
            }}
          >
            {/* 🔺 Top Red Section */}
            <div
              style={{
                backgroundColor: '#e63946',
                padding: '2.5em 0 2em',
                textAlign: 'center',
                color: 'white'
              }}
            >
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
                  justifyContent: 'center'
                }}
              >
                👩‍💻
              </div>
              <div style={{ fontWeight: 'bold', fontSize: '2em' }}>
                {student ? student.name : 'Loading...'}
              </div>
              <div style={{ fontSize: '1.5em', color: '#fcd5d5' }}>
                {COURSE_ID}
              </div>
            </div>

            {/* 🔻 Bottom White Section */}
            <div
              style={{
                backgroundColor: 'white',
                padding: '1.5em',
                borderBottomLeftRadius: '20px',
                borderBottomRightRadius: '20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '1.2em',
                fontWeight: 500
              }}
            >
              {/* Left: Streak */}
              <div style={{ textAlign: 'left', color: '#333' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5em',
                    marginBottom: '0.2em'
                  }}
                >
                  <FireIcon />
                  <span style={{ fontWeight: 500, fontSize: '1em', color: '#000000' }}>Learning Streak</span>
                </div>
                <div
                  style={{
                    fontSize: '2em',
                    fontWeight: 'bold',
                    color: '#FF8551'
                  }}
                >
                  {consistencyStreak[0]?.value ?? 0} days
                </div>
              </div>

              {/* Middle: Median Engagement */}
<div style={{ textAlign: 'center', color: '#333' }}>
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.5em',
      marginBottom: '0.2em'
    }}
  >
         {React.createElement(BsPersonWorkspace as unknown as React.ComponentType<any>, {
       style: {
         color: '#e63946',
         fontSize: '1.5em',
         animation: 'pulse 1.5s infinite'
       }
     })}
    <span style={{ fontWeight: 500, fontSize: '1em', color: '#000000' }}>
      Median Active
    </span>
  </div>
  <div
    style={{
      fontSize: '2em',
      fontWeight: 'bold',
      color: '#e63946'
    }}
  >
    {medianEngagement ?? '--'} mins
  </div>
</div>

              {/* Right: Study Minutes */}
              <div style={{ textAlign: 'right', color: '#333' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: '0.5em',
                    marginBottom: '0.2em'
                  }}
                >
                  {React.createElement(
                    FaRegClock as unknown as React.ComponentType<any>,
                    {
                      style: {
                        color: '#4E9FA2',
                        fontSize: '1.5em',
                        animation: 'spin 2s linear infinite'
                      }
                    }
                  )}
                  <span style={{ fontWeight: 500, fontSize: '1em', color: '#000000' }}>Today's Study</span>
                </div>
                <div
                  style={{
                    fontSize: '2em',
                    fontWeight: 'bold',
                    color: '#4E9FA2'
                  }}
                >
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
              gap: '1.5em'
            }}
          >
            {/* Goal Planner (上半區塊) */}
            <Card
              style={{
                padding: '2.5em 2em',
                borderRadius: '20px',
                backgroundColor: 'white',
                border: '3px solid #e63946',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: '1.2em'
              }}
            >
              <div
                style={{
                  fontSize: '2em',
                  fontWeight: 'bold',
                  color: '#e63946',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4em',
                  marginBottom: '0.6em'
                }}
              >
                {React.createElement(
                  TbTargetArrow as unknown as React.ComponentType<any>,
                  { style: iconStyle }
                )}
                Day Planner
              </div>

              {/* Set Goal + Bonus row */}
              <div
                style={{
                  fontSize: '1.2em',
                  color: '#444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                {/* Goal input */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span
                      style={{
                        fontWeight: 600,
                        color: '#000000',
                        marginRight: '0.5em'
                      }}
                    >
                      Set Study Goal:
                    </span>
                    <input
                      type="number"
                      value={targetMinutes}
                      min={30}
                      disabled={isGoalLocked}
                      onChange={e => {
                        const value = Number(e.target.value);
                        setTargetMinutes(value < 30 ? 30 : value);
                      }}
                      style={{
                        width: '60px',
                        padding: '0.4em',
                        fontSize: '1em',
                        border: '1px solid #ccc',
                        borderRadius: '6px',
                        margin: '0 0.5em'
                      }}
                    />
                    <span style={{ fontWeight: 600, color: '#000000', marginRight: '0.3em' }}>
                      mins
                    </span>
                    {!isGoalLocked ? (
                      <button
                        onClick={() => {
                          localStorage.setItem(
                            todayKey,
                            targetMinutes.toString()
                          );
                          setIsGoalLocked(true);
                          alert('Goal locked for today.');
                        }}
                        style={{
                          padding: '0.2em 0.6em',
                          fontSize: '0.9em',
                          backgroundColor: 'white',
                          color: '#000000',
                          border: 'none',
                          borderRadius: '5px',
                          cursor: 'pointer'
                        }}
                      >
                        ✔
                      </button>
                    ) : (
                      <LockIcon onUnlock={() => setIsGoalLocked(false)} />
                    )}
                  </div>
                </div>

                {/* Bonus
                <div style={{ fontWeight: 'bold', color: '#2a9d8f' }}>
                  Bonus:{' '}
                  <span style={{ fontSize: '1.5em', color: '#e76f5f1' }}>
                    +{bonusPoints}
                  </span>
                </div> */}
              </div>

              {/* Status Bar */}
{(() => {
  const percent = (labTime / 60 / targetMinutes) * 100;
  const clamped = Math.min(percent, 100);

  let barColor = '#e63946'; // <50%
  if (percent >= 70) {
    barColor = '#9BCDD2';
  } else if (percent >= 50) {
    barColor = '#FF8551';
  }
  if (percent >= 100) {
    barColor = '#4E9FA2';
  }

  return (
    <div style={{ marginTop: '0.05em' }}>
      <div
        style={{
          fontSize: '1.2em',
          fontWeight: 600,
          marginBottom: '0.3em',
          color: '#000000'
        }}
      >
        <span>Status:</span>{' '}
        <span
          style={{
            fontWeight: 600,
            color: barColor
          }}
        >
          {goalStatus}
        </span>
      </div>

      {/* Progress Bar */}
      <div
        style={{
          background: '#eee',
          height: '20px',
          borderRadius: '10px',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            width: `${clamped}%`,
            height: '100%',
            background: barColor,
            transition: 'width 0.3s ease'
          }}
        ></div>
      </div>
    </div>
  );
})()}

            </Card>

            {/* League + Last Notebook */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '1.5em',
                width: '100%',
                justifyContent: 'space-between'
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
                    backgroundColor: '#FF8551',
                    border: '2px solid #FF8551',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  {/* Dynamic Animal Badge in Top Left */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '5.3em', // Smaller = closer to center
                      transform: 'translate(-50%, -50%)',
                      textAlign: 'center'
                    }}
                  >
                    {/* badge image */}
  <div>
    {getBadge(consistencyStreak[0]?.value || 0).icon}
  </div>
                     {/* level name */}
                     <div
                      style={{
                        fontSize: '1.3em',
                        fontWeight: 'bold',
                        color: '#000',
                        marginTop: '0.1em'
                      }}
                    >
                      {getLevelNumber(consistencyStreak[0]?.value || 0)}
                      {/* {getLevelNumber(150)} */}
                    </div>
                  </div>

                  {/* Text content in center */}
                  <div
                    style={{
                      marginLeft: '25%',
                      width: '75%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center'
                    }}
                  >
                    <div style={{ marginLeft: '4em', paddingTop: '0.5em' }}>
                      <div
                        style={{
                          fontSize: '1.7em',
                          fontWeight: 600,
                          color: 'white'
                        }}
                      >
                        Rank
                      </div>
                      <div
                        style={{
                          fontSize: '3em',
                          fontWeight: 'bold',
                          color: 'white'
                        }}
                      >
                        Coming soon...
                    </div>
                  </div>
                  </div>
                </Card>
              </div>

              {/* Last Notebook Card */}
              <div style={{ flex: '1 1 250px' }}>
                <Card
                  style={{
                    position: 'relative',
                    height: '110px',
                    padding: '0.8em 1em',
                    borderRadius: '16px',
                    backgroundColor: '#9BCDD2',
                    border: '2px solid #9BCDD2',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  {/* Animated Book Icon */}
                  <AnimatedBookIcon
                    style={{
                      position: 'absolute',
                      top: '0.36em',
                      left: '0.4em',
                      fontSize: '6em'
                    }}
                  >
                    {React.createElement(
                      GiBookCover as unknown as React.ComponentType<any>
                    )}
                  </AnimatedBookIcon>

                  {/* Text content in center */}
                  <div
                    style={{
                      marginLeft: '25%',
                      width: '75%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center'
                    }}
                  >
                    <div style={{ marginLeft: '4em', paddingTop: '0.5em' }}>
                      <div
                        style={{
                          fontSize: '1.7em',
                          fontWeight: 600,
                          color: 'white'
                        }}
                      >
                        Last Opened Notebook
                      </div>

                      <div style={{ height: '0.6em' }} />

                      {/* Notebook name */}
                      <div
                        style={{
                          fontSize: '1.1em',
                          color: 'white'
                        }}
                      >
                        No notebook opened yet
                      </div>
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
            gap: '1.5em'
          }}
        >
          <Card
            style={{
              flex: 1,
              padding: '1.5em 2em',
              borderRadius: '20px',
              border: '1px solid #FFDEDE',
              boxShadow: '0 4px 10px rgba(0, 0, 0, 0.06)',
              backgroundColor: 'white',
              position: 'relative'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '1em'
              }}
            >
              {React.createElement(
                FaChartLine as unknown as React.ComponentType<any>,
                {
                  style: {
                    color: '#FF8551',
                    fontSize: '1.5em',
                    marginRight: '0.5em'
                  }
                }
              )}
              <h3
                style={{
                  fontSize: '1.3em',
                  fontWeight: 550,
                  color: '#000000',
                  margin: 0
                }}
              >
                Consistency Score ({consistencyScore !== null ? consistencyScore.toFixed(1) : '--'}
      <span
        style={{
          fontSize: '0.7em',
          color: '#999',
          marginLeft: '0.2em'
        }}
      >
        /10
      </span>)
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
              border: '1px solid #FFDEDE',
              boxShadow: '0 4px 10px rgba(0, 0, 0, 0.06)',
              backgroundColor: 'white',
              marginTop: '1em'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '0.5em'
              }}
            >
              {React.createElement(
                FaChartLine as unknown as React.ComponentType<any>,
                { size: 22, style: { color: '#4E9FA2', marginRight: '0.5em' } }
              )}
              <h3
                style={{
                  fontSize: '1.3em',
                  fontWeight: 550,
                  color: '#000000',
                  margin: '0.5em'
                }}
              >
                Engagement Time (active time per day)
              </h3>
            </div>
            <div style={{ height: '250px' }}>
              <EngagementStreakChart data={dailyActiveMinutes} />
            </div>
          </Card>
        </section>

        {/* Time Distribution */}
        <section
          style={{
            marginTop: '2em',
            display: 'flex',
            gap: '2em',
            flexWrap: 'wrap'
          }}
        >
          {activebookChartData.length > 0 && (
            <Card
              style={{
                flex: '1 1 45%',
                padding: '1.5em 2em',
                borderRadius: '20px',
                border: '2px solid #FFDEDE',
                boxShadow: '4px 4px 12px rgba(0,0,0,0.08)',
                background: 'white'
              }}
            >
              <h2
                style={{
                  color: '#000000',
                  fontWeight: 550,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5em'
                }}
              >
                {React.createElement(
                  MdBarChart as unknown as React.ComponentType<any>,
                  { style: { color: '#FF8551' } }
                )}
                Time Distribution for Activebook
              </h2>

              {/* Total Time Summary */}
              <p
                style={{
                  marginTop: '-0.5em',
                  marginBottom: '1em',
                  color: '#555',
                  fontSize: '1.3em'
                }}
              >
                Total Active Time:{' '}
                {activebookChartData
                  .reduce((sum, entry) => sum + entry.minutes, 0)
                  .toFixed(1)}{' '}
                min
              </p>

              <WorkSummaryChart data={activebookChartData as any} barColor="#FF8551" />
            </Card>
          )}

          {regularChartData.length > 0 && (
            <Card
              style={{
                flex: '1 1 45%',
                padding: '1.5em 2em',
                borderRadius: '20px',
                border: '2px solid #FFDEDE',
                boxShadow: '4px 4px 12px rgba(0,0,0,0.08)',
                background: 'white'
              }}
            >
              
              <h2
                style={{
                  color: '#000000',
                  fontWeight: 550,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5em'
                }}
              >
                {React.createElement(
                  MdBarChart as unknown as React.ComponentType<any>,
                  { style: { color: '#4E9FA2' } }
                )}
                Time Distribution for Assignments and Others
              </h2>

              {/* Total Time Summary */}
              <p
                style={{
                  marginTop: '-0.5em',
                  marginBottom: '1em',
                  color: '#555',
                  fontSize: '1.3em'
                }}
              >
                Total Active Time:{' '}
                {regularChartData
                  .reduce((sum, entry) => sum + entry.minutes, 0)
                  .toFixed(1)}{' '}
                min
              </p>

              <WorkSummaryChart data={regularChartData as any} barColor="#4E9FA2" />
            </Card>
          )}
        </section>

        {/* Summary of Work Today */}
        <section style={{ marginTop: '1em' }}>
          <Card
            style={{
              padding: '1.5em 2em',
              borderRadius: '20px',
              border: '2px solid #FFDEDE',
              boxShadow: '4px 4px 12px rgba(0,0,0,0.08)',
              background: 'white'
            }}
          >
            <section>
              <h2
                style={{
                  fontSize: '1.5em',
                  fontWeight: 550,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5em',
                  color: '#000000',
                  marginBottom: '1em'
                }}
              >
                {React.createElement(
                  FaClipboardList as unknown as React.ComponentType<any>,
                  { style: { color: '#4E9FA2' } }
                )}
                Summary of Work Today
              </h2>
              {summaries.length === 0 ? (
                <p style={{ color: '#6b7280' }}>No session data yet.</p>
              ) : (
                <ul
                  style={{
                    paddingLeft: '1.2em',
                    fontSize: '0.95em',
                    color: '#374151'
                  }}
                >
                  {summaries.map((summary, idx) => (
                    <li
                      key={idx}
                      style={{
                        marginBottom: '0.4em',
                        lineHeight: '1.6',
                        fontFamily: 'system-ui',
                        padding: '0.2em 0'
                      }}
                    >
                      Worked on{' '}
                      <span style={{ fontWeight: 600 }}>
                        {summary.notebookId}
                      </span>{' '}
                      for{' '}
                      <span style={{ fontWeight: 600, color: '#FF8551' }}>
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
        <section
          style={{ textAlign: 'center', marginTop: '5em', marginBottom: '4em' }}
        >
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
              marginBottom: '0.5em'
            }}
          >
            Personalized Suggestion
          </h2>

          {labTime >= 600 ? (
            <>
              <img
                src="https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExZng3ZHhtbXlwNG9xMTM4eDg3OXFscWh2Y3kwNHRyNDdvYzhiNHo1aSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/OVIqCr0qX7UVA4A6rF/giphy.gif"
                alt="Celebration Meme"
                style={{
                  maxWidth: '300px',
                  borderRadius: '12px',
                  marginTop: '1em'
                }}
              />
              <p
                style={{
                  fontSize: '1.3em',
                  fontWeight: 700,
                  color: '#FF8551',
                  marginTop: '1em'
                }}
              >
                Learning streak unlocked! 🔥
              </p>
              <p style={{ fontSize: '1.1em', color: '#4E9FA2' }}>
                You're crushing it — keep going! 💪
              </p>
            </>
          ) : (
            <>
              <img
                src="https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZmRjb2QzN29iZ2tvaGI0bWx6NGZqMmt3MGNkYnpxdG13ZGIxOHRyYSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/hPPx8yk3Bmqys/giphy.gif"
                alt="Work harder meme"
                style={{
                  maxWidth: '300px',
                  borderRadius: '12px',
                  marginTop: '1em'
                }}
              />
              <p
                style={{
                  fontSize: '1.3em',
                  fontWeight: 700,
                  color: '#4E9FA2',
                  marginTop: '1em'
                }}
              >
                Just getting started... 🐢
              </p>
              <p style={{ fontSize: '1.1em', color: '#000000' }}>
                Try to hit at least 10 minutes today!
              </p>
            </>
          )}
        </section>

        {/* 🔄 Floating Refresh Button */}
<button
  onClick={() => {
    console.log('🔁 Refreshing dashboard...');
    fetchDashboardData();
  }}
  title="Refresh Dashboard"
  style={{
    position: 'fixed',
    bottom: '2em',
    right: '2em',
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    border: 'none',
    backgroundColor: '#FFDEDE',
    color: '#f28b82',
    fontSize: '2.5em',
    cursor: 'pointer',
    boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
    zIndex: 1000,
    transition: 'opacity 0.3s ease, transform 0.2s ease',
    opacity: 0.8
  }}
  onMouseEnter={e => {
    e.currentTarget.style.opacity = '1';
    e.currentTarget.style.transform = 'scale(1.05)';
  }}
  onMouseLeave={e => {
    e.currentTarget.style.opacity = '0.8';
    e.currentTarget.style.transform = 'scale(1)';
  }}
>
  ⟳
</button>

      </div>
    </>
  );
};