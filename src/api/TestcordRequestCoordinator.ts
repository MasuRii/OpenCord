/*
 * OpenCord, a Discord client mod
 * Copyright (c) 2026 OpenCord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

interface CacheEntry {
    value: unknown;
    expires: number;
}

const cache = new Map<string, CacheEntry>();

/**
 * Minimal request coordinator that caches async results by key for a TTL.
 * Compatibility shim for TestCord plugins that import TestcordRequestCoordinator.
 */
export const TestcordRequestCoordinator = {
    request<T>(opts: { key: string; ttlMs: number; run: () => Promise<T>; }): Promise<T> {
        const now = Date.now();
        const existing = cache.get(opts.key);
        if (existing && existing.expires > now) {
            return existing.value as Promise<T>;
        }

        const promise = Promise.resolve().then(opts.run);
        cache.set(opts.key, { value: promise, expires: now + opts.ttlMs });
        promise.catch(() => {
            if (cache.get(opts.key)?.value === promise) cache.delete(opts.key);
        });

        return promise;
    },

    invalidatePrefix(prefix: string) {
        for (const key of cache.keys()) {
            if (key.startsWith(prefix)) cache.delete(key);
        }
    },

    invalidate(key: string) {
        cache.delete(key);
    },

    clear() {
        cache.clear();
    },
};
