## 1. CLI Changes

- [x] 1.1 Replace the `_info "Run \`orc setup $key\`..."` message in `add.sh` with an interactive `[Y/n]` prompt asking whether to launch guided config setup
- [x] 1.2 On accept (or Enter): invoke `orc setup "$key"`. On decline: print a note that setup can be run later with `orc setup <key>`
- [x] 1.3 In `--yolo` mode (`ORC_YOLO=1`): skip the prompt and launch setup automatically

## 2. Validation

- [x] 2.1 Manual test: `orc add testproj /tmp/testproj` → prompts `[Y/n]`, Enter launches setup
- [x] 2.2 Manual test: `orc add testproj /tmp/testproj` → prompts `[Y/n]`, `n` skips setup with info message
- [x] 2.3 Manual test: `orc add --yolo testproj /tmp/testproj` → no prompt, setup launches automatically
- [x] 2.4 Manual test: `orc setup testproj` still works independently for reconfiguration

## 3. Documentation

- [x] 3.1 Update `migrations/CHANGELOG.md` with the behavioral change (add now prompts to launch setup)
