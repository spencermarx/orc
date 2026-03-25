## 1. Configuration
- [ ] 1.1 Add `[worktree]` section to `config.toml` with `setup_instructions` field and WHO/WHEN/WHAT/BOUNDARY docs
- [ ] 1.2 Add `worktree.setup_instructions` to `ORC_VALID_FIELDS` in `doctor.sh`

## 2. CLI Helpers
- [ ] 2.1 Add `_worktree_setup_instructions()` to `_common.sh` — reads config, replaces `{project_root}`
- [ ] 2.2 Add `_prepend_setup_instructions()` to `_common.sh` — wraps init_prompt with "FIRST:" preamble

## 3. Injection Points
- [ ] 3.1 `spawn.sh` — prepend setup to engineer init_prompt
- [ ] 3.2 `spawn-goal.sh` — prepend setup to goal orch init_prompt
- [ ] 3.3 `start.sh` — prepend setup to project orch init_prompt (not root orch)

## 4. Documentation
- [ ] 4.1 Add to `migrations/CHANGELOG.md`
