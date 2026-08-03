import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  APP_DESTINATIONS,
  GATED_SECTIONS,
  MOBILE_MENU_EXEMPTIONS,
  MOBILE_MENU_SECTIONS,
  MOBILE_MENU_UTILITY_SECTIONS,
  NO_WORKSPACE_CONTEXT,
  resolveDestinations,
  type AvailabilityMap,
  type NavContext,
} from "./destinations";

const ALL_INTEGRATIONS: AvailabilityMap = {
  "azure-devops": true,
  github: true,
  gitlab: true,
  jira: true,
  linear: true,
};

const KANBAN: NavContext = { workspaceId: "ws-1", inOffice: false };
const OFFICE: NavContext = { workspaceId: "ws-office", inOffice: true };

function ids(destinations: { id: string }[]): string[] {
  return destinations.map((destination) => destination.id);
}

describe("resolveDestinations", () => {
  it("offers the sidebar's insight and integration destinations, in manifest order", () => {
    const resolved = resolveDestinations({
      surface: "sidebar",
      ctx: KANBAN,
      availability: ALL_INTEGRATIONS,
    });

    expect(ids(resolved)).toEqual(["stats", "azure-devops", "github", "gitlab", "jira", "linear"]);
  });

  it("hides integrations that are not configured", () => {
    const resolved = resolveDestinations({
      surface: "sidebar",
      section: "integrations",
      ctx: KANBAN,
      availability: { github: true, linear: true },
    });

    expect(ids(resolved)).toEqual(["github", "linear"]);
    expect(resolved.map((destination) => destination.href)).toEqual(["/github", "/linear"]);
  });

  it("offers no integrations when none are configured", () => {
    const resolved = resolveDestinations({
      surface: "sidebar",
      section: "integrations",
      ctx: KANBAN,
      availability: {},
    });

    expect(resolved).toEqual([]);
  });

  it("accepts several sections, which is how the mobile menu's utility group resolves", () => {
    const resolved = resolveDestinations({
      surface: "mobileMenu",
      section: MOBILE_MENU_UTILITY_SECTIONS,
      ctx: KANBAN,
    });

    expect(ids(resolved)).toEqual(["stats", "settings"]);
  });

  it("resolves workspace-dependent hrefs from the nav context", () => {
    const [home] = resolveDestinations({ surface: "palette", section: "primary", ctx: KANBAN });

    expect(home?.href).toBe("/?home=overview");
  });

  it("follows the active mode for destinations whose href depends on it", () => {
    // Home is palette-only, so assert the context wiring through the manifest
    // entry itself rather than a surface that does not offer it.
    const home = APP_DESTINATIONS.find((destination) => destination.id === "home");
    const href = home?.href;

    expect(typeof href).toBe("function");
    expect(typeof href === "function" ? href(OFFICE) : null).toBe("/office");
    expect(typeof href === "function" ? href(KANBAN) : null).toBe(
      "/?home=overview&workspaceId=ws-1",
    );
  });

  it("resolves labels through the injected translator, leaving brand names alone", () => {
    const resolved = resolveDestinations({
      surface: "sidebar",
      ctx: KANBAN,
      availability: ALL_INTEGRATIONS,
      translate: (key) => `t(${key})`,
    });

    expect(resolved[0]).toMatchObject({ id: "stats", label: "t(sidebar:stats)" });
    expect(resolved.find((destination) => destination.id === "github")?.label).toBe("GitHub");
  });

  it("applies palette overrides for id, copy and href", () => {
    const resolved = resolveDestinations({ surface: "palette", ctx: KANBAN });
    const settings = resolved.find((destination) => destination.id === "settings");

    expect(settings?.href).toBe("/settings/general");
    expect(settings?.label).toBe("common:commandGoToSettings");
    expect(settings?.palette?.id).toBe("nav-settings");
  });

  it("keeps the surface-agnostic href outside the palette", () => {
    const [settings] = resolveDestinations({
      surface: "mobileMenu",
      section: "utilities",
      ctx: KANBAN,
    });

    expect(settings).toMatchObject({ id: "settings", href: "/settings" });
  });

  it("keeps the GitHub command listed when GitHub is unconfigured, unlike the sidebar link", () => {
    const palette = resolveDestinations({ surface: "palette", ctx: KANBAN, availability: {} });
    const sidebar = resolveDestinations({ surface: "sidebar", ctx: KANBAN, availability: {} });

    expect(ids(palette)).toContain("github");
    expect(ids(sidebar)).not.toContain("github");
  });
});

describe("plugin destinations", () => {
  const pluginItems = [
    { id: "hello", label: "Hello", path: "/plugins/hello" },
    { id: "explicit-main", label: "Explicit", path: "/plugins/explicit", section: "main" as const },
    {
      id: "tracker",
      label: "Tracker",
      path: "/plugins/tracker",
      section: "integrations" as const,
    },
    {
      id: "prefs",
      label: "Prefs",
      path: "/settings/plugins/p",
      section: "settings" as const,
    },
  ];

  it("routes main-section items (explicit or omitted) to the plugins group", () => {
    const resolved = resolveDestinations({
      surface: "mobileMenu",
      section: "plugins",
      ctx: NO_WORKSPACE_CONTEXT,
      pluginItems,
    });

    expect(ids(resolved)).toEqual(["plugin:hello", "plugin:explicit-main"]);
    expect(resolved.every((destination) => destination.source === "plugin")).toBe(true);
  });

  it("keeps the raw item id available for test ids", () => {
    const [hello] = resolveDestinations({
      surface: "mobileMenu",
      section: "plugins",
      ctx: NO_WORKSPACE_CONTEXT,
      pluginItems,
    });

    expect(hello).toMatchObject({ id: "plugin:hello", pluginItemId: "hello" });
  });

  it("routes integration-section items alongside the first-party integrations", () => {
    const resolved = resolveDestinations({
      surface: "sidebar",
      section: "integrations",
      ctx: KANBAN,
      availability: { github: true },
      pluginItems,
    });

    // First-party links keep precedence; plugin items follow.
    expect(ids(resolved)).toEqual(["github", "plugin:tracker"]);
  });

  it("namespaces plugin ids so a plugin cannot collide with a first-party id", () => {
    const resolved = resolveDestinations({
      surface: "sidebar",
      section: "integrations",
      ctx: KANBAN,
      availability: { github: true },
      // A plugin is free to register `id: "github"` in this very section; merged
      // raw it would have produced two entries with the same key.
      pluginItems: [
        {
          id: "github",
          label: "GitHub Extras",
          path: "/plugins/github-extras",
          section: "integrations" as const,
        },
      ],
    });

    expect(ids(resolved)).toEqual(["github", "plugin:github"]);
    expect(new Set(ids(resolved)).size).toBe(resolved.length);
    expect(resolved[1]).toMatchObject({ pluginItemId: "github", label: "GitHub Extras" });
  });

  it("never renders settings-section items as destinations", () => {
    const resolved = resolveDestinations({
      surface: "mobileMenu",
      ctx: NO_WORKSPACE_CONTEXT,
      availability: ALL_INTEGRATIONS,
      pluginItems,
    });

    expect(ids(resolved)).not.toContain("plugin:prefs");
  });

  it("keeps plugin items off the palette, which plugins reach via shortcuts", () => {
    const resolved = resolveDestinations({ surface: "palette", ctx: KANBAN, pluginItems });

    expect(ids(resolved)).not.toContain("plugin:hello");
  });
});

describe("manifest invariants", () => {
  it("gives every destination a unique id", () => {
    expect(new Set(ids(APP_DESTINATIONS)).size).toBe(APP_DESTINATIONS.length);
  });

  it("gives every destination exactly one of label or labelKey", () => {
    for (const destination of APP_DESTINATIONS) {
      expect(
        Boolean(destination.label) !== Boolean(destination.labelKey),
        `${destination.id} must set either label (brand name) or labelKey (translated copy)`,
      ).toBe(true);
    }
  });

  it("declares at least one surface per destination", () => {
    for (const destination of APP_DESTINATIONS) {
      expect(destination.surfaces.length, `${destination.id} is offered nowhere`).toBeGreaterThan(
        0,
      );
    }
  });

  it("gives every palette destination a command id and copy", () => {
    const paletteDestinations = APP_DESTINATIONS.filter((destination) =>
      destination.surfaces.includes("palette"),
    );

    expect(paletteDestinations.length).toBeGreaterThan(0);
    for (const destination of paletteDestinations) {
      expect(destination.palette?.id, `${destination.id} needs a stable command id`).toBeTruthy();
      expect(destination.palette?.labelKey, `${destination.id} needs command copy`).toBeTruthy();
    }
  });
});

/**
 * The guardrails that make the manifest worth having. Both encode bugs the app
 * actually had: `/stats` reachable only from the desktop sidebar, and new routes
 * shipping with no navigation entry at all.
 */
describe("navigation coverage guardrails", () => {
  it("offers every destination in the mobile menu unless it is explicitly exempt", () => {
    // Deliberately stricter than "sidebar destinations must also be mobile":
    // a palette-only destination is just as unreachable on a phone, so every
    // omission has to be justified in MOBILE_MENU_EXEMPTIONS.
    const missing = APP_DESTINATIONS.filter(
      (destination) =>
        !destination.surfaces.includes("mobileMenu") && !(destination.id in MOBILE_MENU_EXEMPTIONS),
    );

    expect(
      ids(missing),
      "the sidebar is hidden below md, so a destination that is not in the mobile menu is unreachable on a phone — add the mobileMenu surface, or record the mobile affordance that owns it in MOBILE_MENU_EXEMPTIONS",
    ).toEqual([]);
  });

  it("keeps the exemption list honest", () => {
    for (const [id, reason] of Object.entries(MOBILE_MENU_EXEMPTIONS)) {
      const destination = APP_DESTINATIONS.find((entry) => entry.id === id);
      expect(destination, `${id} is exempt but is not a destination`).toBeTruthy();
      expect(
        destination?.surfaces.includes("mobileMenu"),
        `${id} is offered in the mobile menu, so it should not be exempt`,
      ).toBe(false);
      expect(reason.length, `${id} needs a reason naming the surface that owns it`).toBeGreaterThan(
        10,
      );
    }
  });

  it("confines availability gates to the sections that resolve availability", () => {
    // `useStaticDestinations` skips the availability subscription (which polls
    // per consumer). That is only safe while gates stay inside GATED_SECTIONS.
    const strays = APP_DESTINATIONS.filter(
      (destination) =>
        destination.requires && !GATED_SECTIONS.some((section) => section === destination.section),
    );

    expect(
      ids(strays),
      `a gated destination outside ${GATED_SECTIONS.join(", ")} would silently disappear on surfaces that use useStaticDestinations`,
    ).toEqual([]);
  });

  it("keeps every palette destination resolvable without availability", () => {
    // The palette resolves statically, so a gated entry must opt out explicitly.
    const unresolvable = APP_DESTINATIONS.filter(
      (destination) =>
        destination.surfaces.includes("palette") &&
        destination.requires &&
        !destination.palette?.ignoreRequires,
    );

    expect(
      ids(unresolvable),
      "a gated palette entry needs palette.ignoreRequires, or the palette must switch to useAppDestinations",
    ).toEqual([]);
  });

  it("puts every mobile-menu destination in a section the mobile menu renders", () => {
    const unrendered = APP_DESTINATIONS.filter(
      (destination) =>
        destination.surfaces.includes("mobileMenu") &&
        !MOBILE_MENU_SECTIONS.includes(destination.section),
    );

    expect(
      ids(unrendered),
      `mobileMenu destinations must live in one of: ${MOBILE_MENU_SECTIONS.join(", ")}`,
    ).toEqual([]);
  });

  it("covers every first-class top-level route with a destination", () => {
    // Pre-auth routes: the SPA shell bounces them, so they are never navigation
    // targets. `/` (the kanban catch-all) and the nested `/settings` and
    // `/office` trees are not part of this switch; Office is still owned by the
    // sidebar footer's mode toggle rather than a manifest destination.
    const NOT_NAVIGABLE = ["/login", "/setup", "/invite"];

    const here = path.dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(path.join(here, "../../src/spa-routes.tsx"), "utf8");
    const topLevelRoutes = [...source.matchAll(/case "(\/[a-z0-9-]*)":/g)].map((match) => match[1]);

    // Guards against a silent pass if the switch is ever restructured.
    expect(topLevelRoutes.length).toBeGreaterThan(5);

    const covered = new Set(
      resolveDestinations({
        surface: "sidebar",
        ctx: NO_WORKSPACE_CONTEXT,
        availability: ALL_INTEGRATIONS,
      })
        .concat(
          resolveDestinations({
            surface: "palette",
            ctx: NO_WORKSPACE_CONTEXT,
            availability: ALL_INTEGRATIONS,
          }),
        )
        .map((destination) => destination.href.split("?")[0]),
    );

    const uncovered = topLevelRoutes.filter(
      (route) => !NOT_NAVIGABLE.includes(route) && !covered.has(route),
    );

    expect(
      uncovered,
      "every first-class route needs a navigation manifest entry (or an explicit NOT_NAVIGABLE reason)",
    ).toEqual([]);
  });
});
