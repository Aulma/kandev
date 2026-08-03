/**
 * The app's navigation manifest: one declaration per top-level destination.
 *
 * Why this exists: each surface used to hardcode its own list. Adding a
 * destination meant editing three unrelated files, and forgetting one silently
 * dropped it from that surface — `/stats` was reachable only from the
 * desktop-only sidebar footer and a keyboard-only palette command, so it had no
 * phone entry point at all. `destinations.test.ts` now fails when a first-class
 * route has no manifest entry, or when a destination is missing from the mobile
 * menu without a recorded reason.
 *
 * What this manifest currently drives: the sidebar's integrations section and
 * footer insight buttons, the sidebar and mobile plugin nav groups, the mobile
 * menu's integrations and utility groups, and the command palette's Navigation
 * group.
 *
 * What it does not drive yet (deliberately, see the notes on `APP_DESTINATIONS`):
 * the sidebar's primary nav and the mobile header/View-toggle affordances for
 * Home and Tasks, action-shaped controls (New task, Inbox, quick chat, the
 * settings gear, the Office↔Kanban switch), the settings tree, and Office's own
 * navigation section. Those stay bespoke until the shared-shell work lands.
 *
 * This module is deliberately pure — no React, no hooks, no `t()`. Availability
 * (integration configured?) and copy resolution are injected by
 * `hooks/use-app-destinations.ts`, which keeps the manifest unit-testable.
 */
import type { ComponentType } from "react";
import {
  IconBrandGithub,
  IconBrandGitlab,
  IconChartBar,
  IconHexagon,
  IconHome,
  IconList,
  IconSettings,
  IconTicket,
} from "@tabler/icons-react";
import { AzureDevOpsIcon } from "@/components/icons/azure-devops-icon";
import { linkToTaskOverview, linkToTasks } from "@/lib/links";
import { resolvePluginIcon } from "@/lib/plugins/icons";
import type { NavItem } from "@/lib/plugins/types";

/**
 * Where a destination may be offered; every destination lists its surfaces
 * explicitly rather than defaulting, so an omission is visible in review.
 *
 * - `sidebar` — desktop navigation chrome: the `AppSidebar` sections and footer,
 *   plus the integration dropdown/topbar shortcuts that mirror them. All of it is
 *   hidden below the `md` breakpoint.
 * - `mobileMenu` — the phone/tablet hamburger sheet, which is the only navigation
 *   surface below `md`.
 * - `palette` — the command panel's Navigation group (keyboard-only today).
 */
export type NavSurface = "sidebar" | "mobileMenu" | "palette";

/**
 * Grouping within a surface. `plugins` and `integrations` keep their own group
 * headings in the mobile menu and their own sidebar sections; `insights` and
 * `utilities` render together in the mobile menu's utility block.
 */
export type NavSection = "primary" | "plugins" | "integrations" | "insights" | "utilities";

/** Keys the availability map may carry. Extend when a gated destination is added. */
export type AvailabilityKey = "azure-devops" | "github" | "gitlab" | "jira" | "linear";

export type DestinationIcon = ComponentType<{ className?: string }>;

/** Resolved at render time so hrefs can follow the active workspace / mode. */
export type NavContext = {
  workspaceId: string | null;
  inOffice: boolean;
};

export type DestinationHref = string | ((ctx: NavContext) => string);

/** Palette-specific overrides. Command ids are stable API — tests select by them. */
export type PaletteOverride = {
  id: string;
  labelKey: string;
  keywordsKey?: string;
  /** Palette href when it differs from the surface-agnostic one. */
  href?: DestinationHref;
  /** Offered even when `requires` is unmet (preserves pre-manifest behavior). */
  ignoreRequires?: boolean;
};

export type Destination = {
  /**
   * Stable identity, unique across the manifest and the merged plugin entries.
   * Plugin ids are namespaced (`plugin:<NavItem.id>`) so a plugin registering
   * `id: "github"` cannot collide with the first-party GitHub destination.
   */
  id: string;
  /** Raw `NavItem.id` for plugin entries; never set on first-party entries. */
  pluginItemId?: string;
  /**
   * Brand and product names are never translated (see apps/web/AGENTS.md), so
   * integrations carry a literal `label`; first-party copy carries `labelKey`.
   * Exactly one of the two is set.
   */
  label?: string;
  labelKey?: string;
  icon: DestinationIcon;
  section: NavSection;
  href: DestinationHref;
  surfaces: NavSurface[];
  /** Availability gate; omitted means always offered. */
  requires?: AvailabilityKey;
  palette?: PaletteOverride;
  /** "plugin" entries get surface-specific test ids; see `pluginDestinations`. */
  source?: "plugin";
};

export type ResolvedDestination = {
  id: string;
  label: string;
  icon: DestinationIcon;
  section: NavSection;
  href: string;
  source?: "plugin";
  /** Raw `NavItem.id` for plugin entries — the id e2e test ids are built from. */
  pluginItemId?: string;
  palette?: PaletteOverride;
};

export type AvailabilityMap = Partial<Record<AvailabilityKey, boolean>>;

// Surface tuples are shared so the same literal isn't repeated per entry (the
// duplicate-string lint counts occurrences, not intent).
const EVERYWHERE: NavSurface[] = ["sidebar", "mobileMenu", "palette"];
const SIDEBAR_AND_MENU: NavSurface[] = ["sidebar", "mobileMenu"];
const MENU_AND_PALETTE: NavSurface[] = ["mobileMenu", "palette"];
const PALETTE_ONLY: NavSurface[] = ["palette"];

/**
 * Sections the mobile menu renders, across its plugin group
 * (`MobilePluginNavSection`), its integrations group (`MobileIntegrationsSection`)
 * and its utility group (`MOBILE_MENU_UTILITY_SECTIONS`). A destination that
 * declares the `mobileMenu` surface must belong to one of these, or it would
 * claim a surface that never draws it — `destinations.test.ts` enforces that.
 */
export const MOBILE_MENU_SECTIONS: NavSection[] = [
  "plugins",
  "integrations",
  "insights",
  "utilities",
];

/** Sections the mobile menu's utility group renders, in order. */
export const MOBILE_MENU_UTILITY_SECTIONS: NavSection[] = ["insights", "utilities"];

/**
 * Destinations deliberately not offered in the mobile menu, each with the mobile
 * affordance that owns it instead. Everything else must be offered there: the
 * sidebar is hidden below `md`, so an omission means unreachable on a phone —
 * which is exactly how `/stats` ended up with no phone entry point.
 * `destinations.test.ts` fails on any omission that is not listed here.
 */
export const MOBILE_MENU_EXEMPTIONS: Record<string, string> = {
  home: "the mobile header's brand link is the phone's home affordance",
  tasks: "the mobile menu's View toggle switches between Kanban and List",
};

/** Catalog key the palette groups navigation commands under. */
export const PALETTE_NAVIGATION_GROUP_KEY = "common:commandGroupNavigation";

/**
 * Id namespace for plugin-registered entries. Matches the `plugin:<id>:…`
 * convention the app-status-bar ordering ids already use.
 */
export const PLUGIN_ID_PREFIX = "plugin:";

/**
 * Sections that may contain availability-gated destinations. Only surfaces
 * rendering these sections need `useAppDestinations`; everything else can use
 * `useStaticDestinations` and skip the integration availability subscription,
 * which polls per consumer. `destinations.test.ts` enforces that no destination
 * outside these sections declares `requires`.
 */
export const GATED_SECTIONS: NavSection[] = ["integrations"];

/**
 * First-party destinations, in the order surfaces should offer them.
 *
 * Not listed here, on purpose:
 * - Home/Inbox/New task in the sidebar's primary nav and the Office↔Kanban
 *   toggle — those carry badge counts, quick-chat launches, or `localStorage`
 *   side effects. They are actions, not plain destinations; folding actions in
 *   is a follow-up that should reuse the command registry.
 * - `/settings/<section>` deep links (the palette's Settings group) — those are
 *   shortcuts into one destination, not destinations of their own.
 * - `/login`, `/setup`, `/invite` — pre-auth routes, intentionally unlisted.
 */
export const APP_DESTINATIONS: Destination[] = [
  {
    id: "home",
    labelKey: "sidebar:home",
    icon: IconHome,
    section: "primary",
    href: (ctx) =>
      ctx.inOffice ? "/office" : linkToTaskOverview({ workspaceId: ctx.workspaceId ?? undefined }),
    // Palette-only: the sidebar's primary nav and the mobile header's brand link
    // already own "go home", so a second entry would duplicate them.
    surfaces: PALETTE_ONLY,
    palette: {
      id: "nav-home",
      labelKey: "common:commandGoToHome",
      keywordsKey: "common:commandGoToHomeKeywords",
      // The palette has always sent users to the workspace-less overview; a
      // manifest refactor is the wrong place to change where a command lands.
      href: () => linkToTaskOverview(),
    },
  },
  {
    id: "tasks",
    labelKey: "sidebar:tasks",
    icon: IconList,
    section: "primary",
    href: (ctx) => linkToTasks(ctx.workspaceId ?? undefined),
    // Palette-only: the sidebar's Tasks section and the mobile menu's View
    // toggle are the established ways to reach the task list.
    surfaces: PALETTE_ONLY,
    palette: {
      id: "nav-tasks",
      labelKey: "common:commandGoToAllTasks",
      keywordsKey: "common:commandGoToAllTasksKeywords",
      href: "/tasks",
    },
  },
  {
    id: "stats",
    labelKey: "sidebar:stats",
    icon: IconChartBar,
    section: "insights",
    href: "/stats",
    surfaces: EVERYWHERE,
    palette: {
      id: "nav-stats",
      labelKey: "common:commandGoToStats",
      keywordsKey: "common:commandGoToStatsKeywords",
    },
  },
  {
    id: "settings",
    labelKey: "common:settings",
    icon: IconSettings,
    section: "utilities",
    href: "/settings",
    // The sidebar's gear also toggles the sidebar's settings takeover, so it
    // stays bespoke; this entry serves the mobile menu and the palette.
    surfaces: MENU_AND_PALETTE,
    palette: {
      id: "nav-settings",
      labelKey: "common:commandGoToSettings",
      keywordsKey: "common:commandGoToSettingsKeywords",
      href: "/settings/general",
    },
  },
  {
    id: "azure-devops",
    label: "Azure DevOps",
    icon: AzureDevOpsIcon,
    section: "integrations",
    href: "/azure-devops",
    // Integrations other than GitHub have no palette command yet: the palette
    // needs "Go to <product>" copy, and adding it means new catalog keys. Adding
    // `palette` here plus an override block is all it takes.
    surfaces: SIDEBAR_AND_MENU,
    requires: "azure-devops",
  },
  {
    id: "github",
    label: "GitHub",
    icon: IconBrandGithub,
    section: "integrations",
    href: "/github",
    surfaces: EVERYWHERE,
    requires: "github",
    palette: {
      id: "nav-github",
      labelKey: "common:commandGoToGitHubDashboard",
      keywordsKey: "common:commandGoToGitHubDashboardKeywords",
      // The GitHub command predates per-workspace availability checks and has
      // always been listed unconditionally; the dashboard itself explains how to
      // connect. Kept as-is so this refactor changes no behavior.
      ignoreRequires: true,
    },
  },
  {
    id: "gitlab",
    label: "GitLab",
    icon: IconBrandGitlab,
    section: "integrations",
    href: "/gitlab",
    surfaces: SIDEBAR_AND_MENU,
    requires: "gitlab",
  },
  {
    id: "jira",
    label: "Jira",
    icon: IconTicket,
    section: "integrations",
    href: "/jira",
    surfaces: SIDEBAR_AND_MENU,
    requires: "jira",
  },
  {
    id: "linear",
    label: "Linear",
    icon: IconHexagon,
    section: "integrations",
    href: "/linear",
    surfaces: SIDEBAR_AND_MENU,
    requires: "linear",
  },
];

/**
 * Context for surfaces whose destinations carry static hrefs (the plugins group)
 * — lets them resolve without pulling workspace/mode hooks they don't need.
 */
export const NO_WORKSPACE_CONTEXT: NavContext = { workspaceId: null, inOffice: false };

export function resolveHref(href: DestinationHref, ctx: NavContext): string {
  return typeof href === "function" ? href(ctx) : href;
}

export function isAvailable(destination: Destination, availability: AvailabilityMap): boolean {
  if (!destination.requires) return true;
  return availability[destination.requires] === true;
}

/**
 * Maps plugin-registered nav items onto destinations so plugin and first-party
 * entries render through the same components. `section: "settings"` items are
 * skipped — those render in the settings tree's `PluginSlot`, not as
 * destinations.
 */
export function pluginDestinations(items: NavItem[]): Destination[] {
  return items
    .filter((item) => (item.section ?? "main") !== "settings")
    .map((item) => ({
      // Namespaced: plugin ids come from third-party manifests and share the id
      // space with first-party destinations once merged. The raw id stays on
      // `pluginItemId` because `plugin-nav-item-<id>` test ids are public contract.
      id: `${PLUGIN_ID_PREFIX}${item.id}`,
      pluginItemId: item.id,
      label: item.label,
      icon: resolvePluginIcon(item.icon),
      section: item.section === "integrations" ? ("integrations" as const) : ("plugins" as const),
      href: item.path,
      // Plugins reach the palette through `registerShortcut`, not as nav
      // commands, so plugin destinations stay off that surface.
      surfaces: SIDEBAR_AND_MENU,
      source: "plugin" as const,
    }));
}

export type ResolveOptions = {
  surface: NavSurface;
  /** One section, several (a surface group that renders more than one), or all. */
  section?: NavSection | NavSection[];
  ctx: NavContext;
  availability?: AvailabilityMap;
  /** i18n lookup for `labelKey` entries; identity-safe for tests. */
  translate?: (key: string) => string;
  /** Plugin-registered nav items to merge in, already in registry order. */
  pluginItems?: NavItem[];
};

/**
 * The one function every surface calls: filters the manifest by surface,
 * section, and availability, then resolves hrefs and copy.
 */
export function resolveDestinations({
  surface,
  section,
  ctx,
  availability = {},
  translate,
  pluginItems = [],
}: ResolveOptions): ResolvedDestination[] {
  const sections = section === undefined ? null : [section].flat();
  const all = [...APP_DESTINATIONS, ...pluginDestinations(pluginItems)];
  return all
    .filter((destination) => destination.surfaces.includes(surface))
    .filter((destination) => !sections || sections.includes(destination.section))
    .filter((destination) => isOfferedOnSurface(destination, surface, availability))
    .map((destination) => toResolved(destination, surface, ctx, translate));
}

function isOfferedOnSurface(
  destination: Destination,
  surface: NavSurface,
  availability: AvailabilityMap,
): boolean {
  if (surface === "palette" && destination.palette?.ignoreRequires) return true;
  return isAvailable(destination, availability);
}

function toResolved(
  destination: Destination,
  surface: NavSurface,
  ctx: NavContext,
  translate?: (key: string) => string,
): ResolvedDestination {
  const palette = surface === "palette" ? destination.palette : undefined;
  const href = resolveHref(palette?.href ?? destination.href, ctx);
  return {
    id: destination.id,
    label: destinationLabel(destination, palette, translate),
    icon: destination.icon,
    section: destination.section,
    href,
    ...(destination.source ? { source: destination.source } : {}),
    ...(destination.pluginItemId ? { pluginItemId: destination.pluginItemId } : {}),
    ...(destination.palette ? { palette: destination.palette } : {}),
  };
}

function destinationLabel(
  destination: Destination,
  palette: PaletteOverride | undefined,
  translate?: (key: string) => string,
): string {
  const key = palette?.labelKey ?? destination.labelKey;
  if (key) return translate ? translate(key) : key;
  return destination.label ?? destination.id;
}
