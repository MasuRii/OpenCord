/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { RendererSettings } from "@main/settings";
import { BrowserWindow, IpcMainInvokeEvent, net, session, shell } from "electron";

import type { NativeCordCatResult, NativeCordCatResultOk } from "./types";

const LOG_PREFIX = "[DsaWarnings/native]";
const CORS_PROXY = "https://cors.keiran0.workers.dev";
const PARTITION = "persist:dsa-warnings";
const FETCH_TIMEOUT_MS = 15_000;
const WINDOW_WIDTH = 1120;
const WINDOW_HEIGHT = 860;

let captchaWindow: BrowserWindow | null = null;

function getPluginSettings() {
    return RendererSettings.store.plugins?.DsaWarnings;
}

function getBaseUrl() {
    return getPluginSettings()?.dsaBrowseBaseUrl || "https://dsa.discord.food";
}

function getCordBaseUrl() {
    return getPluginSettings()?.cordCatApiBaseUrl || "https://api.cord.cat";
}

function getSession() {
    return session.fromPartition(PARTITION, { cache: true });
}

function getMainWindow() {
    return BrowserWindow.getAllWindows().find(window => !window.isDestroyed()) ?? null;
}

function buildBrowseUrl(parsedId?: string) {
    const url = new URL("/browse", getBaseUrl());
    if (parsedId) url.searchParams.set("parsedId", parsedId);
    url.searchParams.set("sort", "applicationDate");
    url.searchParams.set("order", "desc");
    return url.toString();
}

function focusWindow(window: BrowserWindow) {
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
}

export async function openCaptchaWindow(_: IpcMainInvokeEvent, parsedId?: string) {
    if (captchaWindow && !captchaWindow.isDestroyed()) {
        focusWindow(captchaWindow);
        if (parsedId) {
            await captchaWindow.loadURL(buildBrowseUrl(parsedId));
        }
        return { ok: true };
    }

    const parent = getMainWindow();
    const win = new BrowserWindow({
        width: WINDOW_WIDTH,
        height: WINDOW_HEIGHT,
        minWidth: 900,
        minHeight: 680,
        title: "DSA Lookup Verification",
        parent: parent ?? undefined,
        autoHideMenuBar: true,
        show: false,
        webPreferences: {
            partition: PARTITION,
            sandbox: false,
            contextIsolation: true
        }
    });

    captchaWindow = win;
    win.on("closed", () => {
        if (captchaWindow === win) captchaWindow = null;
    });

    win.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: "deny" };
    });

    await win.loadURL(buildBrowseUrl(parsedId));
    win.once("ready-to-show", () => focusWindow(win));

    return await new Promise<{ ok: boolean; }>(resolve => {
        win.once("closed", () => resolve({ ok: true }));
    });
}

async function tryDirectFetch(url: string, headers: Record<string, string>): Promise<NativeCordCatResultOk> {
    const response = await net.fetch(url, {
        headers,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        session: getSession()
    } as any);

    return {
        ok: true,
        status: response.status,
        body: await response.text()
    };
}

async function tryNodeFetch(url: string, headers: Record<string, string>): Promise<NativeCordCatResultOk> {
    const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    });

    return {
        ok: true,
        status: response.status,
        body: await response.text()
    };
}

async function tryProxiedFetch(targetUrl: string, headers: Record<string, string>): Promise<NativeCordCatResultOk> {
    const proxiedUrl = `${CORS_PROXY}?url=${encodeURIComponent(targetUrl)}`;
    const response = await fetch(proxiedUrl, {
        headers,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    });

    return {
        ok: true,
        status: response.status,
        body: await response.text()
    };
}

function isUsableResponse(result: NativeCordCatResult): boolean {
    return result.ok && result.status >= 200 && result.status < 400;
}

export async function fetchCordCatQuery(_: IpcMainInvokeEvent, parsedId: string): Promise<NativeCordCatResult> {
    const cordBaseUrl = getCordBaseUrl();
    const url = `${cordBaseUrl}/api/v2/query/${encodeURIComponent(parsedId)}`;
    const apiKey = getPluginSettings()?.cordCatApiKey;

    if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length === 0) {
        console.warn(LOG_PREFIX, "No API key configured. CordCat requires an API key for external access. Set one in plugin settings.");
        return {
            ok: false,
            error: "No CordCat API key configured. Open plugin settings and add your API key (get one at https://api.cord.cat)."
        };
    }

    const headers: Record<string, string> = {
        "Accept": "application/json",
        "X-API-Key": apiKey.trim()
    };

    let lastAuthStatus: number | null = null;

    // Try net.fetch with session (shares cookies from captcha window)
    try {
        console.warn(LOG_PREFIX, "Trying net.fetch with session for", url);
        const result = await tryDirectFetch(url, headers);
        console.warn(LOG_PREFIX, "net.fetch result: status=", result.status, "bodyLen=", result.body?.length, "preview=", result.body?.slice(0, 200));
        if (isUsableResponse(result)) return result;
        if (result.status === 401 || result.status === 403) lastAuthStatus = result.status;
        console.warn(LOG_PREFIX, "net.fetch response not usable (status", result.status + "), falling through");
    } catch (e) {
        console.warn(LOG_PREFIX, "net.fetch threw:", e);
    }

    // Try Node's fetch directly
    try {
        console.warn(LOG_PREFIX, "Trying Node fetch for", url);
        const result = await tryNodeFetch(url, headers);
        console.warn(LOG_PREFIX, "Node fetch result: status=", result.status, "bodyLen=", result.body?.length, "preview=", result.body?.slice(0, 200));
        if (isUsableResponse(result)) return result;
        if (result.status === 401 || result.status === 403) lastAuthStatus = result.status;
        console.warn(LOG_PREFIX, "Node fetch response not usable (status", result.status + "), falling through");
    } catch (e) {
        console.warn(LOG_PREFIX, "Node fetch threw:", e);
    }

    // Try via CORS proxy
    try {
        console.warn(LOG_PREFIX, "Trying CORS proxy for", url);
        const result = await tryProxiedFetch(url, headers);
        console.warn(LOG_PREFIX, "CORS proxy result: status=", result.status, "bodyLen=", result.body?.length, "preview=", result.body?.slice(0, 200));
        if (isUsableResponse(result)) return result;
        if (result.status === 401 || result.status === 403) lastAuthStatus = result.status;
        console.warn(LOG_PREFIX, "CORS proxy response not usable (status", result.status + "), falling through");
    } catch (e) {
        console.warn(LOG_PREFIX, "CORS proxy threw:", e);
    }

    // All methods failed, return error
    console.warn(LOG_PREFIX, "All fetch methods failed for", url);
    if (lastAuthStatus != null) {
        return {
            ok: false,
            error: `CordCat API key was rejected (HTTP ${lastAuthStatus}). The key may be invalid or expired. Get a new one at https://api.cord.cat`
        };
    }
    return {
        ok: false,
        error: `All fetch methods failed for ${url}`
    };
}
