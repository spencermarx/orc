import type { PluginManifest, PluginInstance } from "./types.js";

export class PluginLoader {
  private plugins: Map<string, PluginInstance> = new Map();

  async load(manifest: PluginManifest): Promise<PluginInstance> {
    if (this.plugins.has(manifest.name)) {
      throw new Error(`Plugin "${manifest.name}" is already loaded`);
    }

    const instance: PluginInstance = {
      manifest,
      activate: async () => {
        /* plugin activation logic */
      },
      deactivate: async () => {
        this.plugins.delete(manifest.name);
      },
    };

    this.plugins.set(manifest.name, instance);
    return instance;
  }

  get(name: string): PluginInstance | undefined {
    return this.plugins.get(name);
  }

  list(): PluginManifest[] {
    return Array.from(this.plugins.values()).map((p) => p.manifest);
  }

  async unload(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin "${name}" is not loaded`);
    }
    await plugin.deactivate();
  }

  async unloadAll(): Promise<void> {
    const names = Array.from(this.plugins.keys());
    for (const name of names) {
      await this.unload(name);
    }
  }
}
