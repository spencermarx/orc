#!/usr/bin/env bash
# gemini.sh — Adapter for Google Gemini CLI (google-gemini/gemini-cli).
#
# Prompt delivery: GEMINI.md file in worktree (auto-discovered hierarchically)
# Commands:        TOML files in .gemini/commands/ (project or global)
# Auto-approval:   --yolo / -y (or --approval-mode=yolo)
# Docs:            https://github.com/google-gemini/gemini-cli

# Marker comment to identify orc-generated GEMINI.md files
readonly _ORC_GEMINI_MARKER="<!-- orc-managed: do not edit manually -->"

_adapter_inject_persona() {
  local persona_content="$1"
  local worktree_path="$2"
  local role="${3:-engineer}"

  local gemini_file="$worktree_path/GEMINI.md"

  cat > "$gemini_file" <<GEMINI_EOF
${_ORC_GEMINI_MARKER}
${persona_content}
GEMINI_EOF
}

_adapter_build_launch_cmd() {
  local persona_file="$1"
  local prompt_file="${2:-}"
  local agent_flags="${3:-}"

  # Persona is delivered via GEMINI.md (written by _adapter_inject_persona),
  # not via CLI flags — Gemini reads it automatically.
  local cmd="gemini"
  [[ -n "$agent_flags" ]] && cmd="$cmd $agent_flags"
  if [[ -n "$prompt_file" ]]; then
    # -i: interactive session with initial prompt
    cmd="$cmd -i \"\$(cat $prompt_file)\""
  fi
  echo "$cmd"
}

_adapter_yolo_flags() {
  echo "--yolo"
}

_adapter_install_commands() {
  local source_dir="$1"
  local project_path="${2:-}"

  local canonical_dir="$ORC_ROOT/packages/commands/_canonical"
  [[ -d "$canonical_dir" ]] || return 0

  # Gemini uses TOML files in .gemini/commands/orc/ (namespaced → /orc:<name>)
  local cmd_target
  if [[ -n "$project_path" ]]; then
    cmd_target="$project_path/.gemini/commands/orc"
  else
    cmd_target="$HOME/.gemini/commands/orc"
  fi
  mkdir -p "$cmd_target"

  for f in "$canonical_dir"/*.md; do
    [[ -f "$f" ]] || continue
    local name description body
    name="$(basename "$f" .md)"

    # Extract description from YAML front-matter
    description="$(sed -n '/^---$/,/^---$/{ /^description:/{ s/^description: *//; s/^"//; s/"$//; p; }; }' "$f")"
    [[ -z "$description" ]] && description="orc ${name} command"

    # Extract body (everything after second ---)
    body="$(awk '/^---$/{c++; next} c>=2' "$f")"

    # Write TOML command file
    cat > "$cmd_target/${name}.toml" <<TOML_EOF
description = "${description}"
prompt = """
${body}
"""
TOML_EOF
  done
}

_adapter_pre_launch() {
  local worktree_path="$1"
  local role="${2:-engineer}"
  # GEMINI.md is written by _adapter_inject_persona, called from the main flow
}

_adapter_post_teardown() {
  local worktree_path="$1"
  # Only remove GEMINI.md if it was created by orc
  local gemini_file="$worktree_path/GEMINI.md"
  if [[ -f "$gemini_file" ]] && head -1 "$gemini_file" | grep -qF "$_ORC_GEMINI_MARKER"; then
    rm -f "$gemini_file"
  fi
}
