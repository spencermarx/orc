export type CollaborationRole = "owner" | "operator" | "observer";

export type CollaborationAction =
  | "view"
  | "interact"
  | "configure"
  | "kill"
  | "dispatch"
  | "approve";

const ROLE_PERMISSIONS: Record<CollaborationRole, Set<CollaborationAction>> = {
  owner: new Set(["view", "interact", "configure", "kill", "dispatch", "approve"]),
  operator: new Set(["view", "interact", "dispatch", "approve"]),
  observer: new Set(["view"]),
};

export function checkPermission(role: CollaborationRole, action: CollaborationAction): boolean {
  return ROLE_PERMISSIONS[role]?.has(action) ?? false;
}
