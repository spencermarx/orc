#!/usr/bin/env bash
# codex.sh — Adapter for OpenAI Codex CLI (openai/codex).
#
# Prompt delivery: AGENTS.md file in worktree (auto-discovered by Codex)
# Commands:        no custom slash command mechanism (built-in only)
# Auto-approval:   --dangerously-bypass-approvals-and-sandbox (alias: --yolo)
# Docs:            https://developers.openai.com/codex/cli/reference

_adapter_inject_persona() {
  local persona_content="$1"
  local worktree_path="$2"
  local role="${3:-engineer}"

  # Codex auto-discovers AGENTS.md from the git root through CWD.
  # Write persona as AGENTS.md in the worktree so Codex picks it up naturally.
  local agents_file="$worktree_path/AGENTS.md"

  cat > "$agents_file" <<AGENTS_EOF
<!-- orc-managed: do not edit manually -->
${persona_content}
AGENTS_EOF
}

_adapter_build_launch_cmd() {
  local persona_file="$1"
  local prompt_file="${2:-}"
  local agent_flags="${3:-}"

  local cmd="codex"
  [[ -n "$agent_flags" ]] && cmd="$cmd $agent_flags"
  # Persona is delivered via AGENTS.md (written by _adapter_inject_persona),
  # not via CLI flags — Codex reads it automatically.
  if [[ -n "$prompt_file" ]]; then
    cmd="$cmd \"\$(cat $prompt_file)\""
  fi
  echo "$cmd"
}

_adapter_yolo_flags() {
  echo "--dangerously-bypass-approvals-and-sandbox"
}

_adapter_install_commands() {
  local source_dir="$1"
  local project_path="${2:-}"

  # Codex has built-in slash commands but no custom command registration mechanism.
  # Project context is delivered via AGENTS.md (handled by _adapter_inject_persona).
  _warn "Codex CLI does not support custom slash commands. orc commands are available via AGENTS.md context."
}

_adapter_pre_launch() {
  :
}

_adapter_post_teardown() {
  local worktree_path="$1"
  # Only remove AGENTS.md if it was created by orc
  local agents_file="$worktree_path/AGENTS.md"
  if [[ -f "$agents_file" ]] && head -1 "$agents_file" | grep -qF "orc-managed"; then
    rm -f "$agents_file"
  fi
}
