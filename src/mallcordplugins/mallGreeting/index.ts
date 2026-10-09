/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { MallCordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { showToast } from "@webpack/common";

export default definePlugin({
    name: "MallGreeting",
    description: "Greets you with a cozy vaporwave toast every time MallCord starts up.",
    authors: [MallCordDevs.Sharp],
    start() {
        showToast("✦ﾟ｡ welcome back to the mall ｡ﾟ✦", "message");
    }
});
