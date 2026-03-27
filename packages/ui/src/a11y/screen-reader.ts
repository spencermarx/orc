export type Announcement = {
  message: string;
  priority: "polite" | "assertive";
  timestamp: number;
};

const announcements: Announcement[] = [];
const listeners: Array<(a: Announcement) => void> = [];

export function announce(message: string, priority: "polite" | "assertive" = "polite"): void {
  const a: Announcement = { message, priority, timestamp: Date.now() };
  announcements.push(a);
  for (const listener of listeners) listener(a);
}

export function onAnnouncement(handler: (a: Announcement) => void): () => void {
  listeners.push(handler);
  return () => {
    const idx = listeners.indexOf(handler);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

export function getAnnouncements(): Announcement[] {
  return [...announcements];
}

export function clearAnnouncements(): void {
  announcements.length = 0;
}
