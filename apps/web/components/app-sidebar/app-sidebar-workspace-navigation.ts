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

export function rememberLastKanbanWorkspace(workspace: ModeWorkspace | undefined): void {
  if (!workspace || isOfficeWorkspace(workspace) || typeof window === "undefined") return;
  window.localStorage.setItem(LAST_KANBAN_WORKSPACE_KEY, workspace.id);
  writeWorkspaceCookie(ACTIVE_WORKSPACE_COOKIE, workspace.id);
}

export function rememberLastOfficeWorkspace(workspace: ModeWorkspace | undefined): void {
  if (!workspace || !isOfficeWorkspace(workspace) || typeof document === "undefined") return;
  writeWorkspaceCookie(ACTIVE_WORKSPACE_COOKIE, workspace.id);
  writeWorkspaceCookie(LEGACY_OFFICE_ACTIVE_WORKSPACE_COOKIE, workspace.id);
}

export function resolveLastKanbanWorkspace(workspaces: ModeWorkspace[]): ModeWorkspace | null {
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

export function resolveLastOfficeWorkspace(workspaces: ModeWorkspace[]): ModeWorkspace | null {
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
