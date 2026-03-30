#!/usr/bin/env bash
# start.sh — Launch orchestrator session (root or per-project).
# Sourced by bin/orc; _common.sh is already loaded.

set -euo pipefail

orc_start() {
  local project="${1:-}"

  # ── Update awareness pre-step ───────────────────────────────────────
  local check_on_launch
  check_on_launch="$(_config_get "updates.check_on_launch" "true")"
  if [[ "$check_on_launch" == "true" ]]; then
    # Check for version updates (non-blocking, 2s timeout)
    local behind_count=""
    if timeout 2 git -C "$ORC_ROOT" fetch origin main --quiet 2>/dev/null; then
      behind_count="$(git -C "$ORC_ROOT" rev-list --count HEAD..origin/main 2>/dev/null || echo "")"
    fi
    if [[ -n "$behind_count" && "$behind_count" -gt 0 ]]; then
      _info "Your orc is $behind_count commit(s) behind main. Run \`git -C $ORC_ROOT pull\` to update."
    fi

    # Post-update hint: detect if HEAD changed since last launch
    local state_dir="$(_orc_state_dir)"
    mkdir -p "$state_dir"
    local last_head_file="$state_dir/last-head"
    local current_head
    current_head="$(git -C "$ORC_ROOT" rev-parse HEAD 2>/dev/null || echo "")"
    if [[ -f "$last_head_file" ]]; then
      local saved_head
      saved_head="$(cat "$last_head_file" 2>/dev/null || echo "")"
      if [[ -n "$current_head" && "$current_head" != "$saved_head" ]]; then
        _info "Updated to latest. Run \`orc doctor\` to check for config changes."
      fi
    fi
    [[ -n "$current_head" ]] && echo "$current_head" > "$last_head_file"
  fi

  _require tmux "brew install tmux"

  if [[ -z "$project" ]]; then
    # ── Root orchestrator ──────────────────────────────────────────────
    local agent_cmd
    agent_cmd="$(_resolve_agent_cmd)"
    _require "$agent_cmd" "Install your preferred agent CLI ($agent_cmd)"

    _tmux_ensure_session

    # Remember if this is a fresh session (for splash screen)
    local _is_new_session="${ORC_TMUX_NEEDS_CLEANUP:-0}"

    local persona
    persona="$(_resolve_persona "root-orchestrator")"
    local init_prompt
    init_prompt="Start by running \`orc status\` to check current state. Then greet the user and ask what they'd like to work on across their projects."

    if _tmux_window_exists "orc"; then
      if _tmux_is_dead_window "orc"; then
        # Agent exited — relaunch in the existing window
        _info "Root orchestrator session ended. Relaunching."
        _tmux_set_pane_title "orc" "0" "root orchestrator"
        _launch_agent_in_window "orc" "$persona" "" "$init_prompt"
      else
        _info "Root orchestrator running. Attaching."
      fi
      _orc_goto "orc"
      return
    fi

    if ! _tmux_window_exists "status"; then
      _tmux_new_window "status" "$ORC_ROOT"
      _tmux_send "status" "while true; do clear; orc status; sleep 5; done"
    fi

    _tmux_new_window "orc" "$ORC_ROOT"
    _tmux_set_pane_title "orc" "0" "root orchestrator"

    # On fresh session: show splash in the pane before launching the agent.
    # The launcher script sequences: splash → clear → agent.
    local show_splash
    show_splash="$(_config_get "tui.show_splash" "true")"
    if [[ "$_is_new_session" == "1" && "$show_splash" == "true" ]]; then
      ORC_SPLASH=1 _launch_agent_in_window "orc" "$persona" "" "$init_prompt"
    else
      _launch_agent_in_window "orc" "$persona" "" "$init_prompt"
    fi
    _orc_goto "orc"
  else
    # ── Project orchestrator ───────────────────────────────────────────
    local project_path
    project_path="$(_require_project "$project")"

    local agent_cmd
    agent_cmd="$(_resolve_agent_cmd "$project_path")"
    _require "$agent_cmd" "Install your preferred agent CLI ($agent_cmd)"

    _tmux_ensure_session
    _detect_ruflo "$project_path"

    # ── Create or reuse project orchestrator worktree ───────────────
    local proj_worktree
    proj_worktree="$(_ensure_project_orch_worktree "$project_path")"

    local persona
    persona="$(_resolve_persona "orchestrator" "$project_path")"
    local init_prompt
    init_prompt="You are the orchestrator for project '${project}'.

Your working directory is an isolated worktree at ${proj_worktree}, based on the project's default branch. You and your sub-agents (scouts) work here freely — the developer's main workspace at ${project_path} is untouched.

IMPORTANT PATHS:
- Working directory (your worktree): ${proj_worktree}
- Project root (for bd commands, git branch operations, and status files): ${project_path}

When running bd commands, use: cd ${project_path} && bd <command>
When creating goal branches, use: git -C ${project_path} branch <type>/<goal-name>

Start by investigating the codebase to understand its structure and current state. Then ask what work needs to be done."
    init_prompt="$(_prepend_setup_instructions "$project_path" "$init_prompt")"

    if _tmux_window_exists "$project"; then
      if _tmux_is_dead_window "$project"; then
        # Dead — tear down the window and recreate below (ensures correct worktree CWD)
        _info "Orchestrator for '$project' session ended. Relaunching."
        tmux kill-window -t "$(_tmux_target "$project")" 2>/dev/null || true
        if _tmux_window_exists "$project"; then
          _die "Failed to remove dead orchestrator window for '$project'." "$EXIT_STATE"
        fi
      else
        _info "Orchestrator for '$project' running."
        # --background: don't switch to the window (used by root orch for multi-project delegation)
        [[ "${ORC_BACKGROUND:-0}" != "1" ]] && _orc_goto "$project"
        return
      fi
    fi

    # Insert after the last window in project hierarchy (or at end)
    local after
    after="$(_last_project_window "$project")"
    _tmux_new_window "$project" "$proj_worktree" "$after"
    _tmux_set_pane_title "$project" "0" "${project} orchestrator"
    _launch_agent_in_window "$project" "$persona" "$project_path" "$init_prompt"

    # --background: don't switch to the window
    [[ "${ORC_BACKGROUND:-0}" != "1" ]] && _orc_goto "$project"
  fi
}

# Guard for standalone execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  orc_start "$@"
fi
