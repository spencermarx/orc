#!/usr/bin/env bash
# init.sh — First-time setup for orc CLI.

if ! declare -f _info &>/dev/null; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  source "$SCRIPT_DIR/_common.sh"
fi

# ── Show the orc ────────────────────────────────────────────────────────────

if [[ -f "$ORC_ROOT/assets/orc-ascii.txt" ]]; then
  cat "$ORC_ROOT/assets/orc-ascii.txt"
fi
echo ""
echo "  orc v${ORC_VERSION} — Multi-project agent orchestration"
echo '  "Looks like work'"'"'s back on the menu, boys!"'
echo ""

# ── Determine install target ────────────────────────────────────────────────

orc_bin="$ORC_ROOT/packages/cli/bin/orc"
install_dir=""
if echo "$PATH" | tr ':' '\n' | grep -qx "$HOME/.local/bin"; then
  install_dir="$HOME/.local/bin"
else
  install_dir="/usr/local/bin"
fi

# ── Symlink orc binary ─────────────────────────────────────────────────────

target="$install_dir/orc"
if [[ -L "$target" ]] && [[ "$(_resolve_symlink "$target")" == "$(_resolve_symlink "$orc_bin")" ]]; then
  _info "✓ Symlink already correct: $target"
else
  _info "Creating symlink: $target → $orc_bin"
  mkdir -p "$install_dir"
  ln -sf "$orc_bin" "$target"
  _info "✓ Symlink: $target → $orc_bin"
fi

# ── Create config.local.toml if missing ─────────────────────────────────────

local_config="$ORC_ROOT/config.local.toml"
if [[ ! -f "$local_config" ]]; then
  cat > "$local_config" <<'TOML'
# Orc — local overrides (gitignored)
# Uncomment and edit values below to override committed defaults.

# [defaults]
# agent_cmd = "auto"   # auto-detect installed CLI (claude, opencode, codex, gemini)
# agent_flags = ""
# yolo_flags = ""
# max_workers = 3

# [approval]
# spawn = "ask"
# review = "auto"
# merge = "ask"

# [review]
# max_rounds = 3
# command = ""

# [board]
# command = ""
TOML
  _info "✓ Config: config.local.toml created"
else
  _info "✓ Config: config.local.toml exists"
fi

# ── Create projects.toml if missing ─────────────────────────────────────────

projects="$ORC_ROOT/projects.toml"
if [[ ! -f "$projects" ]]; then
  cat > "$projects" <<'TOML'
# Orc — project registry (gitignored)
# Register projects with: orc add <key> <path>
TOML
  _info "✓ Projects: projects.toml created"
else
  _info "✓ Projects: projects.toml exists"
fi

# ── Agent CLI selection ─────────────────────────────────────────────────────
# If multiple CLIs are available and no explicit choice exists, ask the user.
# Uses _config_get (which parses TOML structurally) to detect existing config,
# avoiding grep-based heuristics that can't distinguish sections.

existing_agent_cmd="$(_config_get "defaults.agent_cmd" "auto")"

if [[ "$existing_agent_cmd" == "auto" ]]; then
  detected_clis=""
  detected_clis="$(_auto_detect_agent_cmd 2>/dev/null)" || true

  if [[ -n "$detected_clis" ]]; then
    # Count CLIs (space-separated)
    cli_count=0
    for _ in $detected_clis; do ((cli_count++)) || true; done

    if [[ "$cli_count" -gt 1 ]] && [[ -t 0 ]]; then
      # Multiple CLIs + interactive TTY — prompt user to choose
      echo ""
      _info "Multiple agent CLIs detected:"
      n=0
      for cli in $detected_clis; do
        ((n++)) || true
        _info "  $n) $cli"
      done

      choice=""
      while true; do
        printf '\033[0;34m[orc]\033[0m Choose your default CLI [1-%d]: ' "$cli_count"
        read -r choice
        if [[ "$choice" =~ ^[0-9]+$ ]] && (( choice >= 1 && choice <= cli_count )); then
          break
        fi
        _warn "Invalid choice. Enter a number between 1 and $cli_count."
      done

      # Pick the Nth CLI from the space-separated list
      selected_cli=""
      n=0
      for cli in $detected_clis; do
        ((n++)) || true
        if [[ "$n" -eq "$choice" ]]; then
          selected_cli="$cli"
          break
        fi
      done
    elif [[ "$cli_count" -gt 1 ]]; then
      # Multiple CLIs + non-interactive — auto-select first
      selected_cli="${detected_clis%% *}"
      _info "Multiple CLIs available (${detected_clis// /, }); using $selected_cli (non-interactive)."
      _info "Run 'orc init' interactively or set defaults.agent_cmd to choose."
    else
      # Single CLI — use it directly
      selected_cli="$detected_clis"
    fi

    # Write the selection into config.local.toml.
    # CLI names come from hardcoded candidates (claude opencode codex gemini),
    # so they are safe to interpolate into sed patterns without escaping.
    if [[ -n "$selected_cli" ]]; then
      if grep -q '^agent_cmd[[:space:]]*=' "$local_config" 2>/dev/null; then
        # Replace existing agent_cmd line (avoids duplicates on re-run)
        case "$OSTYPE" in
          darwin*) sed -i '' 's|^agent_cmd[[:space:]]*=.*|agent_cmd = "'"$selected_cli"'"|' "$local_config" ;;
          *)       sed -i  's|^agent_cmd[[:space:]]*=.*|agent_cmd = "'"$selected_cli"'"|' "$local_config" ;;
        esac
      elif grep -q '^\[defaults\]' "$local_config" 2>/dev/null; then
        # [defaults] section exists but no agent_cmd — append after header
        case "$OSTYPE" in
          darwin*) sed -i '' '/^\[defaults\]/a\
agent_cmd = "'"$selected_cli"'"
' "$local_config" ;;
          *)       sed -i '/^\[defaults\]/a agent_cmd = "'"$selected_cli"'"' "$local_config" ;;
        esac
      else
        # No uncommented [defaults] — append a new section
        printf '\n[defaults]\nagent_cmd = "%s"\n' "$selected_cli" >> "$local_config"
      fi
      _info "✓ Default CLI: $selected_cli (saved to config.local.toml)"
    fi
  fi
else
  _info "✓ Agent CLI: $existing_agent_cmd (configured in config)"
fi

# ── Install slash commands ──────────────────────────────────────────────────

_install_commands "$ORC_ROOT"
_info "✓ Commands: slash commands installed to ~/.claude/commands/orc/"

# ── Verify prerequisites ────────────────────────────────────────────────────

echo ""
_info "Checking prerequisites..."
missing=0
_require "git"   "https://git-scm.com/downloads"              && _info "  ✓ git" || ((missing++))
_require "tmux"  "brew install tmux"                           && _info "  ✓ tmux" || ((missing++))
_require "bd"    "See Beads documentation"                     && _info "  ✓ bd" || ((missing++))

agent_cmd="$(_resolve_agent_cmd)"
_require "$agent_cmd" "Install your preferred agent CLI ($agent_cmd)" && _info "  ✓ $agent_cmd" || ((missing++))

if (( missing > 0 )); then
  _warn "$missing prerequisite(s) missing — some orc commands may not work."
fi

# ── Summary ─────────────────────────────────────────────────────────────────

echo ""
_info "Setup complete!"
_info "  orc add <key> <path>   Register a project"
_info "  orc                     Start orchestrating"
