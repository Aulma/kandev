"use client";

import { useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useRouter } from "@/lib/routing/client-router";
import { useTheme } from "@/components/theme/app-theme";
import {
  IconSun,
  IconMoon,
  IconRobot,
  IconCpu,
  IconFolder,
  IconMessageCircle,
  IconSparkles,
} from "@tabler/icons-react";
import { useAppDestinations } from "@/hooks/use-app-destinations";
import { PALETTE_NAVIGATION_GROUP_KEY } from "@/lib/navigation/destinations";
import { useRegisterCommands } from "@/hooks/use-register-commands";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import { useAppShortcuts } from "@/hooks/use-app-shortcuts";
import { usePluginShortcuts } from "@/hooks/use-plugin-shortcuts";
import { useAppStore } from "@/components/state-provider";
import { useQuickChatLauncher } from "@/hooks/use-quick-chat-launcher";
import { getShortcut } from "@/lib/keyboard/shortcut-overrides";
import type { CommandItem } from "@/lib/commands/types";

type PushFn = ReturnType<typeof useRouter>["push"];

// Catalog keys, not copy — safe at module scope (no `t()` call here). The
// palette groups by this resolved value, so every producer must use these.
const GROUP_NAVIGATION = PALETTE_NAVIGATION_GROUP_KEY;
const GROUP_SETTINGS = "common:commandGroupSettings";
const GROUP_ACTIONS = "common:commandGroupActions";

/**
 * Search keywords are stored as one comma-separated catalog value so a
 * translator can localize the whole set in one entry. They are matched, never
 * displayed; the palette itself selects commands by `id` (see
 * `command-panel-footer.tsx`), so no behavior keys off this copy.
 */
function searchKeywords(t: TFunction, key: string): string[] {
  return t(key)
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

/**
 * Navigation commands come from the navigation manifest
 * (`lib/navigation/destinations.ts`), so the palette, the sidebar, and the mobile
 * menu offer the same destinations. Command ids and copy live in each
 * destination's `palette` block — they are stable API for tests and telemetry.
 */
function useNavigationCommands(push: PushFn, t: TFunction): CommandItem[] {
  const destinations = useAppDestinations("palette");
  // Cached on a value signature so the command array keeps its identity across
  // unrelated re-renders — `useRegisterCommands` re-registers whenever the array
  // changes. Same render-time cache pattern as `use-responsive-breakpoint.ts`;
  // a `useMemo` cannot work here because the resolved list is rebuilt each render.
  const signature = destinations.map((d) => `${d.id}|${d.href}|${d.label}`).join("");
  const cacheRef = useRef<{ signature: string; commands: CommandItem[] } | null>(null);

  if (!cacheRef.current || cacheRef.current.signature !== signature) {
    cacheRef.current = {
      signature,
      commands: destinations.map((destination) => {
        const Icon = destination.icon;
        const keywordsKey = destination.palette?.keywordsKey;
        return {
          id: destination.palette?.id ?? `nav-${destination.id}`,
          label: destination.label,
          group: t(GROUP_NAVIGATION),
          icon: <Icon className="size-3.5" />,
          keywords: keywordsKey ? searchKeywords(t, keywordsKey) : [],
          action: () => push(destination.href),
        };
      }),
    };
  }

  return cacheRef.current.commands;
}

function buildSettingsCommands(push: PushFn, t: TFunction): CommandItem[] {
  return [
    {
      id: "settings-agents",
      label: t("common:commandAgentsSettings"),
      group: t(GROUP_SETTINGS),
      icon: <IconRobot className="size-3.5" />,
      keywords: searchKeywords(t, "common:commandAgentsSettingsKeywords"),
      action: () => push("/settings/agents"),
    },
    {
      id: "settings-executors",
      label: t("common:commandExecutorsSettings"),
      group: t(GROUP_SETTINGS),
      icon: <IconCpu className="size-3.5" />,
      keywords: searchKeywords(t, "common:commandExecutorsSettingsKeywords"),
      action: () => push("/settings/executors"),
    },
    {
      id: "settings-workspace",
      label: t("common:commandWorkspaceSettings"),
      group: t(GROUP_SETTINGS),
      icon: <IconFolder className="size-3.5" />,
      keywords: searchKeywords(t, "common:commandWorkspaceSettingsKeywords"),
      action: () => push("/settings/workspace"),
    },
    {
      id: "settings-prompts",
      label: t("common:commandPromptsSettings"),
      group: t(GROUP_SETTINGS),
      icon: <IconMessageCircle className="size-3.5" />,
      keywords: searchKeywords(t, "common:commandPromptsSettingsKeywords"),
      action: () => push("/settings/prompts"),
    },
  ];
}

function buildThemeCommand(
  resolvedTheme: string | undefined,
  setTheme: (theme: string) => void,
  t: TFunction,
): CommandItem {
  const isDark = resolvedTheme === "dark";
  const destinationTheme = isDark ? "light" : "dark";
  return {
    id: "pref-theme",
    label: isDark ? t("common:commandSwitchToLightMode") : t("common:commandSwitchToDarkMode"),
    group: t("common:commandGroupPreferences"),
    icon: isDark ? <IconSun className="size-3.5" /> : <IconMoon className="size-3.5" />,
    keywords: searchKeywords(t, "common:commandThemeKeywords"),
    action: () => setTheme(destinationTheme),
  };
}

export function GlobalCommands() {
  const { t } = useTranslation();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const activeWorkspaceId = useAppStore((s) => s.workspaces.activeId);
  const handleOpenQuickChat = useQuickChatLauncher(activeWorkspaceId);
  const handleOpenConfigChat = useQuickChatLauncher(activeWorkspaceId, "config");

  const keyboardShortcuts = useAppStore((s) => s.userSettings.keyboardShortcuts);
  const quickChatShortcut = getShortcut("QUICK_CHAT", keyboardShortcuts);

  const quickChatCommand: CommandItem = useMemo(
    () => ({
      id: "quick-chat",
      label: t("common:commandQuickChat"),
      group: t(GROUP_ACTIONS),
      icon: <IconMessageCircle className="size-3.5" />,
      keywords: searchKeywords(t, "common:commandQuickChatKeywords"),
      shortcut: quickChatShortcut,
      action: handleOpenQuickChat,
    }),
    [handleOpenQuickChat, quickChatShortcut, t],
  );

  const configChatCommand: CommandItem = useMemo(
    () => ({
      id: "config-chat",
      label: t("common:configurationChat"),
      group: t(GROUP_ACTIONS),
      icon: <IconSparkles className="size-3.5" />,
      keywords: searchKeywords(t, "common:commandConfigChatKeywords"),
      action: handleOpenConfigChat,
    }),
    [handleOpenConfigChat, t],
  );

  const navigationCommands = useNavigationCommands(router.push, t);

  const commands = useMemo<CommandItem[]>(
    () => [
      ...navigationCommands,
      ...buildSettingsCommands(router.push, t),
      buildThemeCommand(resolvedTheme, setTheme, t),
      quickChatCommand,
      configChatCommand,
    ],
    [
      navigationCommands,
      router.push,
      resolvedTheme,
      setTheme,
      quickChatCommand,
      configChatCommand,
      t,
    ],
  );

  useRegisterCommands(commands);
  useKeyboardShortcut(quickChatShortcut, handleOpenQuickChat);
  // Order matters: useAppShortcuts (core) must register its capture-phase
  // keydown listener before usePluginShortcuts so core shortcuts win when a
  // combo matches both — see the precedence note on each hook.
  useAppShortcuts();
  usePluginShortcuts();

  return null;
}
