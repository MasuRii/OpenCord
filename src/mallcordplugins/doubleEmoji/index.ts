/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Ported to MallCord from Nightcord; see https://git.nightcord.su/nightcord/nightcord

import { MallCordDevs } from "@utils/constants";
import definePlugin from "@utils/types";

let clickListener: (e: MouseEvent) => void;

export default definePlugin({
    name: "DoubleEmoji",
    description: "Keeps the emoji picker open on click and highlights the emoji you picked.",
    authors: [MallCordDevs.Sharp],

    start() {
        clickListener = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const emojiWrapper = target.closest("[class*='emojiItem'], [class*='EmojiItem']") as HTMLElement;
            if (!emojiWrapper) return;
            if (!target.closest("[class*='emojiPicker'], #emoji-picker-tab-panel, [class*='expressionPicker']")) return;

            emojiWrapper.style.border = "1px solid #5865f2";
            emojiWrapper.style.borderRadius = "4px";
            emojiWrapper.style.background = "rgba(88, 101, 242, 0.05)";

            try { Object.defineProperty(e, "shiftKey", { get: () => true, configurable: true }); } catch { }
        };

        document.addEventListener("click", clickListener, { capture: true });
    },
    stop() {
        if (clickListener) document.removeEventListener("click", clickListener, { capture: true });
    }
});
