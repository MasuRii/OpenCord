/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { addHeaderBarButton, HeaderBarButton, removeHeaderBarButton } from "@api/HeaderBar";
import { Logger } from "@utils/Logger";
import { MallCordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { FluxDispatcher, React, RestAPI, Toasts, UserStore } from "@webpack/common";

const logger = new Logger("AfkMode");
const ChannelStore = findByPropsLazy("getChannel", "getDMFromUserId");

const settings = definePluginSettings({
    message: {
        type: OptionType.STRING,
        description: "Message to auto-reply with when someone DMs you",
        default: "I'm AFK right now, I'll get back to you soon!",
    },
    replyOnce: {
        type: OptionType.BOOLEAN,
        description: "Only reply once per person per AFK session (prevents spam)",
        default: true,
    },
});

let afkEnabled = false;
const repliedChannels = new Set<string>();
let _setEnabled: ((v: boolean) => void) | null = null;

async function onMessageCreate({ message, channelId }: any) {
    if (!afkEnabled || !message) return;
    try {
        const me = UserStore.getCurrentUser();
        if (!me || message.author?.id === me.id) return;

        const cid: string = channelId ?? message.channel_id;
        if (!cid) return;

        const channel = ChannelStore.getChannel(cid);
        if (!channel || channel.type !== 1) return;

        if (settings.store.replyOnce && repliedChannels.has(cid)) return;
        repliedChannels.add(cid);

        await RestAPI.post({
            url: `/channels/${cid}/messages`,
            body: { content: settings.store.message },
        });
    } catch (e) {
        logger.error("Failed to send AFK reply:", e);
    }
}

function MoonIcon({ active }: { active: boolean; }) {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? "var(--brand-500)" : "currentColor"}>
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
    );
}

function AfkButton() {
    const [enabled, setEnabled] = React.useState(afkEnabled);
    _setEnabled = setEnabled;

    function toggle() {
        afkEnabled = !afkEnabled;
        setEnabled(afkEnabled);
        repliedChannels.clear();
        Toasts.show({
            message: afkEnabled ? "AFK Mode ON — auto-replying to DMs" : "AFK Mode OFF",
            type: afkEnabled ? Toasts.Type.SUCCESS : Toasts.Type.MESSAGE,
            id: Toasts.genId(),
        });
    }

    return (
        <HeaderBarButton
            icon={() => <MoonIcon active={enabled} />}
            tooltip={enabled ? "AFK Mode: ON (click to disable)" : "AFK Mode: OFF (click to enable)"}
            onClick={toggle}
        />
    );
}

export default definePlugin({
    name: "AfkMode",
    description: "Auto-replies to DMs with a custom message while you're AFK. Toggle from the header bar.",
    authors: [MallCordDevs.Sharp],
    tags: ["Utility", "Notifications"],
    dependencies: ["HeaderBarAPI"],
    settings,

    start() {
        addHeaderBarButton("afk-mode-btn", () => <AfkButton />, 8);
        FluxDispatcher.subscribe("MESSAGE_CREATE", onMessageCreate);
    },

    stop() {
        removeHeaderBarButton("afk-mode-btn");
        FluxDispatcher.unsubscribe("MESSAGE_CREATE", onMessageCreate);
        afkEnabled = false;
        repliedChannels.clear();
        _setEnabled = null;
    },
});
