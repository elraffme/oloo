

# Fix: Streaming Connection Error

## Root Cause

The socket.io client connection to the SFU server (`api.oloo.media`) is created with zero configuration options:

```
const newSocket = io(SERVER_URL);  // No options at all
```

This causes connection failures because:
1. No explicit transports specified -- socket.io defaults to polling first, then upgrades to WebSocket. If polling fails (due to CORS or server config), the connection dies.
2. No reconnection settings -- default reconnection may not be aggressive enough.
3. No timeout configuration -- the default connection timeout may be too short for slower networks.
4. No `withCredentials` or path configuration for cross-origin connections.

## Fix (Single file change)

**File: `src/hooks/useStream.tsx`** -- Line 909

Update the socket.io client initialization to include proper production-grade configuration:

```typescript
const newSocket = io(SERVER_URL, {
  transports: ['websocket', 'polling'],  // Prefer WebSocket, fall back to polling
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,                         // 20s connection timeout
  forceNew: true,                         // Force new connection (prevent stale reuse)
});
```

Key changes:
- **`transports: ['websocket', 'polling']`** -- Tries WebSocket first (faster, more reliable for media), falls back to HTTP polling only if needed
- **`reconnection: true`** with attempts/delay -- Auto-reconnects on drops
- **`timeout: 20000`** -- Gives the server 20 seconds to respond (handles slow networks)
- **`forceNew: true`** -- Prevents reusing stale/broken connections from previous sessions

## What stays the same

Everything else in the streaming code remains untouched. This is strictly a connection configuration fix -- no redesign.
