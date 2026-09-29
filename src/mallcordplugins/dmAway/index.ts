/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { MallCordDevs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { FluxDispatcher, RestAPI, UserStore } from "@webpack/common";

const log = new Logger("DMAway");

const settings = definePluginSettings({
    message: {
        type: OptionType.STRING,
        description: "Auto-reply message sent to DMs while you're idle",
        default: "I'm away right now, I'll get back to you soon.",
    },
    idleMinutes: {
        type: OptionType.NUMBER,
        description: "Minutes of inactivity before auto-reply triggers",
        default: 10,
    },
    cooldownMinutes: {
        type: OptionType.NUMBER,
        description: "Don't reply to the same person more than once per N minutes",
        default: 30,
    },
});

let idleTimer: ReturnType<typeof setTimeout> | null = null;
let isAway = false;
const replied = new Map<string, number>();

function resetIdle() {
    if (idleTimer) clearTimeout(idleTimer);
    if (isAway) {
        isAway = false;
        log.debug("Back from away");
    }
    idleTimer = setTimeout(() => {
        isAway = true;
        log.debug("Now away");
    }, settings.store.idleMinutes * 60 * 1000);
}

async function onMessage({ message, channelId }: any) {
    if (!isAway) return;
    if (!message?.author?.id) return;

    const me = UserStore.getCurrentUser();
    if (!me) return;
    if (message.author.id === me.id) return;

    const { ChannelTypes } = (await import("@webpack/common")).Constants ?? {};
    const isDM = !message.guild_id;
    if (!isDM) return;

    const now = Date.now();
    const lastReplied = replied.get(message.author.id);
    if (lastReplied && now - lastReplied < settings.store.cooldownMinutes * 60 * 1000) return;

    replied.set(message.author.id, now);

    try {
        await RestAPI.post({
            url: `/channels/${channelId}/messages`,
            body: { content: settings.store.message },
        });
    } catch (e) {
        log.error("Failed to send auto-reply:", e);
    }
}

const ACTIVITY_EVENTS = ["MOUSE_MOVE", "KEY_DOWN"];

function onActivity() {
    resetIdle();
}

export default definePlugin({
    name: "DMAway",
    description: "Automatically replies to DMs with a custom message when you've been idle.",
    authors: [MallCordDevs.Sharp],
    tags: ["dms", "afk", "away", "productivity"],
    settings,

    start() {
        FluxDispatcher.subscribe("MESSAGE_CREATE", onMessage);
        for (const ev of ACTIVITY_EVENTS) {
            document.addEventListener(ev, onActivity, { passive: true });
        }
        resetIdle();
    },

    stop() {
        FluxDispatcher.unsubscribe("MESSAGE_CREATE", onMessage);
        for (const ev of ACTIVITY_EVENTS) {
            document.removeEventListener(ev, onActivity);
        }
        if (idleTimer) clearTimeout(idleTimer);
        isAway = false;
        replied.clear();
    },
});
