"use client";

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { IconBoxMultiple, IconInbox, IconRobot, IconSitemap } from "@tabler/icons-react";
import { AppSidebarNavItem } from "@/components/app-sidebar/app-sidebar-nav-item";
import { OfficeNavigationSection } from "@/components/app-sidebar/sections/office-navigation-section";
import { PageShell } from "@/components/page-shell";
import { usePathname } from "@/lib/routing/client-router";

const PAGE_TITLE_KEYS: Record<string, string> = {
  "/office": "sidebar:dashboard",
  "/office/inbox": "sidebar:inbox",
  "/office/tasks": "sidebar:tasks",
  "/office/routines": "sidebar:routines",
  "/office/projects": "sidebar:projects",
  "/office/agents": "common:agents",
  "/office/workspace/org": "sidebar:orgChart",
  "/office/workspace/skills": "sidebar:skills",
  "/office/workspace/costs": "sidebar:costs",
  "/office/workspace/activity": "sidebar:activity",
  "/office/workspace/routing": "sidebar:providerRouting",
  "/office/workspace/settings": "sidebar:preferences",
};

function resolveTitleKey(pathname: string): string | null {
  const exact = PAGE_TITLE_KEYS[pathname];
  if (exact) return exact;
  if (pathname.startsWith("/office/workspace/settings")) return "sidebar:preferences";
  return null;
}

function isDetailPage(pathname: string): boolean {
  return (
    /^\/office\/tasks\/[^/]+$/.test(pathname) ||
    /^\/office\/agents\/[^/]+(?:\/.*)?$/.test(pathname) ||
    /^\/office\/projects\/[^/]+$/.test(pathname) ||
    /^\/office\/routines\/[^/]+$/.test(pathname)
  );
}

// Destinations the desktop sidebar reaches through sections other than
// `OfficeNavigationSection` — Inbox via `AppSidebarPrimaryNav`, Projects via
// `ProjectsSection`, Agents and Org Chart via `AgentsSection`. Those three build
// rows from live office data and drive some of them through `router.push`
// buttons, which the sheet's close-on-link-click would miss, so the sheet
// restates the destinations as plain links instead of rendering the sections.
// Mobile owes desktop capability parity, not layout parity.
const OFFICE_SHEET_DESTINATIONS = [
  { icon: IconInbox, labelKey: "sidebar:inbox", href: "/office/inbox" },
  { icon: IconBoxMultiple, labelKey: "sidebar:projects", href: "/office/projects" },
  { icon: IconRobot, labelKey: "common:agents", href: "/office/agents" },
  { icon: IconSitemap, labelKey: "sidebar:orgChart", href: "/office/workspace/org" },
] as const;

/**
 * Office's sections for the phone nav sheet — the same component the desktop
 * sidebar renders, compacted to the sheet's touch-row sizing, plus the
 * destinations that live in the sidebar's other sections. Without this, office
 * navigation exists only in the `hidden md:block` sidebar.
 */
function OfficePageNav() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2 [&_a]:min-h-10 [&_a]:text-sm [&_svg]:h-4 [&_svg]:w-4">
      <OfficeNavigationSection collapsed={false} section="work" />
      <div className="flex flex-col gap-0.5">
        {OFFICE_SHEET_DESTINATIONS.map(({ icon, labelKey, href }) => (
          <AppSidebarNavItem
            key={href}
            icon={icon}
            label={t(labelKey)}
            href={href}
            collapsed={false}
          />
        ))}
      </div>
      <OfficeNavigationSection collapsed={false} section="office" />
    </div>
  );
}

/**
 * Office page chrome on the shared `PageShell`. List pages show a static
 * title; detail pages render a portal target (#office-topbar-slot) that the
 * page component fills with its breadcrumb via OfficeTopbarPortal. Both paint
 * paths (`src/office-routes.tsx` and `app/office/layout.tsx`) wrap their route
 * output in this shell so they cannot drift.
 */
export function OfficeShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const titleKey = resolveTitleKey(pathname);
  const detail = isDetailPage(pathname);
  const title = titleKey ? t(titleKey) : "";

  return (
    <PageShell
      title={title}
      variant="root"
      backLabel=""
      topbarTestId="office-topbar"
      className="gap-2 bg-background px-4"
      pageNav={<OfficePageNav />}
      // The manifest's Tasks row goes to kanban. Office's own Tasks row above it
      // goes to /office/tasks, and two rows labelled "Tasks" leading to
      // different surfaces is a coin flip for the user.
      navOmitDestinations={["tasks"]}
      leading={
        detail ? (
          <div id="office-topbar-slot" className="flex items-center gap-2 flex-1 min-w-0" />
        ) : (
          titleKey && <h1 className="truncate text-sm font-medium text-foreground">{title}</h1>
        )
      }
    >
      {children}
    </PageShell>
  );
}
