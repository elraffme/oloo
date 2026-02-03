
# Livestream Connection Timeout Debug Plan

## Problem Analysis

The error "Connection Timed Out - Could not find host video" indicates that viewers are unable to receive the host's video stream from the mediasoup SFU server. Based on my analysis:

### Key Findings

1. **Console Logs Confirm No Host Stream**: The VideoCallGrid continuously shows `hasHostStream: false` with 0 audio/video tracks, meaning no media is being received from the SFU server.

2. **Database Shows Active Stream**: The stream `873905fb-11d6-44de-a411-e4801b978144` is marked as `status: 'live'` with 5 viewers, started over 35 minutes ago - indicating the database thinks the stream is active.

3. **SFU Server Connection Issue**: The app connects to `https://api.oloo.media` for mediasoup signaling. The timeout occurs because:
   - The socket may connect successfully, but the `getCurrentProducers` request returns empty (no producers found)
   - After 10 seconds (PRODUCER_TIMEOUT_MS) and 3 polling attempts (MAX_PRODUCER_POLLS), the viewer times out

4. **Missing Socket/SFU Logs**: No socket connection logs are visible, suggesting either:
   - The socket connection to api.oloo.media is failing silently
   - The SFU server is not responding to producer requests
   - The host's producers were never registered or have been dropped

### Root Causes (Most to Least Likely)

1. **SFU Server State Mismatch**: The host's browser session may have been closed/refreshed, but the SFU server and database still show the stream as "live". The host's producers are no longer registered on the SFU.

2. **SFU Server Downtime/Issues**: The mediasoup server at api.oloo.media may be unreachable, overloaded, or experiencing issues.

3. **Room ID Mismatch**: The viewer may be joining a different room than where the host's producers are registered.

4. **Network/CORS Issues**: WebSocket connection to api.oloo.media may be blocked or failing.

---

## Proposed Fixes

### Fix 1: Enhanced Connection Diagnostics (Immediate)

Add detailed logging and user-facing diagnostics to help identify exactly where the connection fails:

```text
Changes to src/hooks/useStream.tsx:
- Log socket connection success/failure with server response
- Log RTP capabilities request/response
- Log room join confirmation
- Log producer polling results with timestamps
- Add connection health check endpoint ping
```

### Fix 2: Stale Stream Detection (High Priority)

The database shows streams as "live" even when the host has disconnected. Improve cleanup:

```text
Changes needed:
1. src/components/StreamingInterface.tsx - Ensure cleanup() is called on all exit paths
2. Database - Add heartbeat validation (last_activity_at is 35+ minutes stale)
3. Add visual indicator when host connection is unhealthy
```

### Fix 3: Improved Timeout Handling (Medium Priority)

Current 10-second timeout may be too aggressive for slow networks. Adjustments:

```text
Changes to src/hooks/useStream.tsx:
- Increase PRODUCER_TIMEOUT_MS from 10s to 15s
- Increase MAX_PRODUCER_POLLS from 3 to 5
- Add exponential backoff between polls
- Show more descriptive status during waiting
```

### Fix 4: Server Health Check (Medium Priority)

Add a pre-connection health check to validate the SFU server is reachable:

```text
New addition to src/hooks/useStream.tsx:
- Ping /health endpoint before socket connection
- Show clear error if server is unreachable
- Prevent wasted time waiting for producers if server is down
```

### Fix 5: Host Heartbeat Validation (Important)

Validate host is still actively streaming before allowing viewers to join:

```text
Changes:
1. Check last_activity_at in streaming_sessions before joining
2. If stale (>60 seconds), show "Host may have disconnected" warning
3. Auto-cleanup streams where last_activity_at > 2 minutes
```

---

## Technical Details

### File Changes Required

| File | Changes |
|------|---------|
| `src/hooks/useStream.tsx` | Add server health check, improve logging, adjust timeouts |
| `src/components/TikTokStreamViewer.tsx` | Add pre-join host validation, better error messages |
| `src/components/StreamingInterface.tsx` | Ensure heartbeat updates, improve cleanup on disconnect |
| Database function `cleanup_stale_live_streams` | Verify it's running correctly |

### Connection Flow Diagram

```text
Viewer Joins Stream
        |
        v
[1] Socket.connect(api.oloo.media)
        |
        v
[2] getRTPCapabilities -> loadDevice()
        |
        v  
[3] addUserCall(room=streamId, type=viewer)
        |
        v
[4] getCurrentProducers(room) <-- FAILING HERE (returns empty)
        |
   [5 retries over 9 seconds]
        |
        v
[5] TIMEOUT after 10 seconds
```

### Debugging Steps to Try

1. **Check SFU Server**: Verify api.oloo.media is accessible and responding
2. **Restart Host Stream**: Have the host end and restart their stream
3. **Check Browser DevTools**: Look for WebSocket connection errors in Network tab
4. **Test Socket Connection**: Try connecting to the SFU server directly

---

## Implementation Priority

1. **Immediate**: Add diagnostic logging to identify exact failure point
2. **High**: Implement stale stream cleanup so viewers don't join dead streams  
3. **Medium**: Add server health check and improve timeout messaging
4. **Low**: Optimize polling intervals and add retry mechanisms

This plan will help identify whether the issue is:
- Client-side (connection/room logic)
- Server-side (SFU not registering producers)
- Infrastructure (server unreachable)
