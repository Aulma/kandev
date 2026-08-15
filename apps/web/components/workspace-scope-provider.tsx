"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useAppStore } from "@/components/state-provider";
import {
  isOfficeWorkspace,
  selectActiveWorkspace,
  type WorkspaceItem,
} from "@/lib/state/slices/workspace/selectors";

/**
 * Which workspace a subtree is looking at, and therefore which mode's chrome it
 * gets.
 *
 * `"unknown"` is a real third state, not a placeholder: every boot passes
 * through a moment where the workspace list has not hydrated, and a consumer
 * that reads that as "not an Office workspace" renders kanban chrome and then
 * visibly swaps. Callers hold instead.
 */
export type WorkspaceMode = "office" | "kanban" | "unknown";

export type WorkspaceScope = {
  workspace: WorkspaceItem | undefined;
  workspaceId: string | null;
  mode: WorkspaceMode;
};

const UNRESOLVED: WorkspaceScope = { workspace: undefined, workspaceId: null, mode: "unknown" };

const WorkspaceScopeContext = createContext<WorkspaceScope | null>(null);

/**
 * Supplies the workspace a subtree is scoped to.
 *
 * The app mounts exactly one of these at the root, fed by the store's active
 * workspace, so today this is just an indirection over `workspaces.activeId`.
 * It exists so that mode is a property of a *subtree* rather than of the
 * application: showing kanban and Office side by side in one tab means two
 * providers with different workspaces, and every consumer below them keeps
 * working unchanged. Reading the store directly in each consumer would make
 * that a rewrite of the mode system instead.
 */
export function WorkspaceScopeProvider({
  children,
  workspaceId,
}: {
  children: ReactNode;
  /**
   * Scope to a specific workspace. Omit to follow the store's active one.
   *
   * Scopes the MODE only, today: the office collections and their loaders
   * still resolve against the store's active workspace. Making the data
   * follow this scope is the remaining piece of the side-by-side layout —
   * do not pass a workspace other than the active one expecting isolated
   * data underneath.
   */
  workspaceId?: string;
}) {
  const activeWorkspace = useAppStore(selectActiveWorkspace);
  const scopedWorkspace = useAppStore((state) =>
    workspaceId ? state.workspaces.items.find((item) => item.id === workspaceId) : undefined,
  );
  const hasWorkspaces = useAppStore((state) => state.workspaces.items.length > 0);
  const workspace = workspaceId ? scopedWorkspace : activeWorkspace;

  const value = useMemo<WorkspaceScope>(() => {
    if (!workspace) {
      // An empty workspace list is "not loaded yet". A populated list that does
      // not contain the requested workspace is a resolved answer: there is no
      // such workspace, and no mode to render.
      return hasWorkspaces
        ? { workspace: undefined, workspaceId: null, mode: "kanban" }
        : UNRESOLVED;
    }
    return {
      workspace,
      workspaceId: workspace.id,
      mode: isOfficeWorkspace(workspace) ? "office" : "kanban",
    };
  }, [hasWorkspaces, workspace]);

  return <WorkspaceScopeContext.Provider value={value}>{children}</WorkspaceScopeContext.Provider>;
}

/**
 * The workspace scope for this subtree. Outside a provider it reports
 * `"unknown"` rather than throwing, so an isolated component render in a test
 * behaves like a pre-hydration frame instead of crashing.
 */
export function useWorkspaceScope(): WorkspaceScope {
  return useContext(WorkspaceScopeContext) ?? UNRESOLVED;
}
