/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { PaletteCommand } from "../api/types";
import { BoltIcon, GearIcon, PaintIcon, RestartIcon } from "../ui/icons";
import { openSettingsPage } from "./openSettings";

const SECTION = "MallCord";

export const mallcordCommands: PaletteCommand[] = [
    {
        id: "mallcord.settings",
        title: "Open MallCord Settings",
        section: SECTION,
        keywords: ["mallcord", "vencord", "settings"],
        icon: GearIcon,
        actions: [{
            id: "run",
            label: "Open MallCord Settings",
            run: () => void openSettingsPage("mallcord_main")
        }]
    },
    {
        id: "mallcord.quickCss",
        title: "Open QuickCSS",
        section: SECTION,
        keywords: ["css", "quickcss", "editor", "style"],
        icon: PaintIcon,
        actions: [{
            id: "run",
            label: "Open QuickCSS",
            run: () => VencordNative.quickCss.openEditor()
        }]
    },
    {
        id: "mallcord.updater",
        title: "Open Updater",
        section: SECTION,
        keywords: ["update", "updater", "version"],
        icon: BoltIcon,
        predicate: () => !IS_UPDATER_DISABLED,
        actions: [{
            id: "run",
            label: "Open Updater",
            run: () => void openSettingsPage("mallcord_updater")
        }]
    },
    {
        id: "mallcord.changelog",
        title: "Open Changelog",
        section: SECTION,
        keywords: ["changelog", "news", "whats new"],
        icon: BoltIcon,
        actions: [{
            id: "run",
            label: "Open Changelog",
            run: () => void openSettingsPage("mallcord_changelog")
        }]
    },
    {
        id: "mallcord.restart",
        title: "Restart Discord",
        section: SECTION,
        keywords: ["restart", "reload", "refresh"],
        icon: RestartIcon,
        actions: [{
            id: "run",
            label: "Restart Discord",
            run: () => window.location.reload()
        }]
    }
];
