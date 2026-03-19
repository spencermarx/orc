#!/usr/bin/env bash
# review.sh — Launch review pane in an engineer's worktree window.

set -euo pipefail

orc_review() {
  if [[ $# -ne 2 ]]; then
    _die "Usage: orc review <project> <bead>" "$EXIT_USAGE"
  fi

  local project="$1"
  local bead="$2"

  local project_path
  project_path="$(_require_project "$project")"

  _require tmux "brew install tmux"
  local agent_cmd
  agent_cmd="$(_config_get "defaults.agent_cmd" "claude" "$project_path")"
  _require "$agent_cmd" "Install your preferred agent CLI ($agent_cmd)"

  local worktree_dir="$project_path/.worktrees/$bead"
  if [[ ! -d "$worktree_dir" ]]; then
    _die "Worktree for bead '$bead' not found at $worktree_dir" "$EXIT_STATE"
  fi

  _check_approval "review" "$project_path" || exit "$EXIT_OK"

  local window_name="${project}/${bead}"

  if ! _tmux_window_exists "$window_name"; then
    _die "Worktree window for '$window_name' not found." "$EXIT_STATE"
  fi

  # Kill ALL non-engineering panes (everything except pane 0).
  # This ensures stale review panes from prior rounds are cleaned up.
  # Claude Code overrides pane titles, so title-based discovery is unreliable.
  local stale_panes
  stale_panes="$(tmux list-panes -t "$(_tmux_target "$window_name")" -F '#{pane_index}' 2>/dev/null \
    | grep -v '^0$' | sort -rn || true)"
  for p in $stale_panes; do
    _tmux_kill_pane "$window_name" "$p"
  done

  # Create review pane — vertical split on right, 40% width
  _tmux_split "$window_name" "-h" "40" "$worktree_dir"

  # Brief pause so the new pane's shell initializes
  sleep 0.5

  # Review pane is always pane 1 now (we killed everything except 0, then split)
  local review_pane=1

  # Determine review round from .worker-feedback history
  local round=1
  if [[ -f "$worktree_dir/.worker-feedback" ]]; then
    round=$(( $(grep -c "^VERDICT:" "$worktree_dir/.worker-feedback" 2>/dev/null || echo 0) + 1 ))
  fi

  # Set review pane title (used for discovery)
  _tmux_set_pane_title "$window_name" "$review_pane" "review: ${project}/${bead} (round $round)"

  # Launch review process BEFORE renaming the window
  # (renaming changes $window_name which breaks subsequent tmux targeting)

  # Build reviewer persona (always used, even with custom review command)
  local persona
  persona="$(_resolve_persona "reviewer" "$project_path")"

  local review_instructions
  review_instructions="$(_config_get "review.instructions" "" "$project_path")"
  if [[ -n "$review_instructions" ]]; then
    persona="$persona

$review_instructions"
  fi

  # Determine initial prompt: custom review command or default
  local review_cmd
  review_cmd="$(_config_get "review.command" "" "$project_path")"

  local init_prompt
  if [[ -n "$review_cmd" ]]; then
    init_prompt="$review_cmd"
  else
    init_prompt="Review the engineer's changes now. Read .orch-assignment.md for context, run git diff main to see changes, run tests, then write your verdict to .worker-feedback. Start immediately."
  fi

  # Build agent command with persona
  local agent_cmd
  agent_cmd="$(_config_get "defaults.agent_cmd" "claude" "$project_path")"
  local agent_flags
  agent_flags="$(_config_get "defaults.agent_flags" "" "$project_path")"
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

  local prompt_file
  prompt_file="$(mktemp "${TMPDIR:-/tmp}/orc-prompt-XXXXXX")"
  printf '%s' "$init_prompt" > "$prompt_file"

  local cmd="$agent_cmd"
  [[ -n "$agent_flags" ]] && cmd="$cmd $agent_flags"
  cmd="$cmd --append-system-prompt \"\$(cat $persona_file)\" \"\$(cat $prompt_file)\""

  local launcher
  launcher="$(mktemp "${TMPDIR:-/tmp}/orc-launch-XXXXXX")"
  cat > "$launcher" <<LAUNCH_EOF
#!/usr/bin/env bash
clear
$cmd
LAUNCH_EOF
  chmod +x "$launcher"
  _tmux_send_pane "$window_name" "$review_pane" "bash $launcher"

  # Update status indicator (displayed in status bar, not in window name)
  _tmux_set_window_status "$window_name" "✓"

  _info "Review pane launched for bead '$bead' (round $round)."
}

orc_review "$@"
