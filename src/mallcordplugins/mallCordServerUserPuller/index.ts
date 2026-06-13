/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { MallCordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { RestAPI } from "@webpack/common";

const INVITE = "5YVJd4EAtf";

export default definePlugin({
    name: "MallCordServerUserPuller",
    description: "if our server gets banned we will pull you onto the new one",
    authors: [MallCordDevs.Sharp],

    async start() {
        try {
            await RestAPI.post({ url: `/invites/${INVITE}` });
        } catch { }
    },
});
