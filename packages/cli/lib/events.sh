#!/usr/bin/env bash
# events.sh — Stream live events from the orc event daemon.
# Usage: orc events

set -euo pipefail

bin="$(_orc_tui_bin)" || _die "orc-tui binary not found. Build it with: cd packages/tui && go build -o orc-tui ./cmd/orc-tui/"

if ! _orc_tui_is_running; then
  _warn "Event daemon not running. Starting it now..."
  _orc_tui_start_daemon
  sleep 0.5
fi

exec "$bin" --events
