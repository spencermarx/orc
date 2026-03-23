#!/usr/bin/env bash
# setup.sh — Launch project orchestrator in setup mode for guided config assembly.

set -euo pipefail

if [[ $# -lt 1 ]]; then
  _die "Usage: orc setup <project>" "$EXIT_USAGE"
fi

project="$1"
project_path="$(_require_project "$project")"

_require tmux "brew install tmux"

agent_cmd=""
agent_cmd="$(_config_get "defaults.agent_cmd" "claude" "$project_path")"
_require "$agent_cmd" "Install your preferred agent CLI ($agent_cmd)"

_tmux_ensure_session
_detect_ruflo "$project_path"

# ── Read authoritative context at launch time ─────────────────────────────

# Config schema: read the committed defaults (the canonical field reference)
config_schema=""
if [[ -f "$ORC_ROOT/config.toml" ]]; then
  config_schema="$(cat "$ORC_ROOT/config.toml")"
fi

# Existing project config (if reconfiguring)
existing_config_content="No existing config found. Starting fresh."
existing_config_hint=""
if [[ -f "$project_path/.orc/config.toml" ]]; then
  existing_config_hint="An existing config file was found at .orc/config.toml — use it as a starting point and preserve values the user has already set."
  existing_config_content="$(cat "$project_path/.orc/config.toml")"
fi

# YOLO hint
yolo_boundary="- Never write the config without user approval"
if [[ "${ORC_YOLO:-0}" == "1" ]]; then
  yolo_boundary="- YOLO mode: do NOT ask for confirmation. Scout, use sensible defaults, assemble, and write immediately. Present the final config for awareness only."
fi

# ── Build the briefing with all context inlined ───────────────────────────
# Use a temp file to avoid heredoc quoting issues with apostrophes/backticks.

briefing_file="$(mktemp "${TMPDIR:-/tmp}/orc-setup-briefing-XXXXXX")"

cat > "$briefing_file" <<'STATIC_EOF'
You are running in SETUP MODE — a temporary operating mode for guided project config assembly.

## CRITICAL: Config Schema (Authoritative Reference)

The config below is the COMPLETE schema for .orc/config.toml. These are the ONLY valid sections and fields. Do NOT invent sections or fields that do not appear here. If you discover a project need that no field covers, mention it to the user as a recommendation but do NOT add it to the config.

Project configs should ONLY include sections relevant to the project — omit sections the user does not need (e.g., do not include [board] or [layout] unless the user asks). The [defaults] section is also typically omitted from project configs (it uses global defaults).

--- BEGIN CONFIG SCHEMA (TOML) ---
STATIC_EOF

cat "$ORC_ROOT/config.toml" >> "$briefing_file"

cat >> "$briefing_file" <<'STATIC2_EOF'
--- END CONFIG SCHEMA ---

## Your Workflow

1. Scout the project — spawn parallel scout sub-agents to investigate:
   - Planning tools: does the project have OpenSpec (openspec/), Kiro specs, or other planning artifacts? What planning-related slash commands or skills are available?
   - Review tools: does the project have OCR (.ocr/), or other review tooling? What review-related slash commands or skills are available?
   - Delivery infrastructure: what is the branching strategy (check git log)? What CI/CD pipeline exists? Is the gh CLI available?
   - Ticketing integration: are there MCPs or skills for Jira, Linear, GitHub Issues? Check .claude/ for MCP configs.
   - Test infrastructure: what test framework is used? How are tests run? Check package.json scripts, Makefile, CLAUDE.md.
   - Project AI configuration: what is in CLAUDE.md, .claude/ rules? What skills and slash commands are installed?

2. Present findings — show what you found, organized by lifecycle phase. Be specific: name the tools, paths, and commands you discovered.

3. Converse about each lifecycle phase (skip phases where no relevant tools were found):
   - Planning: what tool creates the plan, how to decompose plan artifacts into beads, when to involve user
   - Dispatch: what should every engineer receive in their assignment (regardless of planning)
   - Review: what tool, pass criteria, feedback handling
   - Delivery: what happens on completion, when to involve user
   - Approval gates: dispatch, review, merge confirmation preferences
   - Tickets: integration strategy (only if ticketing tools found)

4. Assemble the config — using ONLY fields from the schema above. For each field you populate:
   - Use values that reference the actual tools/commands you discovered
   - Add descriptive inline TOML comments explaining the value
   - Leave fields empty that the user did not express a preference for (empty = sensible defaults)

5. Present for review — show the complete assembled config to the user

6. Write the file — after explicit approval, write to .orc/config.toml

## Boundaries

- ONLY use sections and fields from the schema above — do not invent new ones
- Skip questions for tools that are not available
- This session ends after the config is written
STATIC2_EOF

# Append dynamic context
{
  echo ""
  echo "## Your Task"
  echo ""
  echo "Help the user set up the .orc/config.toml for project ${project} at ${project_path}."
  echo ""
  echo "${existing_config_hint}"
  echo ""
  echo "## Existing Project Config"
  echo ""
  echo "${existing_config_content}"
  echo ""
  echo "## Migration Awareness"
  echo ""
  echo "If the existing config above contains fields that do not match the schema, read ${ORC_ROOT}/migrations/CHANGELOG.md to understand what changed and why. Focus only on the entries relevant to the stale fields you found — do not read the entire history unless needed."
  echo "If there is no existing config (fresh setup), skip migration context entirely."
  echo ""
  echo "${yolo_boundary}"
} >> "$briefing_file"

briefing="$(cat "$briefing_file")"
rm -f "$briefing_file"

# ── Launch ────────────────────────────────────────────────────────────────

persona=""
persona="$(_resolve_persona "orchestrator" "$project_path")"

if _tmux_window_exists "$project"; then
  if _tmux_is_dead_window "$project"; then
    _launch_agent_in_window "$project" "$persona" "$project_path" "$briefing"
  elif [[ "${ORC_YOLO:-0}" == "1" ]]; then
    _tmux_send "$project" "$briefing"
  else
    _info "Orchestrator for '${project}' is already running."
    _info "Send setup instructions directly or teardown first."
    _orc_goto "$project"
    exit "$EXIT_OK"
  fi
else
  after=""
  after="$(_last_project_window "$project")"
  _tmux_new_window "$project" "$project_path" "$after"
  _launch_agent_in_window "$project" "$persona" "$project_path" "$briefing"
fi

_orc_goto "$project"
