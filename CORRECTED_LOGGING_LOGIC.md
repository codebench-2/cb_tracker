# Corrected Logging Logic Implementation

## Overview
This document describes the corrected logging implementation that follows the specific requirements for when and how different types of logs should be uploaded to the database.

## 🎯 **Logging Requirements & Implementation**

### **1. Window Log** ✅
**Requirement**: Log immediately when user switches browser tabs  
**Implementation**: 
- Triggers on `window.addEventListener('blur')`
- Calculates duration from `windowActiveStart` to current time
- Uploads immediately using `logManager.addLog(log, true)`
- Logs the time user spent in JupyterLab before switching tabs

```typescript
window.addEventListener('blur', async () => {
  if (windowActiveStart !== null) {
    const windowDuration = Math.floor((now - windowActiveStart) / 1000);
    await logManager.addLog({
      net_id: NET_ID,
      course_id: COURSE_ID,
      log_info: {
        type: 'window',
        duration: windowDuration
      }
    }, true); // Immediate upload when user switches tabs
  }
});
```

### **2. Notebook Log** ✅
**Requirement**: Log immediately when user switches notebooks  
**Implementation**:
- Triggers on `app.shell.currentChanged` (notebook switch)
- Calculates duration from `currentPageEnterTime` to `lastPageActivityTime`
- Uploads immediately using `logManager.addLog(log, true)`
- Logs the time user spent in a specific notebook

```typescript
app.shell.currentChanged.connect(async (_, args) => {
  if (currentPageLabel && currentPageEnterTime && lastPageActivityTime) {
    const activeDuration = Math.floor((lastPageActivityTime - currentPageEnterTime) / 1000);
    await logManager.addLog({
      net_id: NET_ID,
      course_id: COURSE_ID,
      log_info: {
        type: 'notebook',
        notebook_id: currentPageLabel,
        duration: activeDuration
      }
    }, true); // Immediate upload when user switches notebooks
  }
});
```

### **3. Copy/Paste Log** ✅
**Requirement**: Log immediately when paste action is detected  
**Implementation**:
- Triggers on `document.addEventListener('paste')` and `document.addEventListener('copy')`
- Captures the pasted/copied content and context
- Uploads immediately using `logManager.addLog(log, true)`
- Logs both copy and paste actions as they happen

```typescript
document.addEventListener('paste', async (event) => {
  // ... content processing ...
  await logManager.addLog({
    net_id: NET_ID,
    course_id: COURSE_ID,
    log_info: {
      type: 'copy_paste',
      notebook_id: context.notebookId,
      cell_id: context.cellId,
      pasted_content: limitedContent
    }
  }, true); // Immediate upload when paste action is detected
});
```

### **4. Cell Log** ✅
**Requirement**: Log in batches when notebook switches  
**Implementation**:
- Stores cell logs locally in `cellVisitLogs` array
- When notebook switches, uploads all cell logs for that notebook in batch
- Uses `logManager.addLog(log, false)` for batch upload
- Clears uploaded logs from local array to prevent duplicates

```typescript
// Store cell logs locally
const logCurrentCell = () => {
  cellVisitLogs.push({
    notebookId,
    cellId: currentCellId,
    // ... other fields
  });
};

// Upload in batches when notebook switches
const notebookCellLogs = cellVisitLogs.filter(log => log.notebookId === currentPageLabel);
for (const cellLog of notebookCellLogs) {
  await logManager.addLog({
    net_id: NET_ID,
    course_id: COURSE_ID,
    log_info: {
      type: 'cell',
      notebook_id: cellLog.notebookId,
      cell_id: cellLog.cellId,
      duration: cellLog.activeDuration
    }
  }, false); // Batch upload for cell logs when notebook switches
}
```

## 🔄 **Upload Flow Summary**

### **Immediate Uploads** (Real-time)
1. **Window Log**: `window.blur` → immediate upload
2. **Notebook Log**: `notebook.switch` → immediate upload  
3. **Copy/Paste Log**: `copy/paste.action` → immediate upload

### **Batch Uploads** (Efficient)
1. **Cell Log**: `notebook.switch` → batch upload all cell logs for that notebook

### **Cleanup Uploads** (Safety)
1. **Remaining Cell Logs**: `beforeunload` → upload any remaining cell logs for current notebook

## 📊 **Data Flow**

```
User Action → Event Trigger → Log Creation → Upload Strategy
├── Switch Browser Tab → window.blur → Window Log → Immediate
├── Switch Notebook → currentChanged → Notebook Log → Immediate  
├── Copy/Paste → copy/paste → Copy/Paste Log → Immediate
└── Cell Activity → cellChange → Cell Log → Store → Batch on Notebook Switch
```

## 🛡️ **Error Handling & Reliability**

### **Immediate Uploads**
- Individual upload failures fall back to batch mode
- Network issues don't block user interaction
- Automatic retry through LogManager fallback

### **Batch Uploads**
- Cell logs stored locally until notebook switch
- No data loss during network interruptions
- Automatic cleanup on page unload

### **Memory Management**
- Cell logs removed from local array after successful upload
- Automatic cleanup prevents memory leaks
- Efficient storage and retrieval

## 🎛️ **Configuration**

### **Upload Timing**
- **Window**: Immediate on tab switch
- **Notebook**: Immediate on notebook switch
- **Copy/Paste**: Immediate on action
- **Cell**: Batch on notebook switch

### **Batch Settings**
- **Cell Logs**: Uploaded when notebook switches
- **Batch Size**: Up to 50 logs per batch
- **Timeout**: 30 seconds for partial batches

## ✅ **Verification Checklist**

- [x] Window logs upload immediately when user switches browser tabs
- [x] Notebook logs upload immediately when user switches notebooks
- [x] Copy/paste logs upload immediately when actions are detected
- [x] Cell logs are stored locally and uploaded in batches when notebook switches
- [x] No duplicate uploads or data loss
- [x] Proper error handling and fallback mechanisms
- [x] Memory-efficient storage and cleanup

## 🚀 **Benefits**

1. **Real-time Visibility**: Important events (window, notebook, copy/paste) are immediately visible
2. **Efficient Batching**: High-frequency cell events are batched for optimal performance
3. **Reliable Delivery**: Multiple fallback mechanisms ensure data isn't lost
4. **User Experience**: No blocking or interruption of user workflow
5. **Resource Efficiency**: Smart memory management and network optimization 