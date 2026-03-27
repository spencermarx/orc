import type { PluginHookName, PluginHookPayload } from "./types.js";

type HookHandler = (payload: PluginHookPayload) => Promise<void>;

const handlers = new Map<PluginHookName, HookHandler[]>();

export function registerHook(
  hook: PluginHookName,
  handler: HookHandler,
): void {
  const existing = handlers.get(hook) ?? [];
  existing.push(handler);
  handlers.set(hook, existing);
}

export async function triggerHook(payload: PluginHookPayload): Promise<void> {
  const hookHandlers = handlers.get(payload.hook) ?? [];
  for (const handler of hookHandlers) {
    await handler(payload);
  }
}

export function clearHooks(): void {
  handlers.clear();
}

export function getHookCount(hook: PluginHookName): number {
  return handlers.get(hook)?.length ?? 0;
}
