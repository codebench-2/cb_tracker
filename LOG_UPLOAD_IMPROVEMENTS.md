# Log Upload Improvements

## Overview
This document outlines the improvements made to the log upload functionality in the CB-Tracker extension to ensure proper error handling and retry logic when pushing logs to the database.

## Issues Addressed

### 1. Missing Error Handling
**Problem**: The original `uploadLogsToCodeBench` function didn't handle specific error cases like notebook not found errors.

**Solution**: Added comprehensive error handling with specific checks for:
- 404 errors (notebook not found)
- Partial success in batch operations
- Individual log item failures

### 2. No Retry Logic
**Problem**: When a log failed due to missing notebook, there was no retry mechanism to add the notebook first.

**Solution**: Implemented retry logic that:
- Detects notebook-related errors
- Automatically creates missing notebooks
- Retries failed log uploads
- Handles both batch and individual log retries

### 3. Incorrect Log Structure
**Problem**: The log structure was missing the required `time_stamp` field according to the API documentation.

**Solution**: Removed the manual `time_stamp` field from log items since the API automatically generates timestamps.

### 4. No Individual Log Upload
**Problem**: The implementation only used batch upload but didn't handle individual failures properly.

**Solution**: Added individual log upload capability for retry scenarios.

## Key Improvements

### Enhanced `uploadLogsToCodeBench` Function
```typescript
export async function uploadLogsToCodeBench(payload: { items: any[] }) {
  // Enhanced error handling with specific response types
  // Handles partial success in batch operations
  // Automatic retry logic for failed items
  // Returns structured response with success/error information
}
```

### New Helper Functions

#### `handleFailedLogItems`
- Processes failed log items from batch operations
- Identifies notebook-related errors
- Creates missing notebooks and retries individual logs

#### `handleMissingNotebooks`
- Extracts unique notebooks from log items
- Creates all missing notebooks in parallel
- Retries the original batch upload

#### `extractNotebookInfoFromLog`
- Extracts notebook information from log items
- Creates proper notebook objects for upload

#### `retryIndividualLog`
- Retries uploading individual log items
- Uses single log endpoint for retry scenarios

### Enhanced `uploadNotebookToCodeBench` Function
```typescript
export async function uploadNotebookToCodeBench(notebook: NotebookInfo) {
  // Returns structured response with success/error information
  // Handles 409 conflicts (notebook already exists)
  // Proper error logging and handling
}
```

## API Endpoints Used

### Correct Endpoints (as per api_docs.mdc)

1. **Batch Log Upload**: `POST /cb-server/logs/batch`
   - Used for initial log upload
   - Handles multiple logs in one request
   - Returns detailed success/failure information

2. **Individual Log Upload**: `POST /cb-server/logs`
   - Used for retry scenarios
   - Handles single log uploads

3. **Notebook Creation**: `POST /cb-server/notebooks`
   - Used when notebook not found errors occur
   - Creates notebooks before retrying logs

## Error Handling Strategy

### 1. Batch Upload Errors
- Check for partial success (some items succeeded, some failed)
- Process failed items individually
- Extract notebook information from failed logs
- Create missing notebooks and retry

### 2. 404 Errors
- Detect notebook not found errors
- Extract all unique notebooks from log items
- Create missing notebooks in parallel
- Retry the original batch upload

### 3. 409 Conflicts
- Handle notebook already exists scenarios
- Treat as success (notebook is available)

### 4. Individual Log Retries
- Retry failed logs after notebook creation
- Use individual log endpoint for precise retry

## Log Structure Compliance

### Before (Incorrect)
```typescript
{
  net_id: string,
  course_id: string,
  time_stamp: string, // ❌ Manual timestamp
  log_info: {
    type: 'window' | 'notebook' | 'cell' | 'copy_paste',
    // ... other fields
  }
}
```

### After (Correct)
```typescript
{
  net_id: string,
  course_id: string,
  // ✅ time_stamp removed - API auto-generates
  log_info: {
    type: 'window' | 'notebook' | 'cell' | 'copy_paste',
    // ... other fields
  }
}
```

## Benefits

1. **Reliability**: Automatic retry logic ensures logs are not lost due to missing notebooks
2. **Error Recovery**: Comprehensive error handling with specific recovery strategies
3. **API Compliance**: Correct log structure according to API documentation
4. **Performance**: Parallel notebook creation and efficient retry mechanisms
5. **Debugging**: Enhanced logging for better troubleshooting

## Usage Example

The improved system automatically handles scenarios like:

1. **New Notebook**: User opens a notebook that doesn't exist in the database
   - Log upload fails with 404
   - System automatically creates the notebook
   - Log upload retries and succeeds

2. **Batch Failures**: Some logs succeed, others fail due to missing notebooks
   - System identifies failed items
   - Creates missing notebooks for failed items
   - Retries only the failed logs

3. **Existing Notebooks**: Notebooks that already exist
   - 409 conflict is handled gracefully
   - Treated as success scenario

## Testing

To test the improvements:

1. **Create a new notebook** and generate some logs
2. **Check browser console** for retry messages
3. **Verify logs appear** in the database
4. **Test with existing notebooks** to ensure no conflicts

The system now provides robust, reliable log upload with automatic error recovery and retry mechanisms. 