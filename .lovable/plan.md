

# Plan: Fix Host Video Not Connecting Issue

## Problem Analysis

The console logs show viewers repeatedly receiving "0 producers" from the SFU server, despite streams being marked as "live" in the database. This indicates the **host's video/audio tracks are not being successfully published to the SFU server**.

### Current Flow Breakdown:
```text
Host starts stream → Database marked "live" → SFU connection attempted
                                                    ↓
                                           (PROBLEM AREA)
                                                    ↓
Viewer joins → Requests producers → SFU returns 0 → Timeout
```

### Root Causes Identified:

1. **Race condition in socket state**: The socket effect uses `socket` from state but the `socket` variable in the closure can become stale when React re-renders
2. **Missing production confirmation**: The stream is marked "live" in the database before confirming the host successfully produced tracks to the SFU
3. **Inconsistent socket references**: Some handlers use `socket` (state) while others use `socketRef.current` - mixing these can cause event handlers to miss events
4. **No production readiness signaling**: Viewers start polling immediately, but there's no way to know if the host has finished producing

## Solution Architecture

```text
+------------------+     +----------------------+     +-------------------+
|  Host: Camera    | --> | Host: Connect to SFU | --> | Host: Produce     |
|  Ready           |     | + Join Room          |     | Audio/Video       |
+------------------+     +----------------------+     +-------------------+
                                                              ↓
                                                    +-------------------+
                                                    | Host: Confirm     |
                                                    | Production Ready  |
                                                    | (update DB flag)  |
                                                    +-------------------+
                                                              ↓
+------------------+     +----------------------+     +-------------------+
|  Viewer: Connect | --> | Viewer: Request      | --> | Viewer: Consume   |
|  to SFU          |     | Producers            |     | Host Stream       |
+------------------+     +----------------------+     +-------------------+
```

## Implementation Steps

### Step 1: Fix Socket Reference Consistency

**File: `src/hooks/useStream.tsx`**

The main socket effect uses `socket` from React state, but this creates stale closures. All socket operations should consistently use `socketRef.current`:

- Change `socket.on("connect", ...)` to use `socketRef.current` for all emit calls inside
- Change `socket.emit("getRTPCapabilites", ...)` callback to use refs
- Ensure `handleProducerTransport`, `consume`, and `startConsumeProducer` all use `socketRef.current`

### Step 2: Add Production Success Confirmation

**File: `src/hooks/useStream.tsx`**

Add explicit confirmation when host production succeeds:
- After both audio and video tracks are produced, emit a "productionReady" event or update a state
- Add `isProducing` state to track production status
- Only transition to 'streaming' phase after all tracks are confirmed produced

### Step 3: Add Host Production Logging

**File: `src/hooks/useStream.tsx`**

Add comprehensive logging to trace the host production flow:
- Log when `transportCreated` event is received
- Log the `producerId` returned from each produce call
- Log any errors in the production process

### Step 4: Improve Viewer Producer Discovery

**File: `src/hooks/useStream.tsx`**

Enhance the producer polling mechanism:
- Request producers immediately after socket connects (not just after joining room)
- Listen for both `currentProducers` and `newProducer` events simultaneously
- Add more aggressive retry logic when producers are initially empty

### Step 5: Add Socket Connection Validation

**File: `src/hooks/useStream.tsx`**

Before emitting events, validate socket is truly connected:
- Check `socket.connected` before each emit
- Add error handling for failed emits
- Implement reconnection logic if socket disconnects mid-stream

### Step 6: Verify Database-SFU Synchronization

**File: `src/components/StreamingInterface.tsx`**

Only mark stream as "live" after confirming SFU production:
- Wait for `connectionPhase` to reach 'streaming' before updating DB status
- Add a production success callback from useStream hook
- If production fails, keep stream in 'waiting' status and show error

---

## Technical Details

### Fix 1: Consistent Socket References

Current problematic pattern:
```typescript
useEffect(() => {
  if (!socket) return;
  socket.on("connect", () => {
    // socket here can be stale!
    socket.emit("getRTPCapabilites", ...);
  });
}, [socket]);
```

Fixed pattern:
```typescript
useEffect(() => {
  const currentSocket = socketRef.current;
  if (!currentSocket) return;
  
  currentSocket.on("connect", () => {
    // Always use the ref for operations
    socketRef.current?.emit("getRTPCapabilites", ...);
  });
}, [socket]);
```

### Fix 2: Production Confirmation

Add to handleProducerTransport:
```typescript
let producedCount = 0;
const expectedTracks = (audioTrack ? 1 : 0) + (videoTrack ? 1 : 0);

// After producing each track:
producedCount++;
if (producedCount === expectedTracks) {
  console.log('🎉 All tracks produced successfully');
  setConnectionPhase('streaming');
  // Notify that production is complete
  onProductionReady?.();
}
```

### Fix 3: Enhanced Logging

Add these logs to trace production:
```typescript
socket.on("transportCreated", (data) => {
  console.log('🚚 Transport created:', data);
  handleProducerTransport(data);
});

// In produce callback:
socketRef.current?.emit("produce", {...}, ({ producerId }) => {
  console.log(`✅ ${kind} producer ID: ${producerId}`);
  // Verify producerId is valid
  if (!producerId) {
    console.error('❌ Invalid producerId returned!');
  }
});
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useStream.tsx` | Fix socket refs, add production confirmation, enhance logging |
| `src/components/StreamingInterface.tsx` | Sync DB status with actual SFU production state |

---

## Testing Checklist

After implementation:
1. **Host production flow**: Start a stream and verify console shows "Video track produced successfully" and "Audio track produced successfully"
2. **Viewer connection**: Join the stream and verify console shows producers being received
3. **Production timing**: Verify stream status only shows "live" after production is confirmed
4. **Error handling**: Test what happens if camera access fails mid-stream
5. **Reconnection**: Test behavior when host loses connection and reconnects

