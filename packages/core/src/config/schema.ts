import { z } from "zod";

// ─── Approval gate ──────────────────────────────────────────────────────────
const approvalGate = z.enum(["ask", "auto"]).default("ask");

// ─── Defaults ───────────────────────────────────────────────────────────────
const DefaultsSchema = z
  .object({
    agent_cmd: z.string().default("auto"),
    agent_flags: z.string().default(""),
    agent_template: z.string().default(""),
    yolo_flags: z.string().default(""),
    max_workers: z.number().int().min(1).default(3),
  })
  .default({});

// ─── Planning ───────────────────────────────────────────────────────────────
const PlanningGoalSchema = z
  .object({
    plan_creation_instructions: z.string().default(""),
    bead_creation_instructions: z.string().default(""),
    when_to_involve_user_in_plan: z.string().default(""),
  })
  .default({});

const PlanningSchema = z
  .object({
    goal: PlanningGoalSchema,
  })
  .default({});

// ─── Dispatch ───────────────────────────────────────────────────────────────
const DispatchGoalSchema = z
  .object({
    assignment_instructions: z.string().default(""),
  })
  .default({});

const DispatchSchema = z
  .object({
    goal: DispatchGoalSchema,
  })
  .default({});

// ─── Approval ───────────────────────────────────────────────────────────────
const ApprovalSchema = z
  .object({
    ask_before_dispatching: approvalGate.default("ask"),
    ask_before_reviewing: approvalGate.default("auto"),
    ask_before_merging: approvalGate.default("ask"),
  })
  .default({});

// ─── Review ─────────────────────────────────────────────────────────────────
const ReviewDevSchema = z
  .object({
    review_instructions: z.string().default(""),
    how_to_determine_if_review_passed: z.string().default(""),
    max_rounds: z.number().int().min(1).default(3),
  })
  .default({});

const ReviewGoalSchema = z
  .object({
    review_instructions: z.string().default(""),
    how_to_determine_if_review_passed: z.string().default(""),
    how_to_address_review_feedback: z.string().default(""),
    max_rounds: z.number().int().min(1).default(3),
  })
  .default({});

const ReviewSchema = z
  .object({
    dev: ReviewDevSchema,
    goal: ReviewGoalSchema,
  })
  .default({});

// ─── Branching ──────────────────────────────────────────────────────────────
const BranchingSchema = z
  .object({
    strategy: z.string().default(""),
  })
  .default({});

// ─── Worktree ───────────────────────────────────────────────────────────────
const WorktreeSchema = z
  .object({
    setup_instructions: z.string().default(""),
  })
  .default({});

// ─── Delivery ───────────────────────────────────────────────────────────────
const DeliveryGoalSchema = z
  .object({
    on_completion_instructions: z.string().default(""),
    when_to_involve_user_in_delivery: z.string().default(""),
  })
  .default({});

const DeliverySchema = z
  .object({
    goal: DeliveryGoalSchema,
  })
  .default({});

// ─── Agents ─────────────────────────────────────────────────────────────────
const AgentsSchema = z
  .object({
    ruflo: z.enum(["off", "auto", "require"]).default("off"),
  })
  .default({});

// ─── Notifications ──────────────────────────────────────────────────────────
const NotificationsSchema = z
  .object({
    system: z.boolean().default(false),
    sound: z.boolean().default(false),
  })
  .default({});

// ─── Updates ────────────────────────────────────────────────────────────────
const UpdatesSchema = z
  .object({
    check_on_launch: z.boolean().default(true),
  })
  .default({});

// ─── Tickets ────────────────────────────────────────────────────────────────
const TicketsSchema = z
  .object({
    strategy: z.string().default(""),
  })
  .default({});

// ─── Board ──────────────────────────────────────────────────────────────────
const BoardSchema = z
  .object({
    command: z.string().default(""),
  })
  .default({});

// ─── TUI ────────────────────────────────────────────────────────────────────
const TuiPaletteSchema = z
  .object({
    enabled: z.boolean().default(true),
    show_preview: z.boolean().default(true),
  })
  .default({});

const TuiMenuSchema = z
  .object({
    enabled: z.boolean().default(true),
  })
  .default({});

const TuiSchema = z
  .object({
    enabled: z.boolean().default(true),
    breadcrumbs: z.boolean().default(true),
    show_help_hint: z.boolean().default(true),
    palette: TuiPaletteSchema,
    menu: TuiMenuSchema,
  })
  .default({});

// ─── Keybindings ────────────────────────────────────────────────────────────
const KeybindingsSchema = z
  .object({
    enabled: z.boolean().default(false),
    project: z.string().default("M-0"),
    dashboard: z.string().default("M-s"),
    prev: z.string().default("M-["),
    next: z.string().default("M-]"),
    palette: z.string().default("M-p"),
    menu: z.string().default("M-m"),
    help: z.string().default("M-?"),
  })
  .default({});

// ─── Layout ─────────────────────────────────────────────────────────────────
const LayoutPreset = z
  .enum(["focused", "main-vertical", "tiled", "stacked", "zen"])
  .default("main-vertical");

const LayoutSchema = z
  .object({
    min_pane_width: z.number().int().min(1).default(40),
    min_pane_height: z.number().int().min(1).default(10),
    preset: LayoutPreset,
  })
  .default({});

// ─── Theme (existing + extended) ────────────────────────────────────────────
const ThemeSchema = z
  .object({
    enabled: z.boolean().default(true),
    mouse: z.boolean().default(true),
    accent: z.string().default("#00ff88"),
    bg: z.string().default("#0d1117"),
    fg: z.string().default("#8b949e"),
    border: z.string().default("#30363d"),
    muted: z.string().default("#6e7681"),
    activity: z.string().default("#d29922"),
  })
  .default({});

// ─── Themes (extended theme management) ─────────────────────────────────────
const ThemesSchema = z
  .object({
    active: z.string().default("default"),
    custom_dir: z.string().default(""),
  })
  .default({});

// ─── Plugins ────────────────────────────────────────────────────────────────
const PluginsSchema = z
  .object({
    enabled: z.boolean().default(false),
    directory: z.string().default(""),
  })
  .default({});

// ─── Observability ──────────────────────────────────────────────────────────
const ObservabilitySchema = z
  .object({
    enabled: z.boolean().default(false),
    cost_tracking: z.boolean().default(false),
    token_tracking: z.boolean().default(false),
    timing: z.boolean().default(false),
  })
  .default({});

// ─── Collaboration ──────────────────────────────────────────────────────────
const CollaborationSchema = z
  .object({
    enabled: z.boolean().default(false),
    port: z.number().int().min(1).max(65535).default(9876),
    auth_required: z.boolean().default(true),
  })
  .default({});

// ─── API ────────────────────────────────────────────────────────────────────
const ApiSchema = z
  .object({
    enabled: z.boolean().default(false),
    port: z.number().int().min(1).max(65535).default(8080),
    host: z.string().default("127.0.0.1"),
  })
  .default({});

// ─── AI ─────────────────────────────────────────────────────────────────────
const AiSchema = z
  .object({
    enabled: z.boolean().default(false),
    model: z.string().default(""),
    cache_ttl: z.number().int().min(0).default(300),
  })
  .default({});

// ─── Accessibility ──────────────────────────────────────────────────────────
const A11ySchema = z
  .object({
    high_contrast: z.boolean().default(false),
    reduced_motion: z.boolean().default(false),
    large_text: z.boolean().default(false),
    sound_cues: z.boolean().default(false),
    screen_reader: z.boolean().default(false),
  })
  .default({});

// ─── Recording ──────────────────────────────────────────────────────────────
const RecordingSchema = z
  .object({
    enabled: z.boolean().default(false),
    auto_record: z.boolean().default(false),
    retention_days: z.number().int().min(0).default(30),
    compression: z.boolean().default(true),
  })
  .default({});

// ─── Root config schema ─────────────────────────────────────────────────────
export const OrcConfigSchema = z
  .object({
    defaults: DefaultsSchema,
    planning: PlanningSchema,
    dispatch: DispatchSchema,
    approval: ApprovalSchema,
    review: ReviewSchema,
    branching: BranchingSchema,
    worktree: WorktreeSchema,
    delivery: DeliverySchema,
    agents: AgentsSchema,
    notifications: NotificationsSchema,
    updates: UpdatesSchema,
    tickets: TicketsSchema,
    board: BoardSchema,
    tui: TuiSchema,
    keybindings: KeybindingsSchema,
    layout: LayoutSchema,
    theme: ThemeSchema,
    themes: ThemesSchema,
    plugins: PluginsSchema,
    observability: ObservabilitySchema,
    collaboration: CollaborationSchema,
    api: ApiSchema,
    ai: AiSchema,
    a11y: A11ySchema,
    recording: RecordingSchema,
  })
  .default({});

export type OrcConfig = z.infer<typeof OrcConfigSchema>;
