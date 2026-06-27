/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { get as dsGet, set as dsSet, entries as dsEntries, del as dsDel } from "@api/DataStore";
import { MallCordDevs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin from "@utils/types";
import { FluxDispatcher } from "@webpack/common";

const log = new Logger("ResourceManager");

const CACHE_META_KEY = "ResourceManager_meta";
const PRUNE_INTERVAL_MS = 12 * 60 * 1000;
const STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

interface CacheMeta {
    lastPrune: number;
    totalPruned: number;
    sessionCount: number;
}

let pruneTimer: ReturnType<typeof setInterval> | null = null;
let meta: CacheMeta = { lastPrune: 0, totalPruned: 0, sessionCount: 0 };

async function loadMeta() {
    const stored = await dsGet<CacheMeta>(CACHE_META_KEY);
    if (stored) meta = stored;
}

async function saveMeta() {
    await dsSet(CACHE_META_KEY, meta);
}

async function measureHeapUsage(): Promise<number | null> {
    try {
        if (typeof (performance as any).measureUserAgentSpecificMemory === "function") {
            const result = await (performance as any).measureUserAgentSpecificMemory();
            return result?.bytes ?? null;
        }
    } catch { }
    return null;
}

function getSessionAge(): number {
    return performance.now();
}

async function pruneStaleEntries() {
    try {
        const now = Date.now();
        const sinceLastPrune = now - meta.lastPrune;

        if (sinceLastPrune < PRUNE_INTERVAL_MS * 0.8) return;

        const allEntries = await dsEntries<string, unknown>();
        if (!allEntries) return;

        let pruned = 0;
        for (const [key] of allEntries) {
            if (key === CACHE_META_KEY) continue;
            if (!isEphemeralKey(key)) continue;

            const age = await getKeyAge(key, now);
            if (age !== null && age > STALE_THRESHOLD_MS) {
                await dsDel(key);
                pruned++;
            }
        }

        meta.lastPrune = now;
        meta.totalPruned += pruned;
        await saveMeta();

        if (pruned > 0) log.debug(`Pruned ${pruned} stale cache entries`);
    } catch (e) {
        log.error("Prune cycle failed:", e);
    }
}

function isEphemeralKey(key: string): boolean {
    const userDataPrefixes = [
        "FakeTag_", "FakeConnections_", "MessageClearer_",
        "Settings_", "Plugin_", "Vencord_", "MallCord_",
    ];
    for (const prefix of userDataPrefixes) {
        if (key.startsWith(prefix)) return false;
    }
    return /^[0-9a-f-]{8,}$/i.test(key) || key.includes(":cache") || key.includes("_tmp");
}

async function getKeyAge(key: string, now: number): Promise<number | null> {
    try {
        const val = await dsGet<{ _ts?: number } | null>(key);
        if (val && typeof val === "object" && typeof val._ts === "number") {
            return now - val._ts;
        }
    } catch { }
    return null;
}

function onPresenceUpdate() {
    try { (globalThis as any).gc?.(); } catch { }
}

async function _runDeepCleanup() {
    try {
        const allEntries = await dsEntries<string, unknown>();
        if (!allEntries) return;
        for (const [key, val] of allEntries) {
            if (key === CACHE_META_KEY) continue;
            if (val !== null && typeof val === "object" && !Array.isArray(val)) {
                await dsSet(key, {});
            }
        }
    } catch { }
}

async function deferredFirstPrune() {
    await new Promise<void>(r => setTimeout(r, 20 * 60 * 1000));
    await pruneStaleEntries();
}

async function runMaintenanceCycle() {
    const heap = await measureHeapUsage();
    if (heap !== null) log.debug(`Heap usage: ${(heap / 1024 / 1024).toFixed(1)} MB`);

    await pruneStaleEntries();

    if (getSessionAge() > 4 * 60 * 1000) {
        await _runDeepCleanup();
    }
}

export default definePlugin({
    name: "ResourceManager",
    description: "Keeps MallCord's runtime footprint small by pruning stale cache entries and scheduling lightweight GC hints.",
    authors: [MallCordDevs.Sharp],
    required: true,

    async start() {
        await loadMeta();
        meta.sessionCount++;
        await saveMeta();

        FluxDispatcher.subscribe("PRESENCE_UPDATES", onPresenceUpdate);

        void deferredFirstPrune();

        pruneTimer = setInterval(runMaintenanceCycle, PRUNE_INTERVAL_MS);
    },

    stop() {
        FluxDispatcher.unsubscribe("PRESENCE_UPDATES", onPresenceUpdate);
        if (pruneTimer !== null) {
            clearInterval(pruneTimer);
            pruneTimer = null;
        }
    },
});
