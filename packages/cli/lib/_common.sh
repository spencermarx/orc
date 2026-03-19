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

ORC_VERSION="0.1.0"
readonly ORC_VERSION

# ─────────────────────────────────────────────────────────────────────────────
# OS detection
# ─────────────────────────────────────────────────────────────────────────────

_is_macos() { [[ "$OSTYPE" == darwin* ]]; }
_is_linux() { [[ "$OSTYPE" == linux* ]]; }

# ─────────────────────────────────────────────────────────────────────────────
# Reserved names — subcommands that can't be used as project keys
# ─────────────────────────────────────────────────────────────────────────────

ORC_RESERVED_NAMES="init add remove list start spawn review board status halt teardown config leave"

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

    # Status bar
    tmux set-option -t "$ORC_TMUX_SESSION" status-style "bg=${bg},fg=${fg}"
    tmux set-option -t "$ORC_TMUX_SESSION" status-position bottom
    tmux set-option -t "$ORC_TMUX_SESSION" status-left "#[bg=${accent},fg=${bg},bold]  orc  #[bg=${bg},fg=${accent}] "
    tmux set-option -t "$ORC_TMUX_SESSION" status-left-length 20
    tmux set-option -t "$ORC_TMUX_SESSION" status-right "#[fg=${fg}]#(${ORC_ROOT}/packages/cli/lib/status.sh --line 2>/dev/null) #[fg=${border}]│ #[fg=${muted}]v${ORC_VERSION} "
    tmux set-option -t "$ORC_TMUX_SESSION" status-right-length 80

    # Window tabs
    tmux set-window-option -t "$ORC_TMUX_SESSION" window-status-format "#[fg=${muted}] #W "
    tmux set-window-option -t "$ORC_TMUX_SESSION" window-status-current-format "#[bg=${tab_bg},fg=${accent},bold] #W #[bg=${bg}]"
    tmux set-window-option -t "$ORC_TMUX_SESSION" window-status-separator "#[fg=${border}]│"
    tmux set-window-option -t "$ORC_TMUX_SESSION" window-status-activity-style "fg=${activity}"

    # Pane borders
    tmux set-option -t "$ORC_TMUX_SESSION" pane-border-style "fg=${border}"
    tmux set-option -t "$ORC_TMUX_SESSION" pane-active-border-style "fg=${accent}"
    tmux set-option -t "$ORC_TMUX_SESSION" pane-border-format " #[fg=${muted}]#{pane_title} "
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
  tmux send-keys -t "$(_tmux_target "$name")" "$cmd" Enter
}

# Check if a window exists. Supports exact match or prefix match
# (for windows with status suffixes like "orc/bd-a1b2 ●").
_tmux_window_exists() {
  local name="$1"
  tmux list-windows -t "$ORC_TMUX_SESSION" -F '#{window_name}' 2>/dev/null \
    | grep -qE "^${name}( |$)" 2>/dev/null || return 1
}

# Find the actual window name (may have status suffix).
# Always succeeds (returns empty string if not found) — safe with set -e.
_tmux_resolve_window() {
  local name="$1"
  local result
  result="$(tmux list-windows -t "$ORC_TMUX_SESSION" -F '#{window_name}' 2>/dev/null \
    | grep -E "^${name}( |$)" | head -1 || true)"
  echo "$result"
}

# Kill a window by name (handles status suffix matching). Never fails.
_tmux_kill_window() {
  local name="$1"
  local actual
  actual="$(_tmux_resolve_window "$name")"
  if [[ -n "$actual" ]]; then
    tmux kill-window -t "${ORC_TMUX_SESSION}:=${actual}" 2>/dev/null || true
  fi
}

# Navigate to a window. exec for external, switch-client for internal.
# Resolves status suffixes automatically.
_orc_goto() {
  local name="$1"
  local actual
  actual="$(_tmux_resolve_window "$name")"
  actual="${actual:-$name}"
  local target="${ORC_TMUX_SESSION}:=${actual}"

  if [[ -n "${TMUX:-}" ]]; then
    tmux select-window -t "$target" 2>/dev/null || true
    tmux switch-client -t "$target"
  else
    exec tmux attach-session -t "$target"
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# tmux target formatting — handles special characters in window names
# ─────────────────────────────────────────────────────────────────────────────

# Format a tmux target for a window (handles special chars like ● in names).
# The = prefix tells tmux to match the name exactly, not as a pattern.
_tmux_target() {
  local window="$1"
  local pane="${2:-}"
  if [[ -n "$pane" ]]; then
    echo "${ORC_TMUX_SESSION}:=${window}.${pane}"
  else
    echo "${ORC_TMUX_SESSION}:=${window}"
  fi
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
  tmux list-panes -t "$(_tmux_target "$window")" \
    -F '#{pane_index}|#{pane_title}' 2>/dev/null \
    | grep "|${title_pattern}" | head -1 | cut -d'|' -f1 || true
}

_tmux_list_panes() {
  local window="$1"
  tmux list-panes -t "$(_tmux_target "$window")" \
    -F '#{pane_index}|#{pane_title}' 2>/dev/null
}

_tmux_pane_count() {
  local window="$1"
  tmux list-panes -t "$(_tmux_target "$window")" 2>/dev/null | wc -l | tr -d ' '
}

_tmux_send_pane() {
  local window="$1"
  local pane="$2"
  local cmd="$3"
  tmux send-keys -t "$(_tmux_target "$window" "$pane")" "$cmd" Enter
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
# Agent adapter
# ─────────────────────────────────────────────────────────────────────────────

_launch_agent_in_window() {
  local window="$1"
  local persona="$2"
  local project_path="${3:-}"
  local initial_prompt="${4:-}"

  local agent_cmd
  agent_cmd="$(_config_get "defaults.agent_cmd" "claude" "$project_path")"
  local agent_flags
  agent_flags="$(_config_get "defaults.agent_flags" "" "$project_path")"
  local agent_template
  agent_template="$(_config_get "defaults.agent_template" "" "$project_path")"

  # --yolo: append auto-accept flags
  if [[ "${ORC_YOLO:-0}" == "1" ]]; then
    local yolo_flags
    yolo_flags="$(_config_get "defaults.yolo_flags" "" "$project_path")"
    if [[ -z "$yolo_flags" ]]; then
      case "$agent_cmd" in
        claude) yolo_flags="--dangerously-skip-permissions" ;;
      esac
    fi
    [[ -n "$yolo_flags" ]] && agent_flags="${agent_flags:+$agent_flags }$yolo_flags"
  fi

  local persona_file
  persona_file="$(mktemp "${TMPDIR:-/tmp}/orc-persona-XXXXXX")"
  printf '%s' "$persona" > "$persona_file"

  # Build the command
  local cmd
  if [[ -n "$agent_template" ]]; then
    cmd="$agent_template"
    cmd="${cmd//\{cmd\}/$agent_cmd}"
    cmd="${cmd//\{prompt_file\}/$persona_file}"
    cmd="${cmd//\{prompt\}/\$(cat $persona_file)}"
  else
    cmd="$agent_cmd"
    [[ -n "$agent_flags" ]] && cmd="$cmd $agent_flags"
    cmd="$cmd --append-system-prompt \"\$(cat $persona_file)\""
    if [[ -n "$initial_prompt" ]]; then
      local prompt_file
      prompt_file="$(mktemp "${TMPDIR:-/tmp}/orc-prompt-XXXXXX")"
      printf '%s' "$initial_prompt" > "$prompt_file"
      cmd="$cmd \"\$(cat $prompt_file)\""
    fi
  fi

  # Write a launcher script so the raw command isn't echoed to the terminal.
  # The user sees a clean screen, not a wall of $(cat /var/folders/...) noise.
  local launcher
  launcher="$(mktemp "${TMPDIR:-/tmp}/orc-launch-XXXXXX")"
  cat > "$launcher" <<LAUNCH_EOF
#!/usr/bin/env bash
clear
$cmd
LAUNCH_EOF
  chmod +x "$launcher"
  _tmux_send "$window" "bash $launcher"
}

# Launch an agent in the review pane of a worktree window.
# Finds the review pane by title ("review:") — no hardcoded index.
_launch_agent_in_review_pane() {
  local window="$1"
  local persona="$2"
  local project_path="${3:-}"
  local initial_prompt="${4:-}"

  local agent_cmd
  agent_cmd="$(_config_get "defaults.agent_cmd" "claude" "$project_path")"
  local agent_flags
  agent_flags="$(_config_get "defaults.agent_flags" "" "$project_path")"
  local agent_template
  agent_template="$(_config_get "defaults.agent_template" "" "$project_path")"

  if [[ "${ORC_YOLO:-0}" == "1" ]]; then
    local yolo_flags
    yolo_flags="$(_config_get "defaults.yolo_flags" "" "$project_path")"
    if [[ -z "$yolo_flags" ]]; then
      case "$agent_cmd" in
        claude) yolo_flags="--dangerously-skip-permissions" ;;
      esac
    fi
    [[ -n "$yolo_flags" ]] && agent_flags="${agent_flags:+$agent_flags }$yolo_flags"
  fi

  local persona_file
  persona_file="$(mktemp "${TMPDIR:-/tmp}/orc-persona-XXXXXX")"
  printf '%s' "$persona" > "$persona_file"

  local cmd
  if [[ -n "$agent_template" ]]; then
    cmd="$agent_template"
    cmd="${cmd//\{cmd\}/$agent_cmd}"
    cmd="${cmd//\{prompt_file\}/$persona_file}"
    cmd="${cmd//\{prompt\}/\$(cat $persona_file)}"
  else
    cmd="$agent_cmd"
    [[ -n "$agent_flags" ]] && cmd="$cmd $agent_flags"
    cmd="$cmd --append-system-prompt \"\$(cat $persona_file)\""
    if [[ -n "$initial_prompt" ]]; then
      local prompt_file
      prompt_file="$(mktemp "${TMPDIR:-/tmp}/orc-prompt-XXXXXX")"
      printf '%s' "$initial_prompt" > "$prompt_file"
      cmd="$cmd \"\$(cat $prompt_file)\""
    fi
  fi

  local launcher
  launcher="$(mktemp "${TMPDIR:-/tmp}/orc-launch-XXXXXX")"
  cat > "$launcher" <<LAUNCH_EOF
#!/usr/bin/env bash
clear
$cmd
LAUNCH_EOF
  chmod +x "$launcher"
  # Find review pane by title, not hardcoded index
  local review_pane
  review_pane="$(_tmux_find_pane "$window" "review:")"
  review_pane="${review_pane:-1}"  # fallback to 1 if title not set yet
  _tmux_send_pane "$window" "$review_pane" "bash $launcher"
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

  local agent_cmd
  agent_cmd="$(_config_get "defaults.agent_cmd" "claude" "$config_path")"

  local source_dir="$ORC_ROOT/packages/commands"

  case "$agent_cmd" in
    claude)
      local cmd_source="$source_dir/claude/orc"
      local cmd_target="$target_dir/.claude/commands/orc"
      [[ -d "$cmd_source" ]] || return 0
      mkdir -p "$cmd_target"
      for f in "$cmd_source"/*.md; do
        [[ -f "$f" ]] || continue
        ln -sf "$f" "$cmd_target/$(basename "$f")"
      done
      ;;
    windsurf)
      local cmd_source="$source_dir/windsurf"
      local cmd_target="$target_dir/.windsurf/commands"
      [[ -d "$cmd_source" ]] || return 0
      mkdir -p "$cmd_target"
      for f in "$cmd_source"/orc-*.md; do
        [[ -f "$f" ]] || continue
        ln -sf "$f" "$cmd_target/$(basename "$f")"
      done
      ;;
    *)
      _warn "No slash command templates for agent '$agent_cmd'. Skipping command install."
      ;;
  esac
}

# ─────────────────────────────────────────────────────────────────────────────
# Worker helpers
# ─────────────────────────────────────────────────────────────────────────────

_worker_count() {
  local project_path="$1"
  local worktrees_dir="$project_path/.worktrees"
  [[ -d "$worktrees_dir" ]] || { echo 0; return; }
  local count=0
  for d in "$worktrees_dir"/*/; do
    [[ -d "$d" ]] && ((count++))
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
_last_project_window() {
  local project="$1"
  tmux list-windows -t "$ORC_TMUX_SESSION" -F '#{window_name}' 2>/dev/null \
    | grep -E "^${project}(/|$)" | tail -1 || echo "$project"
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
