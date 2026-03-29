#!/usr/bin/env bash
# header.sh — Agent header pane renderer.
# Runs in a 2-row tmux pane above an agent pane, displaying rich metadata.
# Usage: header.sh --bead=<bead_id> --worktree=<path> --role=<role> --title=<title>
#
# Watches .worker-status for changes and re-renders. Falls back to 2s poll.

set -euo pipefail

# ── Parse arguments ──────────────────────────────────────────────────────────

bead_id=""
worktree=""
role="eng"
title=""
goal=""

for arg in "$@"; do
  case "$arg" in
    --bead=*)     bead_id="${arg#--bead=}" ;;
    --worktree=*) worktree="${arg#--worktree=}" ;;
    --role=*)     role="${arg#--role=}" ;;
    --title=*)    title="${arg#--title=}" ;;
    --goal=*)     goal="${arg#--goal=}" ;;
  esac
done

if [[ -z "$worktree" ]]; then
  echo "header.sh: --worktree required" >&2
  exit 1
fi

# ── Resolve ORC_ROOT for config reading ──────────────────────────────────────

SCRIPT_PATH="${BASH_SOURCE[0]}"
while [[ -L "$SCRIPT_PATH" ]]; do
  SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"
  SCRIPT_PATH="$(readlink "$SCRIPT_PATH")"
  [[ "$SCRIPT_PATH" != /* ]] && SCRIPT_PATH="$SCRIPT_DIR/$SCRIPT_PATH"
done
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"
ORC_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# ── Theme colors (read from config or defaults) ─────────────────────────────

# Simple TOML reader (matches _config_get pattern from _common.sh)
_read_toml_value() {
  local key="$1" default="$2"
  local section="${key%%.*}"
  local field="${key#*.}"
  local config_file="$ORC_ROOT/config.toml"
  local local_config="$ORC_ROOT/config.local.toml"

  # Try local config first, then default
  for f in "$local_config" "$config_file"; do
    [[ -f "$f" ]] || continue
    local val
    val=$(awk -v section="$section" -v field="$field" '
      /^\[/ { in_section = ($0 ~ "\\[" section "\\]") }
      in_section && $1 == field && /=/ {
        sub(/^[^=]+=[ \t]*"?/, ""); sub(/"?[ \t]*$/, ""); print; exit
      }
    ' "$f")
    if [[ -n "$val" ]]; then
      echo "$val"
      return
    fi
  done
  echo "$default"
}

C_ACCENT=$(_read_toml_value "theme.accent" "#00ff88")
C_SECONDARY=$(_read_toml_value "theme.secondary" "#00cc6a")
C_BG=$(_read_toml_value "theme.bg" "#0d1117")
C_FG=$(_read_toml_value "theme.fg" "#e6edf3")
C_MUTED=$(_read_toml_value "theme.muted" "#3b5249")
C_ACTIVITY=$(_read_toml_value "theme.activity" "#d4a017")
C_ERROR=$(_read_toml_value "theme.error" "#f85149")

# ── ANSI color helpers (truecolor) ───────────────────────────────────────────

_hex_to_rgb() {
  local hex="${1#\#}"
  printf "%d;%d;%d" "0x${hex:0:2}" "0x${hex:2:2}" "0x${hex:4:2}"
}

_fg() { printf '\033[38;2;%sm' "$(_hex_to_rgb "$1")"; }
_bg() { printf '\033[48;2;%sm' "$(_hex_to_rgb "$1")"; }
_reset() { printf '\033[0m'; }
_bold() { printf '\033[1m'; }

# ── Status reading ───────────────────────────────────────────────────────────

_read_status() {
  local status_file="$worktree/.worker-status"
  if [[ -f "$status_file" ]]; then
    head -1 "$status_file"
  else
    echo "working"
  fi
}

_format_elapsed() {
  local status_file="$worktree/.worker-status"
  if [[ -f "$status_file" ]]; then
    local mod_time now diff
    if [[ "$OSTYPE" == darwin* ]]; then
      mod_time=$(stat -f %m "$status_file" 2>/dev/null || echo 0)
    else
      mod_time=$(stat -c %Y "$status_file" 2>/dev/null || echo 0)
    fi
    now=$(date +%s)
    diff=$(( now - mod_time ))
    if (( diff < 60 )); then
      echo "${diff}s"
    elif (( diff < 3600 )); then
      echo "$(( diff / 60 ))m"
    else
      echo "$(( diff / 3600 ))h"
    fi
  fi
}

# ── Render ───────────────────────────────────────────────────────────────────

_render() {
  local status elapsed icon color role_label
  status="$(_read_status)"
  elapsed="$(_format_elapsed)"

  # Status → icon + color
  case "$status" in
    working*)
      icon="●"
      color="$C_ACCENT"
      ;;
    review*)
      icon="◎"
      color="$C_ACTIVITY"
      ;;
    blocked*)
      icon="✗"
      color="$C_ERROR"
      ;;
    done*)
      icon="✓"
      color="$C_MUTED"
      ;;
    question*)
      icon="?"
      color="$C_ACTIVITY"
      ;;
    *)
      icon="○"
      color="$C_MUTED"
      ;;
  esac

  # Role label
  case "$role" in
    eng*)     role_label="eng" ;;
    goal*)    role_label="goal" ;;
    review*)  role_label="review" ;;
    *)        role_label="$role" ;;
  esac

  # Extract phase from extended status (e.g., "working:testing")
  local phase=""
  if [[ "$status" == *:* ]]; then
    phase="${status#*:}"
    status="${status%%:*}"
  fi

  # Build the header line
  local cols
  cols=$(tput cols 2>/dev/null || echo 80)

  # Clear and position
  tput cup 0 0 2>/dev/null || true
  tput el 2>/dev/null || true

  # Render: ┌─ ● role: bead │ title │ status elapsed │ phase ─────┐
  local line=""
  line+="$(_fg "$color")$(_bold)┌─ ${icon} ${role_label}: ${bead_id:-unknown}"
  line+="$(_reset)$(_fg "$C_SECONDARY") │ "
  line+="$(_fg "$C_FG")${title:-untitled}"
  line+="$(_fg "$C_SECONDARY") │ "
  line+="$(_fg "$color")${status}${elapsed:+ ${elapsed}}"
  if [[ -n "$phase" ]]; then
    line+="$(_fg "$C_SECONDARY") │ $(_fg "$C_FG")${phase}"
  fi

  # Pad with ─ to fill width and close with ┐
  # (We print the line, then fill remaining space)
  printf '%s' "$line"

  # Fill remaining width with ─
  local visible_len
  # Approximate: strip ANSI sequences for length calculation
  visible_len=$(echo -e "$line" | sed 's/\x1b\[[0-9;]*m//g' | wc -c)
  local remaining=$(( cols - visible_len ))
  if (( remaining > 2 )); then
    printf '%s' "$(_fg "$color")"
    printf ' %0.s─' $(seq 1 $(( remaining - 2 )))
    printf '┐'
  fi
  printf '%s\n' "$(_reset)"

  # Second line (optional): fill with border color
  tput el 2>/dev/null || true
}

# ── Main loop ────────────────────────────────────────────────────────────────

# Initial render
_render

# Watch for changes — try fswatch/inotifywait, fall back to poll
status_file="$worktree/.worker-status"

if command -v fswatch &>/dev/null; then
  fswatch -1 --event Updated "$status_file" 2>/dev/null | while read -r _; do
    _render
  done &
  WATCH_PID=$!
  # Also poll as safety net
  while true; do
    sleep 2
    _render
  done
elif command -v inotifywait &>/dev/null; then
  while true; do
    inotifywait -qq -e modify,create "$status_file" 2>/dev/null || sleep 2
    _render
  done &
  WATCH_PID=$!
  while true; do
    sleep 2
    _render
  done
else
  # Pure polling fallback
  while true; do
    sleep 2
    _render
  done
fi
