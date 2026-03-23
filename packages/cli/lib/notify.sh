#!/usr/bin/env bash
# notify.sh — View, navigate, and manage notifications.

set -euo pipefail

_notify_display_active() {
  local entries
  entries="$(_orc_notify_active_list)"

  if [[ -z "$entries" ]]; then
    _info "No active notifications."
    return 0
  fi

  local idx=0
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    ((idx++)) || true
    local level scope message
    level="$(echo "$line" | awk '{print $2}')"
    scope="$(echo "$line" | awk '{print $3}')"
    message="$(echo "$line" | sed 's/^[^ ]* [^ ]* [^ ]* "//' | sed 's/"$//')"

    # Derive tmux window from scope (project/goal from project/goal/bead)
    local window
    window="$(echo "$scope" | cut -d/ -f1-2)"

    printf '  %d. ● %-18s %s — %s\n' "$idx" "$level" "$scope" "$message"
    printf '     → orc:%s\n\n' "$window"
  done <<< "$entries"

  # Interactive navigation
  if [[ -t 0 ]]; then
    printf '  Go to [1-%d], or Enter to dismiss: ' "$idx"
    local choice
    read -r choice
    if [[ "$choice" =~ ^[0-9]+$ ]] && [[ "$choice" -ge 1 ]] && [[ "$choice" -le "$idx" ]]; then
      _notify_goto "$choice"
    fi
  fi
}

_notify_goto() {
  local target_idx="$1"
  local entries
  entries="$(_orc_notify_active_list)"

  local idx=0
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    ((idx++)) || true
    if [[ "$idx" -eq "$target_idx" ]]; then
      local scope
      scope="$(echo "$line" | awk '{print $3}')"
      local window
      window="$(echo "$scope" | cut -d/ -f1-2)"

      if _tmux_window_exists "$window"; then
        _orc_goto "$window"
      else
        _warn "Window '$window' not found."
      fi
      return 0
    fi
  done <<< "$entries"

  _warn "Notification #$target_idx not found."
}

_notify_display_all() {
  local log_file
  log_file="$(_orc_notify_log)"

  if [[ ! -f "$log_file" ]]; then
    _info "No notification history."
    return 0
  fi

  # Collect resolved scopes
  local resolved_scopes=""
  while IFS= read -r line; do
    local level scope
    level="$(echo "$line" | awk '{print $2}')"
    scope="$(echo "$line" | awk '{print $3}')"
    [[ "$level" == "RESOLVED" ]] && resolved_scopes="${resolved_scopes}${scope}"$'\n'
  done < "$log_file"

  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    local timestamp level scope message
    timestamp="$(echo "$line" | awk '{print $1}')"
    level="$(echo "$line" | awk '{print $2}')"
    scope="$(echo "$line" | awk '{print $3}')"
    message="$(echo "$line" | sed 's/^[^ ]* [^ ]* [^ ]* "//' | sed 's/"$//')"

    if [[ "$level" == "RESOLVED" ]]; then
      printf '  ✓ %-18s %s — %s (%s)\n' "RESOLVED" "$scope" "$message" "$timestamp"
    elif echo "$resolved_scopes" | grep -qxF "$scope"; then
      printf '  ✓ %-18s %s — %s (%s)\n' "$level" "$scope" "$message" "$timestamp"
    else
      printf '  ● %-18s %s — %s (%s)\n' "$level" "$scope" "$message" "$timestamp"
    fi
  done < "$log_file"
}

_notify_clear() {
  local entries
  entries="$(_orc_notify_active_list)"

  if [[ -z "$entries" ]]; then
    _info "No active notifications to clear."
    return 0
  fi

  local count=0
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    local scope
    scope="$(echo "$line" | awk '{print $3}')"
    _orc_resolve "$scope" "Manually cleared"
    ((count++)) || true
  done <<< "$entries"

  _info "Resolved $count active notification(s)."
}

# ── Entry point ──────────────────────────────────────────────────────────────

case "${1:-}" in
  --all)
    _notify_display_all
    ;;
  --clear)
    _notify_clear
    ;;
  --goto)
    if [[ -z "${2:-}" ]]; then
      _die "Usage: orc notify --goto <N>" "$EXIT_USAGE"
    fi
    _notify_goto "$2"
    ;;
  "")
    _notify_display_active
    ;;
  *)
    _die "Usage: orc notify [--all|--clear|--goto <N>]" "$EXIT_USAGE"
    ;;
esac
