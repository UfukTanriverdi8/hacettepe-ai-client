#!/bin/sh
# Stops whatever listens on each given port, by PID. Never `pkill -f` or `kill $(pgrep -f ...)`:
# the pattern also matches the shell running the command and kills it.
#
#     sh stop-port.sh 8010 4301
#
# Only pass ports this verification started. A real backend or another project may hold :8000.

for port in "$@"; do
    pid=$(ss -ltnp 2>/dev/null | grep ":$port " | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2)
    if [ -n "$pid" ]; then
        kill "$pid" && echo "stopped :$port (pid $pid)"
    else
        echo "nothing on :$port"
    fi
done
