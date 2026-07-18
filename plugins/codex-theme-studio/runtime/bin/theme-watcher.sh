#!/bin/sh
set -u

# Keep only this small shell process resident. The full Node/CDP runtime is started for one bounded
# reconciliation cycle, then exits so V8 and renderer-protocol memory are returned to macOS.
NODE_BIN=$1
CLI_PATH=$2
INTERVAL_SECONDS=${CTS_WATCH_INTERVAL_SECONDS:-30}
running=1
child_pid=

stop_watcher() {
  running=0
  if [ -n "$child_pid" ]; then
    kill "$child_pid" 2>/dev/null || true
  fi
}

trap stop_watcher TERM INT HUP

while [ "$running" -eq 1 ]; do
  "$NODE_BIN" "$CLI_PATH" watch-cycle &
  child_pid=$!
  cycle_status=0
  wait "$child_pid" || cycle_status=$?
  child_pid=

  # Exit code 75 means no active theme remains. Other failures are transient and are retried only
  # after the normal health interval, avoiding a tight retry loop during an app upgrade/restart.
  if [ "$cycle_status" -eq 75 ] || [ "$running" -ne 1 ]; then
    break
  fi

  sleep "$INTERVAL_SECONDS" &
  child_pid=$!
  wait "$child_pid" || true
  child_pid=
done

exit 0
