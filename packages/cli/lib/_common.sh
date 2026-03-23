#!/usr/bin/env bash
# _common.sh — Shared helpers for the orc CLI.
# Sourced by bin/orc and all subcommand scripts.

set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# Exit codes
# ─────────────────────────────────────────────────────────────────────────────

readonly EXIT_OK=0
readonly EXIT_USAGE=1
readonly EXIT_STATE=2
readonly EXIT_NO_PROJECT=3

# ─────────────────────────────────────────────────────────────────────────────
# Portable symlink resolution (no readlink -f — works on macOS + Linux)
# ─────────────────────────────────────────────────────────────────────────────

_resolve_symlink() {
  local path="$1"
  while [[ -L "$path" ]]; do
    local dir
    dir="$(cd "$(dirname "$path")" && pwd)"
    path="$(readlink "$path")"
    [[ "$path" != /* ]] && path="$dir/$path"
  done
  echo "$path"
}

# ─────────────────────────────────────────────────────────────────────────────
# ORC_ROOT resolution — follow the `orc` symlink back to the repo
# ─────────────────────────────────────────────────────────────────────────────

_resolve_orc_root() {
  local source="${BASH_SOURCE[1]:-${BASH_SOURCE[0]}}"
  source="$(_resolve_symlink "$source")"
  local dir
  dir="$(cd "$(dirname "$source")" && pwd)"
  while [[ "$dir" != "/" ]]; do
    if [[ -f "$dir/config.toml" && -d "$dir/packages" ]]; then
      echo "$dir"
      return 0
    fi
    dir="$(dirname "$dir")"
  done
  dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
  echo "$dir"
}

ORC_ROOT="$(_resolve_orc_root)"
readonly ORC_ROOT

# Read version from package.json (single source of truth)
ORC_VERSION="$(grep '"version"' "$ORC_ROOT/package.json" | head -1 | sed 's/.*"version": *"//;s/".*//')"
readonly ORC_VERSION

# ─────────────────────────────────────────────────────────────────────────────
# OS detection
# ─────────────────────────────────────────────────────────────────────────────

_is_macos() { [[ "$OSTYPE" == darwin* ]]; }
_is_linux() { [[ "$OSTYPE" == linux* ]]; }

# ─────────────────────────────────────────────────────────────────────────────
# Reserved names — subcommands that can't be used as project keys
# ─────────────────────────────────────────────────────────────────────────────

ORC_RESERVED_NAMES="init add remove list start spawn spawn-goal review board status halt teardown config leave doctor notify setup send"

_is_reserved_name() {
  local name="$1"
  local word
  for word in $ORC_RESERVED_NAMES; do
    [[ "$word" == "$name" ]] && return 0
  done
  return 1
}

# ─────────────────────────────────────────────────────────────────────────────
# Output helpers
# ─────────────────────────────────────────────────────────────────────────────

_info()  { printf '\033[0;34m[orc]\033[0m %s\n' "$*"; }
_warn()  { printf '\033[0;33m[orc]\033[0m %s\n' "$*" >&2; }
_error() { printf '\033[0;31m[orc]\033[0m %s\n' "$*" >&2; }
_die()   { _error "$1"; exit "${2:-$EXIT_USAGE}"; }

# ─────────────────────────────────────────────────────────────────────────────
# Prerequisite checking
# ─────────────────────────────────────────────────────────────────────────────

_require() {
  local cmd="$1"
  local hint="${2:-}"
  if ! command -v "$cmd" &>/dev/null; then
    _error "Required tool '$cmd' not found on PATH."
    [[ -n "$hint" ]] && _error "  Install: $hint"
    return 1
  fi
}

_require_tools() {
  local failed=0
  _require "git" "https://git-scm.com/downloads" || ((failed++))
  _require "tmux" "brew install tmux" || ((failed++))
  _require "bd" "See Beads documentation for install instructions" || ((failed++))
  local agent_cmd
  agent_cmd="$(_config_get "defaults.agent_cmd" "claude")"
  _require "$agent_cmd" "Install your preferred agent CLI ($agent_cmd)" || ((failed++))
  return "$failed"
}

# ─────────────────────────────────────────────────────────────────────────────
# TOML config reader — three-layer resolution
# ─────────────────────────────────────────────────────────────────────────────

_parse_toml() {
  local file="$1"
  [[ -f "$file" ]] || return 0
  local section=""
  while IFS= read -r line || [[ -n "$line" ]]; do
    # Trim leading/trailing whitespace
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    [[ -z "$line" ]] && continue
    # Skip pure comment lines
    [[ "$line" == \#* ]] && continue
    # Section header
    if [[ "$line" =~ ^\[([a-zA-Z0-9._-]+)\]$ ]]; then
      section="${BASH_REMATCH[1]}"
      continue
    fi
    # key = value
    if [[ "$line" =~ ^([a-zA-Z0-9_-]+)[[:space:]]*=[[:space:]]*(.+)$ ]]; then
      local key="${BASH_REMATCH[1]}"
      local val="${BASH_REMATCH[2]}"
      # Strip surrounding quotes first, then handle inline comments
      if [[ "$val" =~ ^\"([^\"]*)\" ]]; then
        val="${BASH_REMATCH[1]}"
      elif [[ "$val" =~ ^\'([^\']*)\' ]]; then
        val="${BASH_REMATCH[1]}"
      else
        # Unquoted value — strip inline comments
        val="${val%%#*}"
        val="${val%"${val##*[![:space:]]}"}"
      fi
      local full_key="${section:+${section}.}${key}"
      printf '%s=%s\n' "$full_key" "$val"
    fi
  done < "$file"
}

_config_get() {
  local key="$1"
  local default="${2:-}"
  local project_path="${3:-}"

  if [[ -n "$project_path" && -f "$project_path/.orc/config.toml" ]]; then
    local val
    val="$(_parse_toml "$project_path/.orc/config.toml" | { grep "^${key}=" || true; } | tail -1 | cut -d= -f2-)"
    if [[ -n "$val" ]]; then echo "$val"; return 0; fi
  fi

  if [[ -f "$ORC_ROOT/config.local.toml" ]]; then
    local val
    val="$(_parse_toml "$ORC_ROOT/config.local.toml" | { grep "^${key}=" || true; } | tail -1 | cut -d= -f2-)"
    if [[ -n "$val" ]]; then echo "$val"; return 0; fi
  fi

  if [[ -f "$ORC_ROOT/config.toml" ]]; then
    local val
    val="$(_parse_toml "$ORC_ROOT/config.toml" | { grep "^${key}=" || true; } | tail -1 | cut -d= -f2-)"
    if [[ -n "$val" ]]; then echo "$val"; return 0; fi
  fi

  echo "$default"
}

# ─────────────────────────────────────────────────────────────────────────────
# Project registry (projects.toml)
# ─────────────────────────────────────────────────────────────────────────────

_projects_file() { echo "$ORC_ROOT/projects.toml"; }

_project_path() {
  local key="$1"
  local file
  file="$(_projects_file)"
  [[ -f "$file" ]] || return 0
  _parse_toml "$file" | { grep "^projects\.${key}\.path=" || true; } | tail -1 | cut -d= -f2-
}

_require_project() {
  local key="$1"
  local path
  path="$(_project_path "$key")"
  if [[ -z "$path" ]]; then
    _die "Project '$key' not found. Run 'orc list' to see registered projects." "$EXIT_NO_PROJECT"
  fi
  echo "$path"
}

_project_keys() {
  local file
  file="$(_projects_file)"
  [[ -f "$file" ]] || return 0
  _parse_toml "$file" | { grep "^projects\." || true; } | sed 's/^projects\.\([^.]*\)\..*/\1/' | sort -u
}

# Detect if CWD is inside a registered project. Prints the project key or empty.
_detect_project_from_cwd() {
  local cwd
  cwd="$(pwd)"
  local key
  for key in $(_project_keys); do
    local proj_path
    proj_path="$(_project_path "$key")"
    if [[ -n "$proj_path" && "$cwd" == "$proj_path"* ]]; then
      echo "$key"
      return 0
    fi
  done
}

# ─────────────────────────────────────────────────────────────────────────────
# tmux helpers
# ─────────────────────────────────────────────────────────────────────────────

readonly ORC_TMUX_SESSION="orc"

_tmux_ensure_session() {
  if ! tmux has-session -t "$ORC_TMUX_SESSION" 2>/dev/null; then
    tmux new-session -d -s "$ORC_TMUX_SESSION" -n "_orc_init"
    ORC_TMUX_NEEDS_CLEANUP=1
  fi

  # ── Propagate ORC_YOLO into the tmux environment ──────────────────
  # Child processes (orc spawn, orc review) inherit this from the tmux session
  if [[ "${ORC_YOLO:-0}" == "1" ]]; then
    tmux set-environment -t "$ORC_TMUX_SESSION" ORC_YOLO 1
  fi

  # ── Functional settings (idempotent — safe to re-apply) ──────────
  tmux set-option -t "$ORC_TMUX_SESSION" history-limit 50000
  tmux set-option -t "$ORC_TMUX_SESSION" alternate-screen off
  tmux set-option -t "$ORC_TMUX_SESSION" base-index 1
  tmux set-option -t "$ORC_TMUX_SESSION" renumber-windows on
  tmux set-option -t "$ORC_TMUX_SESSION" allow-rename off
  tmux set-option -t "$ORC_TMUX_SESSION" monitor-activity on
  tmux set-option -t "$ORC_TMUX_SESSION" visual-activity off
  tmux set-option -t "$ORC_TMUX_SESSION" pane-border-format " #{pane_title} "
  tmux set-option -t "$ORC_TMUX_SESSION" pane-border-status top
  tmux set-option -t "$ORC_TMUX_SESSION" status-interval 10

  # ── Theme (idempotent — re-applied every time so config changes take effect) ──
  local theme_enabled
  theme_enabled="$(_config_get "theme.enabled" "true")"

  if [[ "$theme_enabled" == "true" ]]; then
    local accent bg fg border muted activity
    accent="$(_config_get "theme.accent" "#00ff88")"
    bg="$(_config_get "theme.bg" "#0d1117")"
    fg="$(_config_get "theme.fg" "#8b949e")"
    border="$(_config_get "theme.border" "#30363d")"
    muted="$(_config_get "theme.muted" "#6e7681")"
    activity="$(_config_get "theme.activity" "#d29922")"
    local tab_bg="#161b22"
    local error="#f85149"

    # Status bar
    tmux set-option -t "$ORC_TMUX_SESSION" status-style "bg=${bg},fg=${fg}"
    tmux set-option -t "$ORC_TMUX_SESSION" status-position bottom
    tmux set-option -t "$ORC_TMUX_SESSION" status-left "#[bg=${accent},fg=${bg},bold] ⚔ orc #[fg=${accent},bg=${bg}]▸ "
    tmux set-option -t "$ORC_TMUX_SESSION" status-left-length 20
    tmux set-option -t "$ORC_TMUX_SESSION" status-right "#[fg=${fg}]#(${ORC_ROOT}/packages/cli/lib/status.sh --line 2>/dev/null) #[fg=${border}]│ #[fg=${muted}]v${ORC_VERSION} "
    tmux set-option -t "$ORC_TMUX_SESSION" status-right-length 80

    # Window tabs — show @orc_status indicator after name
    tmux set-window-option -t "$ORC_TMUX_SESSION" window-status-format "#[fg=${muted}] #W #{?@orc_status,#{@orc_status} ,}"
    tmux set-window-option -t "$ORC_TMUX_SESSION" window-status-current-format "#[bg=${tab_bg},fg=${accent},bold] #W #{?@orc_status,#{@orc_status} ,}#[bg=${bg}]"
    tmux set-window-option -t "$ORC_TMUX_SESSION" window-status-separator "#[fg=${border}]│"
    tmux set-window-option -t "$ORC_TMUX_SESSION" window-status-activity-style "fg=${activity}"

    # Pane borders — role-aware icons and colors
    tmux set-option -t "$ORC_TMUX_SESSION" pane-border-style "fg=${border}"
    tmux set-option -t "$ORC_TMUX_SESSION" pane-active-border-style "fg=${accent}"
    tmux set-option -t "$ORC_TMUX_SESSION" pane-border-format " #{?#{m:goal:*,#{pane_title}},#[fg=${accent}]⚔ ,#{?#{m:eng:*,#{pane_title}},#[fg=${fg}]● ,#{?#{m:review:*,#{pane_title}},#[fg=${activity}]✓ ,#[fg=${muted}]}}}#{pane_title} "

    # Message bar
    tmux set-option -t "$ORC_TMUX_SESSION" message-style "bg=${accent},fg=${bg},bold"
    tmux set-option -t "$ORC_TMUX_SESSION" message-command-style "bg=${border},fg=${fg}"

    # Copy/selection mode
    tmux set-option -t "$ORC_TMUX_SESSION" mode-style "bg=${accent},fg=${bg}"
    tmux set-option -t "$ORC_TMUX_SESSION" clock-mode-colour "${accent}"

    # Mouse (configurable — only when themed so custom tmux users aren't affected)
    local mouse_enabled
    mouse_enabled="$(_config_get "theme.mouse" "true")"
    if [[ "$mouse_enabled" == "true" ]]; then
      tmux set-option -t "$ORC_TMUX_SESSION" mouse on
    fi
  else
    # No theming — just functional status-right for health visibility
    tmux set-option -t "$ORC_TMUX_SESSION" status-right "#(${ORC_ROOT}/packages/cli/lib/status.sh --line 2>/dev/null) │ orc v${ORC_VERSION} "
    tmux set-option -t "$ORC_TMUX_SESSION" status-right-length 80
  fi
}

_tmux_cleanup_init() {
  if [[ "${ORC_TMUX_NEEDS_CLEANUP:-0}" == "1" ]]; then
    tmux kill-window -t "${ORC_TMUX_SESSION}:_orc_init" 2>/dev/null || true
    ORC_TMUX_NEEDS_CLEANUP=0
  fi
}

# Create a new tmux window. Supports hierarchical insertion via -a and target.
# Usage: _tmux_new_window "window-name" [working-dir] [after-window]
_tmux_new_window() {
  local name="$1"
  local dir="${2:-$PWD}"
  local after="${3:-}"
  _tmux_ensure_session
  if _tmux_window_exists "$name"; then
    _warn "Window '$name' already exists."
    return 1
  fi
  if [[ -n "$after" ]] && _tmux_window_exists "$after"; then
    tmux new-window -a -t "${ORC_TMUX_SESSION}:${after}" -n "$name" -c "$dir"
  else
    tmux new-window -a -t "$ORC_TMUX_SESSION" -n "$name" -c "$dir"
  fi
  _tmux_cleanup_init
}

_tmux_send() {
  local name="$1"
  local cmd="$2"
  local target
  target="$(_tmux_target "$name")"

  # Use tmux load-buffer (from stdin) + paste-buffer for all text.
  # This bypasses TUI paste detection that causes agent CLIs to buffer
  # multi-line input without submitting. No temp files.
  printf '%s' "$cmd" | tmux load-buffer -
  tmux paste-buffer -t "$target"
  sleep 0.15
  tmux send-keys -t "$target" Enter
}

# Check if a window exists. Supports exact match or prefix match
# (for windows with status suffixes like "orc/bd-a1b2 ●").
_tmux_window_exists() {
  local name="$1"
  tmux list-windows -t "$ORC_TMUX_SESSION" -F '#{window_name}' 2>/dev/null \
    | grep -qxF "$name" 2>/dev/null || return 1
}

# Kill a window by name. Never fails.
_tmux_kill_window() {
  local name="$1"
  if _tmux_window_exists "$name"; then
    tmux kill-window -t "$(_tmux_target "$name")" 2>/dev/null || true
  fi
}

# Navigate to a window. exec for external, switch-client for internal.
_orc_goto() {
  local name="$1"
  local target
  target="$(_tmux_target "$name")"

  if [[ -n "${TMUX:-}" ]]; then
    tmux select-window -t "$target" 2>/dev/null || true
    tmux switch-client -t "$target"
  else
    # Select the target window BEFORE attaching so the user lands on it
    tmux select-window -t "$target" 2>/dev/null || true
    exec tmux attach-session -t "$ORC_TMUX_SESSION"
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# tmux target formatting
# ─────────────────────────────────────────────────────────────────────────────

# Window names are STABLE identifiers: "orc", "status", "myapp", "myapp/bd-a1b2".
# No emojis, no spaces, no status suffixes. Status is shown via @orc_status
# user option, rendered in the window-status-format.

_tmux_target() {
  local window="$1"
  local pane="${2:-}"
  if [[ -n "$pane" ]]; then
    echo "${ORC_TMUX_SESSION}:${window}.${pane}"
  else
    echo "${ORC_TMUX_SESSION}:${window}"
  fi
}

# Set the status indicator for a window (displayed in status bar, not in the name).
_tmux_set_window_status() {
  local window="$1"
  local status="$2"  # e.g., "●", "✓", "✗", "✓✓"
  tmux set-option -t "$(_tmux_target "$window")" @orc_status "$status" 2>/dev/null || true
}

# ─────────────────────────────────────────────────────────────────────────────
# Pane helpers
# ─────────────────────────────────────────────────────────────────────────────

# Split a window into panes.
# Usage: _tmux_split "window-name" [direction: -h|-v] [size: percent] [working-dir]
_tmux_split() {
  local window="$1"
  local direction="${2:--h}"
  local size="${3:-40}"
  local dir="${4:-}"
  local target
  target="$(_tmux_target "$window")"
  local cmd=(tmux split-window "$direction" -l "${size}%" -t "$target")
  [[ -n "$dir" ]] && cmd+=(-c "$dir")
  "${cmd[@]}"
}

_tmux_layout() {
  local window="$1"
  local layout="$2"
  tmux select-layout -t "$(_tmux_target "$window")" "$layout"
}

# ─────────────────────────────────────────────────────────────────────────────
# Pane discovery — all helpers use _tmux_target for safe special-char handling
# ─────────────────────────────────────────────────────────────────────────────

_tmux_find_pane() {
  local window="$1"
  local title_pattern="$2"
  # Try @orc_id first (stable — agent CLIs cannot override)
  local target
  target="$(_tmux_target "$window")"
  local pane_idx
  pane_idx="$(tmux list-panes -t "$target" -F '#{pane_index}' 2>/dev/null | while read idx; do
    local orc_id
    orc_id="$(tmux show-option -t "${target}.${idx}" -p -v @orc_id 2>/dev/null || true)"
    if [[ "$orc_id" == "$title_pattern"* ]]; then
      echo "$idx"
      break
    fi
  done)"
  if [[ -n "$pane_idx" ]]; then
    echo "$pane_idx"
    return
  fi
  # Fallback to title match (for backwards compatibility)
  tmux list-panes -t "$target" \
    -F '#{pane_index}|#{pane_title}' 2>/dev/null \
    | grep "|${title_pattern}" | head -1 | cut -d'|' -f1 || true
}

_tmux_list_panes() {
  local window="$1"
  tmux list-panes -t "$(_tmux_target "$window")" \
    -F '#{pane_index}|#{pane_title}' 2>/dev/null
}

# Set a stable pane identifier that agent CLIs cannot override.
# Use this alongside _tmux_set_pane_title — title is for display, @orc_id is for discovery.
_tmux_set_pane_id() {
  local window="$1"
  local pane="$2"
  local orc_id="$3"
  tmux set-option -t "$(_tmux_target "$window" "$pane")" -p @orc_id "$orc_id" 2>/dev/null || true
}

_tmux_pane_count() {
  local window="$1"
  tmux list-panes -t "$(_tmux_target "$window")" 2>/dev/null | wc -l | tr -d ' '
}

_tmux_send_pane() {
  local window="$1"
  local pane="$2"
  local cmd="$3"
  local target
  target="$(_tmux_target "$window" "$pane")"

  printf '%s' "$cmd" | tmux load-buffer -
  tmux paste-buffer -t "$target"
  sleep 0.15
  tmux send-keys -t "$target" Enter
}

_tmux_kill_pane() {
  local window="$1"
  local pane="$2"
  tmux kill-pane -t "$(_tmux_target "$window" "$pane")" 2>/dev/null || true
}

_tmux_kill_pane_by_title() {
  local window="$1"
  local title_pattern="$2"
  local pane_idx
  pane_idx="$(_tmux_find_pane "$window" "$title_pattern")"
  if [[ -n "$pane_idx" ]]; then
    _tmux_kill_pane "$window" "$pane_idx"
  fi
}

_tmux_capture() {
  local window="$1"
  local pane="${2:-0}"
  local lines="${3:-5}"
  tmux capture-pane -t "$(_tmux_target "$window" "$pane")" -p -S "-${lines}"
}

_tmux_is_pane_alive() {
  local window="$1"
  local pane="${2:-0}"
  local pane_pid
  pane_pid="$(tmux display-message -t "$(_tmux_target "$window" "$pane")" -p '#{pane_pid}' 2>/dev/null || echo "")"
  [[ -z "$pane_pid" ]] && return 1
  pgrep -P "$pane_pid" &>/dev/null && return 0
  return 1
}

# Check if a window's primary pane is a dead shell (agent exited).
# Uses process tree — reliable even when agent binary is a shell wrapper.
_tmux_is_dead_window() {
  local window="$1"
  # Find the engineering pane by title, fall back to pane 0
  local eng_pane
  eng_pane="$(_tmux_find_pane "$window" "eng:")"
  eng_pane="${eng_pane:-0}"
  if _tmux_is_pane_alive "$window" "$eng_pane"; then
    return 1  # alive
  fi
  return 0    # dead
}

# Set a pane title using tmux's select-pane -T (no shell input needed).
_tmux_set_pane_title() {
  local window="$1"
  local pane="$2"
  local title="$3"
  tmux select-pane -t "$(_tmux_target "$window" "$pane")" -T "$title" 2>/dev/null || true
}

# ─────────────────────────────────────────────────────────────────────────────
# Pane layout engine — auto-tiling, registry, min-size, rebalancing
# ─────────────────────────────────────────────────────────────────────────────

# Registry dir lives inside the orc tmp space, keyed by window name.
_pane_registry_dir() {
  local window="$1"
  # Sanitize window name for filesystem (replace / and spaces)
  local safe_name="${window//\//_}"
  safe_name="${safe_name// /_}"
  echo "${TMPDIR:-/tmp}/orc-pane-registry/${safe_name}"
}

# Add a pane to the registry for a window.
# Usage: _pane_registry_add "window-name" "pane-id" "role" [min_width] [min_height]
_pane_registry_add() {
  local window="$1"
  local pane_id="$2"
  local role="$3"
  local min_width="${4:-20}"
  local min_height="${5:-10}"
  local dir
  dir="$(_pane_registry_dir "$window")"
  mkdir -p "$dir"
  printf '%s\n' "role=${role}" "min_width=${min_width}" "min_height=${min_height}" > "$dir/${pane_id}"
}

# Remove a pane from the registry.
# Usage: _pane_registry_remove "window-name" "pane-id"
_pane_registry_remove() {
  local window="$1"
  local pane_id="$2"
  local dir
  dir="$(_pane_registry_dir "$window")"
  rm -f "$dir/${pane_id}" 2>/dev/null || true
}

# List registered panes for a window (prints "pane_id|role|min_width|min_height" per line).
_pane_registry_list() {
  local window="$1"
  local dir
  dir="$(_pane_registry_dir "$window")"
  [[ -d "$dir" ]] || return 0
  local f
  for f in "$dir"/*; do
    [[ -f "$f" ]] || continue
    local pane_id role min_width min_height
    pane_id="$(basename "$f")"
    role="$(grep '^role=' "$f" | cut -d= -f2-)"
    min_width="$(grep '^min_width=' "$f" | cut -d= -f2-)"
    min_height="$(grep '^min_height=' "$f" | cut -d= -f2-)"
    printf '%s|%s|%s|%s\n' "$pane_id" "$role" "$min_width" "$min_height"
  done
}

# Clear the entire registry for a window (e.g., on window teardown).
_pane_registry_clear() {
  local window="$1"
  local dir
  dir="$(_pane_registry_dir "$window")"
  rm -rf "$dir" 2>/dev/null || true
}

# Check minimum size constraints for all registered panes in a window.
# Returns 0 if all panes meet their min-size, 1 if any violate.
# Prints violations to stderr.
# Usage: _pane_min_size_check "window-name"
_pane_min_size_check() {
  local window="$1"
  local target
  target="$(_tmux_target "$window")"
  local violations=0

  while IFS='|' read -r pane_id role min_width min_height; do
    [[ -z "$pane_id" ]] && continue
    # Get actual pane dimensions
    local actual_width actual_height
    actual_width="$(tmux display-message -t "${target}.${pane_id}" -p '#{pane_width}' 2>/dev/null || echo 0)"
    actual_height="$(tmux display-message -t "${target}.${pane_id}" -p '#{pane_height}' 2>/dev/null || echo 0)"
    if [[ "$actual_width" -lt "$min_width" ]] || [[ "$actual_height" -lt "$min_height" ]]; then
      _warn "Pane ${pane_id} (${role}): ${actual_width}x${actual_height} below minimum ${min_width}x${min_height}"
      ((violations++))
    fi
  done < <(_pane_registry_list "$window")

  [[ "$violations" -eq 0 ]]
}

# Auto-tile panes in a window using an appropriate layout.
# Picks the best tmux layout based on pane count and window dimensions.
# Usage: _tmux_tile_panes "window-name" [layout-hint: "columns"|"rows"|"auto"]
_tmux_tile_panes() {
  local window="$1"
  local hint="${2:-auto}"
  local target
  target="$(_tmux_target "$window")"

  local pane_count
  pane_count="$(_tmux_pane_count "$window")"

  # Single pane — nothing to tile
  [[ "$pane_count" -le 1 ]] && return 0

  local layout
  if [[ "$hint" == "columns" ]]; then
    layout="even-horizontal"
  elif [[ "$hint" == "rows" ]]; then
    layout="even-vertical"
  elif [[ "$hint" == "main-vertical" ]]; then
    layout="main-vertical"
  else
    # Auto: detect goal windows (pane 0 title starts with "goal:") → always main-vertical
    local pane0_title
    pane0_title="$(tmux display-message -t "${target}.0" -p '#{pane_title}' 2>/dev/null || echo "")"
    if [[ "$pane0_title" == goal:* ]]; then
      layout="main-vertical"
    else
      # Non-goal windows: pick layout based on pane count and window aspect ratio
      local win_width win_height
      win_width="$(tmux display-message -t "$target" -p '#{window_width}' 2>/dev/null || echo 120)"
      win_height="$(tmux display-message -t "$target" -p '#{window_height}' 2>/dev/null || echo 40)"
      if [[ "$pane_count" -eq 2 ]]; then
        if [[ "$win_width" -ge 160 ]]; then
          layout="even-horizontal"
        else
          layout="even-vertical"
        fi
      elif [[ "$pane_count" -le 4 ]]; then
        layout="tiled"
      else
        layout="tiled"
      fi
    fi
  fi

  tmux select-layout -t "$target" "$layout" 2>/dev/null || true
}

# Rebalance panes after adding or removing a pane.
# Re-applies tiling and checks min-size constraints.
# Usage: _tmux_rebalance "window-name" [layout-hint]
_tmux_rebalance() {
  local window="$1"
  local hint="${2:-auto}"

  # Re-tile
  _tmux_tile_panes "$window" "$hint"

  # Check constraints — warn but don't fail
  _pane_min_size_check "$window" || true
}

# Apply the canonical goal-window layout: pane 0 full-height left (~60%),
# all other panes stacked in the right column.
# Usage: _tmux_apply_goal_layout "window-name"
_tmux_apply_goal_layout() {
  local window="$1"
  local target
  target="$(_tmux_target "$window")"
  local pane_count
  pane_count="$(_tmux_pane_count "$window")"
  [[ "$pane_count" -le 1 ]] && return 0

  # Apply main-vertical: pane 0 is the full-height left "main" pane
  tmux select-layout -t "$target" main-vertical 2>/dev/null || true

  # Set pane 0 to ~60% of window width
  local win_width
  win_width="$(tmux display-message -t "$target" -p '#{window_width}' 2>/dev/null || echo 120)"
  local main_width=$(( win_width * 60 / 100 ))
  tmux resize-pane -t "${target}.0" -x "$main_width" 2>/dev/null || true
}

# ─────────────────────────────────────────────────────────────────────────────
# Pane overflow — find/create overflow windows when panes won't fit
# ─────────────────────────────────────────────────────────────────────────────

# Configurable min-size thresholds for pane overflow checks.
# These define the minimum dimensions a child pane must have after a split.
_pane_overflow_min_width() {
  local project_path="${1:-}"
  _config_get "layout.min_pane_width" "40" "$project_path"
}

_pane_overflow_min_height() {
  local project_path="${1:-}"
  _config_get "layout.min_pane_height" "10" "$project_path"
}

# Check if adding a pane to a window would violate min-size constraints.
# Simulates a main-vertical split: the right column gets divided among children.
# Returns 0 if adding a pane would fit, 1 if it would violate constraints.
# Usage: _tmux_can_fit_pane "window-name" [min_width] [min_height]
_tmux_can_fit_pane() {
  local window="$1"
  local min_width="${2:-40}"
  local min_height="${3:-10}"
  local target
  target="$(_tmux_target "$window")"

  local win_width win_height pane_count
  win_width="$(tmux display-message -t "$target" -p '#{window_width}' 2>/dev/null || echo 0)"
  win_height="$(tmux display-message -t "$target" -p '#{window_height}' 2>/dev/null || echo 0)"
  pane_count="$(_tmux_pane_count "$window")"

  # If the window doesn't exist or has no dimensions, can't fit
  [[ "$win_width" -eq 0 || "$win_height" -eq 0 ]] && return 1

  # In main-vertical layout, pane 0 gets ~60% width, the rest share the right column.
  # After adding a new pane, the right column will have (pane_count) child panes
  # (pane_count includes pane 0, so children = pane_count - 1, plus the new one = pane_count).
  local right_col_width right_col_children child_height

  # Right column width: window width minus ~60% for pane 0, minus 1 for separator
  right_col_width=$(( win_width * 40 / 100 ))
  [[ "$right_col_width" -lt "$min_width" ]] && return 1

  # Count right-column "slots" (engineer panes), not total panes.
  # Review panes sub-split engineers vertically and share a slot.
  if [[ "$pane_count" -le 1 ]]; then
    right_col_children=1
  else
    local eng_count=0
    local pane_titles
    pane_titles="$(tmux list-panes -t "$target" -F '#{pane_title}' 2>/dev/null || true)"
    while IFS= read -r title; do
      case "$title" in
        eng:*) ((eng_count++)) || true ;;
      esac
    done <<< "$pane_titles"
    # After adding the new engineer, there will be eng_count + 1 slots
    right_col_children=$(( eng_count + 1 ))
    # Floor: at least 1 slot
    [[ "$right_col_children" -lt 1 ]] && right_col_children=1
  fi

  # Each child pane gets equal vertical space minus separators (1 line each)
  local separators=$(( right_col_children - 1 ))
  child_height=$(( (win_height - separators) / right_col_children ))

  [[ "$child_height" -ge "$min_height" ]] && return 0
  return 1
}

# List all overflow windows for a base window name.
# Prints window names like "base:2", "base:3", etc. (one per line, sorted).
# Usage: _tmux_overflow_windows "base-window-name"
_tmux_overflow_windows() {
  local base="$1"
  # Escape regex-special chars in the base name (e.g., dots, slashes are literal)
  local escaped_base
  escaped_base="$(printf '%s' "$base" | sed 's/[][\\.^$*+?(){}|/]/\\&/g')"
  tmux list-windows -t "$ORC_TMUX_SESSION" -F '#{window_name}' 2>/dev/null \
    | grep -E "^${escaped_base}:[0-9]+$" | sort -t: -k2 -n || true
}

# Find the best window to add a pane to, creating overflow windows as needed.
# Returns the target window name (the base window, or an overflow like "base:2").
# Fills numbering gaps: prefers :2 over :4 when :2 is available.
# Usage: _tmux_pane_target "base-window-name" [project_path]
_tmux_pane_target() {
  local base="$1"
  local project_path="${2:-}"

  local min_w min_h
  min_w="$(_pane_overflow_min_width "$project_path")"
  min_h="$(_pane_overflow_min_height "$project_path")"

  # First: try the primary window
  if _tmux_window_exists "$base" && _tmux_can_fit_pane "$base" "$min_w" "$min_h"; then
    echo "$base"
    return 0
  fi

  # If base doesn't exist yet, it will be created by the caller — it can fit
  if ! _tmux_window_exists "$base"; then
    echo "$base"
    return 0
  fi

  # Second: try existing overflow windows
  local overflow
  overflow="$(_tmux_overflow_windows "$base")"
  local win
  while IFS= read -r win; do
    [[ -z "$win" ]] && continue
    if _tmux_can_fit_pane "$win" "$min_w" "$min_h"; then
      echo "$win"
      return 0
    fi
  done <<< "$overflow"

  # Third: create a new overflow window, filling gaps
  local next_num=2
  while true; do
    local candidate="${base}:${next_num}"
    if ! _tmux_window_exists "$candidate"; then
      # Create the overflow window (inserted after the last related window)
      local after
      after="$(_last_project_window "$base")"
      # Also check existing overflow windows for correct insertion point
      local last_overflow
      last_overflow="$(echo "$overflow" | tail -1)"
      [[ -n "$last_overflow" ]] && after="$last_overflow"
      _tmux_new_window "$candidate" "$PWD" "$after"
      echo "$candidate"
      return 0
    fi
    ((next_num++))
  done
}

# Combined helper: split a pane, set its title, register it, rebalance, and
# launch an agent. This is the single entry point for spawning a child agent
# as a pane inside a parent window.
#
# Usage: _tmux_split_with_agent "target-window" "pane-title" "persona" \
#            [project_path] [initial_prompt] [working_dir]
#
# The target window should be obtained from _tmux_pane_target() first.
# Uses main-vertical layout. Pane 0 is assumed to be the orchestrator.
_tmux_split_with_agent() {
  local window="$1"
  local pane_title="$2"
  local persona="$3"
  local project_path="${4:-}"
  local initial_prompt="${5:-}"
  local working_dir="${6:-$PWD}"

  local target
  target="$(_tmux_target "$window")"

  # Split horizontally (creates a new pane to the right)
  local cmd=(tmux split-window -h -t "$target")
  [[ -n "$working_dir" ]] && cmd+=(-c "$working_dir")
  "${cmd[@]}"

  # The new pane is now the active pane — get its index
  local new_pane
  new_pane="$(tmux display-message -t "$target" -p '#{pane_index}' 2>/dev/null)"

  # Set pane title
  _tmux_set_pane_title "$window" "$new_pane" "$pane_title"
  _tmux_set_pane_id "$window" "$new_pane" "$pane_title"

  # Register in pane registry
  local min_w min_h
  min_w="$(_pane_overflow_min_width "$project_path")"
  min_h="$(_pane_overflow_min_height "$project_path")"
  _pane_registry_add "$window" "$new_pane" "$pane_title" "$min_w" "$min_h"

  # Apply goal-window layout (main-vertical with 60% pane 0) and check constraints
  _tmux_apply_goal_layout "$window"
  _pane_min_size_check "$window" || true

  # Build agent command and launch it in the new pane via adapter
  _send_to_pane() {
    _tmux_send_pane "$window" "$new_pane" "bash $1"
  }

  # Extract role hint from pane title (e.g., "eng: bd-xxx" → engineer, "goal: name" → goal-orchestrator)
  local role="engineer"
  case "$pane_title" in
    goal:*) role="goal-orchestrator" ;;
    eng:*)  role="engineer" ;;
  esac

  _build_and_launch _send_to_pane "$project_path" "$persona" "$initial_prompt" "$role" "$working_dir"
}

# ─────────────────────────────────────────────────────────────────────────────
# Goal branch helpers
# ─────────────────────────────────────────────────────────────────────────────

# Return the branching strategy from config (natural language or empty).
_config_get_branching_strategy() {
  local project_path="${1:-}"
  _config_get "branching.strategy" "" "$project_path"
}

# Determine the branch prefix for a goal type.
# Types: feat, fix, task (default: task).
_goal_branch_prefix() {
  local goal_type="${1:-task}"
  case "$goal_type" in
    feat|feature) echo "feat/" ;;
    fix|bugfix)   echo "fix/" ;;
    task|*)       echo "task/" ;;
  esac
}

# Create a goal branch off the current HEAD (or a specified base).
# Usage: _create_goal_branch <project_path> <goal_name> [goal_type] [base_branch]
# Prints the created branch name to stdout.
_create_goal_branch() {
  local project_path="$1"
  local goal_name="$2"
  local goal_type="${3:-task}"
  local base_branch="${4:-}"

  local prefix
  prefix="$(_goal_branch_prefix "$goal_type")"
  local branch="${prefix}${goal_name}"

  # Verify the branch doesn't already exist
  if git -C "$project_path" show-ref --verify --quiet "refs/heads/${branch}" 2>/dev/null; then
    _die "Branch '${branch}' already exists." "$EXIT_STATE"
  fi

  local create_args=("$branch")
  if [[ -n "$base_branch" ]]; then
    create_args+=("$base_branch")
  fi

  git -C "$project_path" branch "${create_args[@]}"
  echo "$branch"
}

# Fast-forward merge a bead branch into its goal branch.
# Usage: _merge_bead_to_goal <project_path> <goal_branch> <bead_branch>
_merge_bead_to_goal() {
  local project_path="$1"
  local goal_branch="$2"
  local bead_branch="$3"

  # Verify both branches exist
  if ! git -C "$project_path" show-ref --verify --quiet "refs/heads/${goal_branch}" 2>/dev/null; then
    _die "Goal branch '${goal_branch}' not found." "$EXIT_STATE"
  fi
  if ! git -C "$project_path" show-ref --verify --quiet "refs/heads/${bead_branch}" 2>/dev/null; then
    _die "Bead branch '${bead_branch}' not found." "$EXIT_STATE"
  fi

  # Attempt fast-forward merge without switching branches
  # git fetch . src:dst does a fast-forward update of dst to src
  if ! git -C "$project_path" fetch . "${bead_branch}:${goal_branch}" 2>/dev/null; then
    _error "Fast-forward merge failed for '${bead_branch}' → '${goal_branch}'."
    _error "The goal branch may have diverged. Manual merge required."
    return 1
  fi

  _info "Merged '${bead_branch}' → '${goal_branch}' (fast-forward)."
}

# Find the goal branch for a given goal name by checking all type prefixes.
# Usage: _find_goal_branch <project_path> <goal_name>
# Prints the branch name (e.g., "feat/my-goal") or exits with error.
# Tolerates receiving the full branch name (e.g., "feat/my-goal") — strips
# known type prefixes before searching so agents can pass either format.
_find_goal_branch() {
  local project_path="$1"
  local goal_name="$2"

  # Strip type prefix if the caller accidentally passed the full branch name
  goal_name="${goal_name#feat/}"
  goal_name="${goal_name#fix/}"
  goal_name="${goal_name#task/}"

  local prefix
  for prefix in feat/ fix/ task/; do
    local candidate="${prefix}${goal_name}"
    if git -C "$project_path" show-ref --verify --quiet "refs/heads/${candidate}" 2>/dev/null; then
      echo "$candidate"
      return 0
    fi
  done
  _die "No goal branch found for '${goal_name}'. Expected feat/${goal_name}, fix/${goal_name}, or task/${goal_name}." "$EXIT_STATE"
}

# Check if a goal branch exists for a given goal name (any type prefix).
# Returns 0 if found, 1 if not.
# Tolerates receiving the full branch name — strips known type prefixes.
_goal_branch_exists() {
  local project_path="$1"
  local goal_name="$2"

  # Strip type prefix if the caller accidentally passed the full branch name
  goal_name="${goal_name#feat/}"
  goal_name="${goal_name#fix/}"
  goal_name="${goal_name#task/}"

  local prefix
  for prefix in feat/ fix/ task/; do
    if git -C "$project_path" show-ref --verify --quiet "refs/heads/${prefix}${goal_name}" 2>/dev/null; then
      return 0
    fi
  done
  return 1
}

# Delete a goal branch.
# Usage: _delete_goal_branch <project_path> <goal_branch> [--force]
_delete_goal_branch() {
  local project_path="$1"
  local goal_branch="$2"
  local force="${3:-}"

  if ! git -C "$project_path" show-ref --verify --quiet "refs/heads/${goal_branch}" 2>/dev/null; then
    _warn "Branch '${goal_branch}' does not exist. Nothing to delete."
    return 0
  fi

  local delete_flag="-d"
  [[ "$force" == "--force" ]] && delete_flag="-D"

  git -C "$project_path" branch "$delete_flag" "$goal_branch"
  _info "Deleted branch '${goal_branch}'."
}

# ─────────────────────────────────────────────────────────────────────────────
# Agent adapter — sourced-script pattern for CLI-specific logic
# ─────────────────────────────────────────────────────────────────────────────

# Load the adapter for the configured agent CLI.
# Sources adapters/{agent_cmd}.sh, falling back to adapters/generic.sh.
# Sourced once per session — subsequent calls are no-ops.
_load_adapter() {
  [[ -n "${_ORC_ADAPTER_LOADED+x}" ]] && return 0

  local project_path="${1:-}"
  local agent_cmd
  agent_cmd="$(_config_get "defaults.agent_cmd" "claude" "$project_path")"

  local adapter_dir="$ORC_ROOT/packages/cli/lib/adapters"
  local adapter_file="$adapter_dir/${agent_cmd}.sh"

  if [[ -f "$adapter_file" ]]; then
    # shellcheck source=/dev/null
    source "$adapter_file"
  else
    # shellcheck source=/dev/null
    source "$adapter_dir/generic.sh"
  fi

  # Validate required functions exist
  local required_fn
  for required_fn in _adapter_build_launch_cmd _adapter_inject_persona _adapter_yolo_flags _adapter_install_commands; do
    if ! declare -F "$required_fn" &>/dev/null; then
      _die "Adapter '${agent_cmd}' missing required function: ${required_fn}" "$EXIT_STATE"
    fi
  done

  # Provide default no-ops for optional functions
  if ! declare -F _adapter_pre_launch &>/dev/null; then
    _adapter_pre_launch() { :; }
  fi
  if ! declare -F _adapter_post_teardown &>/dev/null; then
    _adapter_post_teardown() { :; }
  fi

  export _ORC_ADAPTER_LOADED=1
}

# Common logic for building and launching an agent command.
# Handles persona file creation, yolo flags, ruflo, and launcher script.
# Returns nothing — sends the launch command to the specified tmux target.
#
# Usage: _build_and_launch <send_fn> <project_path> <persona> [initial_prompt] [role] [working_dir]
#   send_fn: a function that takes one arg (the launcher path) and sends it
_build_and_launch() {
  local send_fn="$1"
  local project_path="$2"
  local persona="$3"
  local initial_prompt="${4:-}"
  local role="${5:-engineer}"
  local working_dir="${6:-}"

  _load_adapter "$project_path"

  local agent_flags
  agent_flags="$(_config_get "defaults.agent_flags" "" "$project_path")"

  # --yolo: append auto-accept flags via adapter
  if [[ "${ORC_YOLO:-0}" == "1" ]]; then
    local yolo_flags
    yolo_flags="$(_adapter_yolo_flags "$project_path")"
    [[ -n "$yolo_flags" ]] && agent_flags="${agent_flags:+$agent_flags }$yolo_flags"
  fi

  # Ruflo: ensure MCP server registered, append persona block
  _ensure_ruflo_mcp
  local ruflo_block
  ruflo_block="$(_ruflo_persona_block)"
  [[ -n "$ruflo_block" ]] && persona="${persona}${ruflo_block}"

  # Inject persona into worktree (for file-based CLIs like OpenCode, Gemini)
  if [[ -n "$working_dir" ]]; then
    _adapter_inject_persona "$persona" "$working_dir" "$role"
  fi

  # Pre-launch hook
  if [[ -n "$working_dir" ]]; then
    _adapter_pre_launch "$working_dir" "$role"
  fi

  # Note: Temp files (persona, prompt, launcher) are written to $TMPDIR and
  # intentionally NOT cleaned up with a trap. Agent sessions may run for hours
  # or days — a trap on EXIT would fire when the orc CLI exits (not when the
  # agent exits), deleting files the agent still references. OS-level $TMPDIR
  # cleanup handles eventual removal.
  local persona_file
  persona_file="$(mktemp "${TMPDIR:-/tmp}/orc-persona-XXXXXX")"
  printf '%s' "$persona" > "$persona_file"

  local prompt_file=""
  if [[ -n "$initial_prompt" ]]; then
    prompt_file="$(mktemp "${TMPDIR:-/tmp}/orc-prompt-XXXXXX")"
    printf '%s' "$initial_prompt" > "$prompt_file"
  fi

  # Build the command via adapter
  local cmd
  cmd="$(_adapter_build_launch_cmd "$persona_file" "$prompt_file" "$agent_flags" "$project_path")"

  # Write launcher script for clean terminal output
  local launcher
  launcher="$(mktemp "${TMPDIR:-/tmp}/orc-launch-XXXXXX")"
  cat > "$launcher" <<LAUNCH_EOF
#!/usr/bin/env bash
clear
$cmd
LAUNCH_EOF
  chmod +x "$launcher"

  # Send to tmux via the provided function
  "$send_fn" "$launcher"
}

_launch_agent_in_window() {
  local window="$1"
  local persona="$2"
  local project_path="${3:-}"
  local initial_prompt="${4:-}"

  _send_to_window() {
    _tmux_send "$window" "bash $1"
  }

  _build_and_launch _send_to_window "$project_path" "$persona" "$initial_prompt"
}

# Launch an agent in the review pane of a worktree window.
# Finds the review pane by title ("review:") — no hardcoded index.
_launch_agent_in_review_pane() {
  local window="$1"
  local persona="$2"
  local project_path="${3:-}"
  local initial_prompt="${4:-}"

  _send_to_review_pane() {
    local review_pane
    review_pane="$(_tmux_find_pane "$window" "review:")"
    review_pane="${review_pane:-1}"  # fallback to 1 if title not set yet
    _tmux_send_pane "$window" "$review_pane" "bash $1"
  }

  _build_and_launch _send_to_review_pane "$project_path" "$persona" "$initial_prompt" "reviewer"
}

# ─────────────────────────────────────────────────────────────────────────────
# Persona resolution
# ─────────────────────────────────────────────────────────────────────────────

_resolve_persona() {
  local role="$1"
  local project_path="${2:-}"

  if [[ -n "$project_path" && -f "$project_path/.orc/${role}.md" ]]; then
    cat "$project_path/.orc/${role}.md"
    return 0
  fi

  local default_path="$ORC_ROOT/packages/personas/${role}.md"
  if [[ -f "$default_path" ]]; then
    cat "$default_path"
    return 0
  fi

  _error "Persona '${role}' not found."
  return 1
}

# ─────────────────────────────────────────────────────────────────────────────
# Command installation — symlink slash commands into agent config dirs
# ─────────────────────────────────────────────────────────────────────────────

_install_commands() {
  local target_dir="$1"
  local config_path="${2:-}"

  _load_adapter "$config_path"
  _adapter_install_commands "$ORC_ROOT/packages/commands" "$config_path"
}

# Ensure all orc runtime directories are excluded from git in the target project.
# Uses .git/info/exclude — git's built-in per-repo ignore that doesn't touch .gitignore.
_orc_git_exclude() {
  local project_path="$1"

  local git_dir
  git_dir="$(git -C "$project_path" rev-parse --git-dir 2>/dev/null || true)"
  [[ -n "$git_dir" ]] || return 0

  # Resolve to absolute path
  if [[ "$git_dir" != /* ]]; then
    git_dir="$project_path/$git_dir"
  fi

  local exclude_file="$git_dir/info/exclude"
  mkdir -p "$(dirname "$exclude_file")"
  touch "$exclude_file"

  # All orc runtime paths that may appear in a registered project
  local patterns=(".beads/" ".worktrees/" ".goals/")
  local pattern
  for pattern in "${patterns[@]}"; do
    if ! grep -qxF "$pattern" "$exclude_file" 2>/dev/null; then
      echo "$pattern" >> "$exclude_file"
    fi
  done
}

# ─────────────────────────────────────────────────────────────────────────────
# Worker helpers
# ─────────────────────────────────────────────────────────────────────────────

_goal_status_dir() {
  local project_path="$1"
  local goal="$2"
  echo "$project_path/.worktrees/.orc-state/goals/$goal"
}

_goal_worker_status() {
  local project_path="$1"
  local goal="$2"
  local status_file
  status_file="$(_goal_status_dir "$project_path" "$goal")/.worker-status"
  if [[ -f "$status_file" ]]; then
    head -1 "$status_file"
  else
    echo "unknown"
  fi
}

_worker_count() {
  local project_path="$1"
  local worktrees_dir="$project_path/.worktrees"
  [[ -d "$worktrees_dir" ]] || { echo 0; return; }
  local count=0
  for d in "$worktrees_dir"/*/; do
    [[ -d "$d" ]] || continue
    # Skip internal state directories (not worktrees)
    [[ "$(basename "$d")" == .* ]] && continue
    ((count++)) || true
  done
  echo "$count"
}

_worker_status() {
  local worktree="$1"
  local status_file="$worktree/.worker-status"
  if [[ -f "$status_file" ]]; then
    head -1 "$status_file"
  else
    echo "unknown"
  fi
}

# Find the last window name matching a project prefix (for hierarchical insertion).
# Matches all three levels: {project}, {project}/{goal}, {project}/{goal}/{bead}.
_last_project_window() {
  local project="$1"
  tmux list-windows -t "$ORC_TMUX_SESSION" -F '#{window_name}' 2>/dev/null \
    | grep -E "^${project}(/|$)" | tail -1 || echo "$project"
}

# List all active goal orchestrator panes for a project.
# Prints goal names (one per line).
# Goals are panes with title "goal: <name>" inside the project window (or overflow).
_list_active_goals() {
  local project="$1"

  # Helper: extract goal names from panes with "goal: *" titles in a window
  _extract_goals_from_window() {
    local win="$1"
    tmux list-panes -t "$(_tmux_target "$win")" \
      -F '#{pane_title}' 2>/dev/null \
      | grep -E "^goal: " | sed 's/^goal: //' || true
  }

  # Check the primary project window
  if _tmux_window_exists "$project"; then
    _extract_goals_from_window "$project"
  fi

  # Check overflow windows
  local overflow
  overflow="$(_tmux_overflow_windows "$project")"
  local win
  while IFS= read -r win; do
    [[ -z "$win" ]] && continue
    _extract_goals_from_window "$win"
  done <<< "$overflow"
}

# ─────────────────────────────────────────────────────────────────────────────
# Notification helpers — condition-based notifications with auto-resolution
# ─────────────────────────────────────────────────────────────────────────────

_orc_state_dir() {
  echo "${TMPDIR:-/tmp}/orc-state"
}

_orc_notify_log() {
  echo "$(_orc_state_dir)/notifications.log"
}

# Append a notification to the log. Optionally triggers OS notification.
# Usage: _orc_notify <level> <scope> <message>
# Levels: PLAN_REVIEW, PLAN_INVALIDATED, QUESTION, BLOCKED, GOAL_REVIEW,
#         DELIVERY, GOAL_COMPLETE, ESCALATION, RESOLVED
_orc_notify() {
  local level="$1"
  local scope="$2"
  local message="$3"

  local log_file
  log_file="$(_orc_notify_log)"
  mkdir -p "$(dirname "$log_file")"

  local timestamp
  timestamp="$(date -u '+%Y-%m-%dT%H:%M:%S')"

  printf '%s %s %s "%s"\n' "$timestamp" "$level" "$scope" "$message" >> "$log_file"

  # OS-level notification (only for condition notifications, not RESOLVED/GOAL_COMPLETE)
  if [[ "$level" != "RESOLVED" && "$level" != "GOAL_COMPLETE" ]]; then
    local system_notify
    system_notify="$(_config_get "notifications.system" "false")"
    if [[ "$system_notify" == "true" ]]; then
      local sound_flag=""
      local sound_enabled
      sound_enabled="$(_config_get "notifications.sound" "false")"
      if _is_macos && command -v terminal-notifier &>/dev/null; then
        local tn_args=(-title "orc" -subtitle "$level" -message "$message" -group "orc-$scope")
        [[ "$sound_enabled" == "true" ]] && tn_args+=(-sound default)
        terminal-notifier "${tn_args[@]}" &>/dev/null &
      elif _is_linux && command -v notify-send &>/dev/null; then
        notify-send "orc — $level" "$message" &>/dev/null &
      fi
    fi
  fi
}

# Convenience: resolve (clear) a notification for a scope.
# Usage: _orc_resolve <scope> <message>
_orc_resolve() {
  local scope="$1"
  local message="$2"
  _orc_notify "RESOLVED" "$scope" "$message"
}

# Count active (unresolved) notifications.
# An active notification is one without a matching RESOLVED entry for its scope.
_orc_notify_active_count() {
  local log_file
  log_file="$(_orc_notify_log)"
  [[ -f "$log_file" ]] || { echo 0; return; }

  # Collect all notification scopes and resolution scopes
  local count=0
  local resolved_scopes=""

  # Read log in reverse to find resolved scopes first
  while IFS= read -r line; do
    local level scope
    level="$(echo "$line" | awk '{print $2}')"
    scope="$(echo "$line" | awk '{print $3}')"

    if [[ "$level" == "RESOLVED" ]]; then
      resolved_scopes="${resolved_scopes}${scope}"$'\n'
    fi
  done < "$log_file"

  # Count notifications without matching RESOLVED
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    local level scope
    level="$(echo "$line" | awk '{print $2}')"
    scope="$(echo "$line" | awk '{print $3}')"

    # Skip RESOLVED entries and GOAL_COMPLETE (always immediately resolved)
    [[ "$level" == "RESOLVED" ]] && continue

    # Check if this scope has been resolved
    if ! echo "$resolved_scopes" | grep -qxF "$scope"; then
      ((count++)) || true
    fi
  done < "$log_file"

  echo "$count"
}

# List active (unresolved) notifications.
# Prints: <index> <level> <scope> <message>
_orc_notify_active_list() {
  local log_file
  log_file="$(_orc_notify_log)"
  [[ -f "$log_file" ]] || return 0

  local resolved_scopes=""
  while IFS= read -r line; do
    local level scope
    level="$(echo "$line" | awk '{print $2}')"
    scope="$(echo "$line" | awk '{print $3}')"
    [[ "$level" == "RESOLVED" ]] && resolved_scopes="${resolved_scopes}${scope}"$'\n'
  done < "$log_file"

  local idx=0
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    local level scope
    level="$(echo "$line" | awk '{print $2}')"
    scope="$(echo "$line" | awk '{print $3}')"
    [[ "$level" == "RESOLVED" ]] && continue
    if ! echo "$resolved_scopes" | grep -qxF "$scope"; then
      ((idx++)) || true
      echo "$line"
    fi
  done < "$log_file"
}

# Set a pane's border to the activity color (attention indicator).
# Usage: _orc_pane_highlight <window> <pane_index>
_orc_pane_highlight() {
  local window="$1"
  local pane="$2"
  local activity_color
  activity_color="$(_config_get "theme.activity" "#d29922")"
  tmux select-pane -t "$(_tmux_target "$window" "$pane")" \
    -P "fg=default,bg=default" \
    -p "fg=${activity_color}" 2>/dev/null || true
}

# Clear a pane's border highlight (restore default).
# Usage: _orc_pane_unhighlight <window> <pane_index>
_orc_pane_unhighlight() {
  local window="$1"
  local pane="$2"
  local border_color
  border_color="$(_config_get "theme.border" "#30363d")"
  tmux select-pane -t "$(_tmux_target "$window" "$pane")" \
    -P "fg=default,bg=default" \
    -p "fg=${border_color}" 2>/dev/null || true
}

# ─────────────────────────────────────────────────────────────────────────────
# Approval policy
# ─────────────────────────────────────────────────────────────────────────────

_check_approval() {
  local action="$1"
  local project_path="${2:-}"

  # --yolo skips all approval gates
  [[ "${ORC_YOLO:-0}" == "1" ]] && return 0

  local policy
  policy="$(_config_get "approval.${action}" "ask" "$project_path")"

  if [[ "$policy" == "ask" ]]; then
    printf '%s' "Proceed with ${action}? [y/N] "
    local answer
    read -r answer
    if [[ ! "$answer" =~ ^[Yy] ]]; then
      _info "Cancelled."
      return 1
    fi
  fi
  return 0
}

# ─────────────────────────────────────────────────────────────────────────────
# Ruflo detection — optional agent capability enhancer
# ─────────────────────────────────────────────────────────────────────────────

_detect_ruflo() {
  local project_path="${1:-}"

  # Already detected this session — skip
  if [[ -n "${ORC_RUFLO_AVAILABLE+x}" ]]; then
    return 0
  fi

  local mode
  mode="$(_config_get "agents.ruflo" "off" "$project_path")"

  # Default: Ruflo is never used, never detected, never mentioned
  if [[ "$mode" == "off" ]]; then
    export ORC_RUFLO_AVAILABLE=0
    return 0
  fi

  # Check for ruflo availability
  local found=0
  if command -v ruflo &>/dev/null; then
    found=1
  elif npx ruflo --version &>/dev/null 2>&1; then
    found=1
  fi

  if [[ "$found" -eq 1 ]]; then
    export ORC_RUFLO_AVAILABLE=1
    return 0
  fi

  # Not found
  if [[ "$mode" == "require" ]]; then
    _die "Ruflo is required but not found. Install via: npm install -g ruflo@latest" "$EXIT_STATE"
  fi

  # auto mode, not found — silently proceed
  export ORC_RUFLO_AVAILABLE=0
}

# Ensure the Ruflo MCP server is registered with the agent CLI.
# Called once per session before the first agent spawn.
_ensure_ruflo_mcp() {
  # Skip when Ruflo is not available
  [[ "${ORC_RUFLO_AVAILABLE:-0}" == "1" ]] || return 0

  # Already ensured this session — skip
  [[ -n "${ORC_RUFLO_MCP_READY+x}" ]] && return 0

  # Check if ruflo MCP server is already registered
  if claude mcp list 2>/dev/null | grep -q "ruflo"; then
    export ORC_RUFLO_MCP_READY=1
    return 0
  fi

  # Register the Ruflo MCP server
  _info "Registering Ruflo MCP server..."
  if claude mcp add ruflo -- npx ruflo@latest mcp start 2>/dev/null; then
    export ORC_RUFLO_MCP_READY=1
  else
    _warn "Failed to register Ruflo MCP server — continuing without it"
    export ORC_RUFLO_AVAILABLE=0
  fi
}

# Return a persona enhancement block when Ruflo is active, empty otherwise.
_ruflo_persona_block() {
  [[ "${ORC_RUFLO_AVAILABLE:-0}" == "1" ]] || return 0

  cat <<'RUFLO_BLOCK'

## Ruflo Tools Available

You have access to Ruflo MCP tools in this session:

- `agent_spawn`: Spawn sub-agents for parallel sub-tasks within your bead
- `memory_search`: Search shared context and knowledge across sessions
- `memory_store`: Store context and findings for other agents to discover

Use these only when they clearly accelerate your work. Default to normal
implementation for straightforward tasks. Do not force Ruflo usage when
standard approaches suffice.
RUFLO_BLOCK
}
