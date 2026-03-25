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
# agent_cmd = "auto"   # auto-detect installed CLI (gemini, codex, opencode, claude)
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
