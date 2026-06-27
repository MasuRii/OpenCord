/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ColorPaletteIcon } from "@components/Icons";
import SettingsPlugin from "@plugins/_core/settings";
import { MallCordDevs } from "@utils/constants";
import { removeFromArray } from "@utils/misc";
import definePlugin from "@utils/types";
import { SettingsRouter } from "@webpack/common";

import { settings } from "./utils/settings";

export default definePlugin({
    name: "ThemeLibrary",
    description: "A library of themes for Vencord.",
    tags: ["Appearance", "Customisation"],
    authors: [MallCordDevs.Fafa],
    settings,
    toolboxActions: {
        "Open Theme Library": () => {
            SettingsRouter.openUserSettings("mallcord_theme_library_panel");
        },
    },

    start() {
        SettingsPlugin.customEntries.push({
            key: "mallcord_theme_library",
            title: "Theme Library",
            Component: require("./components/ThemeTab").default,
            Icon: ColorPaletteIcon
        });
    },

    stop() {
        removeFromArray(SettingsPlugin.customEntries, e => e.key === "mallcord_theme_library");
    },
});
