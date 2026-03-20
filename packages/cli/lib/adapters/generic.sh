#!/usr/bin/env bash
# generic.sh — Fallback adapter for any agent CLI without a dedicated adapter.
#
# This adapter is automatically loaded when defaults.agent_cmd doesn't match
# any file in this directory (e.g., agent_cmd="my-custom-agent" and there's no
# adapters/my-custom-agent.sh). It uses the agent_template config field for
# command construction, or falls back to --append-system-prompt conventions.
#
# To use with a custom CLI, set these in config.toml or config.local.toml:
#
#   [defaults]
#   agent_cmd = "my-agent"
#   agent_template = "my-agent --system {prompt_file} --input {prompt}"
#   yolo_flags = "--auto-approve"
#
# Template placeholders:
#   {cmd}         → value of agent_cmd
#   {prompt_file} → path to temp file containing the persona
#   {prompt}      → $(cat <persona_file>) for inline injection
#
# ─── How to add a dedicated adapter ────────────────────────────────────
# 1. Create a new file: adapters/{cli-name}.sh (name must match agent_cmd)
# 2. Implement all required _adapter_* functions (see contract below)
# 3. That's it — orc auto-discovers adapters by filename. No registry.
#
# Required functions:
#   _adapter_build_launch_cmd  <persona_file> [prompt_file] [agent_flags] [project_path]
#   _adapter_inject_persona    <persona_content> <worktree_path> <role>
#   _adapter_yolo_flags        [project_path]
#   _adapter_install_commands  <source_dir> [project_path]
#
# Optional functions (default no-op if not defined):
#   _adapter_pre_launch        <worktree_path> <role>
#   _adapter_post_teardown     <worktree_path>
# ───────────────────────────────────────────────────────────────────────

_adapter_inject_persona() {
  # Generic adapter: no file-based injection needed.
  # Persona is passed via CLI flags in build_launch_cmd.
  :
}

_adapter_build_launch_cmd() {
  local persona_file="$1"
  local prompt_file="${2:-}"
  local agent_flags="${3:-}"
  local project_path="${4:-}"

  local agent_cmd
  agent_cmd="$(_config_get "defaults.agent_cmd" "claude" "$project_path")"
  local agent_template
  agent_template="$(_config_get "defaults.agent_template" "" "$project_path")"

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
    if [[ -n "$prompt_file" ]]; then
      cmd="$cmd \"\$(cat $prompt_file)\""
    fi
  fi
  echo "$cmd"
}

_adapter_yolo_flags() {
  local project_path="${1:-}"
  local yolo_flags
  yolo_flags="$(_config_get "defaults.yolo_flags" "" "$project_path")"
  echo "$yolo_flags"
}

_adapter_install_commands() {
  local source_dir="$1"
  local project_path="${2:-}"
  _warn "No slash command templates for this agent CLI. Skipping command install."
}

_adapter_pre_launch() {
  :
}

_adapter_post_teardown() {
  :
}
