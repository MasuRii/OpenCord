/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Ported to MallCord from Nightcord; see https://git.nightcord.su/nightcord/nightcord

import { definePluginSettings } from "@api/Settings";
import { MallCordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { moment, useEffect, useReducer } from "@webpack/common";

const settings = definePluginSettings({
    format: {
        type: OptionType.SELECT,
        description: "Seconds format displayed on every message timestamp",
        default: "HH:mm:ss",
        options: [
            { label: "15:34:21  (24h)", value: "HH:mm:ss", default: true },
            { label: "3:34:21 PM  (12h)", value: "h:mm:ss A" },
        ],
    },
    showInTooltip: {
        type: OptionType.BOOLEAN,
        description: "Show seconds in the hover tooltip",
        default: true,
    },
    showInCompact: {
        type: OptionType.BOOLEAN,
        description: "Show seconds in compact mode",
        default: true,
    },
});

// A single shared interval ticks all subscribed timestamp components, instead
// of one interval per rendered message (which would melt Discord).
const tickListeners = new Set<() => void>();
let globalTickInterval: ReturnType<typeof setInterval> | null = null;

function startGlobalTick() {
    if (globalTickInterval !== null) return;
    globalTickInterval = setInterval(() => {
        for (const fn of tickListeners) {
            try { fn(); } catch { }
        }
    }, 1000);
}

function stopGlobalTick() {
    if (tickListeners.size > 0) return;
    if (globalTickInterval !== null) {
        clearInterval(globalTickInterval);
        globalTickInterval = null;
    }
}

function useSecondTick() {
    const [, tick] = useReducer((n: number) => n + 1, 0);
    useEffect(() => {
        tickListeners.add(tick);
        startGlobalTick();
        return () => {
            tickListeners.delete(tick);
            stopGlobalTick();
        };
    }, []);
}

function renderTimestamp(date: Date, type: "cozy" | "compact" | "tooltip"): string {
    useSecondTick();

    const fmt = settings.store.format ?? "HH:mm:ss";

    switch (type) {
        case "cozy":
            return moment(date).format(fmt);
        case "compact":
            return settings.store.showInCompact
                ? moment(date).format(fmt)
                : moment(date).format("LT");
        case "tooltip":
            return settings.store.showInTooltip
                ? moment(date).format(`dddd, MMMM D, YYYY [at] ${fmt}`)
                : moment(date).format("LLLL");
    }
}

export default definePlugin({
    name: "RealtimeTimestamps",
    description: "Replaces Discord timestamps (e.g. 15:31) with live seconds (e.g. 15:34:21), updated every second.",
    tags: ["Appearance", "Chat", "Utility"],
    authors: [MallCordDevs.Sharp],
    settings,

    renderTimestamp,

    stop() {
        tickListeners.clear();
        if (globalTickInterval !== null) {
            clearInterval(globalTickInterval);
            globalTickInterval = null;
        }
    },

    patches: [
        {
            find: "#{intl::MESSAGE_EDITED_TIMESTAMP_A11Y_LABEL}",
            replacement: [
                {
                    match: /(\i\.useMemo\(.{0,50}"LT".{0,30}\]\))/,
                    replace: "$self.renderTimestamp(arguments[0].timestamp,'compact')",
                },
                {
                    match: /(\i\.useMemo\(.{0,10}\i\.\i\)\(.{0,10}\]\))/,
                    replace: "$self.renderTimestamp(arguments[0].timestamp,'cozy')",
                },
                {
                    match: /(__unsupportedReactNodeAsText:).{0,25}"LLLL"\)/,
                    replace: "$1$self.renderTimestamp(arguments[0].timestamp,'tooltip')",
                },
            ],
        },
        {
            find: /.full,.{0,15}children:/,
            replacement: {
                match: /(__unsupportedReactNodeAsText:)\i\.full/,
                replace: "$1$self.renderTimestamp(new Date(arguments[0].node.timestamp*1000),'tooltip')",
            },
        },
    ],
});
