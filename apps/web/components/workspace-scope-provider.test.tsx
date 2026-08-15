import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StateProvider } from "@/components/state-provider";
import type { AppState } from "@/lib/state/store";
import { WorkspaceScopeProvider, useWorkspaceScope } from "./workspace-scope-provider";

const OFFICE = {
  id: "office-1",
  name: "Office",
  owner_id: "owner",
  office_workflow_id: "wf-office",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};
const KANBAN = { ...OFFICE, id: "kanban-1", name: "Kanban", office_workflow_id: null };

function Probe() {
  const { mode, workspaceId } = useWorkspaceScope();
  return <span data-testid="scope">{`${mode}:${workspaceId ?? "none"}`}</span>;
}

function renderScope(
  initialState: Partial<AppState>,
  props: { workspaceId?: string } = {},
): string {
  render(
    <StateProvider initialState={initialState}>
      <WorkspaceScopeProvider {...props}>
        <Probe />
      </WorkspaceScopeProvider>
    </StateProvider>,
  );
  return screen.getByTestId("scope").textContent ?? "";
}

afterEach(() => cleanup());

describe("WorkspaceScopeProvider", () => {
  it("reports office mode for an active office workspace", () => {
    expect(renderScope({ workspaces: { items: [KANBAN, OFFICE], activeId: OFFICE.id } })).toBe(
      "office:office-1",
    );
  });

  it("reports kanban mode for an active kanban workspace", () => {
    expect(renderScope({ workspaces: { items: [KANBAN, OFFICE], activeId: KANBAN.id } })).toBe(
      "kanban:kanban-1",
    );
  });

  it("reports unknown while the workspace list is unhydrated", () => {
    // The frame every boot passes through. Reading it as kanban is what makes
    // the sidebar paint one mode and swap to the other.
    expect(renderScope({ workspaces: { items: [], activeId: OFFICE.id } })).toBe("unknown:none");
  });

  it("scopes to an explicitly named workspace instead of the active one", () => {
    // The seam the side-by-side layout needs: two providers, two workspaces,
    // one store. Consumers below each one are unchanged.
    expect(
      renderScope(
        { workspaces: { items: [KANBAN, OFFICE], activeId: KANBAN.id } },
        {
          workspaceId: OFFICE.id,
        },
      ),
    ).toBe("office:office-1");
  });

  it("resolves rather than holds when a populated list lacks the named workspace", () => {
    expect(
      renderScope(
        { workspaces: { items: [KANBAN], activeId: KANBAN.id } },
        {
          workspaceId: "deleted-workspace",
        },
      ),
    ).toBe("kanban:none");
  });
});
