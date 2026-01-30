

# Plan: Fix Critical Microphone/Audio Issues in Livestream

## Problem Analysis

After thorough analysis of the livestream code, I've identified several critical audio issues that prevent reliable two-way audio between host and viewers:

### Root Cause 1: Audio Track Initialization Issues

**In `useStream.tsx` (lines 528-541):**
The host initializes getUserMedia with just `audio: true` without proper audio constraints for mobile compatibility:

```typescript
const stream = await navigator.mediaDevices.getUserMedia({
  audio: true,  // Missing echoCancellation, noiseSuppression!
  video: {...}
});
```

Compare this to `StreamingInterface.tsx` (lines 957-962) which correctly uses:
```typescript
constraints.audio = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true
};
```

The host's SFU connection uses the simpler `audio: true` constraint, which can result in poor audio quality and feedback issues.

### Root Cause 2: Host Audio Not Verified Before Production

The host starts broadcasting without verifying the audio track is actually enabled and ready. In `handleProducerTransport` (line 316-328):
```typescript
const audioTrack = stream.getAudioTracks()[0];
if (audioTrack) {
  console.log('🎤 Producing audio track...');
  await produceTransport.current.produce({ track: audioTrack, ...});
}
```

There's no check for `audioTrack.enabled` or `audioTrack.readyState === 'live'` before producing.

### Root Cause 3: Viewer Mic Toggle Logic Flaw

In `TikTokStreamViewer.tsx` (lines 440-470) and `StreamViewer.tsx` (lines 617-650), the mic toggle logic has issues:

1. When mic is enabled independently (without camera), `publishStream('mic')` is called but may not properly wait for transport creation
2. The `toggleSFUMute()` function in `useStream.tsx` only toggles `track.enabled` but doesn't handle cases where the track was never produced to the SFU
3. Re-joining a stream may leave audio tracks in an inconsistent state

### Root Cause 4: Missing Audio Restart on Reconnection

When a viewer or host reconnects, the audio track is not re-enabled or re-produced. The `cleanup()` function stops all tracks, but `initialize()` doesn't automatically re-acquire audio permissions for viewers.

### Root Cause 5: Video Element Muted State Confusion

In both viewer components, there are two different "muted" concepts being conflated:
1. `isMuted` - whether the video element plays audio (speaker)
2. `viewerMicEnabled` / mic toggle - whether the viewer's microphone is active

The speaker toggle (`isMuted`) affects `videoRef.current.muted`, while the mic toggle affects the SFU production, but the naming creates confusion.

## Solution Architecture

```text
+----------------------+     +------------------------+     +------------------+
| getUserMedia with    | --> | Verify audio track     | --> | Produce to SFU   |
| proper constraints   |     | enabled & live         |     | with confirmation|
+----------------------+     +------------------------+     +------------------+
         |                            |                              |
         v                            v                              v
+----------------------+     +------------------------+     +------------------+
| Mobile-friendly      |     | Log track state for    |     | Update UI only   |
| echoCancellation ON  |     | debugging              |     | after SFU ACK    |
+----------------------+     +------------------------+     +------------------+
```

## Implementation Steps

### Step 1: Enhance Host Audio Initialization in useStream.tsx

**File: `src/hooks/useStream.tsx`**

Update the `initialize()` function to use proper audio constraints:

Current (line 528-536):
```typescript
const stream = await navigator.mediaDevices.getUserMedia({
  audio: true,
  video: {...}
});
```

Change to:
```typescript
const stream = await navigator.mediaDevices.getUserMedia({
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    // Mobile-friendly sample rate
    sampleRate: { ideal: 48000 },
  },
  video: {...}
});
```

### Step 2: Add Audio Track Verification Before Production

**File: `src/hooks/useStream.tsx`**

In `handleProducerTransport()`, add verification that audio track is ready:

```typescript
const audioTrack = stream.getAudioTracks()[0];

if (audioTrack) {
  // Verify audio track is ready
  if (!audioTrack.enabled) {
    console.warn('⚠️ Audio track is disabled, enabling...');
    audioTrack.enabled = true;
  }
  
  if (audioTrack.readyState !== 'live') {
    console.error('❌ Audio track not live, state:', audioTrack.readyState);
    // Don't produce dead tracks
  } else {
    console.log('🎤 Producing audio track...');
    await produceTransport.current.produce({...});
  }
}
```

### Step 3: Fix Viewer Mic Publishing Logic

**File: `src/hooks/useStream.tsx`**

Update `publishStream()` to handle mic-only mode properly:

Current (lines 791-835):
```typescript
async function publishStream(type = "camera", displayName = "Viewer") {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: type === "camera",
  });
  // ...
}
```

Change to:
```typescript
async function publishStream(type = "camera", displayName = "Viewer") {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: type === "camera" ? { facingMode: 'user' } : false,
  });
  
  // Ensure audio track is enabled immediately
  stream.getAudioTracks().forEach(track => {
    track.enabled = true;
    console.log('🎤 Audio track for viewer:', {
      label: track.label,
      enabled: track.enabled,
      readyState: track.readyState
    });
  });
  // ...
}
```

### Step 4: Fix toggleMute to Re-enable Disabled Tracks

**File: `src/hooks/useStream.tsx`**

The current `toggleMute()` only toggles `enabled` but doesn't handle edge cases:

```typescript
function toggleMute() {
  if (localStreamRef.current) {
    const audioTracks = localStreamRef.current.getAudioTracks();
    
    if (audioTracks.length === 0) {
      console.warn('⚠️ No audio tracks to toggle');
      return;
    }
    
    audioTracks.forEach((track) => {
      track.enabled = !track.enabled;
      console.log(`🎤 Audio track ${track.enabled ? 'unmuted' : 'muted'}`);
      setIsMuted(!track.enabled);
    });
  } else {
    console.warn('⚠️ No local stream to toggle mute');
  }
}
```

### Step 5: Add Audio State Logging in Viewers

**Files: `src/components/TikTokStreamViewer.tsx` and `src/components/StreamViewer.tsx`**

Add useEffect hooks to log audio track states when remote stream updates:

```typescript
useEffect(() => {
  if (remoteStream) {
    const audioTracks = remoteStream.getAudioTracks();
    console.log('🔊 Remote stream audio state:', {
      trackCount: audioTracks.length,
      tracks: audioTracks.map(t => ({
        label: t.label,
        enabled: t.enabled,
        muted: t.muted,
        readyState: t.readyState
      }))
    });
  }
}, [remoteStream]);
```

### Step 6: Fix Host Mic Toggle in StreamingInterface

**File: `src/components/StreamingInterface.tsx`**

The host's `toggleMicrophone()` function needs to also notify the SFU transport:

Current (lines 1056-1064):
```typescript
const toggleMicrophone = () => {
  if (streamRef.current) {
    const audioTrack = streamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMicOn(audioTrack.enabled);
    }
  }
};
```

This only toggles the local track but the SFU producer continues sending. Need to add logging and potentially pause the producer.

### Step 7: Ensure Audio Works After Reconnection

**File: `src/hooks/useStream.tsx`**

In the `retryConnection()` function, if viewer had mic enabled, re-request audio permissions and re-produce:

```typescript
const retryConnection = useCallback(() => {
  console.log('🔄 Retrying connection...');
  // ... existing code ...
  
  // If viewer had mic enabled before, flag for re-enabling after reconnect
  const hadMicEnabled = localStreamRef.current?.getAudioTracks().some(t => t.enabled);
  // Store in ref for post-connect handling
}, [...]);
```

### Step 8: Add Comprehensive Audio Debugging Panel

**File: `src/components/StreamDiagnostics.tsx`**

Enhance the diagnostics to show more audio information:

```typescript
interface DiagnosticsData {
  // ... existing fields ...
  audioInputDevice: string;
  audioOutputDevice: string;
  audioTrackState: string;
}
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useStream.tsx` | Fix audio constraints, add track verification, improve toggleMute and publishStream |
| `src/components/StreamingInterface.tsx` | Improve host mic toggle logging |
| `src/components/StreamViewer.tsx` | Add audio state logging, improve mic toggle flow |
| `src/components/TikTokStreamViewer.tsx` | Add audio state logging, improve mic toggle flow |
| `src/components/StreamDiagnostics.tsx` | Add audio device info to diagnostics |

## Testing Checklist

After implementation:

1. **Host Audio Production**
   - Start a stream and verify console shows "Audio track produced successfully" with proper constraints
   - Verify audio track shows `enabled: true` and `readyState: 'live'`

2. **Host Mic Toggle**
   - Toggle mic off/on and verify viewers can hear the change
   - Verify console logs show track state changes

3. **Viewer Hearing Host**
   - Join stream as viewer and verify host audio plays immediately (after unmuting speaker)
   - Check console for "Remote stream audio state" logs showing tracks

4. **Viewer Mic to Host**
   - Enable mic as viewer and verify host can hear
   - Toggle mic off/on and verify state consistency

5. **Two-Way Audio**
   - Test simultaneous talking between host and viewer
   - Verify no echo or feedback (echoCancellation working)

6. **Mobile Testing**
   - Test on iOS Safari and Android Chrome
   - Verify audio works after backgrounding and returning to app

7. **Reconnection**
   - Test network disconnect/reconnect scenarios
   - Verify audio resumes after reconnection

