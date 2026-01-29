

# Plan: Fix Livestream Host Video Not Connecting Issue

## Status: ✅ COMPLETED

## Problem Analysis

Based on the console logs and code analysis, here's what's happening:

1. **Viewer connects successfully** to the SFU server at `api.oloo.media`
2. **Socket connection established** - "connected socket" logged
3. **Device loads correctly** - "emit recvd" logged
4. **Room join succeeds** - joins room with the stream ID
5. **Producer polling returns empty** - "📡 Received currentProducers: 0 producer(s)" repeatedly
6. **Timeout triggers** - After 10 seconds with no producers, shows timeout UI

The streams exist in the database (e.g., "Live tracking" and "Growth" with active viewers), but the SFU server is not returning any producers for the room. This indicates a **state desync between the database and the SFU server**.

## Root Causes Identified

### Cause 1: Stale Database State
The `streaming_sessions` table shows streams as "live" even when the host has disconnected from the SFU. The database cleanup isn't happening when:
- Host closes browser without ending stream
- Host loses internet connection
- SFU server restarts

### Cause 2: Missing First Producer Request
Currently, the viewer starts polling **after** joining the room, but the first poll happens 3 seconds later. There's no immediate request for producers when joining.

Looking at the code flow:
```text
socket.emit("addUserCall", ...) // Join room
setConnectionPhase('awaiting_producers')
startProducerPolling() // Starts interval that fires after 3s
startConnectionTimeout() // 10s timeout
```

The first `getCurrentProducers` request happens at 3 seconds, not immediately after joining.

### Cause 3: No Heartbeat Validation
Viewers try to join streams that may have been abandoned, with no way to verify the host is actually connected to the SFU before attempting to join.

## Solution Architecture

```text
+------------------+     +--------------------+     +----------------------+
|  Socket Connect  | --> | Load Device & Join | --> | IMMEDIATE Producer   |
+------------------+     +--------------------+     | Request (not wait 3s)|
                                                    +----------------------+
                                                            |
                         +----------------------------------+
                         v
          +----------------------------------+
          | If 0 producers:                  |
          | Start polling + show message     |
          | "Host may be reconnecting..."    |
          +----------------------------------+
                         |
     +-------------------+-------------------+
     v                                       v
+-------------------+           +------------------------+
| Producers Found   |           | Still 0 after timeout  |
| Consume Stream    |           | Query DB for host      |
+-------------------+           | last_activity_at       |
                                +------------------------+
                                            |
                    +-----------------------+
                    v
         +------------------------+
         | If host inactive >2min |
         | Show "Stream may have  |
         | ended" message         |
         +------------------------+
```

## Implementation Steps

### Step 1: Add Immediate Producer Request After Joining

**File: `src/hooks/useStream.tsx`**

Currently, the first producer poll happens after 3 seconds. We need to request producers immediately after joining the room.

Changes:
- After emitting `addUserCall`, immediately emit `getCurrentProducers`
- Then start the polling interval for subsequent retries

This ensures the viewer gets the first response within ~100ms instead of waiting 3 seconds.

### Step 2: Add Stream Validation Before Joining

**File: `src/components/StreamViewer.tsx`** and **`TikTokStreamViewer.tsx`**

Before connecting to the SFU, check if the stream's `last_activity_at` is recent (within 2 minutes). If the host hasn't had activity in 2+ minutes, show a warning that the stream may have ended.

Changes:
- Fetch `last_activity_at` from `streaming_sessions` table
- If stale, show "This stream may have ended. Try anyway?" with options
- If user proceeds, attempt connection with appropriate expectations

### Step 3: Improve Timeout UI with Actionable Information

**Files: `src/components/StreamViewer.tsx`, `TikTokStreamViewer.tsx`**

When timeout occurs, provide more helpful information:
- Check the database to see if the stream is still marked as "live"
- If stream shows live but no SFU producers, explain "Host may have disconnected. Stream will auto-connect if host returns."
- Add "Go Back to Discover" button prominently

### Step 4: Add Host Activity Heartbeat

**File: `src/components/StreamingInterface.tsx`** (Host side)

The host should send periodic heartbeats to update `last_activity_at` in the database:
- Every 30 seconds while streaming, update `last_activity_at`
- This allows viewers to detect stale streams

### Step 5: Improve Producer Polling Start Logic

**File: `src/hooks/useStream.tsx`**

Fix the polling to start immediately, not wait for the first interval:

Current:
```typescript
// Polling starts but first request is after 3 seconds
producerPollInterval.current = setInterval(() => {
  // First execution after 3000ms
  requestProducers();
}, PRODUCER_POLL_INTERVAL_MS);
```

Should be:
```typescript
// Request immediately, then start interval
requestProducers(); // Immediate first request
producerPollInterval.current = setInterval(() => {
  requestProducers();
}, PRODUCER_POLL_INTERVAL_MS);
```

### Step 6: Add Stream Status Verification on Timeout

**File: `src/hooks/useStream.tsx`** or viewer components

When timeout occurs:
1. Query the database to check if stream is still "live"
2. Check `last_activity_at` timestamp
3. Display appropriate message based on findings:
   - "Host appears offline" if `last_activity_at` > 2 minutes old
   - "Host is live but connection failed - try again" if recent activity
   - "Stream has ended" if status changed to "ended"

---

## Technical Details

### Immediate Producer Request

In `useStream.tsx`, after joining room:

```typescript
socket.emit("addUserCall", {
  room: roomId.current,
  peerId: peerId.current,
  username: "User",
  type: roleRef.current,
});

if (roleRef.current === "streamer") {
  socket.emit("createTransport", peerId.current);
} else {
  setConnectionPhase('awaiting_producers');
  // NEW: Request producers immediately
  socket.emit('getCurrentProducers', { room: roomId.current });
  // Then start polling for subsequent attempts
  startProducerPolling();
  startConnectionTimeout();
}
```

### Stream Freshness Check

Before connecting, check stream freshness:

```typescript
const checkStreamFreshness = async (streamId: string): Promise<{ isFresh: boolean; lastActivity: Date | null }> => {
  const { data } = await supabase
    .from('streaming_sessions')
    .select('last_activity_at, status')
    .eq('id', streamId)
    .single();
  
  if (!data || data.status !== 'live') {
    return { isFresh: false, lastActivity: null };
  }
  
  const lastActivity = new Date(data.last_activity_at);
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
  
  return {
    isFresh: lastActivity > twoMinutesAgo,
    lastActivity
  };
};
```

### Host Heartbeat

In the streaming interface, while streaming:

```typescript
useEffect(() => {
  if (!isStreaming || !activeStreamId) return;
  
  const heartbeatInterval = setInterval(async () => {
    await supabase
      .from('streaming_sessions')
      .update({ last_activity_at: new Date().toISOString() })
      .eq('id', activeStreamId);
  }, 30000); // Every 30 seconds
  
  return () => clearInterval(heartbeatInterval);
}, [isStreaming, activeStreamId]);
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useStream.tsx` | Add immediate producer request after joining room |
| `src/components/StreamViewer.tsx` | Add stream freshness check, improve timeout UI |
| `src/components/TikTokStreamViewer.tsx` | Same changes as StreamViewer |
| `src/components/StreamingInterface.tsx` | Add host heartbeat to update last_activity_at |

---

## Testing Checklist

After implementation:
1. Test viewer joining active stream - should connect faster (immediate producer request)
2. Test viewer joining stale stream (host disconnected) - should show appropriate warning
3. Test retry button after timeout - should re-check for producers
4. Test host heartbeat - verify `last_activity_at` updates every 30 seconds
5. Test timeout message - should show helpful context about stream status
6. Test "Go Back" flow - should cleanly return to discover page

