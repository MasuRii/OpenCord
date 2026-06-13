/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Ported to MallCord from Nightcord (original author: Bash); see https://git.nightcord.su/nightcord/nightcord

import { MallCordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { ChannelStore, Constants, PermissionsBits, PermissionStore, RestAPI, UserStore } from "@webpack/common";

const VoiceActions = findByPropsLazy("toggleSelfMute");

interface VoiceState {
    userId: string;
    channelId?: string;
    guildId?: string;
    deaf: boolean;
    mute: boolean;
    selfDeaf: boolean;
    selfMute: boolean;
}

async function patchMember(userId: string, guildId: string, body: object) {
    await RestAPI.patch({
        url: Constants.Endpoints.GUILD_MEMBER(guildId, userId),
        body
    });
}

export default definePlugin({
    name: "AutoUnmute",
    description: "Automatically unmutes/undeafens you when you're server muted or deafened, if you have permission.",
    authors: [MallCordDevs.Sharp],

    flux: {
        VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceState[]; }) {
            const currentUser = UserStore.getCurrentUser();
            if (!currentUser) return;

            for (const state of voiceStates) {
                const { userId, channelId, guildId, mute, selfMute, deaf, selfDeaf } = state;
                if (userId !== currentUser.id || !channelId || !guildId) continue;

                const channel = ChannelStore.getChannel(channelId);
                if (!channel) continue;

                if (mute && !selfMute && PermissionStore.can(PermissionsBits.MUTE_MEMBERS, channel)) {
                    setTimeout(async () => {
                        try { await patchMember(currentUser.id, guildId, { mute: false }); }
                        catch { try { VoiceActions.toggleSelfMute(); } catch { } }
                    }, 100);
                }

                if (deaf && !selfDeaf && PermissionStore.can(PermissionsBits.DEAFEN_MEMBERS, channel)) {
                    setTimeout(async () => {
                        try { await patchMember(currentUser.id, guildId, { deaf: false }); }
                        catch { try { VoiceActions.toggleSelfDeaf(); } catch { } }
                    }, 100);
                }
            }
        }
    }
});
