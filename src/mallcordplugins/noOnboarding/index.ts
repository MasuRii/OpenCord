/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { MallCordDevs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "NoOnboarding",
    description: "Skips the server onboarding flow entirely so you can get into servers without going through the setup screens.",
    authors: [MallCordDevs.Sharp],
    tags: ["Utility", "Servers"],

    patches: [
        {
            find: "#{intl::ONBOARDING_COVER_WELCOME_SUBTITLE}",
            replacement: {
                match: "3e3",
                replace: "0",
            },
            noWarn: true,
        },
        {
            find: "shouldShowOnboarding",
            replacement: {
                match: /shouldShowOnboarding\(\){return !0}/,
                replace: "shouldShowOnboarding(){return !1}",
            },
            noWarn: true,
        },
    ],
});
