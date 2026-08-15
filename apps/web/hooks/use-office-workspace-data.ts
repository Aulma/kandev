"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAppStore, useAppStoreApi } from "@/components/state-provider";
import { useFeature } from "@/hooks/domains/features/use-feature";
import { useOfficeRefetch } from "@/hooks/use-office-refetch";
import { getInbox, getMeta, listAgentProfiles, listProjects } from "@/lib/api/domains/office-api";
import { isOfficeWorkspace, selectActiveWorkspace } from "@/lib/state/slices/workspace/selectors";

/**
 * Loads the office collections the always-mounted chrome reads — agents,
 * projects and the inbox — for the active workspace, plus the global office
 * meta.
 *
 * This used to live inside `src/office-routes.tsx`, which meant the data
 * existed only while an `/office/*` route was mounted. Every consumer outside
 * that route (the sidebar's Projects and Agents sections, the inbox badge) read
 * a store the route happened to have filled, and rendered empty anywhere else.
 * Owning the fetch here makes the data a property of the selected workspace
 * rather than of the URL.
 *
 * Deliberately gated on the workspace record, not on `useInOffice()`: the point
 * is that an office workspace has its data loaded wherever you are. The
 * surfaces that render it are still route-gated today, so this only changes
 * *when* the data is available, not what is shown.
 */
export function useOfficeWorkspaceData(): void {
  const store = useAppStoreApi();
  const officeEnabled = useFeature("office");
  const activeWorkspace = useAppStore(selectActiveWorkspace);
  // Office endpoints are not registered when the feature is off, so a kanban
  // workspace (or a build without Office) must not call them at all.
  const workspaceId =
    activeWorkspace && officeEnabled && isOfficeWorkspace(activeWorkspace)
      ? activeWorkspace.id
      : null;

  // Request sequencing is per resource AND per workspace. Two loads of the same
  // resource for the same workspace resolving out of order must let the newer
  // one win. Everything else is independent: sharing a counter across resources
  // would make the three parallel loads cancel each other, and sharing one
  // across workspaces would drop a workspace's data the moment another started
  // loading — leaving it stale when you switch back. Keying is what makes the
  // cross-workspace case safe: a late response lands under its own key, correct
  // and simply unread.
  const seqRef = useRef<Record<string, number>>({});
  const nextSeq = useCallback((key: string) => {
    const next = (seqRef.current[key] ?? 0) + 1;
    seqRef.current[key] = next;
    return next;
  }, []);
  const isLatest = useCallback((key: string, seq: number) => seqRef.current[key] === seq, []);

  const loadAgents = useCallback(async () => {
    if (!workspaceId) return;
    const key = `agents:${workspaceId}`;
    const seq = nextSeq(key);
    const res = await listAgentProfiles(workspaceId, { cache: "no-store" }).catch(() => ({
      agents: [],
    }));
    if (!isLatest(key, seq)) return;
    store.getState().setOfficeAgentProfiles(workspaceId, res.agents ?? []);
  }, [isLatest, nextSeq, store, workspaceId]);

  const loadProjects = useCallback(async () => {
    if (!workspaceId) return;
    const key = `projects:${workspaceId}`;
    const seq = nextSeq(key);
    const res = await listProjects(workspaceId, { cache: "no-store" }).catch(() => ({
      projects: [],
    }));
    if (!isLatest(key, seq)) return;
    store.getState().setProjects(workspaceId, res.projects ?? []);
  }, [isLatest, nextSeq, store, workspaceId]);

  const loadInbox = useCallback(async () => {
    if (!workspaceId) return;
    const key = `inbox:${workspaceId}`;
    const seq = nextSeq(key);
    const res = await getInbox(workspaceId, { cache: "no-store" }).catch(() => ({
      items: [],
      total_count: 0,
    }));
    if (!isLatest(key, seq)) return;
    const items = res.items ?? [];
    store.getState().setInboxItems(workspaceId, items);
    store.getState().setInboxCount(workspaceId, res.total_count ?? items.length);
  }, [isLatest, nextSeq, store, workspaceId]);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;

    async function load() {
      // `meta` is instance-wide rather than per-workspace, so it is fetched
      // once alongside the first workspace load and never keyed.
      const [, , , meta] = await Promise.all([
        loadAgents(),
        loadProjects(),
        loadInbox(),
        getMeta({ cache: "no-store" }).catch(() => null),
      ]);
      if (cancelled || !meta) return;
      store.getState().setMeta(meta);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [loadAgents, loadInbox, loadProjects, store, workspaceId]);

  // The same WS triggers the office pages listen to, so a change made in one
  // surface refreshes the chrome in every other.
  useOfficeRefetch("agents", loadAgents);
  useOfficeRefetch("projects", loadProjects);
  useOfficeRefetch("inbox", loadInbox);
}
