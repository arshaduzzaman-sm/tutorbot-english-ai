#!/usr/bin/env bash
# Prints the hardware tier (SPEC 6.4): minimum | recommended | mock
set -uo pipefail
ram_gb=0
if [ -r /proc/meminfo ]; then
  ram_gb=$(( $(awk '/MemTotal/ {print $2}' /proc/meminfo) / 1024 / 1024 ))
elif command -v sysctl >/dev/null 2>&1; then
  ram_gb=$(( $(sysctl -n hw.memsize 2>/dev/null || echo 0) / 1024 / 1024 / 1024 ))
fi
if [ "$ram_gb" -ge 15 ]; then echo recommended
elif [ "$ram_gb" -ge 7 ]; then echo minimum
else echo mock
fi
