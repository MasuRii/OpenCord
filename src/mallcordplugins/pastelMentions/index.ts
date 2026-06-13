/*
 * MallCord, a vaporwave-inspired Discord client mod
 * Copyright (c) 2026 unfamiliardev
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { disableStyle, enableStyle } from "@api/Styles";
import { MallCordDevs } from "@utils/constants";
import definePlugin from "@utils/types";

import style from "./style.css?managed";

export default definePlugin({
    name: "PastelMentions",
    description: "Recolors mentions and role pills with a soft pastel vaporwave gradient.",
    authors: [MallCordDevs.Sharp],
    start: () => enableStyle(style),
    stop: () => disableStyle(style),
});
