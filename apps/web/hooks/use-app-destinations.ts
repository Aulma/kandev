"use client";

import { useTranslation } from "react-i18next";
import { useAppStore } from "@/components/state-provider";
import { useInOffice } from "@/hooks/use-in-office";
import { useNavAvailability } from "@/hooks/use-nav-availability";
import {
  resolveDestinations,
  type GatedNavSection,
  type NavContext,
  type NavSurface,
  type ResolvedDestination,
  type StaticNavSection,
} from "@/lib/navigation/destinations";
import { usePluginRegistry } from "@/lib/plugins/registry";

/** Active workspace and mode, the inputs a destination href may depend on. */
export function useNavContext(): NavContext {
  const workspaceId = useAppStore((s) => s.workspaces.activeId);
  const inOffice = useInOffice();
  return { workspaceId, inOffice };
}

/**
 * Destinations for a surface that renders availability-gated sections — today
 * that means the integrations groups (see `GATED_SECTIONS`).
 *
 * Subscribes to `useNavAvailability`, and therefore to the per-integration auth
 * probes, which each run their own 90s `setInterval` per consumer
 * (`hooks/domains/integrations/use-integration-availability.ts`). Use
 * `useStaticDestinations` for ungated sections so a nav surface doesn't add
 * background polling just to render a static link.
 *
 * Not memoized: the availability map is rebuilt each render, so a `useMemo` here
 * would never hit. Consumers map the result straight into JSX.
 */
export function useAppDestinations(
  surface: NavSurface,
  section: GatedNavSection | GatedNavSection[],
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

/**
 * Destinations for a surface whose sections carry no availability gate — the
 * sidebar footer, the mobile menu's utility group, and the command palette
 * (whose one gated entry opts out via `palette.ignoreRequires`).
 *
 * Identical to `useAppDestinations` minus the availability subscription, so
 * these surfaces cost no background requests. `destinations.test.ts` enforces
 * the invariant that makes this safe: nothing outside `GATED_SECTIONS` declares
 * `requires`, and every palette entry is either ungated or opted out.
 */
export function useStaticDestinations(
  surface: NavSurface,
  section?: StaticNavSection | StaticNavSection[],
): ResolvedDestination[] {
  const { t } = useTranslation();
  const ctx = useNavContext();
  const registry = usePluginRegistry();

  return resolveDestinations({
    surface,
    ...(section ? { section } : {}),
    ctx,
    translate: t,
    pluginItems: registry.getNavItems(),
  });
}
