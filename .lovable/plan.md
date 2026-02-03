
# Livestream Connection Timeout Debug Plan

## ✅ IMPLEMENTED

### Fix 1: Enhanced Connection Diagnostics ✓
- Increased `PRODUCER_TIMEOUT_MS` from 10s to 15s
- Increased `MAX_PRODUCER_POLLS` from 3 to 5
- Added exponential backoff between polls (2s, 3s, 4s, 5s...)
- Added detailed logging for socket connection, RTP capabilities, and producer polling
- Added `health_check` and `stale_host` connection phases

### Fix 2: Stale Stream Detection ✓
- Added pre-join check for `last_activity_at` in TikTokStreamViewer
- Shows warning toast if host hasn't sent heartbeat in 2 minutes
- New `STALE_STREAM_THRESHOLD_SECONDS` constant (120 seconds)

### Fix 3: SFU Server Health Check ✓
- Added `checkSFUHealth()` function that pings `/health` endpoint
- Viewers get early error if server is unreachable (5s timeout)
- Prevents wasted time waiting for producers if server is down

### Fix 4: Improved Cleanup Function ✓
- Fixed SQL syntax error in orphaned sessions cleanup
- Uses proper Supabase client filtering instead of raw SQL subqueries

---

## Files Modified

| File | Changes |
|------|---------|
| `src/hooks/useStream.tsx` | Added health check, improved logging, increased timeouts, new phases |
| `src/components/TikTokStreamViewer.tsx` | Pre-join host validation, better error messages |
| `supabase/functions/cleanup-streams/index.ts` | Fixed orphaned sessions SQL bug |

---

## Next Steps (if issues persist)

1. **Monitor SFU server logs** - Check api.oloo.media for connection issues
2. **Add WebSocket monitoring** - Log socket.io transport state changes
3. **Consider fallback mode** - Show "technical difficulties" when SFU is unreachable
4. **Database cron job** - Schedule cleanup-streams to run every 5 minutes
