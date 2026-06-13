/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { TestcordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { RestAPI, showToast, Toasts } from "@webpack/common";

const INVITE_CODES = ["disgusting", "testcord"];

const settings = definePluginSettings({
    autoJoinOnStart: {
        type: OptionType.BOOLEAN,
        description: "Automatically join servers when the plugin starts",
        default: true
    }
});

async function joinServer(code: string) {
    try {
        const res = await RestAPI.post({ url: `/invites/${code}`, body: {} });
        const guildName = res?.body?.guild?.name;
        showToast(`Joined ${guildName ?? "server"}!`, Toasts.Type.SUCCESS);
        return true;
    } catch (e) {
        console.error(`[AutoServers] Failed to join ${code}:`, e);
        showToast(`Failed to join ${code}`, Toasts.Type.FAILURE);
        return false;
    }
}

async function joinAllServers() {
    for (const code of INVITE_CODES) {
        await joinServer(code);
        await new Promise(r => setTimeout(r, 1000));
    }
}

export default definePlugin({
    name: "AutoServers",
    description: "Automatically joins peak servers for you",
    authors: [TestcordDevs.x2b],
    settings,

    start() {
        if (settings.store.autoJoinOnStart) {
            joinAllServers();
        }
    },

    toolboxActions: {
        "Join All Servers"() {
            joinAllServers();
        }
    }
});
