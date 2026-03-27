export type FocusTrap = {
  elements: string[];
  currentIndex: number;
  active: boolean;
};

export function createFocusTrap(elementIds: string[]): FocusTrap {
  return { elements: elementIds, currentIndex: 0, active: true };
}

export function focusNext(trap: FocusTrap): string {
  if (!trap.active || trap.elements.length === 0) return "";
  trap.currentIndex = (trap.currentIndex + 1) % trap.elements.length;
  return trap.elements[trap.currentIndex];
}

export function focusPrev(trap: FocusTrap): string {
  if (!trap.active || trap.elements.length === 0) return "";
  trap.currentIndex = (trap.currentIndex - 1 + trap.elements.length) % trap.elements.length;
  return trap.elements[trap.currentIndex];
}

export function releaseTrap(trap: FocusTrap): void {
  trap.active = false;
}

export function getCurrentFocus(trap: FocusTrap): string {
  if (!trap.active || trap.elements.length === 0) return "";
  return trap.elements[trap.currentIndex];
}
