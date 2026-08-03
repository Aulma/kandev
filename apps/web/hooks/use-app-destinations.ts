"use client";

import { useTranslation } from "react-i18next";
import { useAppStore } from "@/components/state-provider";
import { useInOffice } from "@/hooks/use-in-office";
import { useNavAvailability } from "@/hooks/use-nav-availability";
import {
  resolveDestinations,
  type NavContext,
  type NavSection,
  type NavSurface,
  type ResolvedDestination,
} from "@/lib/navigation/destinations";
import { usePluginRegistry } from "@/lib/plugins/registry";

/** Active workspace and mode, the inputs a destination href may depend on. */
export function useNavContext(): NavContext {
  const workspaceId = useAppStore((s) => s.workspaces.activeId);
  const inOffice = useInOffice();
  return { workspaceId, inOffice };
}

/**
 * The destinations a surface should offer, resolved against the active workspace,
 * integration availability, and the plugin registry.
 *
 * Every navigation surface calls this instead of hardcoding its own list — that
 * is what keeps the sidebar, the mobile menu, and the command palette from
 * drifting apart (see `lib/navigation/destinations.ts`).
 *
 * Not memoized: the availability map is rebuilt each render, so a `useMemo` here
 * would never hit. Consumers map the result straight into JSX.
 */
export function useAppDestinations(
  surface: NavSurface,
  section?: NavSection | NavSection[],
): ResolvedDestination[] {
  const { t } = useTranslation();
  const ctx = useNavContext();
  const availability = useNavAvailability();
  const registry = usePluginRegistry();

  return resolveDestinations({
    surface,
    ...(section ? { section } : {}),
    ctx,
    availability,
    translate: t,
    pluginItems: registry.getNavItems(),
  });
}
