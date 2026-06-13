/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Ported to MallCord from Nightcord; see https://git.nightcord.su/nightcord/nightcord

import { definePluginSettings } from "@api/Settings";
import { MallCordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { RestAPI, showToast, Toasts, UserStore } from "@webpack/common";

const settings = definePluginSettings({
    showToast: {
        type: OptionType.BOOLEAN,
        description: "Show a notification when a forced nickname is removed",
        default: true,
    }
});

const resettingGuilds = new Set<string>();

async function resetNick(guildId: string, forcedNick: string) {
    if (resettingGuilds.has(guildId)) return;
    resettingGuilds.add(guildId);

    try {
        try {
            await RestAPI.patch({
                url: `/users/@me/guilds/${guildId}/profile`,
                body: { nick: null }
            });
            if (settings.store.showToast) showToast(`AntiNickname: nickname "${forcedNick}" removed`, Toasts.Type.SUCCESS);
            return;
        } catch {
            // fall through to the member endpoint
        }

        await RestAPI.patch({
            url: `/guilds/${guildId}/members/@me`,
            body: { nick: "" }
        });
        if (settings.store.showToast) showToast(`AntiNickname: nickname "${forcedNick}" removed`, Toasts.Type.SUCCESS);
    } catch (err: any) {
        console.warn(`[AntiNickname] Failed to reset nickname on ${guildId}:`, err);
        if (settings.store.showToast) showToast(`AntiNickname: failed to reset nickname (${err?.status ?? "?"})`, Toasts.Type.FAILURE);
    } finally {
        setTimeout(() => resettingGuilds.delete(guildId), 2000);
    }
}

export default definePlugin({
    name: "AntiNickname",
    description: "Automatically resets any nickname forcefully assigned to you in a server. Works even without admin permissions.",
    authors: [MallCordDevs.Sharp],
    settings,

    flux: {
        GUILD_MEMBER_UPDATE({ guildId, user, nick }: { guildId: string; user: { id: string; }; nick: string | null; }) {
            const currentUser = UserStore.getCurrentUser();
            if (!currentUser || user.id !== currentUser.id) return;
            if (!nick) return;
            setTimeout(() => resetNick(guildId, nick), 300);
        }
    },

    stop() {
        resettingGuilds.clear();
    }
});
