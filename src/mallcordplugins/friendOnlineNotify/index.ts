/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { MallCordDevs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { FluxDispatcher, GuildMemberStore, PresenceStore, RelationshipStore, showToast, Toasts, UserStore } from "@webpack/common";

const logger = new Logger("FriendOnlineNotify");

const settings = definePluginSettings({
    notifyOnline: {
        type: OptionType.BOOLEAN,
        description: "Notify when a friend comes online.",
        default: true,
    },
    notifyOffline: {
        type: OptionType.BOOLEAN,
        description: "Notify when a friend goes offline.",
        default: false,
    },
    ignoreMobile: {
        type: OptionType.BOOLEAN,
        description: "Don't notify when the friend is only on mobile.",
        default: false,
    },
});

// Track previously known statuses so we only fire on change
const knownStatuses = new Map<string, string>();

interface PresenceUpdate {
    updates: Array<{ user: { id: string; }; status: string; clientStatus?: { mobile?: string; }; }>;
}

function onPresenceUpdates({ updates }: PresenceUpdate) {
    const me = UserStore.getCurrentUser()?.id;

    for (const update of updates) {
        const userId = update.user?.id;
        if (!userId || userId === me) continue;

        // Only notify for friends (relationship type 1 = friend)
        if ((RelationshipStore as any).getRelationshipType(userId) !== 1) continue;

        const prev = knownStatuses.get(userId) ?? "offline";
        const next = update.status ?? "offline";

        if (prev === next) continue;
        knownStatuses.set(userId, next);

        const wasOffline = prev === "offline";
        const isOffline = next === "offline";
        const isOnline = next !== "offline";

        const cs = update.clientStatus as any;
        if (settings.store.ignoreMobile && cs?.mobile && !cs?.web && !cs?.desktop) continue;

        const user = UserStore.getUser(userId);
        const name = (user as any)?.globalName ?? user?.username ?? userId;

        try {
            if (settings.store.notifyOnline && wasOffline && isOnline) {
                showToast(`${name} came online`, Toasts.Type.SUCCESS);
            } else if (settings.store.notifyOffline && !wasOffline && isOffline) {
                showToast(`${name} went offline`, Toasts.Type.MESSAGE);
            }
        } catch (e) {
            logger.error("Failed to show toast", e);
        }
    }
}

export default definePlugin({
    name: "FriendOnlineNotify",
    description: "Shows a toast notification when friends come online or go offline.",
    tags: ["Notifications", "Friends"],
    authors: [MallCordDevs.Sharp],
    settings,

    start() {
        // Seed initial statuses so we don't spam on startup
        const me = UserStore.getCurrentUser()?.id;
        const friends = (RelationshipStore as any).getFriendIDs?.() as string[] ?? [];
        for (const id of friends) {
            if (id === me) continue;
            const status = PresenceStore.getStatus(id) ?? "offline";
            knownStatuses.set(id, status);
        }
        FluxDispatcher.subscribe("PRESENCE_UPDATES", onPresenceUpdates as any);
    },

    stop() {
        FluxDispatcher.unsubscribe("PRESENCE_UPDATES", onPresenceUpdates as any);
        knownStatuses.clear();
    },
});
