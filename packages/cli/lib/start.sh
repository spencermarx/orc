#!/usr/bin/env bash
# start.sh — Launch orchestrator session (root or per-project).
# Sourced by bin/orc; _common.sh is already loaded.

set -euo pipefail

orc_start() {
  local project="${1:-}"

  _require tmux "brew install tmux"

  if [[ -z "$project" ]]; then
    # ── Root orchestrator ──────────────────────────────────────────────
    local agent_cmd
    agent_cmd="$(_config_get "defaults.agent_cmd" "claude")"
    _require "$agent_cmd" "Install your preferred agent CLI ($agent_cmd)"

    _tmux_ensure_session

    local persona
    persona="$(_resolve_persona "root-orchestrator")"
    local init_prompt
    init_prompt="Start by running \`orc status\` to check current state. Then greet the user and ask what they'd like to work on across their projects."

    if _tmux_window_exists "orc"; then
      if _tmux_is_dead_window "orc"; then
        # Agent exited — relaunch in the existing window
        _info "Root orchestrator session ended. Relaunching."
        _launch_agent_in_window "orc" "$persona" "" "$init_prompt"
      else
        _info "Root orchestrator running. Attaching."
      fi
      _orc_goto "orc"
      return
    fi

    if ! _tmux_window_exists "status"; then
      _tmux_new_window "status" "$ORC_ROOT"
      _tmux_send "status" "watch -n5 orc status"
    fi

    _tmux_new_window "orc" "$ORC_ROOT"
    _launch_agent_in_window "orc" "$persona" "" "$init_prompt"
    _orc_goto "orc"
  else
    # ── Project orchestrator ───────────────────────────────────────────
    local project_path
    project_path="$(_require_project "$project")"

    local agent_cmd
    agent_cmd="$(_config_get "defaults.agent_cmd" "claude" "$project_path")"
    _require "$agent_cmd" "Install your preferred agent CLI ($agent_cmd)"

    _tmux_ensure_session

    local persona
    persona="$(_resolve_persona "orchestrator" "$project_path")"
    local init_prompt
    init_prompt="You are the orchestrator for project '${project}' at ${project_path}. Start by investigating the codebase to understand its structure and current state. Then ask what work needs to be done."

    if _tmux_window_exists "$project"; then
      if _tmux_is_dead_window "$project"; then
        _info "Orchestrator for '$project' session ended. Relaunching."
        _launch_agent_in_window "$project" "$persona" "$project_path" "$init_prompt"
      else
        _info "Orchestrator for '$project' running. Attaching."
      fi
      _orc_goto "$project"
      return
    fi

    # Insert after the last window in project hierarchy (or at end)
    local after
    after="$(_last_project_window "$project")"
    _tmux_new_window "$project" "$project_path" "$after"
    _launch_agent_in_window "$project" "$persona" "$project_path" "$init_prompt"

    _orc_goto "$project"
  fi
}

# Guard for standalone execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  orc_start "$@"
fi
