import { describe, it, expect } from "vitest";
import type { StoreApi } from "zustand";
import type { AppState, WorkspaceState } from "@/lib/state/store";
import type { BackendMessageMap, WorkspacePayload } from "@/lib/types/backend";
import { registerWorkspacesHandlers } from "./workspaces";

type WorkspaceItem = WorkspaceState["items"][number];

const TS = "2026-01-01T00:00:00Z";

function workspaceItem(overrides: Partial<WorkspaceItem> & { id: string }): WorkspaceItem {
  return {
    name: "Workspace",
    owner_id: "",
    created_at: TS,
    updated_at: TS,
    ...overrides,
  } as WorkspaceItem;
}

function makeStore(items: WorkspaceItem[], activeId: string | null) {
  let state = {
    workspaces: { items, activeId },
    workflows: { items: [], activeId: null },
    kanban: { workflowId: null, steps: [], tasks: [] },
  } as unknown as AppState;

  return {
    getState: () => state,
    setState: (updater: AppState | ((s: AppState) => AppState)) => {
      state =
        typeof updater === "function" ? (updater as (s: AppState) => AppState)(state) : updater;
    },
    subscribe: () => () => {},
    destroy: () => {},
    getInitialState: () => state,
  } as unknown as StoreApi<AppState>;
}

function createdMessage(payload: WorkspacePayload): BackendMessageMap["workspace.created"] {
  return {
    id: "msg-1",
    type: "notification",
    action: "workspace.created",
    payload,
    timestamp: TS,
  };
}

function updatedMessage(payload: WorkspacePayload): BackendMessageMap["workspace.updated"] {
  return {
    id: "msg-1",
    type: "notification",
    action: "workspace.updated",
    payload,
    timestamp: TS,
  };
}

describe("workspace.created handler — office identity", () => {
  it("carries office_workflow_id onto a newly inserted workspace", () => {
    const store = makeStore([], null);
    const handlers = registerWorkspacesHandlers(store);

    handlers["workspace.created"]?.(
      createdMessage({ id: "ws-office", name: "Office", office_workflow_id: "wf-office" }),
    );

    const inserted = store.getState().workspaces.items.find((w) => w.id === "ws-office");
    expect(inserted?.office_workflow_id).toBe("wf-office");
  });

  it("inserts a kanban workspace with a falsy office_workflow_id", () => {
    const store = makeStore([], null);
    const handlers = registerWorkspacesHandlers(store);

    // Go serializes the empty OfficeWorkflowID as "".
    handlers["workspace.created"]?.(
      createdMessage({ id: "ws-kanban", name: "Kanban", office_workflow_id: "" }),
    );

    const inserted = store.getState().workspaces.items.find((w) => w.id === "ws-kanban");
    expect(inserted?.office_workflow_id).toBeFalsy();
  });
});

describe("workspace.updated handler — office identity", () => {
  it("keeps the stored office_workflow_id when the payload omits it", () => {
    const store = makeStore(
      [workspaceItem({ id: "ws-office", name: "Office", office_workflow_id: "wf-office" })],
      "ws-office",
    );
    const handlers = registerWorkspacesHandlers(store);

    handlers["workspace.updated"]?.(updatedMessage({ id: "ws-office", name: "Renamed" }));

    const updated = store.getState().workspaces.items.find((w) => w.id === "ws-office");
    expect(updated?.name).toBe("Renamed");
    expect(updated?.office_workflow_id).toBe("wf-office");
  });

  it("repairs a missing office_workflow_id from the payload", () => {
    const store = makeStore(
      [workspaceItem({ id: "ws-office", name: "Office", office_workflow_id: null })],
      "ws-office",
    );
    const handlers = registerWorkspacesHandlers(store);

    handlers["workspace.updated"]?.(
      updatedMessage({ id: "ws-office", name: "Office", office_workflow_id: "wf-office" }),
    );

    const updated = store.getState().workspaces.items.find((w) => w.id === "ws-office");
    expect(updated?.office_workflow_id).toBe("wf-office");
  });
});
