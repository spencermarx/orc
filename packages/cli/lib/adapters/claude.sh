#!/usr/bin/env bash
# claude.sh — Adapter for Claude Code (claude CLI).

_adapter_inject_persona() {
  # Claude uses --append-system-prompt flag, no file injection needed.
  :
}

_adapter_build_launch_cmd() {
  local persona_file="$1"
  local prompt_file="${2:-}"
  local agent_flags="${3:-}"

  local cmd="claude"
  [[ -n "$agent_flags" ]] && cmd="$cmd $agent_flags"
  cmd="$cmd --append-system-prompt \"\$(cat $persona_file)\""
  if [[ -n "$prompt_file" ]]; then
    cmd="$cmd \"\$(cat $prompt_file)\""
  fi
  echo "$cmd"
}

_adapter_yolo_flags() {
  echo "--dangerously-skip-permissions"
}

_adapter_install_commands() {
  local source_dir="$1"
  local project_path="${2:-}"

  # Prefer canonical commands, fall back to legacy
  local canonical_dir="$ORC_ROOT/packages/commands/_canonical"
  local legacy_dir="$ORC_ROOT/packages/commands/claude/orc"
  local cmd_target="$HOME/.claude/commands/orc"
  mkdir -p "$cmd_target"

  if [[ -d "$canonical_dir" ]] && ls "$canonical_dir"/*.md &>/dev/null; then
    for f in "$canonical_dir"/*.md; do
      [[ -f "$f" ]] || continue
      ln -sf "$f" "$cmd_target/$(basename "$f")"
    done
  elif [[ -d "$legacy_dir" ]]; then
    for f in "$legacy_dir"/*.md; do
      [[ -f "$f" ]] || continue
      ln -sf "$f" "$cmd_target/$(basename "$f")"
    done
  fi
}

_adapter_pre_launch() {
  :
}

_adapter_post_teardown() {
  :
}
