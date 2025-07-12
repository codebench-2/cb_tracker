import React from 'react';
import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
// import { ReactWidget } from '@jupyterlab/apputils';
// import { ReadingTrackerWidget } from './widgets/ActiveReadingTracker/widgetART';
import { PageConfig } from '@jupyterlab/coreutils';
import { IMainMenu } from '@jupyterlab/mainmenu';
import { NotebookPanel } from '@jupyterlab/notebook';
import { ToolbarAPT } from './widgets/AssignmentProgressTracker/ToolbarAPT';
import { render } from 'react-dom';
import { Widget } from '@lumino/widgets';
import myDashboardPlugin from './myDashboardPlugin';
import axios from 'axios';
import { NET_ID, COURSE_ID } from './common/config';
import { MyDashboardWidget } from './widgets/MyDashboard/myDashboardPlugin';
import { dashboardIcon } from './common/icons';
import { ICommandPalette } from '@jupyterlab/apputils';

export async function uploadLogsToCodeBench(payload: { items: any[] }) {
  console.log('🚀 Uploading logs to CodeBench via axios:', payload);

  try {
    type CodeBenchResponse = {
      success: boolean;
      error?: any;
      data?: {
        total_items?: number;
        successful_items?: number;
        failed_items?: number;
        results?: Array<{
          index: number;
          success: boolean;
          data?: any;
          error?: string;
        }>;
      };
      [key: string]: any;
    };

    const response = await axios.post<CodeBenchResponse>(
      'http://localhost:8888/cb-server/logs/batch',
      payload,
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );

    console.log('✅ CodeBench response:', response.data);

    if (!response.data.success) {
      console.error('❌ CodeBench reported failure:', response.data.error);
      return { success: false, error: response.data.error };
    }

    // Handle partial success in batch operations
    if (
      response.data.data &&
      response.data.data.failed_items &&
      response.data.data.failed_items > 0
    ) {
      console.warn(
        `⚠️ Partial success: ${response.data.data.successful_items} succeeded, ${response.data.data.failed_items} failed`
      );

      // Process failed items to retry with notebook creation
      if (response.data.data.results) {
        const failedItems = response.data.data.results.filter(
          result => !result.success
        );
        await handleFailedLogItems(failedItems, payload.items);
      }
    }

    return { success: true, data: response.data.data };
  } catch (error) {
    console.error('❌ Upload to CodeBench failed:', error);
    if (error && typeof error === 'object' && 'isAxiosError' in error) {
      const axiosError = error as any;
      console.error(
        'Axios error details:',
        axiosError.response?.data || axiosError.message
      );

      // If it's a 404 error, it might be due to missing notebook
      if (axiosError.response?.status === 404) {
        console.log(
          '🔄 404 error detected, attempting to create missing notebooks and retry...'
        );
        await handleMissingNotebooks(payload.items);
      }
    }
    return { success: false, error };
  }
}

/**
 * Handle failed log items by checking if they failed due to missing notebooks
 */
async function handleFailedLogItems(
  failedResults: Array<{ index: number; success: boolean; error?: string }>,
  originalItems: any[]
) {
  console.log('🔄 Processing failed log items...');

  for (const failedResult of failedResults) {
    const originalItem = originalItems[failedResult.index];
    const error = failedResult.error || '';

    // Check if error is related to missing notebook
    if (
      error.includes('notebook') ||
      error.includes('404') ||
      error.includes('not found')
    ) {
      console.log(
        `🔄 Attempting to create missing notebook for log item ${failedResult.index}`
      );

      // Extract notebook info from the log item
      const notebookInfo = extractNotebookInfoFromLog(originalItem);
      if (notebookInfo) {
        try {
          const notebookResult = await uploadNotebookToCodeBench(notebookInfo);
          if (notebookResult.success) {
            console.log(
              `✅ Successfully created notebook: ${notebookInfo.notebook_id}`
            );

            // Retry the specific log item
            await retryIndividualLog(originalItem);
          } else {
            console.error(
              `❌ Failed to create notebook: ${notebookInfo.notebook_id}`,
              notebookResult.error
            );
          }
        } catch (notebookError) {
          console.error(
            `❌ Failed to create notebook: ${notebookInfo.notebook_id}`,
            notebookError
          );
        }
      }
    }
  }
}

/**
 * Handle missing notebooks by creating them and retrying the upload
 */
async function handleMissingNotebooks(items: any[]) {
  console.log('🔄 Creating missing notebooks and retrying upload...');

  // Extract unique notebooks from log items
  const notebooksToCreate = new Map<string, any>();

  items.forEach(item => {
    if (item.log_info && item.log_info.notebook_id) {
      const notebookId = item.log_info.notebook_id;
      if (!notebooksToCreate.has(notebookId)) {
        const notebookInfo = extractNotebookInfoFromLog(item);
        if (notebookInfo) {
          notebooksToCreate.set(notebookId, notebookInfo);
        }
      }
    }
  });

  // Create all missing notebooks
  for (const [notebookId, notebookInfo] of notebooksToCreate) {
    try {
      const notebookResult = await uploadNotebookToCodeBench(notebookInfo);
      if (notebookResult.success) {
        console.log(`✅ Created notebook: ${notebookId}`);
      } else {
        console.error(
          `❌ Failed to create notebook: ${notebookId}`,
          notebookResult.error
        );
      }
    } catch (error) {
      console.error(`❌ Failed to create notebook: ${notebookId}`, error);
    }
  }

  // Retry the original upload
  console.log('🔄 Retrying original log upload...');
  try {
    const retryResponse = await axios.post(
      'http://localhost:8888/cb-server/logs/batch',
      { items },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
    console.log('✅ Retry successful:', retryResponse.data);
  } catch (retryError) {
    console.error('❌ Retry failed:', retryError);
  }
}

/**
 * Extract notebook information from a log item
 */
function extractNotebookInfoFromLog(logItem: any) {
  if (!logItem.log_info || !logItem.log_info.notebook_id) {
    return null;
  }

  const notebookId = logItem.log_info.notebook_id;
  const notebookName = notebookId.split('/').pop() || notebookId;

  return {
    notebook_id: notebookId,
    net_id: logItem.net_id,
    course_id: logItem.course_id,
    name: notebookName,
    type: 'regular' as 'activebook' | 'regular', // Default to regular, could be enhanced to detect activebook
    topics: [],
    last_opened: new Date().toISOString()
  };
}

/**
 * Retry uploading a single log item
 */
async function retryIndividualLog(logItem: any) {
  try {
    const response = await axios.post(
      'http://localhost:8888/cb-server/logs',
      logItem,
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
    console.log('✅ Individual log retry successful:', response.data);
  } catch (error) {
    console.error('❌ Individual log retry failed:', error);
  }
}

/**
 * Visit log structure
 */
export type PageVisitLog = {
  pageId: string;
  enter: number;
  leave: number;
  activeDuration: number; // Track actual active time
};
export const visitLogs: PageVisitLog[] = [];

/**
 * Copy/Paste log structure
 */
export type CopyPasteLog = {
  type: 'copy' | 'paste';
  timestamp: number;
  contentLength: number;
  contentType: 'code' | 'markdown' | 'text' | 'unknown';
  contentHash: string;
  content: string; // The actual copied/pasted text content
  contentPreview: string; // Truncated preview for display
  context: {
    notebookId: string;
    cellId?: string;
    cellType?: 'code' | 'markdown';
  };
  sourceType: 'internal' | 'external' | 'unknown';
};
export const copyPasteLogs: CopyPasteLog[] = [];

/**
 * Cell visit log structure
 */
export type CellVisitLog = {
  notebookId: string;
  cellId: string;
  cellIndex: number;
  enter: number;
  leave: number;
  activeDuration: number; // Track actual active time per cell
};
export const cellVisitLogs: CellVisitLog[] = [];

// Helper function to create content hash
async function createContentHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .substring(0, 8);
}

// Copy/Paste alert
let lastCopyPasteAlert = 0;
const COPY_PASTE_ALERT_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Content sanitization function
function sanitizeContent(content: string): string {
  // Remove potentially sensitive patterns
  const sensitivePatterns = [
    /password\s*[:=]\s*[^\s\n]+/gi,
    /api[_-]?key\s*[:=]\s*[^\s\n]+/gi,
    /token\s*[:=]\s*[^\s\n]+/gi,
    /secret\s*[:=]\s*[^\s\n]+/gi,
    /auth\s*[:=]\s*[^\s\n]+/gi,
    /Bearer\s+[^\s\n]+/gi,
    /[a-zA-Z0-9]{32,}/g // Long strings that might be hashes/tokens
  ];

  let sanitized = content;
  sensitivePatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  });

  return sanitized;
}

// Content limiting function
function limitContent(content: string, maxLength: number = 1000): string {
  if (content.length <= maxLength) {
    return content;
  }
  return content.substring(0, maxLength) + '... [TRUNCATED]';
}

// Create content preview
function createPreview(content: string, maxLength: number = 100): string {
  const sanitized = sanitizeContent(content);
  const limited = limitContent(sanitized, maxLength);
  return limited.replace(/\n/g, ' ').trim();
}

// Export functions to access global window variables
export const windowActiveSeconds = () =>
  Math.floor(((window as any).__labActiveTime || 0) / 1000);
export const windowFocusCount = () => (window as any).__labFocusCount || 0;
export const completedCellCount = () =>
  (window as any).__completedCells?.size || 0;
export const copyPasteCount = () => copyPasteLogs.length;
export const totalTasks = 10;

export async function uploadNotebookToCodeBench(notebook: {
  notebook_id: string;
  net_id: string;
  course_id: string;
  name: string;
  type: 'activebook' | 'regular';
  topics: string[];
  last_opened: string;
}) {
  console.log('🚀 Uploading notebook info to CodeBench:', notebook);
  try {
    const response = await axios.post(
      'http://localhost:8888/cb-server/notebooks',
      notebook,
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
    console.log('✅ Notebook upload response:', response.data);
    if (!response.data.success) {
      console.error(
        '❌ CodeBench reported notebook upload failure:',
        response.data.error
      );
      return { success: false, error: response.data.error };
    }
    return { success: true, data: response.data.data };
  } catch (error) {
    console.error('❌ Notebook upload failed:', error);
    if (error && typeof error === 'object' && 'isAxiosError' in error) {
      const axiosError = error as any;
      console.error(
        'Axios error details:',
        axiosError.response?.data || axiosError.message
      );

      // If it's a 409 conflict, the notebook already exists, which is fine
      if (axiosError.response?.status === 409) {
        console.log('ℹ️ Notebook already exists:', notebook.notebook_id);
        return { success: true, data: null };
      }
    }
    return { success: false, error };
  }
}

/**
 * Plugin definition
 */
const readingTrackerPlugin: JupyterFrontEndPlugin<void> = {
  id: 'cb-tracker:plugin',
  description: 'Tracks scroll + reading time in ActiveBook and Notebooks',
  autoStart: true,
  optional: [IMainMenu, ICommandPalette],
  activate: (app: JupyterFrontEnd, mainMenu?: IMainMenu, palette?: ICommandPalette) => {
    console.log('✅ cb-tracker plugin activated');

    // Mount sidebar widget
    const widget = ReactWidget.create(<ReadingTrackerWidget />);
    widget.id = 'cb-tracker-widget';
    widget.title.label = 'Reading Tracker';
    widget.title.closable = true;
    app.shell.add(widget, 'left');

        // Create Dashboard widget instance
    const dashboardWidget = new MyDashboardWidget();
    dashboardWidget.id = 'my-dashboard-widget';
    dashboardWidget.title.label = 'My Dashboard';
    dashboardWidget.title.icon = dashboardIcon;
    dashboardWidget.title.caption = 'My Dashboard';
    dashboardWidget.title.closable = true;

    // Add dashboard command
    const dashboardCommand = 'my-dashboard:open';
    app.commands.addCommand(dashboardCommand, {
      label: 'My Dashboard',
      icon: dashboardIcon,
      execute: () => {
        if (!dashboardWidget.isAttached) {
          app.shell.add(dashboardWidget, 'main');
        }
        app.shell.activateById(dashboardWidget.id);
      }
    });

    // Add to command palette
    if (palette) {
      palette.addItem({
        command: dashboardCommand,
        category: 'Tools'
      });
    }

    // Note: Dashboard will only be added to main area when the command is executed
    // No need to add it to left sidebar since it should always open in main area

    // Note: The launcher addition is handled by myDashboardPlugin.tsx
    // which will use the command we just created above

    // 🪄 Add Assignment Progress Tracker to each notebook's top bar
    app.docRegistry.addWidgetExtension('Notebook', {
      createNew: (panel: NotebookPanel) => {
        const button = document.createElement('div');
        button.style.marginLeft = '8px';
        const widget = new Widget({ node: button });

        const renderAPT = () => {
          const notebook = panel.content;
          const codeCells = notebook.widgets.filter(
            cell => cell.model.type === 'code'
          );
          const totalCells = codeCells.length;

          const activeCell = notebook.activeCell;
          let current = 0;

          if (activeCell && activeCell.model.type === 'code') {
            current = codeCells.findIndex(cell => cell === activeCell) + 1;
          }

          render(
            <ToolbarAPT current={current} total={totalCells || 1} />,
            button
          );
        };

        // Insert into notebook toolbar
        panel.toolbar.insertItem(10, 'AssignmentProgress', widget);

        // Render on load, cell change, and active cell change
        panel.context.ready.then(() => {
          renderAPT();
          if (panel.content.model) {
            panel.content.model.cells.changed.connect(renderAPT);
          }
          panel.content.activeCellChanged.connect(renderAPT);
        });

        // === Per-cell active time tracking ===
        let currentCellId: string | null = null;
        let currentCellIndex: number | null = null;
        let cellEnterTime: number | null = null;
        let lastCellActivityTime: number | null = null;

        const notebookId = panel.context.path;

        const logCurrentCell = () => {
          if (currentCellId && cellEnterTime && lastCellActivityTime) {
            const activeDuration = Math.floor(
              (lastCellActivityTime - cellEnterTime) / 1000
            );

            // Store in local array for UI display and batch upload later
            cellVisitLogs.push({
              notebookId,
              cellId: currentCellId,
              cellIndex: currentCellIndex ?? -1,
              enter: cellEnterTime,
              leave: lastCellActivityTime,
              activeDuration
            });

            console.log(
              `[ReadingTracker] ⌛ Cell ${currentCellIndex} (${currentCellId}) in ${notebookId} tracked for ${activeDuration}s (stored for batch upload)`
            );
          }
        };

        const trackActiveCell = () => {
          const activeCell = panel.content.activeCell;
          const now = Date.now();

          // Log previous cell before switching
          if (cellEnterTime !== null) {
            lastCellActivityTime = now;
            logCurrentCell();
          }

          // Start tracking new cell
          if (activeCell) {
            currentCellId = activeCell.model.id;
            currentCellIndex = panel.content.widgets.findIndex(
              cell => cell === activeCell
            );
            cellEnterTime = now;
            lastCellActivityTime = now;
            console.log(
              `[ReadingTracker] 🖊️ Entered Cell ${currentCellIndex} (${currentCellId}) in ${notebookId}`
            );
          } else {
            currentCellId = null;
            currentCellIndex = null;
            cellEnterTime = null;
            lastCellActivityTime = null;
          }
        };

        // Attach the tracker to active cell changes
        panel.content.activeCellChanged.connect(trackActiveCell);

        // Ensure final logging when notebook is closed
        panel.disposed.connect(() => {
          if (cellEnterTime !== null) {
            lastCellActivityTime = Date.now();
            logCurrentCell();
          }
        });

        // === Cell Timer Display ===
        const updateCellTimers = () => {
          panel.content.widgets.forEach((cell, idx) => {
            let timerNode = cell.node.querySelector(
              '.cell-timer'
            ) as HTMLDivElement;
            if (!timerNode) {
              timerNode = document.createElement('div') as HTMLDivElement;
              timerNode.className = 'cell-timer';
              timerNode.style.position = 'absolute';
              timerNode.style.top = '0px';
              timerNode.style.left = '35px';
              timerNode.style.fontSize = '0.8em';
              timerNode.style.color = '#666';
              timerNode.style.background = 'rgba(255,255,255,0)';
              timerNode.style.padding = '2px 4px';
              timerNode.style.borderRadius = '4px';
              timerNode.style.zIndex = '10';
              cell.node.style.position = 'relative';
              cell.node.appendChild(timerNode);
            }

            const cellId = cell.model.id;
            const cellLogs = cellVisitLogs.filter(log => log.cellId === cellId);
            let totalTime = cellLogs.reduce(
              (sum, log) => sum + log.activeDuration,
              0
            );

            if (currentCellId === cellId && cellEnterTime) {
              totalTime += Math.floor((Date.now() - cellEnterTime) / 1000);
            }

            timerNode.textContent = `🕒 ${totalTime}s`;
          });
        };

        // Update every 1 second
        setInterval(updateCellTimers, 1000);

        panel.context.ready.then(async () => {
          const notebookPath = panel.context.path; // full file path
          const net_id = NET_ID;

          let course_id = COURSE_ID;
          const pathParts = notebookPath.split('/');

          if (pathParts.length >= 2) {
            course_id = pathParts[0]; // correct when inside course folder
          } else {
            console.warn(
              `🪐 Notebook is in root, cannot determine course_id reliably for: ${notebookPath}`
            );
          }

          const notebookName = notebookPath.split('/').pop() || notebookPath;
          const name = notebookName;
          const last_opened = new Date().toISOString();

          // Determine notebook type
          let type: 'activebook' | 'regular' = 'regular';
          try {
            const model = panel.content.model;
            const metadata = model?.metadata ? (model.metadata as any) : {};
            if (String(metadata?.activebook).toLowerCase() === 'true') {
              type = 'activebook';
            }
          } catch (error) {
            console.warn(
              'Could not read notebook metadata for type detection:',
              error
            );
          }

          const notebookInfo = {
            notebook_id: notebookPath,
            net_id,
            course_id,
            name,
            type,
            topics: [],
            last_opened
          };

          const notebookResult = await uploadNotebookToCodeBench(notebookInfo);
          if (!notebookResult.success) {
            console.error(
              '❌ Failed to upload notebook:',
              notebookResult.error
            );
          }
        });

        return widget;
      }
    });

    function saveLogsSync(logs: PageVisitLog[]) {
      const filename = 'cb-tracker-logs.json';
      const url = PageConfig.getBaseUrl() + 'api/contents/' + filename;
      const xhr = new XMLHttpRequest();

      const allData = {
        pageVisits: logs,
        copyPasteActivity: copyPasteLogs,
        metadata: {
          timestamp: Date.now(),
          totalCopyPasteEvents: copyPasteLogs.length
        }
      };

      try {
        xhr.open('PUT', url, false);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader(
          'Authorization',
          `Token ${PageConfig.getOption('token')}`
        );

        xhr.send(
          JSON.stringify({
            type: 'file',
            format: 'text',
            content: JSON.stringify(allData, null, 2)
          })
        );

        if (xhr.status >= 200 && xhr.status < 300) {
          return true;
        } else {
          console.error(
            `Save failed: ${xhr.status} ${xhr.statusText}`,
            xhr.responseText
          );
          return false;
        }
      } catch (error) {
        console.error('XHR error:', error);
        return false;
      }
    }

    function saveAllLogsReadable() {
      const filename = 'cb-tracker-logs-human-readable.json';
      const url = PageConfig.getBaseUrl() + 'api/contents/' + filename;
      const xhr = new XMLHttpRequest();

      // Format visitLogs with readable times
      const readablePageVisits = visitLogs.map(log => ({
        pageId: log.pageId,
        enter: new Date(log.enter).toLocaleString(),
        leave: new Date(log.leave).toLocaleString(),
        activeDuration: log.activeDuration
      }));

      // Format cellVisitLogs with readable times
      const readableCellVisits = cellVisitLogs.map(log => ({
        notebookId: log.notebookId,
        cellId: log.cellId,
        cellIndex: log.cellIndex,
        enter: new Date(log.enter).toLocaleString(),
        leave: new Date(log.leave).toLocaleString(),
        activeDuration: log.activeDuration
      }));

      const allData = {
        pageVisits: readablePageVisits,
        cellVisits: readableCellVisits,
        copyPasteActivity: copyPasteLogs,
        metadata: {
          timestamp: new Date().toLocaleString(),
          totalCopyPasteEvents: copyPasteLogs.length
        }
      };

      try {
        xhr.open('PUT', url, false);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader(
          'Authorization',
          `Token ${PageConfig.getOption('token')}`
        );

        xhr.send(
          JSON.stringify({
            type: 'file',
            format: 'text',
            content: JSON.stringify(allData, null, 2)
          })
        );

        if (xhr.status >= 200 && xhr.status < 300) {
          console.log(
            '✅ Saved readable logs to cb-tracker-logs-human-readable.json'
          );
          alert(
            '✅ Saved readable logs to cb-tracker-logs-human-readable.json'
          );
        } else {
          console.error(
            `Save failed: ${xhr.status} ${xhr.statusText}`,
            xhr.responseText
          );
          alert('❌ Save failed. Check console.');
        }
      } catch (error) {
        console.error('XHR error:', error);
        alert('❌ Save failed. Check console.');
      }
    }

    function saveCopyPasteLogsSync() {
      const filename = 'copy-paste-logs.json';
      const url = PageConfig.getBaseUrl() + 'api/contents/' + filename;
      const xhr = new XMLHttpRequest();

      const copyPasteData = {
        copyPasteActivity: copyPasteLogs,
        metadata: {
          timestamp: Date.now(),
          totalEvents: copyPasteLogs.length,
          totalCopies: copyPasteLogs.filter(log => log.type === 'copy').length,
          totalPastes: copyPasteLogs.filter(log => log.type === 'paste').length,
          internalPastes: copyPasteLogs.filter(
            log => log.type === 'paste' && log.sourceType === 'internal'
          ).length,
          externalPastes: copyPasteLogs.filter(
            log => log.type === 'paste' && log.sourceType === 'external'
          ).length
        }
      };

      try {
        xhr.open('PUT', url, false);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader(
          'Authorization',
          `Token ${PageConfig.getOption('token')}`
        );

        xhr.send(
          JSON.stringify({
            type: 'file',
            format: 'text',
            content: JSON.stringify(copyPasteData, null, 2)
          })
        );

        if (xhr.status >= 200 && xhr.status < 300) {
          return true;
        } else {
          console.error(
            `Copy/Paste save failed: ${xhr.status} ${xhr.statusText}`,
            xhr.responseText
          );
          return false;
        }
      } catch (error) {
        console.error('Copy/Paste XHR error:', error);
        return false;
      }
    }

    app.commands.addCommand('cb-tracker:save-manual', {
      label: 'Test Save Logs',
      caption: 'Manually save reading tracker logs',
      isEnabled: () => true,
      execute: () => {
        const success = saveLogsSync(visitLogs);
        if (success) {
          alert('Reading logs saved to cb-tracker-logs.json!');
        } else {
          alert('Save failed. Check browser console for details.');
        }
      }
    });

    app.commands.addCommand('cb-tracker:save-copypaste', {
      label: 'Save Copy/Paste Logs',
      caption: 'Save copy/paste logs to copy-paste-logs.json',
      isEnabled: () => true,
      execute: () => {
        const success = saveCopyPasteLogsSync();
        if (success) {
          alert(
            `Copy/Paste logs saved to copy-paste-logs.json!\n\nTotal events: ${copyPasteLogs.length}\nFile location: copy-paste-logs.json`
          );
        } else {
          alert('Save failed. Check browser console for details.');
        }
      }
    });

    app.commands.addCommand('cb-tracker:save-readable', {
      label: 'Save Human-Readable Logs',
      caption:
        'Save logs with readable timestamps to cb-tracker-logs-human-readable.json',
      isEnabled: () => true,
      execute: () => {
        saveAllLogsReadable();
      }
    });

    app.commands.addCommand('cb-tracker:show-copypaste', {
      label: 'View Copy/Paste Logs',
      caption: 'View copy/paste activity in console',
      isEnabled: () => true,
      execute: () => {
        console.log('📋 Copy/Paste Activity Summary:');
        console.log(`Total events: ${copyPasteLogs.length}`);
        console.log(
          `Copies: ${copyPasteLogs.filter(log => log.type === 'copy').length}`
        );
        console.log(
          `Pastes: ${copyPasteLogs.filter(log => log.type === 'paste').length}`
        );
        console.log(
          `Internal pastes: ${copyPasteLogs.filter(log => log.type === 'paste' && log.sourceType === 'internal').length}`
        );
        console.log(
          `External pastes: ${copyPasteLogs.filter(log => log.type === 'paste' && log.sourceType === 'external').length}`
        );
        console.log('Full logs with content:', copyPasteLogs);

        // Show content previews in alert
        const recentEvents = copyPasteLogs.slice(-5);
        const previews = recentEvents
          .map(
            log =>
              `${log.type}: "${log.contentPreview}" (${log.contentLength} chars)`
          )
          .join('\n');

        alert(
          `Copy/Paste Summary:\n\nTotal events: ${copyPasteLogs.length}\nCopies: ${copyPasteLogs.filter(log => log.type === 'copy').length}\nPastes: ${copyPasteLogs.filter(log => log.type === 'paste').length}\n\nRecent activity:\n${previews}\n\nCheck browser console for full logs with complete content.`
        );
      }
    });

    // Add to File menu if mainMenu is available
    if (mainMenu) {
      mainMenu.fileMenu.addGroup(
        [
          { command: 'cb-tracker:save-manual' },
          { command: 'cb-tracker:save-readable' },
          { command: 'cb-tracker:save-copypaste' },
          { command: 'cb-tracker:show-copypaste' }
        ],
        100
      );
    }

    (window as any).saveReadingLogs = () => {
      console.log('📥 Manually saving visit logs...');
      saveLogsSync(visitLogs);
    };

    // Copy/Paste tracking
    let lastCopiedContent = '';

    const getCurrentContext = () => {
      const currentWidget = app.shell.currentWidget;
      if (!currentWidget) {
        return {
          notebookId: 'unknown',
          cellId: undefined,
          cellType: undefined
        };
      }

      return {
        notebookId: currentWidget.title.label || currentWidget.id || 'unknown',
        cellId: undefined, // TODO: Could be enhanced to detect specific cell
        cellType: undefined // TODO: Could be enhanced to detect cell type
      };
    };

    const detectContentType = (
      content: string
    ): 'code' | 'markdown' | 'text' | 'unknown' => {
      if (
        content.includes('def ') ||
        content.includes('import ') ||
        content.includes('print(')
      ) {
        return 'code';
      }
      if (
        content.includes('# ') ||
        content.includes('## ') ||
        content.includes('**')
      ) {
        return 'markdown';
      }
      return 'text';
    };

    document.addEventListener('copy', async event => {
      try {
        const now = Date.now();
        if (now - lastCopyPasteAlert > COPY_PASTE_ALERT_INTERVAL) {
          alert(
            '📋 Heads up: Your copy/paste activity is being recorded for your learning analytics.'
          );
          lastCopyPasteAlert = now;
        }

        const selection = window.getSelection();
        const copiedText = selection?.toString() || '';

        if (copiedText.length > 0) {
          lastCopiedContent = copiedText;
          const contentHash = await createContentHash(copiedText);
          const context = getCurrentContext();
          const sanitizedContent = sanitizeContent(copiedText);
          const limitedContent = limitContent(sanitizedContent);
          const preview = createPreview(copiedText);

          const logEntry: CopyPasteLog = {
            type: 'copy',
            timestamp: Date.now(),
            contentLength: copiedText.length,
            contentType: detectContentType(copiedText),
            contentHash,
            content: limitedContent,
            contentPreview: preview,
            context,
            sourceType: 'internal' // Always internal for copy events
          };

          copyPasteLogs.push(logEntry);
          console.log(
            `[ReadingTracker] Copy: ${copiedText.length} chars from ${context.notebookId}`,
            { preview }
          );

          // Upload copy log immediately when copy action is detected
          await logManager.addLog(
            {
              net_id: NET_ID,
              course_id: COURSE_ID,
              log_info: {
                type: 'copy_paste',
                notebook_id: context.notebookId,
                cell_id: context.cellId,
                pasted_content: limitedContent
              }
            },
            true
          ); // Immediate upload when copy action is detected

          // Automatically save to file system
          saveCopyPasteLogsSync();
        }
      } catch (error) {
        console.error('Copy tracking error:', error);
      }
    });

    document.addEventListener('paste', async event => {
      try {
        const now = Date.now();
        if (now - lastCopyPasteAlert > COPY_PASTE_ALERT_INTERVAL) {
          alert(
            '📋 Heads up: Your copy/paste activity is being recorded for your learning analytics.'
          );
          lastCopyPasteAlert = now;
        }

        const clipboardData = event.clipboardData?.getData('text') || '';

        if (clipboardData.length > 0) {
          const contentHash = await createContentHash(clipboardData);
          const context = getCurrentContext();
          const isInternal = clipboardData === lastCopiedContent;
          const sanitizedContent = sanitizeContent(clipboardData);
          const limitedContent = limitContent(sanitizedContent);
          const preview = createPreview(clipboardData);

          const logEntry: CopyPasteLog = {
            type: 'paste',
            timestamp: Date.now(),
            contentLength: clipboardData.length,
            contentType: detectContentType(clipboardData),
            contentHash,
            content: limitedContent,
            contentPreview: preview,
            context,
            sourceType: isInternal ? 'internal' : 'external'
          };

          copyPasteLogs.push(logEntry);
          console.log(
            `[ReadingTracker] Paste: ${clipboardData.length} chars to ${context.notebookId} (${isInternal ? 'internal' : 'external'})`,
            { preview }
          );

          // Upload paste log immediately when paste action is detected
          await logManager.addLog(
            {
              net_id: NET_ID,
              course_id: COURSE_ID,
              log_info: {
                type: 'copy_paste',
                notebook_id: context.notebookId,
                cell_id: context.cellId,
                pasted_content: limitedContent
              }
            },
            true
          ); // Immediate upload when paste action is detected

          // Automatically save to file system
          saveCopyPasteLogsSync();
        }
      } catch (error) {
        console.error('Paste tracking error:', error);
      }
    });

    // Page visit tracking
    let currentPageLabel: string | null = null;
    let currentPageEnterTime: number | null = null;
    let lastPageActivityTime: number | null = null;

    if (app.shell.currentChanged) {
      app.shell.currentChanged.connect(async (_, args) => {
        const now = Date.now();

        if (currentPageLabel && currentPageEnterTime && lastPageActivityTime) {
          const activeDuration = Math.floor(
            (lastPageActivityTime - currentPageEnterTime) / 1000
          );

          // Store in local array for UI display
          visitLogs.push({
            pageId: currentPageLabel,
            enter: currentPageEnterTime,
            leave: lastPageActivityTime,
            activeDuration
          });

          // Upload notebook log immediately when user switches notebooks
          if (activeDuration > 0) {
            await logManager.addLog(
              {
                net_id: NET_ID,
                course_id: COURSE_ID,
                log_info: {
                  type: 'notebook',
                  notebook_id: currentPageLabel,
                  duration: activeDuration
                }
              },
              true
            ); // Immediate upload when user switches notebooks
          }

          // Upload cell logs in batches when notebook switches
          const notebookCellLogs = cellVisitLogs.filter(
            log => log.notebookId === currentPageLabel
          );
          if (notebookCellLogs.length > 0) {
            console.log(
              `📦 Uploading ${notebookCellLogs.length} cell logs for notebook: ${currentPageLabel}`
            );
            for (const cellLog of notebookCellLogs) {
              if (cellLog.activeDuration > 0) {
                await logManager.addLog(
                  {
                    net_id: NET_ID,
                    course_id: COURSE_ID,
                    log_info: {
                      type: 'cell',
                      notebook_id: cellLog.notebookId,
                      cell_id: cellLog.cellId,
                      duration: cellLog.activeDuration
                    }
                  },
                  false
                ); // Batch upload for cell logs when notebook switches
              }
            }
            // Remove uploaded cell logs from local array
            const remainingCellLogs = cellVisitLogs.filter(
              log => log.notebookId !== currentPageLabel
            );
            cellVisitLogs.length = 0;
            cellVisitLogs.push(...remainingCellLogs);
          }

          console.log(
            `[ReadingTracker] Left: ${currentPageLabel} (Active: ${activeDuration}s) - logged immediately`
          );
        }

        // Start new session
        const newWidget = args.newValue;
        if (newWidget) {
          if (newWidget instanceof NotebookPanel) {
            // If the widget is a notebook, capture its full path for precise logging
            currentPageLabel = newWidget.context.path; // e.g., 'Activebook/Lab 01.ipynb'
            console.log(
              `[ReadingTracker] Entered notebook: ${currentPageLabel}`
            );
          } else {
            // Fallback to label or id
            currentPageLabel =
              newWidget.title.label || newWidget.id || 'unknown';
            console.log(`[ReadingTracker] Entered widget: ${currentPageLabel}`);
          }
          currentPageEnterTime = now;
          lastPageActivityTime = now; // Initialize activity time
          console.log(`[ReadingTracker] Entered: ${currentPageLabel}`);
        } else {
          currentPageLabel = null;
          currentPageEnterTime = null;
          lastPageActivityTime = null;
        }

        markActivity(); // record activity on page switch
      });
    }

    // 👁️ Window/tab focus tracking
    let windowActiveStart: number | null = document.hasFocus()
      ? Date.now()
      : null;
    let windowFocusCount = 0;
    let totalWindowActiveTime = 0;
    // Track if we've had at least one blur event
    let hasBlurOccurred = false;

    (window as any).__labFocusCount = 0;

    window.addEventListener('blur', async () => {
      if (windowActiveStart !== null) {
        const now = Date.now();
        // Only track time if not paused
        if (!trackingPaused) {
          const windowDuration = Math.floor((now - windowActiveStart) / 1000);
          totalWindowActiveTime += now - windowActiveStart;

          // Log window activity immediately when user switches tabs
          if (windowDuration > 0) {
            await logManager.addLog(
              {
                net_id: NET_ID,
                course_id: COURSE_ID,
                log_info: {
                  type: 'window',
                  duration: windowDuration
                }
              },
              true
            ); // Immediate upload when user switches tabs
          }
        }
        windowActiveStart = null;

        (window as any).__labActiveTime = totalWindowActiveTime;

        if (hasBlurOccurred) {
          windowFocusCount += 1;
          (window as any).__labFocusCount = windowFocusCount;
        }

        hasBlurOccurred = true;
        console.log(
          `👋 Left window - logged ${Math.floor((now - (windowActiveStart || now)) / 1000)}s`
        );
      }
    });

    window.addEventListener('focus', () => {
      // Only start tracking if not paused
      if (!trackingPaused && windowActiveStart === null) {
        windowActiveStart = Date.now();
        console.log(`👀 Returned to window`);
      }
    });

    // Add visibility change handling
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        window.dispatchEvent(new Event('blur'));
      } else if (document.visibilityState === 'visible') {
        window.dispatchEvent(new Event('focus'));
      }
    });

    // Inactivity tracking for page sessions
    let lastActivityTimestamp = Date.now();
    let trackingPaused = false;

    const activityHandler = () => {
      lastActivityTimestamp = Date.now();

      // Update last page activity time if we're on a page
      if (currentPageLabel && currentPageEnterTime) {
        lastPageActivityTime = Date.now();
      }
    };

    // Add more activity listeners
    [
      'scroll',
      'mousemove',
      'keydown',
      'mousedown',
      'focus',
      'click',
      'input'
    ].forEach(evt => window.addEventListener(evt, activityHandler));

    const markActivity = () => {
      const now = Date.now();
      lastActivityTimestamp = now;

      if (trackingPaused) {
        console.log('🔄 Activity detected, resuming Active Reading Tracker.');
        trackingPaused = false;
        // Resume active time tracking
        windowActiveStart = Date.now();

        // Restart page session tracking
        if (currentPageLabel && currentPageEnterTime === null) {
          currentPageEnterTime = now;
          lastPageActivityTime = now;
          console.log(`[ReadingTracker] Resumed: ${currentPageLabel}`);
        }
      }

      // Update last page activity time
      if (currentPageLabel && currentPageEnterTime) {
        lastPageActivityTime = now;
      }
    };

    window.addEventListener('scroll', markActivity);
    window.addEventListener('focus', markActivity);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        markActivity();
      }
    });

    // Inactivity checker - ends session after 2 minutes
    setInterval(() => {
      const now = Date.now();
      const idleTime = now - lastActivityTimestamp;

      // Pause tracking after 2 minutes
      if (idleTime > 2 * 60 * 1000 && !trackingPaused) {
        trackingPaused = true;
        console.log('⏸️ Active Reading Tracker paused due to inactivity.');

        // Pause window tracking
        if (windowActiveStart !== null) {
          windowActiveStart = null;
        }

        // End current page session if inactive
        if (currentPageLabel && currentPageEnterTime && lastPageActivityTime) {
          const activeDuration = Math.floor(
            (lastPageActivityTime - currentPageEnterTime) / 1000
          );

          visitLogs.push({
            pageId: currentPageLabel,
            enter: currentPageEnterTime,
            leave: lastPageActivityTime,
            activeDuration
          });

          console.log(
            `⏸️ Page session paused due to inactivity (${currentPageLabel}). Active: ${activeDuration}s`
          );

          // Reset tracking
          currentPageEnterTime = null;
          lastPageActivityTime = null;
        }
      }
    }, 10000); // check every 10s

    // Cleanup and expose stats
    window.addEventListener('beforeunload', async () => {
      const net_id = NET_ID;
      const course_id = COURSE_ID;

      // Upload any remaining cell logs for current notebook
      if (currentPageLabel) {
        const currentNotebookCellLogs = cellVisitLogs.filter(
          log => log.notebookId === currentPageLabel
        );
        if (currentNotebookCellLogs.length > 0) {
          console.log(
            `📦 Uploading ${currentNotebookCellLogs.length} remaining cell logs for notebook: ${currentPageLabel}`
          );
          for (const cellLog of currentNotebookCellLogs) {
            if (cellLog.activeDuration > 0) {
              await logManager.addLog(
                {
                  net_id,
                  course_id,
                  log_info: {
                    type: 'cell',
                    notebook_id: cellLog.notebookId,
                    cell_id: cellLog.cellId,
                    duration: cellLog.activeDuration
                  }
                },
                false
              ); // Batch upload for remaining cell logs
            }
          }
        }
      }

      // Force flush any remaining batch logs
      await logManager.flush();
    });

    // 🔢 Assignment Progress Tracker
    let totalTasks = 10; // You can dynamically detect this later
    let completedCells = new Set<string>();

    app.commands.commandExecuted.connect((_, args) => {
      if (args.id === 'runmenu:run') {
        const activeWidget = app.shell.currentWidget;
        const cellIndex =
          activeWidget?.node?.dataset?.jpCellIndex || Date.now().toString();
        completedCells.add(cellIndex);
        console.log(`✅ Progress: ${completedCells.size}/${totalTasks}`);
      }
    });
  }
};

const plugins: JupyterFrontEndPlugin<void>[] = [
  readingTrackerPlugin,
  myDashboardPlugin
];
export default plugins;

// Log Manager for hybrid immediate/batch uploads
class LogManager {
  private batchLogs: any[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private readonly maxBatchSize = 50;
  private readonly maxWaitTime = 30000; // 30 seconds
  private isUploading = false;

  constructor() {
    // Ensure logs are uploaded when page is unloaded
    window.addEventListener('beforeunload', () => {
      this.uploadBatch(true); // Force upload
    });

    // Upload on visibility change (user switches tabs)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.uploadBatch(true);
      }
    });
  }

  async addLog(log: any, immediate: boolean = false) {
    if (immediate) {
      await this.uploadIndividualLog(log);
    } else {
      this.batchLogs.push(log);
      this.scheduleBatchUpload();
    }
  }

  private scheduleBatchUpload() {
    // Upload immediately if batch is full
    if (this.batchLogs.length >= this.maxBatchSize) {
      this.uploadBatch();
    }
    // Schedule upload if timer isn't already set
    else if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => this.uploadBatch(), this.maxWaitTime);
    }
  }

  private async uploadBatch(force: boolean = false) {
    if (this.isUploading || (this.batchLogs.length === 0 && !force)) {
      return;
    }

    this.isUploading = true;

    // Clear the timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    // Get current batch and clear the array
    const logsToUpload = [...this.batchLogs];
    this.batchLogs = [];

    if (logsToUpload.length > 0) {
      console.log(`📦 Uploading batch of ${logsToUpload.length} logs...`);
      const result = await uploadLogsToCodeBench({ items: logsToUpload });
      if (!result.success) {
        console.error('❌ Batch upload failed:', result.error);
        // Could implement retry logic here if needed
      }
    }

    this.isUploading = false;
  }

  private async uploadIndividualLog(log: any) {
    console.log('⚡ Uploading individual log immediately...');
    try {
      const response = await axios.post(
        'http://localhost:8888/cb-server/logs',
        log,
        {
          headers: { 'Content-Type': 'application/json' }
        }
      );

      if (!response.data.success) {
        console.error('❌ Individual log upload failed:', response.data.error);
        // Fallback to batch if individual upload fails
        this.batchLogs.push(log);
        this.scheduleBatchUpload();
      } else {
        console.log('✅ Individual log uploaded successfully');
      }
    } catch (error) {
      console.error('❌ Individual log upload error:', error);
      // Fallback to batch if individual upload fails
      this.batchLogs.push(log);
      this.scheduleBatchUpload();
    }
  }

  // Public method to force upload current batch
  async flush() {
    await this.uploadBatch(true);
  }

  // Get current batch size for debugging
  getBatchSize() {
    return this.batchLogs.length;
  }
}

// Global log manager instance
const logManager = new LogManager();
