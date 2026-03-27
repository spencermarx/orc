import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseConfig, parsePartialConfig, ConfigParseError, ConfigValidationError } from "../parser.js";
import { resolveConfig, deepMerge } from "../resolver.js";
import { watchConfig } from "../watcher.js";
import { createConfig } from "../index.js";
import { OrcConfigSchema } from "../schema.js";
import type { OrcConfig } from "../schema.js";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "orc-config-test-"));
}

function writeToml(dir: string, filename: string, content: string): string {
  const filePath = join(dir, filename);
  writeFileSync(filePath, content, "utf-8");
  return filePath;
}

// ─── Schema ────────────────────────────────────────────────────────────────────

describe("OrcConfigSchema", () => {
  it("returns full defaults when given an empty object", () => {
    const config = OrcConfigSchema.parse({});

    // Spot-check key defaults
    expect(config.defaults.agent_cmd).toBe("auto");
    expect(config.defaults.max_workers).toBe(3);
    expect(config.approval.ask_before_dispatching).toBe("ask");
    expect(config.approval.ask_before_reviewing).toBe("auto");
    expect(config.approval.ask_before_merging).toBe("ask");
    expect(config.review.dev.max_rounds).toBe(3);
    expect(config.review.goal.max_rounds).toBe(3);
    expect(config.tui.enabled).toBe(true);
    expect(config.tui.breadcrumbs).toBe(true);
    expect(config.tui.palette.enabled).toBe(true);
    expect(config.tui.menu.enabled).toBe(true);
    expect(config.layout.preset).toBe("main-vertical");
    expect(config.layout.min_pane_width).toBe(40);
    expect(config.layout.min_pane_height).toBe(10);
    expect(config.theme.accent).toBe("#00ff88");
    expect(config.themes.active).toBe("default");
    expect(config.plugins.enabled).toBe(false);
    expect(config.observability.enabled).toBe(false);
    expect(config.collaboration.enabled).toBe(false);
    expect(config.collaboration.port).toBe(9876);
    expect(config.api.enabled).toBe(false);
    expect(config.api.port).toBe(8080);
    expect(config.api.host).toBe("127.0.0.1");
    expect(config.ai.enabled).toBe(false);
    expect(config.ai.cache_ttl).toBe(300);
    expect(config.a11y.high_contrast).toBe(false);
    expect(config.a11y.screen_reader).toBe(false);
    expect(config.recording.enabled).toBe(false);
    expect(config.recording.retention_days).toBe(30);
    expect(config.recording.compression).toBe(true);
    expect(config.keybindings.enabled).toBe(false);
    expect(config.notifications.system).toBe(false);
    expect(config.agents.ruflo).toBe("off");
  });

  it("infers the OrcConfig type correctly", () => {
    const config: OrcConfig = OrcConfigSchema.parse({});
    // TypeScript compile-time check — if this compiles, types are correct
    const _check: string = config.defaults.agent_cmd;
    const _check2: boolean = config.tui.enabled;
    const _check3: number = config.api.port;
    expect(_check).toBe("auto");
    expect(_check2).toBe(true);
    expect(_check3).toBe(8080);
  });

  it("validates enum fields", () => {
    const result = OrcConfigSchema.safeParse({
      approval: { ask_before_dispatching: "invalid" },
    });
    expect(result.success).toBe(false);
  });

  it("validates numeric constraints", () => {
    const result = OrcConfigSchema.safeParse({
      defaults: { max_workers: 0 },
    });
    expect(result.success).toBe(false);
  });

  it("validates port ranges", () => {
    const result = OrcConfigSchema.safeParse({
      api: { port: 70000 },
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid partial overrides", () => {
    const config = OrcConfigSchema.parse({
      defaults: { max_workers: 5 },
      tui: { enabled: false },
      layout: { preset: "zen" },
    });
    expect(config.defaults.max_workers).toBe(5);
    expect(config.defaults.agent_cmd).toBe("auto"); // default preserved
    expect(config.tui.enabled).toBe(false);
    expect(config.layout.preset).toBe("zen");
  });

  it("accepts all layout presets", () => {
    for (const preset of ["focused", "main-vertical", "tiled", "stacked", "zen"] as const) {
      const config = OrcConfigSchema.parse({ layout: { preset } });
      expect(config.layout.preset).toBe(preset);
    }
  });
});

// ─── Parser ────────────────────────────────────────────────────────────────────

describe("parseConfig", () => {
  it("parses valid TOML and returns typed config", () => {
    const toml = `
[defaults]
agent_cmd = "claude"
max_workers = 5

[approval]
ask_before_dispatching = "auto"

[tui]
enabled = false

[layout]
preset = "zen"
min_pane_width = 60
`;
    const config = parseConfig(toml);
    expect(config.defaults.agent_cmd).toBe("claude");
    expect(config.defaults.max_workers).toBe(5);
    expect(config.defaults.agent_flags).toBe(""); // default
    expect(config.approval.ask_before_dispatching).toBe("auto");
    expect(config.tui.enabled).toBe(false);
    expect(config.tui.breadcrumbs).toBe(true); // default
    expect(config.layout.preset).toBe("zen");
    expect(config.layout.min_pane_width).toBe(60);
  });

  it("parses empty TOML and returns all defaults", () => {
    const config = parseConfig("");
    expect(config.defaults.agent_cmd).toBe("auto");
    expect(config.tui.enabled).toBe(true);
    expect(config.layout.preset).toBe("main-vertical");
  });

  it("throws ConfigParseError on malformed TOML", () => {
    expect(() => parseConfig("[invalid\nkey = ")).toThrow(ConfigParseError);
  });

  it("throws ConfigValidationError on invalid values", () => {
    const toml = `
[defaults]
max_workers = -1
`;
    expect(() => parseConfig(toml)).toThrow(ConfigValidationError);
  });

  it("provides structured error details on validation failure", () => {
    try {
      parseConfig(`
[approval]
ask_before_dispatching = "maybe"
`);
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigValidationError);
      const validationErr = err as ConfigValidationError;
      expect(validationErr.issues.length).toBeGreaterThan(0);
      expect(validationErr.issues[0]!.path).toContain("approval");
    }
  });

  it("parses nested sections correctly", () => {
    const toml = `
[planning.goal]
plan_creation_instructions = "/openspec:proposal"
bead_creation_instructions = "Map tasks to beads"

[review.dev]
review_instructions = "Focus on security"
max_rounds = 5

[review.goal]
how_to_address_review_feedback = "Fix must-fix items"

[delivery.goal]
on_completion_instructions = "Push and create PR"
`;
    const config = parseConfig(toml);
    expect(config.planning.goal.plan_creation_instructions).toBe("/openspec:proposal");
    expect(config.planning.goal.bead_creation_instructions).toBe("Map tasks to beads");
    expect(config.review.dev.review_instructions).toBe("Focus on security");
    expect(config.review.dev.max_rounds).toBe(5);
    expect(config.review.goal.how_to_address_review_feedback).toBe("Fix must-fix items");
    expect(config.delivery.goal.on_completion_instructions).toBe("Push and create PR");
  });

  it("parses TUI sub-sections", () => {
    const toml = `
[tui]
enabled = true
breadcrumbs = false
show_help_hint = false

[tui.palette]
enabled = false
show_preview = false

[tui.menu]
enabled = false
`;
    const config = parseConfig(toml);
    expect(config.tui.breadcrumbs).toBe(false);
    expect(config.tui.show_help_hint).toBe(false);
    expect(config.tui.palette.enabled).toBe(false);
    expect(config.tui.palette.show_preview).toBe(false);
    expect(config.tui.menu.enabled).toBe(false);
  });

  it("parses new TUI redesign sections", () => {
    const toml = `
[plugins]
enabled = true
directory = "~/.orc/plugins"

[observability]
enabled = true
cost_tracking = true
token_tracking = true
timing = true

[collaboration]
enabled = true
port = 3000
auth_required = false

[api]
enabled = true
port = 9090
host = "0.0.0.0"

[themes]
active = "dark-neon"
custom_dir = "~/.orc/themes"

[ai]
enabled = true
model = "claude-3-opus"
cache_ttl = 600

[a11y]
high_contrast = true
reduced_motion = true
large_text = true
sound_cues = true
screen_reader = true

[recording]
enabled = true
auto_record = true
retention_days = 7
compression = false
`;
    const config = parseConfig(toml);
    expect(config.plugins.enabled).toBe(true);
    expect(config.plugins.directory).toBe("~/.orc/plugins");
    expect(config.observability.enabled).toBe(true);
    expect(config.observability.cost_tracking).toBe(true);
    expect(config.collaboration.port).toBe(3000);
    expect(config.collaboration.auth_required).toBe(false);
    expect(config.api.host).toBe("0.0.0.0");
    expect(config.api.port).toBe(9090);
    expect(config.themes.active).toBe("dark-neon");
    expect(config.ai.model).toBe("claude-3-opus");
    expect(config.ai.cache_ttl).toBe(600);
    expect(config.a11y.high_contrast).toBe(true);
    expect(config.a11y.screen_reader).toBe(true);
    expect(config.recording.auto_record).toBe(true);
    expect(config.recording.retention_days).toBe(7);
    expect(config.recording.compression).toBe(false);
  });
});

describe("parsePartialConfig", () => {
  it("returns raw object without applying defaults", () => {
    const raw = parsePartialConfig(`
[defaults]
max_workers = 10
`);
    expect(raw).toEqual({ defaults: { max_workers: 10 } });
    // Should NOT have agent_cmd or other defaults
    expect((raw as Record<string, unknown>).tui).toBeUndefined();
  });

  it("throws ConfigParseError on malformed TOML", () => {
    expect(() => parsePartialConfig("= = =")).toThrow(ConfigParseError);
  });
});

// ─── deepMerge ─────────────────────────────────────────────────────────────────

describe("deepMerge", () => {
  it("merges flat objects", () => {
    const base = { a: 1, b: 2 };
    const override = { b: 3, c: 4 };
    const result = deepMerge(base, override);
    expect(result).toEqual({ a: 1, b: 3, c: 4 });
  });

  it("deep merges nested objects", () => {
    const base = { defaults: { agent_cmd: "auto", max_workers: 3 } };
    const override = { defaults: { max_workers: 5 } };
    const result = deepMerge(base, override);
    expect(result).toEqual({
      defaults: { agent_cmd: "auto", max_workers: 5 },
    });
  });

  it("replaces arrays instead of concatenating", () => {
    const base = { items: [1, 2, 3] };
    const override = { items: [4, 5] };
    const result = deepMerge(base, override);
    expect(result).toEqual({ items: [4, 5] });
  });

  it("handles deeply nested structures", () => {
    const base = {
      review: { dev: { max_rounds: 3, review_instructions: "" } },
    };
    const override = {
      review: { dev: { max_rounds: 5 } },
    };
    const result = deepMerge(base, override);
    expect(result).toEqual({
      review: { dev: { max_rounds: 5, review_instructions: "" } },
    });
  });

  it("does not mutate the base object", () => {
    const base = { a: { b: 1 } };
    const override = { a: { b: 2 } };
    deepMerge(base, override);
    expect(base.a.b).toBe(1);
  });

  it("handles override introducing new keys", () => {
    const base = { a: 1 };
    const override = { b: { c: 2 } };
    const result = deepMerge(base, override);
    expect(result).toEqual({ a: 1, b: { c: 2 } });
  });
});

// ─── Resolver ──────────────────────────────────────────────────────────────────

describe("resolveConfig", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns defaults when only config.toml exists", () => {
    writeToml(tempDir, "config.toml", `
[defaults]
agent_cmd = "claude"
`);
    const config = resolveConfig({ orcRoot: tempDir });
    expect(config.defaults.agent_cmd).toBe("claude");
    expect(config.defaults.max_workers).toBe(3); // schema default
  });

  it("returns full defaults when config.toml is empty", () => {
    writeToml(tempDir, "config.toml", "");
    const config = resolveConfig({ orcRoot: tempDir });
    expect(config.defaults.agent_cmd).toBe("auto");
  });

  it("returns defaults when no config files exist", () => {
    const config = resolveConfig({ orcRoot: tempDir });
    expect(config.defaults.agent_cmd).toBe("auto");
    expect(config.tui.enabled).toBe(true);
  });

  it("config.local.toml overrides config.toml", () => {
    writeToml(tempDir, "config.toml", `
[defaults]
agent_cmd = "claude"
max_workers = 3
`);
    writeToml(tempDir, "config.local.toml", `
[defaults]
max_workers = 8
`);
    const config = resolveConfig({ orcRoot: tempDir });
    expect(config.defaults.agent_cmd).toBe("claude"); // from config.toml
    expect(config.defaults.max_workers).toBe(8); // overridden by local
  });

  it("project config overrides both config.toml and config.local.toml", () => {
    const projectDir = join(tempDir, "myproject");
    mkdirSync(join(projectDir, ".orc"), { recursive: true });

    writeToml(tempDir, "config.toml", `
[defaults]
agent_cmd = "claude"
max_workers = 3

[tui]
enabled = true
`);
    writeToml(tempDir, "config.local.toml", `
[defaults]
max_workers = 8
`);
    writeToml(join(projectDir, ".orc"), "config.toml", `
[defaults]
max_workers = 2

[tui]
enabled = false
`);

    const config = resolveConfig({
      orcRoot: tempDir,
      projectPath: projectDir,
    });
    expect(config.defaults.agent_cmd).toBe("claude"); // from config.toml
    expect(config.defaults.max_workers).toBe(2); // project wins
    expect(config.tui.enabled).toBe(false); // project wins
  });

  it("deep merges nested sections across tiers", () => {
    writeToml(tempDir, "config.toml", `
[review.dev]
max_rounds = 3
review_instructions = "Check types"
`);
    writeToml(tempDir, "config.local.toml", `
[review.dev]
max_rounds = 5
`);

    const config = resolveConfig({ orcRoot: tempDir });
    expect(config.review.dev.max_rounds).toBe(5); // overridden
    expect(config.review.dev.review_instructions).toBe("Check types"); // preserved
  });

  it("handles missing project .orc directory gracefully", () => {
    writeToml(tempDir, "config.toml", "");
    const config = resolveConfig({
      orcRoot: tempDir,
      projectPath: join(tempDir, "nonexistent"),
    });
    expect(config.defaults.agent_cmd).toBe("auto");
  });

  it("applies schema defaults for fields not in any config file", () => {
    writeToml(tempDir, "config.toml", `
[defaults]
agent_cmd = "codex"
`);
    const config = resolveConfig({ orcRoot: tempDir });
    // Fields from new TUI redesign sections should get defaults
    expect(config.plugins.enabled).toBe(false);
    expect(config.observability.enabled).toBe(false);
    expect(config.collaboration.port).toBe(9876);
    expect(config.api.host).toBe("127.0.0.1");
    expect(config.ai.cache_ttl).toBe(300);
    expect(config.a11y.high_contrast).toBe(false);
    expect(config.recording.retention_days).toBe(30);
  });
});

// ─── createConfig ──────────────────────────────────────────────────────────────

describe("createConfig", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("is equivalent to resolveConfig", () => {
    writeToml(tempDir, "config.toml", `
[defaults]
agent_cmd = "opencode"
`);
    const fromCreate = createConfig({ orcRoot: tempDir });
    const fromResolve = resolveConfig({ orcRoot: tempDir });
    expect(fromCreate).toEqual(fromResolve);
  });
});

// ─── Watcher ───────────────────────────────────────────────────────────────────

describe("watchConfig", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
    writeToml(tempDir, "config.toml", `
[defaults]
agent_cmd = "claude"
max_workers = 3
`);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("provides initial resolved config", () => {
    const watcher = watchConfig({ orcRoot: tempDir });
    expect(watcher.config.defaults.agent_cmd).toBe("claude");
    expect(watcher.config.defaults.max_workers).toBe(3);
    watcher.close();
  });

  it("emits change event when config file is modified", async () => {
    const watcher = watchConfig({ orcRoot: tempDir });
    const changed = new Promise<OrcConfig>((resolve) => {
      watcher.on("change", resolve);
    });

    // Modify the config file after a tick
    await new Promise((r) => setTimeout(r, 50));
    writeToml(tempDir, "config.toml", `
[defaults]
agent_cmd = "codex"
max_workers = 10
`);

    const newConfig = await Promise.race([
      changed,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Watcher timeout")), 3000),
      ),
    ]);

    expect(newConfig.defaults.agent_cmd).toBe("codex");
    expect(newConfig.defaults.max_workers).toBe(10);
    watcher.close();
  });

  it("debounces rapid changes", async () => {
    const watcher = watchConfig({ orcRoot: tempDir });
    const handler = vi.fn();
    watcher.on("change", handler);

    // Rapid-fire writes
    await new Promise((r) => setTimeout(r, 50));
    for (let i = 1; i <= 5; i++) {
      writeToml(tempDir, "config.toml", `
[defaults]
agent_cmd = "claude"
max_workers = ${i}
`);
    }

    // Wait for debounce to settle (300ms + buffer)
    await new Promise((r) => setTimeout(r, 800));

    // Should have been called fewer times than the number of writes
    // due to debouncing (typically 1-2 times)
    expect(handler.mock.calls.length).toBeLessThan(5);
    expect(handler.mock.calls.length).toBeGreaterThan(0);
    watcher.close();
  });

  it("supports removing listeners", () => {
    const watcher = watchConfig({ orcRoot: tempDir });
    const handler = vi.fn();
    watcher.on("change", handler);
    watcher.off("change", handler);
    watcher.close();
    // No assertion needed — just verifying no error
  });

  it("close stops watching without errors", () => {
    const watcher = watchConfig({ orcRoot: tempDir });
    expect(() => watcher.close()).not.toThrow();
    // Double close should be safe
    expect(() => watcher.close()).not.toThrow();
  });
});

// ─── Full round-trip ───────────────────────────────────────────────────────────

describe("full round-trip", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("write TOML -> parse -> validate -> resolve", () => {
    // Write a comprehensive config touching every section
    writeToml(tempDir, "config.toml", `
[defaults]
agent_cmd = "claude"
agent_flags = "--verbose"
agent_template = ""
yolo_flags = ""
max_workers = 4

[planning.goal]
plan_creation_instructions = "/openspec:proposal"
bead_creation_instructions = "Map tasks"
when_to_involve_user_in_plan = "always"

[dispatch.goal]
assignment_instructions = "Include tests"

[approval]
ask_before_dispatching = "auto"
ask_before_reviewing = "auto"
ask_before_merging = "auto"

[review.dev]
review_instructions = "Security focus"
max_rounds = 2

[review.goal]
review_instructions = "Full review"
how_to_address_review_feedback = "Fix all"
max_rounds = 1

[branching]
strategy = "always feat/"

[worktree]
setup_instructions = "pnpm install"

[delivery.goal]
on_completion_instructions = "Push and PR"
when_to_involve_user_in_delivery = "never"

[agents]
ruflo = "auto"

[notifications]
system = true
sound = true

[updates]
check_on_launch = false

[tickets]
strategy = "Jira sync"

[tui]
enabled = true
breadcrumbs = true
show_help_hint = false

[tui.palette]
enabled = true
show_preview = false

[tui.menu]
enabled = false

[keybindings]
enabled = true
project = "M-1"

[layout]
min_pane_width = 50
min_pane_height = 15
preset = "tiled"

[board]
command = "bd list"

[theme]
enabled = true
accent = "#ff0000"
bg = "#000000"

[themes]
active = "cyberpunk"
custom_dir = "~/.orc/themes"

[plugins]
enabled = true
directory = "~/.orc/plugins"

[observability]
enabled = true
cost_tracking = true
token_tracking = true
timing = true

[collaboration]
enabled = true
port = 4000
auth_required = false

[api]
enabled = true
port = 3000
host = "0.0.0.0"

[ai]
enabled = true
model = "gpt-4"
cache_ttl = 120

[a11y]
high_contrast = true
reduced_motion = true
large_text = false
sound_cues = true
screen_reader = false

[recording]
enabled = true
auto_record = true
retention_days = 14
compression = false
`);

    // Local overrides
    writeToml(tempDir, "config.local.toml", `
[defaults]
max_workers = 6

[api]
port = 5000
`);

    // Project overrides
    const projectDir = join(tempDir, "myproject");
    mkdirSync(join(projectDir, ".orc"), { recursive: true });
    writeToml(join(projectDir, ".orc"), "config.toml", `
[defaults]
max_workers = 1

[recording]
retention_days = 3
`);

    // Resolve with full three-tier chain
    const config = resolveConfig({
      orcRoot: tempDir,
      projectPath: projectDir,
    });

    // Verify resolution order: project > local > defaults
    expect(config.defaults.agent_cmd).toBe("claude"); // from config.toml
    expect(config.defaults.max_workers).toBe(1); // project wins over local(6) and default(4)
    expect(config.api.port).toBe(5000); // local wins over default(3000)
    expect(config.recording.retention_days).toBe(3); // project wins

    // Verify values from config.toml that weren't overridden
    expect(config.planning.goal.plan_creation_instructions).toBe("/openspec:proposal");
    expect(config.approval.ask_before_dispatching).toBe("auto");
    expect(config.review.dev.review_instructions).toBe("Security focus");
    expect(config.tui.show_help_hint).toBe(false);
    expect(config.tui.palette.show_preview).toBe(false);
    expect(config.layout.preset).toBe("tiled");
    expect(config.theme.accent).toBe("#ff0000");
    expect(config.themes.active).toBe("cyberpunk");
    expect(config.plugins.enabled).toBe(true);
    expect(config.observability.cost_tracking).toBe(true);
    expect(config.collaboration.auth_required).toBe(false);
    expect(config.ai.model).toBe("gpt-4");
    expect(config.a11y.high_contrast).toBe(true);
    expect(config.recording.auto_record).toBe(true);
    expect(config.recording.compression).toBe(false);

    // Verify type safety — these would be compile errors if wrong
    const _agent: string = config.defaults.agent_cmd;
    const _workers: number = config.defaults.max_workers;
    const _gate: "ask" | "auto" = config.approval.ask_before_dispatching;
    const _preset: "focused" | "main-vertical" | "tiled" | "stacked" | "zen" = config.layout.preset;
    const _tuiEnabled: boolean = config.tui.enabled;
    expect(_agent).toBeDefined();
    expect(_workers).toBeDefined();
    expect(_gate).toBeDefined();
    expect(_preset).toBeDefined();
    expect(_tuiEnabled).toBeDefined();
  });
});
