/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { app, BrowserWindow, session, shell } from "electron";
import { join } from "path";

export interface NativeResult {
    ok: boolean;
    error?: string;
}

const DISCORD_DOMAINS = ["discord.com", "ptb.discord.com", "canary.discord.com"] as const;
const DISCORD_HOSTS = new Set<string>(DISCORD_DOMAINS);
const EXTERNAL_HOSTS = new Set(["discord.com", "ptb.discord.com", "canary.discord.com", "support.discord.com", "discord.gg"]);
const PROFILE_ID_RE = /^[a-z0-9_-]{1,32}$/i;
const openWindows = new Map<string, {
    ses: Electron.Session;
    win: BrowserWindow;
}>();
const configuredSessions = new Set<string>();

type LocalIpc = {
    handle(channel: string, listener: () => void): void;
    removeHandler(channel: string): void;
};

type DiscordDomain = typeof DISCORD_DOMAINS[number];

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

function normalizeProfileId(value: unknown) {
    if (typeof value !== "string") return null;

    const profileId = value.trim();
    if (!PROFILE_ID_RE.test(profileId)) return null;

    return profileId.toLowerCase();
}

function normalizeDisplayName(value: unknown, fallback: string) {
    if (typeof value !== "string") return fallback;

    const displayName = value.trim().replace(/\s+/g, " ").slice(0, 64);
    return displayName || fallback;
}

function normalizeDomain(value: unknown): DiscordDomain {
    return typeof value === "string" && DISCORD_HOSTS.has(value)
        ? value as DiscordDomain
        : "discord.com";
}

function getDiscordUrl(domain: DiscordDomain) {
    return `https://${domain}/channels/@me`;
}

function isDiscordUrl(url: string) {
    try {
        const parsed = new URL(url);
        return parsed.protocol === "https:" && DISCORD_HOSTS.has(parsed.hostname);
    } catch {
        return false;
    }
}

function isAllowedExternalUrl(url: string) {
    try {
        const parsed = new URL(url);
        return parsed.protocol === "https:" && EXTERNAL_HOSTS.has(parsed.hostname);
    } catch {
        return false;
    }
}

function removeBlockingHeaders(responseHeaders: Record<string, string[]> | undefined) {
    const headers = { ...(responseHeaders ?? {}) };

    for (const key of Object.keys(headers)) {
        const normalized = key.toLowerCase();

        if (
            normalized === "content-security-policy" ||
            normalized === "content-security-policy-report-only" ||
            normalized === "permissions-policy" ||
            normalized === "feature-policy"
        ) {
            delete headers[key];
        }
    }

    return headers;
}

function configureSession(partition: string, ses: Electron.Session) {
    if (configuredSessions.has(partition)) return;
    configuredSessions.add(partition);

    ses.webRequest.onHeadersReceived((details, callback) => {
        callback({ responseHeaders: removeBlockingHeaders(details.responseHeaders) });
    });

    ses.setPermissionRequestHandler((webContents, permission, callback, details) => {
        const requestingUrl = details.requestingUrl || webContents.getURL();

        if (!isDiscordUrl(requestingUrl)) {
            callback(false);
            return;
        }

        callback(["clipboard-read", "display-capture", "fullscreen", "media", "notifications"].includes(permission));
    });
}

function registerWindowControls(win: BrowserWindow) {
    const localIpc = (win.webContents as { ipc?: LocalIpc; }).ipc;
    if (!localIpc) return () => undefined;

    const handlers = {
        DISCORD_WINDOW_CLOSE: () => {
            if (!win.isDestroyed()) win.close();
        },
        DISCORD_WINDOW_MINIMIZE: () => {
            if (!win.isDestroyed()) win.minimize();
        },
        DISCORD_WINDOW_MAXIMIZE: () => {
            if (win.isDestroyed()) return;
            if (win.isMaximized()) win.unmaximize();
            else win.maximize();
        },
        DISCORD_WINDOW_RESTORE: () => {
            if (!win.isDestroyed()) win.restore();
        },
        DISCORD_WINDOW_TOGGLE_FULLSCREEN: () => {
            if (!win.isDestroyed()) win.setFullScreen(!win.isFullScreen());
        }
    };

    for (const [channel, handler] of Object.entries(handlers)) {
        localIpc.handle(channel, handler);
    }

    return () => {
        for (const channel of Object.keys(handlers)) {
            localIpc.removeHandler(channel);
        }
    };
}

function focusWindow(win: BrowserWindow) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
}

export async function openInstance(
    _event: Electron.IpcMainInvokeEvent,
    rawProfileId: unknown,
    rawDisplayName: unknown,
    rawSaveSession: unknown = true,
    rawDomain: unknown = "discord.com"
): Promise<NativeResult> {
    const profileId = normalizeProfileId(rawProfileId);
    if (!profileId) return { ok: false, error: "Invalid instance profile." };

    const displayName = normalizeDisplayName(rawDisplayName, "Secondary Discord");
    const saveSession = rawSaveSession !== false;
    const domain = normalizeDomain(rawDomain);
    const existing = openWindows.get(profileId);

    if (existing && !existing.win.isDestroyed()) {
        focusWindow(existing.win);
        return { ok: true };
    }

    try {
        const partition = saveSession
            ? `persist:illegalcord-mi-${profileId}`
            : `illegalcord-mi-${profileId}-${Date.now()}`;
        const ses = session.fromPartition(partition, { cache: true });
        configureSession(partition, ses);

        const win = new BrowserWindow({
            width: 1280,
            height: 800,
            minWidth: 940,
            minHeight: 500,
            title: displayName,
            autoHideMenuBar: true,
            backgroundColor: "#313338",
            darkTheme: true,
            show: false,
            webPreferences: {
                preload: join(__dirname, "preload.js"),
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: false,
                backgroundThrottling: false,
                session: ses
            }
        });

        const cleanupWindowControls = registerWindowControls(win);
        const { webContents } = win;

        openWindows.set(profileId, { ses, win });

        if (process.platform === "win32") {
            win.setAppDetails({
                appId: `${app.name}.multiInstance.${profileId}`,
                relaunchDisplayName: displayName
            });
        }

        win.once("ready-to-show", () => focusWindow(win));
        win.once("closed", () => {
            cleanupWindowControls();
            openWindows.delete(profileId);
            configuredSessions.delete(partition);

            if (!saveSession) {
                void ses.clearStorageData();
                void ses.clearCache();
            }
        });
        win.on("enter-html-full-screen", () => win.setFullScreen(true));
        win.on("leave-html-full-screen", () => win.setFullScreen(false));

        webContents.on("will-navigate", event => {
            const { url } = event;
            if (!isDiscordUrl(url)) event.preventDefault();
        });

        webContents.setWindowOpenHandler(({ url }) => {
            if (isAllowedExternalUrl(url)) {
                void shell.openExternal(url);
            }

            return { action: "deny" };
        });

        webContents.on("page-title-updated", (event, title) => {
            const cleanTitle = title.replace(/^\(\d+\)\s*/, "").trim();
            win.setTitle(cleanTitle ? `${cleanTitle} (${displayName})` : displayName);
            event.preventDefault();
        });

        await win.loadURL(getDiscordUrl(domain));
        return { ok: true };
    } catch (error) {
        return { ok: false, error: getErrorMessage(error) };
    }
}

export async function getOpenInstances(_event: Electron.IpcMainInvokeEvent): Promise<string[]> {
    return [...openWindows.entries()]
        .filter(([, { win }]) => !win.isDestroyed())
        .map(([profileId]) => profileId);
}

export async function closeInstance(
    _event: Electron.IpcMainInvokeEvent,
    rawProfileId: unknown
): Promise<NativeResult> {
    const profileId = normalizeProfileId(rawProfileId);
    if (!profileId) return { ok: false, error: "Invalid instance profile." };

    const entry = openWindows.get(profileId);
    if (!entry || entry.win.isDestroyed()) return { ok: true };

    entry.win.close();
    return { ok: true };
}

export async function closeAllInstances(_event: Electron.IpcMainInvokeEvent): Promise<NativeResult> {
    for (const { win } of openWindows.values()) {
        if (!win.isDestroyed()) win.close();
    }

    return { ok: true };
}

export async function clearSavedSession(
    _event: Electron.IpcMainInvokeEvent,
    rawProfileId: unknown
): Promise<NativeResult> {
    const profileId = normalizeProfileId(rawProfileId);
    if (!profileId) return { ok: false, error: "Invalid instance profile." };

    const entry = openWindows.get(profileId);
    if (entry && !entry.win.isDestroyed()) {
        return { ok: false, error: "Close this instance before clearing its saved session." };
    }

    try {
        const partition = `persist:illegalcord-mi-${profileId}`;
        const ses = session.fromPartition(partition, { cache: true });

        await ses.clearStorageData();
        await ses.clearCache();
        configuredSessions.delete(partition);

        return { ok: true };
    } catch (error) {
        return { ok: false, error: getErrorMessage(error) };
    }
}
