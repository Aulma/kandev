package store

import (
	"context"
	"testing"

	"github.com/jmoiron/sqlx"
	_ "github.com/mattn/go-sqlite3"

	"github.com/kandev/kandev/internal/agent/settings/models"
)

// TestListAgentProfiles_ExcludesOfficeRows guards the workspace_id scoping on
// the kanban-side profile reads. Office agent instances share agent_profiles
// (ADR 0005 Wave G) and the same agent_id as the CLI's global profiles; if
// this filter regresses, the boot-time discovery sync and profile reconciler
// walk the office rows too and rewrite their name/model to the CLI's current
// model label ("Default (recommended)") on every restart.
func TestListAgentProfiles_ExcludesOfficeRows(t *testing.T) {
	db, err := sqlx.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })

	repo, err := newSQLiteRepository(db, db, nil, false)
	if err != nil {
		t.Fatalf("newSQLiteRepository: %v", err)
	}

	ctx := context.Background()
	agent := &models.Agent{Name: "claude-acp"}
	if err := repo.CreateAgent(ctx, agent); err != nil {
		t.Fatalf("create agent: %v", err)
	}

	global := &models.AgentProfile{
		AgentID:          agent.ID,
		Name:             "Default (recommended)",
		AgentDisplayName: "Claude",
		Model:            "default",
	}
	if err := repo.CreateAgentProfile(ctx, global); err != nil {
		t.Fatalf("create global profile: %v", err)
	}

	office := &models.AgentProfile{
		AgentID:          agent.ID,
		Name:             "Engineering Lead",
		AgentDisplayName: "Engineering Lead",
		Model:            "default",
		WorkspaceID:      "ws-office",
		Role:             models.AgentRoleWorker,
	}
	if err := repo.CreateAgentProfile(ctx, office); err != nil {
		t.Fatalf("create office profile: %v", err)
	}

	profiles, err := repo.ListAgentProfiles(ctx, agent.ID)
	if err != nil {
		t.Fatalf("list profiles: %v", err)
	}
	if len(profiles) != 1 || profiles[0].ID != global.ID {
		ids := make([]string, 0, len(profiles))
		for _, p := range profiles {
			ids = append(ids, p.ID+"/"+p.Name)
		}
		t.Fatalf("ListAgentProfiles should return only the global profile, got %v", ids)
	}

	// The office row stays reachable by id for the office-side callers.
	if _, err := repo.GetAgentProfile(ctx, office.ID); err != nil {
		t.Fatalf("office profile must remain readable by id: %v", err)
	}
}

// TestHasDeletedAgentProfiles_IgnoresOfficeRows: a soft-deleted office agent
// must not count as "this CLI agent was provisioned before", or the seeders
// would skip creating the kanban default profile.
func TestHasDeletedAgentProfiles_IgnoresOfficeRows(t *testing.T) {
	db, err := sqlx.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })

	repo, err := newSQLiteRepository(db, db, nil, false)
	if err != nil {
		t.Fatalf("newSQLiteRepository: %v", err)
	}

	ctx := context.Background()
	agent := &models.Agent{Name: "claude-acp"}
	if err := repo.CreateAgent(ctx, agent); err != nil {
		t.Fatalf("create agent: %v", err)
	}

	office := &models.AgentProfile{
		AgentID:          agent.ID,
		Name:             "CEO",
		AgentDisplayName: "CEO",
		Model:            "default",
		WorkspaceID:      "ws-office",
		Role:             models.AgentRoleCEO,
	}
	if err := repo.CreateAgentProfile(ctx, office); err != nil {
		t.Fatalf("create office profile: %v", err)
	}
	if err := repo.DeleteAgentProfile(ctx, office.ID); err != nil {
		t.Fatalf("delete office profile: %v", err)
	}

	had, err := repo.HasDeletedAgentProfiles(ctx, agent.ID)
	if err != nil {
		t.Fatalf("has deleted profiles: %v", err)
	}
	if had {
		t.Fatal("deleted office row must not suppress kanban default seeding")
	}

	global := &models.AgentProfile{
		AgentID:          agent.ID,
		Name:             "Default (recommended)",
		AgentDisplayName: "Claude",
		Model:            "default",
	}
	if err := repo.CreateAgentProfile(ctx, global); err != nil {
		t.Fatalf("create global profile: %v", err)
	}
	if err := repo.DeleteAgentProfile(ctx, global.ID); err != nil {
		t.Fatalf("delete global profile: %v", err)
	}

	had, err = repo.HasDeletedAgentProfiles(ctx, agent.ID)
	if err != nil {
		t.Fatalf("has deleted profiles: %v", err)
	}
	if !had {
		t.Fatal("deleted global profile must still count as provisioned-before")
	}
}
