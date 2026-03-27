export type AccessibilityModes = {
  highContrast: boolean;
  reducedMotion: boolean;
  largeText: boolean;
  soundCues: boolean;
  screenReader: boolean;
};

const defaultModes: AccessibilityModes = {
  highContrast: false,
  reducedMotion: false,
  largeText: false,
  soundCues: false,
  screenReader: false,
};

let currentModes: AccessibilityModes = { ...defaultModes };
const modeListeners: Array<(modes: AccessibilityModes) => void> = [];

export function getModes(): AccessibilityModes {
  return { ...currentModes };
}

export function setMode<K extends keyof AccessibilityModes>(key: K, value: AccessibilityModes[K]): void {
  currentModes[key] = value;
  for (const listener of modeListeners) listener({ ...currentModes });
}

export function resetModes(): void {
  currentModes = { ...defaultModes };
}

export function onModeChange(handler: (modes: AccessibilityModes) => void): () => void {
  modeListeners.push(handler);
  return () => {
    const idx = modeListeners.indexOf(handler);
    if (idx >= 0) modeListeners.splice(idx, 1);
  };
}

export function loadFromConfig(config: { high_contrast?: boolean; reduced_motion?: boolean; large_text?: boolean; sound_cues?: boolean; screen_reader?: boolean }): void {
  if (config.high_contrast !== undefined) currentModes.highContrast = config.high_contrast;
  if (config.reduced_motion !== undefined) currentModes.reducedMotion = config.reduced_motion;
  if (config.large_text !== undefined) currentModes.largeText = config.large_text;
  if (config.sound_cues !== undefined) currentModes.soundCues = config.sound_cues;
  if (config.screen_reader !== undefined) currentModes.screenReader = config.screen_reader;
}
