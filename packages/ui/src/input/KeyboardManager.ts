// Keyboard input management — global shortcut capture + pass-through

export type KeyBinding = {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: string;
  description: string;
};

export type KeyEvent = {
  key: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  raw: string;
};

type KeyHandler = (event: KeyEvent, action: string) => void;

export class KeyboardManager {
  private bindings: Map<string, KeyBinding> = new Map();
  private handlers: Map<string, KeyHandler> = new Map();
  private globalHandler: KeyHandler | null = null;

  registerBinding(binding: KeyBinding): void {
    const key = this.makeKey(binding);
    this.bindings.set(key, binding);
  }

  removeBinding(action: string): void {
    for (const [key, binding] of this.bindings) {
      if (binding.action === action) {
        this.bindings.delete(key);
        break;
      }
    }
  }

  onAction(action: string, handler: KeyHandler): () => void {
    this.handlers.set(action, handler);
    return () => {
      this.handlers.delete(action);
    };
  }

  onAnyKey(handler: KeyHandler): () => void {
    this.globalHandler = handler;
    return () => {
      this.globalHandler = null;
    };
  }

  handleInput(input: string, key: { ctrl: boolean; shift: boolean; meta: boolean }): boolean {
    const event: KeyEvent = {
      key: input,
      ctrl: key.ctrl,
      shift: key.shift,
      alt: key.meta,
      raw: input,
    };

    const bindingKey = this.makeKeyFromEvent(event);
    const binding = this.bindings.get(bindingKey);

    if (binding) {
      const handler = this.handlers.get(binding.action);
      if (handler) {
        handler(event, binding.action);
        return true;
      }
    }

    if (this.globalHandler) {
      this.globalHandler(event, "");
    }

    return false;
  }

  getBindings(): KeyBinding[] {
    return Array.from(this.bindings.values());
  }

  loadFromConfig(keybindings: Record<string, string>): void {
    for (const [action, keyStr] of Object.entries(keybindings)) {
      if (!keyStr) continue;
      const binding = this.parseKeyString(keyStr, action);
      if (binding) {
        this.registerBinding(binding);
      }
    }
  }

  private parseKeyString(keyStr: string, action: string): KeyBinding | null {
    const parts = keyStr.split("+").map((p) => p.trim().toLowerCase());
    const binding: KeyBinding = {
      key: parts[parts.length - 1],
      ctrl: parts.includes("ctrl") || parts.includes("c"),
      shift: parts.includes("shift") || parts.includes("s"),
      alt: parts.includes("alt") || parts.includes("m"),
      action,
      description: action,
    };

    // Handle tmux-style notation (M- = Alt, C- = Ctrl)
    if (keyStr.startsWith("M-")) {
      binding.alt = true;
      binding.key = keyStr.slice(2).toLowerCase();
    } else if (keyStr.startsWith("C-")) {
      binding.ctrl = true;
      binding.key = keyStr.slice(2).toLowerCase();
    }

    return binding;
  }

  private makeKey(binding: KeyBinding): string {
    const mods: string[] = [];
    if (binding.ctrl) mods.push("ctrl");
    if (binding.shift) mods.push("shift");
    if (binding.alt) mods.push("alt");
    mods.push(binding.key.toLowerCase());
    return mods.join("+");
  }

  private makeKeyFromEvent(event: KeyEvent): string {
    const mods: string[] = [];
    if (event.ctrl) mods.push("ctrl");
    if (event.shift) mods.push("shift");
    if (event.alt) mods.push("alt");
    mods.push(event.key.toLowerCase());
    return mods.join("+");
  }
}

export const DEFAULT_BINDINGS: KeyBinding[] = [
  { key: "p", ctrl: true, action: "command-palette", description: "Open command palette" },
  { key: "o", ctrl: true, action: "observability", description: "Open observability" },
  { key: "r", ctrl: true, action: "recordings", description: "Open recordings" },
  { key: "[", ctrl: true, action: "prev-view", description: "Previous view" },
  { key: "]", ctrl: true, action: "next-view", description: "Next view" },
  { key: "?", action: "help", description: "Show help" },
];
