/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { chooseFile, saveFile } from "@utils/web";

import type { Bookmark, BookmarkCategory } from "./types";

// Bump if the on-disk shape ever changes; import stays backward-compatible.
const EXPORT_VERSION = 1;
const CATEGORIES = new Set<BookmarkCategory>(["general", "important", "later"]);

const asString = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);

/**
 * Validate one untrusted record from a backup file into a clean Bookmark.
 * We rebuild a fresh object with only known fields — never spread the raw
 * input — so a tampered file can't inject extra/prototype-polluting keys.
 * Returns null for records missing the fields needed to be usable.
 */
function sanitizeBookmark(raw: any): Bookmark | null {
    if (!raw || typeof raw !== "object") return null;

    const messageId = asString(raw.messageId);
    const channelId = asString(raw.channelId);
    if (!messageId || !channelId) return null; // required to jump to the message

    const savedAt = Number.isFinite(raw.savedAt) ? Number(raw.savedAt) : Date.now();
    const attachmentCount = Number.isFinite(raw.attachmentCount) ? Math.max(0, Math.floor(raw.attachmentCount)) : 0;
    const category: BookmarkCategory = CATEGORIES.has(raw.category) ? raw.category : "general";

    return {
        id: asString(raw.id) || `${messageId}_${savedAt}`,
        messageId,
        channelId,
        guildId: typeof raw.guildId === "string" ? raw.guildId : null,
        authorId: asString(raw.authorId),
        authorUsername: asString(raw.authorUsername, "Unknown"),
        authorAvatar: typeof raw.authorAvatar === "string" ? raw.authorAvatar : null,
        content: asString(raw.content),
        attachmentCount,
        timestamp: asString(raw.timestamp),
        category,
        savedAt,
    };
}

/** Build a downloadable backup file and prompt the user to save it locally. */
export function exportBookmarks(bookmarks: Bookmark[]): void {
    const payload = {
        _esharq: "messageBookmarks",
        version: EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        count: bookmarks.length,
        bookmarks,
    };

    const date = new Date().toISOString().slice(0, 10);
    const file = new File(
        [JSON.stringify(payload, null, 2)],
        `esharq-bookmarks-${date}.json`,
        { type: "application/json" }
    );
    saveFile(file);
}

/** Parse + validate a backup file's text. Throws on unparseable/wrong-shape input. */
export function parseBookmarksFile(text: string): Bookmark[] {
    let data: any;
    try {
        data = JSON.parse(text);
    } catch {
        throw new Error("invalid-json");
    }

    // Accept both the wrapped export object and a bare array of bookmarks.
    const rawList = Array.isArray(data) ? data : (Array.isArray(data?.bookmarks) ? data.bookmarks : null);
    if (!rawList) throw new Error("invalid-format");

    const clean: Bookmark[] = [];
    for (const raw of rawList) {
        const b = sanitizeBookmark(raw);
        if (b) clean.push(b);
    }
    return clean;
}

/**
 * Prompt the user to pick a backup file and return its validated bookmarks.
 * Resolves to null if the user cancels the file dialog.
 */
export async function pickBookmarksFile(): Promise<Bookmark[] | null> {
    const file = await chooseFile("application/json,.json");
    if (!file) return null;
    const text = await file.text();
    return parseBookmarksFile(text);
}
