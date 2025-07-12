# Hybrid Log Upload Approach Implementation

## Overview
This document describes the implementation of a hybrid log upload system that combines immediate and batch uploads for optimal performance and reliability.

## 🎯 **Hybrid Strategy**

### **Immediate Uploads** (Real-time)
- **Window logs**: Important session-level events
- **Notebook logs**: Critical page visit events
- **High-priority events**: Events that need immediate visibility

### **Batch Uploads** (Efficient)
- **Cell logs**: High-frequency cell interactions
- **Copy/paste logs**: Frequent user actions
- **High-volume events**: Events that occur frequently

## 🏗️ **Architecture**

### **LogManager Class**
```typescript
class LogManager {
  private batchLogs: any[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private readonly maxBatchSize = 50;
  private readonly maxWaitTime = 30000; // 30 seconds
  private isUploading = false;
}
```

### **Key Features**
1. **Smart Batching**: Automatically batches logs up to 50 items
2. **Time-based Flushing**: Uploads after 30 seconds if batch isn't full
3. **Automatic Cleanup**: Uploads on page unload and tab switch
4. **Fallback Logic**: Individual upload failures fall back to batch
5. **Memory Management**: Clears batch after successful upload

## 📊 **Upload Triggers**

### **Immediate Triggers**
- Page unload (`beforeunload`)
- Tab visibility change (`visibilitychange`)
- Manual flush calls

### **Batch Triggers**
- Batch size reaches 50 logs
- Timer expires (30 seconds)
- Forced flush operations

## 🔄 **Upload Flow**

### **Individual Upload**
```typescript
async addLog(log: any, immediate: boolean = true) {
  if (immediate) {
    await this.uploadIndividualLog(log);
  } else {
    this.batchLogs.push(log);
    this.scheduleBatchUpload();
  }
}
```

### **Batch Upload**
```typescript
private async uploadBatch(force: boolean = false) {
  // Upload current batch to /cb-server/logs/batch
  // Handle partial successes
  // Clear batch after successful upload
}
```

## 📈 **Performance Benefits**

### **Network Efficiency**
- **Reduced HTTP requests**: Batch multiple logs together
- **Lower overhead**: Fewer connection establishments
- **Better throughput**: Optimized for bulk operations

### **User Experience**
- **Real-time feedback**: Important events upload immediately
- **No blocking**: Non-critical events don't interrupt user flow
- **Reliable delivery**: Fallback mechanisms ensure data isn't lost

### **System Reliability**
- **Graceful degradation**: Individual failures don't affect batch
- **Automatic retry**: Failed individual uploads fall back to batch
- **Memory safety**: Automatic cleanup prevents memory leaks

## 🎛️ **Configuration**

### **Batch Settings**
```typescript
private readonly maxBatchSize = 50;    // Max logs per batch
private readonly maxWaitTime = 30000;  // Max wait time (30s)
```

### **Upload Endpoints**
- **Individual**: `POST /cb-server/logs`
- **Batch**: `POST /cb-server/logs/batch`

## 🔍 **Monitoring & Debugging**

### **Console Logs**
```typescript
console.log("⚡ Uploading individual log immediately...");
console.log(`📦 Uploading batch of ${logsToUpload.length} logs...`);
console.log("✅ Individual log uploaded successfully");
```

### **Debug Methods**
```typescript
logManager.getBatchSize();  // Get current batch size
logManager.flush();         // Force upload current batch
```

## 🛡️ **Error Handling**

### **Individual Upload Failures**
1. Log error to console
2. Add to batch for retry
3. Schedule batch upload

### **Batch Upload Failures**
1. Log error to console
2. Could implement retry logic
3. Preserve logs for next attempt

### **Network Issues**
- Automatic fallback to batch mode
- Graceful handling of connection failures
- No data loss during network interruptions

## 📋 **Usage Examples**

### **Immediate Upload (Important Events)**
```typescript
await logManager.addLog({
  net_id: NET_ID,
  course_id: COURSE_ID,
  log_info: {
    type: 'notebook',
    notebook_id: notebookPath,
    duration: activeDuration
  }
}, true); // Immediate upload
```

### **Batch Upload (High-Frequency Events)**
```typescript
await logManager.addLog({
  net_id: NET_ID,
  course_id: COURSE_ID,
  log_info: {
    type: 'cell',
    notebook_id: notebookId,
    cell_id: cellId,
    duration: activeDuration
  }
}, false); // Batch upload
```

## 🎯 **Event Classification**

### **Immediate Upload Events**
- ✅ Window focus/blur events
- ✅ Notebook page visits
- ✅ Session start/end events

### **Batch Upload Events**
- ✅ Cell interactions (high frequency)
- ✅ Copy/paste operations (high frequency)
- ✅ Minor user actions

## 🚀 **Benefits Summary**

1. **Performance**: Optimized network usage with smart batching
2. **Reliability**: Multiple fallback mechanisms ensure data delivery
3. **User Experience**: Real-time feedback for important events
4. **Scalability**: Handles high-frequency events efficiently
5. **Maintainability**: Clean separation of concerns and error handling

## 🔧 **Future Enhancements**

1. **Retry Logic**: Implement exponential backoff for failed uploads
2. **Priority Queues**: Different priority levels for different event types
3. **Compression**: Compress batch payloads for better performance
4. **Metrics**: Track upload success rates and performance metrics
5. **Configuration**: Make batch size and timing configurable 