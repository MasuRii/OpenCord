/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { disableStyle, enableStyle } from "@api/Styles";
import { MallCordDevs } from "@utils/constants";
import definePlugin from "@utils/types";

import style from "./style.css?managed";

export default definePlugin({
    name: "HideNitroUpsells",
    description: "Hides Nitro upsell banners, gift buttons and 'boost' nags around the client.",
    authors: [MallCordDevs.Sharp],
    start: () => enableStyle(style),
    stop: () => disableStyle(style),
});
