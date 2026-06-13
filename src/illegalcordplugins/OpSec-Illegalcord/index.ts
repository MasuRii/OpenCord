/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IllegalcordDevs } from "@utils/constants";
import definePlugin from "@utils/types";

import plugin from "./OpSec.plugin";

export default definePlugin({
    ...plugin,
    name: "OpSec",
    description: "Safely autocorrects outgoing messages without touching links, mentions, or code.",
    authors: [IllegalcordDevs.Solace, IllegalcordDevs.irritably]
});
