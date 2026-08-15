import { linkToTaskOverview } from "@/lib/links";
import {
  ACTIVE_WORKSPACE_COOKIE,
  LEGACY_OFFICE_ACTIVE_WORKSPACE_COOKIE,
  readCookie,
} from "@/lib/routing/route-bootstrap";
import { isOfficeWorkspace, type ModeWorkspace } from "@/lib/state/slices/workspace/selectors";

export const LAST_KANBAN_WORKSPACE_KEY = "kandev.lastKanbanWorkspaceId";
const ACTIVE_WORKSPACE_COOKIE_MAX_AGE = 31536000;

export function workspaceHomeHref(workspace: ModeWorkspace | undefined): string {
  if (!workspace) return linkToTaskOverview();
  if (!isOfficeWorkspace(workspace)) return linkToTaskOverview({ workspaceId: workspace.id });
  return `/office?workspaceId=${workspace.id}`;
}

/**
 * Records a workspace as the active one, and as the last of its kind.
 *
 * One write per workspace change. This replaced a pair of type-specific
 * `rememberLast…` helpers that call sites had to dispatch between — and
 * sometimes call both of, or call for the workspace being *left* as well as
 * the one being entered — which is how the two cookies drifted out of step.
 *
 * The per-kind record is what lets the mode toggle return you to the workspace
 * you last used on the other side, so it is kept alongside the active-workspace
 * cookie rather than derived from it.
 */
export function rememberWorkspaceSelection(workspace: ModeWorkspace | undefined): void {
  if (!workspace) return;
  rememberWorkspaceSelectionById(workspace.id, isOfficeWorkspace(workspace) ? "office" : "kanban");
}

/**
 * The same write for a caller that knows the kind but does not hold a workspace
 * record — the setup wizard, whose create response returns an id and nothing
 * else. Passing a fabricated record with an invented `office_workflow_id` would
 * be a lie the type system happily accepts.
 */
export function rememberWorkspaceSelectionById(id: string, kind: "office" | "kanban"): void {
  if (!id || typeof document === "undefined") return;
  writeWorkspaceCookie(ACTIVE_WORKSPACE_COOKIE, id);
  if (kind === "office") {
    writeWorkspaceCookie(LEGACY_OFFICE_ACTIVE_WORKSPACE_COOKIE, id);
    return;
  }
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LAST_KANBAN_WORKSPACE_KEY, id);
  }
}

// Generic over the record so callers holding full workspaces get one back —
// the mode toggle labels itself with the destination workspace's name.
export function resolveLastKanbanWorkspace<T extends ModeWorkspace>(workspaces: T[]): T | null {
  const kanbanWorkspaces = workspaces.filter((workspace) => !isOfficeWorkspace(workspace));
  if (kanbanWorkspaces.length === 0) return null;

  const activeCookieId = readCookie(ACTIVE_WORKSPACE_COOKIE);
  const activeCookieWorkspace = kanbanWorkspaces.find(
    (workspace) => workspace.id === activeCookieId,
  );
  if (activeCookieWorkspace) return activeCookieWorkspace;

  if (typeof window !== "undefined") {
    const storedId = window.localStorage.getItem(LAST_KANBAN_WORKSPACE_KEY);
    const stored = kanbanWorkspaces.find((workspace) => workspace.id === storedId);
    if (stored) return stored;
  }

  return kanbanWorkspaces[0] ?? null;
}

export function resolveLastOfficeWorkspace<T extends ModeWorkspace>(workspaces: T[]): T | null {
  const officeWorkspaces = workspaces.filter(isOfficeWorkspace);
  if (officeWorkspaces.length === 0) return null;

  const activeCookieId = readCookie(ACTIVE_WORKSPACE_COOKIE);
  const activeCookieWorkspace = officeWorkspaces.find(
    (workspace) => workspace.id === activeCookieId,
  );
  if (activeCookieWorkspace) return activeCookieWorkspace;

  const officeCookieId = readCookie(LEGACY_OFFICE_ACTIVE_WORKSPACE_COOKIE);
  const officeCookieWorkspace = officeWorkspaces.find(
    (workspace) => workspace.id === officeCookieId,
  );
  return officeCookieWorkspace ?? officeWorkspaces[0] ?? null;
}

function writeWorkspaceCookie(name: string, value: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${ACTIVE_WORKSPACE_COOKIE_MAX_AGE}; samesite=strict`;
}
