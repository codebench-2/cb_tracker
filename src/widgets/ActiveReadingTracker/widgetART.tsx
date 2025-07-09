// src/widgets/ActiveReadingTracker/widgetART.tsx
import React, { useEffect, useState } from 'react';
import { visitLogs, copyPasteLogs, CopyPasteLog, cellVisitLogs } from '../../index';

export const ReadingTrackerWidget = () => {
  const [copyPaste, setCopyPaste] = useState<CopyPasteLog[]>([...copyPasteLogs]);
  const [labActiveTime, setLabActiveTime] = useState<number>(0);
  const [labFocusSwitches, setLabFocusSwitches] = useState<number>(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCopyPaste([...copyPasteLogs]);

      // @ts-ignore — These are global vars defined in index.tsx
      setLabActiveTime(window.__labActiveTime || 0);
      // @ts-ignore
      setLabFocusSwitches(window.__labFocusCount || 0);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: '1em', fontSize: '0.85em' }}>
      <h3>📖 Reading Tracker</h3>

      <h4 style={{ marginTop: '1em' }}>🧠 JupyterLab Window Usage</h4>
      <ul>
        <li>🕒 Total active time: <strong>{Math.floor(labActiveTime / 1000)}s</strong></li>
        <li>🔁 Window switches: <strong>{labFocusSwitches}</strong></li>
      </ul>

      <h4 style={{ marginTop: '1em' }}>📋 Copy/Paste Activity</h4>
      {copyPaste.length === 0 ? (
        <p>No copy/paste activity yet.</p>
      ) : (
        <div>
          <ul>
            <li>📥 Total copies: <strong>{copyPaste.filter(log => log.type === 'copy').length}</strong></li>
            <li>📤 Total pastes: <strong>{copyPaste.filter(log => log.type === 'paste').length}</strong></li>
            <li>🔄 Internal pastes: <strong>{copyPaste.filter(log => log.type === 'paste' && log.sourceType === 'internal').length}</strong></li>
            <li>🌐 External pastes: <strong>{copyPaste.filter(log => log.type === 'paste' && log.sourceType === 'external').length}</strong></li>
          </ul>
          
          <div style={{ marginTop: '0.5em', fontSize: '0.8em' }}>
            <strong>Recent Activity:</strong>
            <div style={{ maxHeight: '150px', overflowY: 'auto', paddingRight: '4px', marginTop: '4px' }}>
              <ul style={{ paddingLeft: '1em', margin: 0 }}>
                {copyPaste.slice(-10).reverse().map((log, i) => (
                  <li key={i} style={{ marginBottom: '0.5em', fontSize: '1em' }}>
                    <span style={{ 
                      background: log.type === 'copy' ? '#e3f2fd' : '#f3e5f5', 
                      padding: '1px 4px', 
                      borderRadius: '3px',
                      marginRight: '4px'
                    }}>
                      {log.type === 'copy' ? '📥' : '📤'} {log.type}
                    </span>
                    {log.contentLength} chars ({log.contentType})
                    {log.type === 'paste' && (
                      <span style={{ color: log.sourceType === 'internal' ? '#4caf50' : '#ff9800', marginLeft: '4px' }}>
                        [{log.sourceType}]
                      </span>
                    )}
                    <br />
                    <span style={{ color: '#666', fontSize: '0.9em' }}>
                      {new Date(log.timestamp).toLocaleTimeString()} in {log.context.notebookId}
                    </span>
                    {log.contentPreview && (
                      <div style={{ 
                        marginTop: '2px', 
                        padding: '2px 4px', 
                        background: '#f5f5f5', 
                        borderRadius: '2px',
                        fontFamily: 'monospace',
                        fontSize: '0.9em',
                        color: '#555',
                        fontStyle: 'italic'
                      }}>
                        "{log.contentPreview}"
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <section style={{ marginTop: '1em' }}>
        <h3>📄 Notebook & Page Sessions</h3>
        {visitLogs.length === 0 ? (
          <p>No page session data yet.</p>
        ) : (
          <div style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: '4px', marginTop: '4px' }}>
            <ul style={{ paddingLeft: '1em', fontSize: '0.95em' }}>
              {[...visitLogs].reverse().map((log, idx) => {
                const notebookId = log.pageId;

                // Group cell logs for this notebook
                const cellsForNotebook = cellVisitLogs
                  .filter(cellLog => cellLog.notebookId === notebookId)
                  .reduce((acc, cellLog) => {
                    if (!acc[cellLog.cellId]) {
                      acc[cellLog.cellId] = 0;
                    }
                    acc[cellLog.cellId] += cellLog.activeDuration;
                    return acc;
                  }, {} as { [cellId: string]: number });

                return (
                  <li key={idx} style={{ marginBottom: '0.5em' }}>
                    <strong>📘 {notebookId}</strong><br />
                    ⏱ Active: {log.activeDuration}s<br />
                    📅 {new Date(log.enter).toLocaleTimeString()} → {new Date(log.leave).toLocaleTimeString()}

                    {/* Cell logs */}
                    {Object.keys(cellsForNotebook).length > 0 && (
                      <ul style={{ marginTop: '0.3em', paddingLeft: '1em', fontSize: '0.9em' }}>
                        {Object.entries(cellsForNotebook).map(([cellId, duration], cellIdx) => (
                          <li key={cellIdx}>
                            🗂️ Cell ID: <code>{cellId.slice(0, 8)}</code> → {duration}s
                          </li>
                        ))}
                      </ul>
                   )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
};