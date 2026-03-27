export type ParsedArgs = {
  command: string;
  positional: string[];
  flags: Record<string, string | boolean>;
};

const SUBCOMMANDS = new Set([
  "init", "add", "remove", "list", "status", "teardown", "doctor",
  "config", "board", "sessions", "recordings", "web", "api", "setup",
  "spawn", "spawn-goal", "review", "halt", "leave", "notify",
]);

export function parseArgs(argv: string[]): ParsedArgs {
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  // Determine command
  let command = "";
  if (flags.gallery) {
    command = "gallery";
  } else if (flags.help) {
    command = "help";
  } else if (flags.version) {
    command = "version";
  } else if (positional.length > 0 && SUBCOMMANDS.has(positional[0])) {
    command = positional.shift()!;
  } else if (positional.length === 0) {
    command = "root";
  } else {
    // Positional args are project/bead navigation
    command = "navigate";
  }

  return { command, positional, flags };
}
