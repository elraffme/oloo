

# Plan: Fix Slow/Stuck Livestream Loading with Retry Mechanisms and Better Error Handling

## Problem Summary

When viewers join a livestream, they often get stuck at "Connected! Loading video stream..." indefinitely. The socket connection succeeds, but the video stream never materializes due to race conditions and lack of resilience in the Mediasoup/SFU handshake process.

## Root Causes Identified

1. **No timeout mechanism**: The viewer waits forever for producers without any fallback
2. **Race conditions**: If a viewer joins before the host finishes producing, `currentProducers` returns empty
3. **No producer polling**: Once `currentProducers` returns empty, there's no retry to check again
4. **Poor connection state visibility**: Users can't tell where the process is stuck
5. **No manual retry option**: Users must refresh the page to retry

## Solution Architecture

```text
+------------------+     +--------------------+     +-------------------+
|  Socket Connect  | --> | Load Device & Join | --> | Request Producers |
+------------------+     +--------------------+     +-------------------+
                                                            |
                                    +-----------------------+
                                    v
                    +-------------------------------+
                    | Wait for currentProducers     |
                    | (with 5s timeout + polling)   |
                    +-------------------------------+
                                    |
        +---------------------------+---------------------------+
        v                                                       v
+-------------------+                               +------------------------+
| Producers Found   |                               | Timeout - No Producers |
| Create Consumers  |                               | Show Retry Button      |
+-------------------+                               +------------------------+
        |                                                       |
        v                                                       v
+-------------------+                               +------------------------+
| Stream Playing    |                               | User clicks Retry      |
+-------------------+                               | Re-poll for producers  |
                                                    +------------------------+
```

## Implementation Steps

### Step 1: Enhance useStream Hook with Connection States and Timeouts

**File: `src/hooks/useStream.tsx`**

Add new state variables and timeout logic:
- Add `connectionPhase` state to track: `'idle' | 'connecting' | 'device_loading' | 'joining_room' | 'awaiting_producers' | 'consuming' | 'streaming' | 'timeout' | 'error'`
- Add `producerTimeout` ref to track if we've timed out waiting for producers
- Add `requestProducers()` function to manually poll for current producers from the SFU
- Add `PRODUCER_TIMEOUT_MS` constant (default 10 seconds)
- Add `retryConnection()` function that re-polls for producers without full reconnection

Key changes:
1. After socket connects and joins room, start a timeout timer
2. When `currentProducers` event fires with empty array, wait and re-request
3. If 10 seconds pass with no producers, set `connectionPhase` to `'timeout'`
4. Expose `retryProducers()` function that emits another producer request

### Step 2: Add Producer Polling Mechanism

**File: `src/hooks/useStream.tsx`**

Implement automatic producer polling:
- After joining room, emit `getCurrentProducers` request every 3 seconds
- Maximum 3 polling attempts before showing timeout state
- Cancel polling once producers are found and consuming begins
- Clear polling interval on cleanup

New logic in socket connect handler:
```text
On socket connect:
  1. Load device
  2. Join room
  3. Start producer polling interval (3s)
  4. Start timeout timer (10s)
  
On currentProducers event:
  - If producers.length > 0: clear polling, consume producers
  - If producers.length === 0: wait for next poll
  
On timeout (10s):
  - Clear polling interval
  - Set connectionPhase to 'timeout'
  - Show retry UI
```

### Step 3: Update StreamViewer Component with Enhanced Loading States

**File: `src/components/StreamViewer.tsx`**

Update the connection state handling:
- Import new `connectionPhase` and `retryProducers` from useStream
- Replace current `connectionState` with the hook's phase
- Add "Retry Connection" button when in timeout state
- Add elapsed time counter to show how long user has been waiting
- Show more descriptive messages for each phase

New UI elements:
```text
Phase: awaiting_producers
  -> "Waiting for host video... (5s)"
  -> Show spinner
  
Phase: timeout
  -> "Connection timed out"
  -> "The host may not be streaming yet"
  -> [Retry] [Leave Stream] buttons
  
Phase: streaming
  -> Hide all loading UI
```

### Step 4: Update TikTokStreamViewer with Same Enhancements

**File: `src/components/TikTokStreamViewer.tsx`**

Mirror the changes from StreamViewer:
- Use `connectionPhase` from useStream
- Add retry button UI
- Show elapsed time during loading
- Handle timeout state with user-friendly message

### Step 5: Add Automatic Reconnection Logic

**File: `src/hooks/useStream.tsx`**

Implement auto-retry with exponential backoff:
- On connection failure or timeout, attempt up to 3 automatic retries
- Delays: 2s, 4s, 8s (exponential backoff)
- Track retry count with `reconnectAttempts` ref
- If all retries fail, show manual retry button
- Reset retry count on successful stream

### Step 6: Add Connection Health Monitoring

**File: `src/hooks/useStream.tsx`**

Enhance the existing `checkChannelHealth()` function:
- Return detailed connection info: socket state, device loaded, producers found, consumers active
- Add periodic health check (every 5 seconds while connected)
- Detect stale connections (connected but no data flowing)
- Trigger reconnection on detected staleness

### Step 7: Add Error Boundary for Stream Components

**File: `src/components/StreamErrorBoundary.tsx`** (new file)

Create error boundary wrapper:
- Catch React errors in stream viewer components
- Show user-friendly error message with retry option
- Log errors for debugging
- Prevent full app crash from stream issues

### Step 8: Update Types and Exports

**File: `src/hooks/useStream.tsx`**

Export new values from the hook:
- `connectionPhase` - current connection phase
- `retryConnection` - function to retry producer polling
- `connectionError` - error message if any
- `elapsedTime` - time since connection started

---

## Technical Details

### New State Variables in useStream

```text
// Connection phase tracking
connectionPhase: 'idle' | 'connecting' | 'device_loading' | 'joining_room' | 'awaiting_producers' | 'consuming' | 'streaming' | 'timeout' | 'error'

// Timing refs
connectionStartTime: number | null
producerPollInterval: NodeJS.Timeout | null
connectionTimeout: NodeJS.Timeout | null

// Error tracking  
connectionError: string | null
```

### Producer Polling Logic

```text
function startProducerPolling():
  pollCount = 0
  maxPolls = 3
  pollInterval = 3000ms
  
  interval = setInterval:
    pollCount++
    emit('getCurrentProducers', room)
    
    if pollCount >= maxPolls:
      clearInterval(interval)
      // Don't timeout yet, wait for overall timeout
      
function handleCurrentProducers(producers):
  clearProducerPolling()
  
  if producers.length > 0:
    clearConnectionTimeout()
    setConnectionPhase('consuming')
    producers.forEach(consume)
  else:
    // Empty response, polling will continue if still active
    log('No producers yet, waiting...')
```

### Retry Function

```text
function retryConnection():
  setConnectionPhase('awaiting_producers')
  clearConnectionTimeout()
  reconnectAttempts.current++
  
  // Re-request producers from server
  socket.emit('getCurrentProducers', { room: roomId.current })
  
  // Restart timeout
  startConnectionTimeout()
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useStream.tsx` | Add connection phases, timeouts, polling, retry logic |
| `src/components/StreamViewer.tsx` | Update loading UI, add retry button, use new phases |
| `src/components/TikTokStreamViewer.tsx` | Same updates as StreamViewer |
| `src/components/StreamErrorBoundary.tsx` | New error boundary component |

---

## Testing Checklist

After implementation:
1. Test joining a stream that is actively live - should connect within 5 seconds
2. Test joining before host goes live - should show "waiting for host" then auto-connect
3. Test when SFU server is slow - timeout should trigger after 10 seconds with retry option
4. Test retry button - should re-attempt connection without full page refresh
5. Test on mobile (iOS Safari, Chrome Android) - verify loading states render correctly
6. Test host ending stream while viewer is connecting - should handle gracefully

