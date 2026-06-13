/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { get as dsGet, set as dsSet } from "@api/DataStore";
import { MallCordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { React, showToast, Toasts } from "@webpack/common";

const SEEN_KEY = "RecRoomTribute_shown";

export default definePlugin({
    name: "RecRoomTribute",
    description: "A memorial to Rec Room (2016–2026), the VR social platform that brought millions together before closing on June 1, 2026.",
    tags: ["Fun"],
    authors: [MallCordDevs.Sharp],

    settingsAboutComponent() {
        return (
            <div style={{ padding: "8px 0", color: "var(--text-normal)", lineHeight: 1.6 }}>
                <div style={{ fontSize: "20px", fontWeight: 700, marginBottom: "6px" }}>
                    🎮 In Memory of Rec Room
                </div>
                <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "10px" }}>
                    2016 – June 1, 2026
                </div>
                <p style={{ margin: "0 0 8px" }}>
                    Rec Room was a virtual reality social game where millions of players created rooms,
                    played games, and made friends across PlayStation, Xbox, Nintendo Switch, Meta Quest, and more.
                    After a decade of bringing people together, Rec Room Inc. ceased operations on June 1, 2026.
                </p>
                <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "13px", fontStyle: "italic" }}>
                    "Thank you for ten years of memories. The rooms may be gone, but the friendships made inside them aren't."
                </p>
            </div>
        );
    },

    async start() {
        const shown = await dsGet<boolean>(SEEN_KEY);
        if (shown) return;
        await dsSet(SEEN_KEY, true);

        setTimeout(() => {
            showToast(
                "🎮 In memory of Rec Room (2016–2026). Gone but not forgotten.",
                Toasts.Type.MESSAGE
            );
        }, 3000);
    },
});
