/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { MagnifyingGlassIcon } from "@components/Icons";
import SettingsPlugin from "@plugins/_core/settings";
import { MallCordDevs } from "@utils/constants";
import { removeFromArray } from "@utils/misc";
import definePlugin, { StartAt } from "@utils/types";
import { SettingsRouter } from "@webpack/common";

import IconsTab from "./components/IconsTab";
import { SettingsAbout } from "./components/Modals";

export default definePlugin({
    name: "IconViewer",
    description: "Adds a new tab to settings to preview all icons.",
    tags: ["Developers"],
    authors: [MallCordDevs.iamme],
    dependencies: ["Settings", "ConcatenatedModules"],
    startAt: StartAt.WebpackReady,
    toolboxActions: {
        "Open Icons Tab"() {
            SettingsRouter.openUserSettings("mallcord_icon_viewer_panel");
        },
    },
    settingsAboutComponent: SettingsAbout,
    start() {
        SettingsPlugin.customEntries.push({
            key: "mallcord_icon_viewer",
            title: "Icon Finder",
            Component: IconsTab,
            Icon: MagnifyingGlassIcon
        });
    },
    stop() {
        removeFromArray(SettingsPlugin.customEntries, e => e.key === "mallcord_icon_viewer");
    },
});
