/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as childProcess from "child_process";
import { app, ipcMain,shell } from "electron";
import * as fs from "fs";
import * as http from "http";
import * as path from "path";

// IPC handler to open external URLs (used by NightcordUpdater)
ipcMain.handle("NIGHTCORD_OPEN_URL", (_event, url: string) => {
    if (typeof url === "string" && url.startsWith("https://")) {
        shell.openExternal(url);
    }
});

const PORT = 47821;
let serverProc: childProcess.ChildProcess | null = null;
let serverReady = false;
let startPromise: Promise<boolean> | null = null;

// ── Find ghost-server/server.js ────────────────────────────────────────────
function findServerScript(): string | null {
    const execDir = path.dirname(process.execPath);
    const resPath = (process as any).resourcesPath ?? "";
    const candidates = [
        // Production Electron: resources/ghost-server/server.js
        path.join(resPath, "ghost-server", "server.js"),
        // Production Electron (with unpacked app.asar): resources/app/ghost-server/server.js
        path.join(resPath, "app", "ghost-server", "server.js"),
        // Production : exe + resources/ subfolder
        path.join(execDir, "resources", "ghost-server", "server.js"),
        path.join(execDir, "resources", "app", "ghost-server", "server.js"),
        // Portable (extracted dist/desktop): exe in dist/desktop, ghost-server alongside
        path.join(execDir, "ghost-server", "server.js"),
        // dev-inject : __dirname = dist/desktop/renderer
        path.join(__dirname, "..", "..", "ghost-server", "server.js"),
        path.join(__dirname, "..", "..", "..", "ghost-server", "server.js"),
        path.join(__dirname, "..", "..", "..", "..", "ghost-server", "server.js"),
        // Root of the repo in dev
        path.join(resPath, "..", "ghost-server", "server.js"),
    ];
    console.log("[GhostNative] execPath:", process.execPath);
    console.log("[GhostNative] resourcesPath:", resPath);
    console.log("[GhostNative] __dirname:", __dirname);
    for (const c of candidates) {
        console.log("[GhostNative] test:", c, fs.existsSync(c) ? "✓" : "✗");
        if (fs.existsSync(c)) { console.log("[GhostNative] server.js found:", c); return c; }
    }
    console.error("[GhostNative] server.js not found! Candidates tested:", candidates.length);
    return null;
}

function findNode(): string {
    const execDir = path.dirname(process.execPath);
    const resPath = (process as any).resourcesPath ?? "";
    const candidates = [
        // Production Electron: node.exe copied next to the Discord .exe
        path.join(execDir, "node.exe"),
        // Production: in resources/ (collect-assets copies there)
        path.join(resPath, "node.exe"),
        path.join(resPath, "..", "node.exe"),
        path.join(resPath, "app", "node.exe"),
        // In the resources/ subfolder
        path.join(execDir, "resources", "node.exe"),
        path.join(execDir, "resources", "app", "node.exe"),
        // Portable: dist/desktop contains node.exe, __dirname goes up to dist/desktop
        path.join(__dirname, "..", "..", "node.exe"),
        path.join(__dirname, "..", "..", "..", "node.exe"),
        // NVM for Windows
        path.join(process.env.LOCALAPPDATA ?? "", "nvm", "nodejs", "node.exe"),
        "C:\\nvm4w\\nodejs\\node.exe",
        "C:\\Program Files\\nodejs\\node.exe",
        "C:\\Program Files (x86)\\nodejs\\node.exe",
        path.join(process.env.LOCALAPPDATA ?? "", "Programs", "nodejs", "node.exe"),
    ];
    for (const c of candidates) {
        if (fs.existsSync(c)) { console.log("[GhostNative] node.exe found:", c); return c; }
    }
    console.warn("[GhostNative] bundled node.exe not found, falling back to 'node' from PATH");
    return "node";
}

function ping(): Promise<boolean> {
    return new Promise(resolve => {
        const req = http.get(`http://127.0.0.1:${PORT}/status`, res => {
            resolve(res.statusCode === 200);
        });
        req.setTimeout(1500, () => { req.destroy(); resolve(false); });
        req.on("error", () => resolve(false));
    });
}

async function killZombieServer(): Promise<void> {
    // If a zombie ghost-server is running from a previous crash, kill it cleanly
    try {
        const res = await Promise.race([
            ping(),
            new Promise<boolean>(r => setTimeout(() => r(false), 500))
        ]);
        if (res) {
            // A server is responding — check if it's ours or a zombie
            if (!serverProc) {
                // Not our process — it's a zombie from a previous crash
                // Try to stop it via the HTTP API
                try {
                    await new Promise<void>(resolve => {
                        const req = http.request({ hostname: "127.0.0.1", port: PORT, path: "/shutdown", method: "POST" }, () => resolve());
                        req.setTimeout(1000, () => { req.destroy(); resolve(); });
                        req.on("error", () => resolve());
                        req.end();
                    });
                } catch { }
                // Fallback : taskkill
                try {
                    childProcess.execSync('taskkill /F /IM node.exe /FI "WINDOWTITLE eq ghost-server"', { stdio: "ignore" });
                } catch { }
                await new Promise(r => setTimeout(r, 500));
            }
        }
    } catch { }
}

async function ensureServer(): Promise<boolean> {
    if (serverReady && await ping()) return true;
    if (startPromise) return startPromise;

    startPromise = (async () => {
        // Kill zombies before starting
        await killZombieServer();
        if (await ping()) { serverReady = true; return true; }

        const script = findServerScript();
        if (!script) {
            console.error("[GhostNative] server.js not found!");
            startPromise = null;
            return false;
        }

        const nodeExe = findNode();
        const scriptDir = path.dirname(script);
        const nodeModulesPath = path.join(scriptDir, "node_modules");
        console.log(`[GhostNative] Launching: ${nodeExe} ${script}`);
        console.log(`[GhostNative] cwd: ${scriptDir}`);
        console.log(`[GhostNative] node_modules exists: ${fs.existsSync(nodeModulesPath)}`);

        serverProc = childProcess.spawn(nodeExe, [script], {
            windowsHide: true,
            stdio: ["ignore", "pipe", "pipe"],
            detached: false,
            cwd: scriptDir,
            env: {
                ...process.env,
            }
        });

        // Limit ghost-server logs in the main Electron process
        // Too many logs = I/O on the main thread = freezes
        // But we write them to a log file for debugging
        const logPath = path.join(app.getPath("userData"), "ghost-server.log");
        let logStream: fs.WriteStream | null = null;
        try {
            logStream = fs.createWriteStream(logPath, { flags: "w" });
            logStream.write(`=== GHOST SERVER LOGS STARTED AT ${new Date().toISOString()} ===\n`);
            console.log("[GhostNative] Log file created at:", logPath);
        } catch (e: any) {
            console.error("[GhostNative] Unable to create log file:", e.message);
        }

        let logBuffer = "";
        serverProc.stdout?.on("data", (d: Buffer) => {
            if (logStream) logStream.write(d);
            logBuffer += d.toString();
            const lines = logBuffer.split("\n");
            logBuffer = lines.pop() ?? "";
            for (const line of lines) {
                if (line.trim()) console.log("[GhostServer]", line.trim());
            }
        });
        serverProc.stderr?.on("data", (d: Buffer) => {
            if (logStream) logStream.write(d);
            const msg = d.toString().trim();
            if (msg) console.error("[GhostServer ERR]", msg);
        });
        serverProc.on("exit", (code: number | null) => {
            console.log("[GhostNative] server exit:", code);
            if (logStream) {
                logStream.write(`\n=== GHOST SERVER EXITED WITH CODE ${code} ===\n`);
                logStream.end();
            }
            serverProc = null;
            serverReady = false;
        });
        serverProc.on("error", (e: Error) => {
            console.error("[GhostNative] spawn error:", e.message);
            if (logStream) {
                logStream.write(`\n=== GHOST SERVER SPAWN ERROR: ${e.message} ===\n`);
            }
        });

        // Poll every 200ms for 60s max
        for (let i = 0; i < 300; i++) {
            await new Promise(r => setTimeout(r, 200));
            if (await ping()) {
                console.log("[GhostNative] ghost-server ready ✓");
                serverReady = true;
                startPromise = null;
                return true;
            }
        }

        console.error("[GhostNative] ghost-server timeout !");
        startPromise = null;
        return false;
    })();

    return startPromise;
}

async function api(endpoint: string, body?: object, timeoutMs = 15000): Promise<any> {
    // FIX: timeout reduced from 90s → 15s.
    // 90s blocked the entire Discord UI for almost 2 minutes if the ghost-server
    // didn't respond (e.g.: yt-dlp running, ffmpeg starting).
    // 15s is more than enough for all fast calls (/connect, /join, /leave).
    // Slow calls (/stream-start) are now non-blocking server-side.
    const ok = await ensureServer();
    if (!ok) return { ok: false, error: "ghost-server not found or timeout" };

    return new Promise((resolve, reject) => {
        const data = body !== undefined ? JSON.stringify(body) : undefined;
        const opts: http.RequestOptions = {
            hostname: "127.0.0.1",
            port: PORT,
            path: endpoint,
            method: body !== undefined ? "POST" : "GET",
            headers: {
                "Content-Type": "application/json",
                ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
            },
        };
        const req = http.request(opts, res => {
            let raw = "";
            res.on("data", c => raw += c);
            res.on("end", () => {
                try { resolve(JSON.parse(raw)); }
                catch { resolve({ ok: false, error: "Invalid JSON" }); }
            });
        });
        // FIX: 15s timeout instead of 90s — prevents freezing the Discord UI
        req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error(`Timeout ${timeoutMs / 1000}s`)); });
        req.on("error", reject);
        if (data) req.write(data);
        req.end();
    });
}

export async function listAudioInputDevices(_: any): Promise<{ label: string; dshowName: string; }[]> {
    // FIX: try the ghost-server FIRST (fast, < 1s if available).
    // Before this fix, if the ghost-server wasn't ready, we spawned ffmpeg directly
    // on the main Electron process with an 8s timeout — which froze the Discord UI
    // for 8 seconds and explained the "loading for a long time" on the screen selector.
    // Now: ghost-server in 1s → ffmpeg fallback in 5s max (reduced from 8s).
    try {
        const ok = await Promise.race([
            ping(),
            new Promise<boolean>(r => setTimeout(() => r(false), 1000))
        ]);
        if (ok) {
            const res = await api("/devices", undefined, 3000);
            if (res?.devices?.length) {
                const names: string[] = res.devices;
                return names.map((n: string) => ({ label: n, dshowName: n }));
            }
        }
    } catch { }

    // Fallback ffmpeg direct — timeout reduced to 5s (instead of 8s)
    return new Promise(resolve => {
        const ghostServerNodeModules = path.join(process.resourcesPath ?? "", "ghost-server", "node_modules");
        const ffmpegCandidates = [
            path.join(path.dirname(process.execPath), "ffmpeg.exe"),
            path.join(process.resourcesPath ?? "", "..", "ffmpeg.exe"),
            // Bundled via node-av in ghost-server/node_modules (already in the installer)
            path.join(ghostServerNodeModules, "node-av", "binary", "ffmpeg.exe"),
            path.join(ghostServerNodeModules, "node_modules", "node-av", "binary", "ffmpeg.exe"),
            "ffmpeg",
        ];
        let ffmpeg = "ffmpeg";
        for (const c of ffmpegCandidates) {
            if (c !== "ffmpeg" && fs.existsSync(c)) { ffmpeg = c; break; }
        }

        try {
            const proc = childProcess.spawn(ffmpeg, [
                "-list_devices", "true", "-f", "dshow", "-i", "dummy", "-hide_banner"
            ], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });

            const chunks: Buffer[] = [];
            proc.stderr?.on("data", (d: Buffer) => chunks.push(d));
            proc.stdout?.on("data", (d: Buffer) => chunks.push(d));

            proc.on("exit", () => {
                // Decode UTF-8, fallback to latin1 if replacement characters present
                // (ffmpeg on Windows uses the system codepage, not UTF-8)
                const raw = Buffer.concat(chunks);
                let out = raw.toString("utf8");
                if (out.includes("\ufffd")) out = raw.toString("latin1");
                const names: string[] = [];
                for (const line of out.split(/\r?\n/)) {
                    if (!/\(audio\)/i.test(line) || /Alternative name/i.test(line)) continue;
                    const m = line.match(/"([^"]+)"/);
                    if (!m) continue;
                    const name = m[1].trim();
                    if (!name.startsWith("@") && name.length >= 2 && !names.includes(name))
                        names.push(name);
                }
                resolve(names.map((n: string) => ({ label: n, dshowName: n })));
            });

            proc.on("error", () => resolve([]));
            // FIX: timeout reduced to 5s (instead of 8s) — reduces UI freeze by 37%
            setTimeout(() => { try { proc.kill(); } catch { } resolve([]); }, 5000);
        } catch { resolve([]); }
    });
}

export async function connectGhost(
    _: any, userId: string, token: string, guildId: string, channelId: string, micDevice: string,
): Promise<{ ok: boolean; error?: string; }> {
    // The ghost-server waits for DVS internally (up to 60s) + login (20s) + joinVoice
    // HTTP timeout of 120s to cover the worst case without stacking waitForDVS
    try { return await api("/connect", { userId, token, guildId, channelId, micDevice }, 120000); }
    catch (e: any) { return { ok: false, error: e?.message ?? String(e) }; }
}

export async function preConnectGhost(
    _: any, userId: string, token: string, micDevice: string,
): Promise<{ ok: boolean; error?: string; }> {
    try { return await api("/preconnect", { userId, token, micDevice }, 120000); }
    catch (e: any) { return { ok: false, error: e?.message ?? String(e) }; }
}

export async function joinVoice(
    _: any, userId: string, guildId: string, channelId: string, micDevice: string,
): Promise<{ ok: boolean; error?: string; }> {
    try { return await api("/join", { userId, guildId, channelId, micDevice }); }
    catch (e: any) { return { ok: false, error: e?.message ?? String(e) }; }
}

export async function joinVoiceAll(
    _: any, userIds: string[], guildId: string, channelId: string, micDevice: string,
): Promise<{ ok: boolean; }> {
    try { await api("/join-all", { userIds, guildId, channelId, micDevice }); return { ok: true }; }
    catch { return { ok: false }; }
}

export async function leaveVoiceAll(_: any, userIds: string[]): Promise<void> {
    try { await api("/leave-all", { userIds }); } catch { }
}

export async function leaveVoice(_: any, userId: string): Promise<void> {
    try { await api("/leave", { userId }); } catch { }
}

export async function disconnectGhost(_: any, userId: string): Promise<void> {
    try { await api("/disconnect", { userId }); } catch { }
}

export async function init(_: any): Promise<void> {
    const script = findServerScript();
    console.log("[GhostNative] init — server.js:", script ?? "NOT FOUND");
    console.log("[GhostNative] node exe:", findNode());

    const ok = await ensureServer();
    if (!ok) {
        console.error("[GhostNative] ghost-server failed");
        return;
    }
    console.log("[GhostNative] ghost-server HTTP ready ✓");
}

// ── Cleanup ───────────────────────────────────────────────────────────────────
app.on("before-quit", () => {
    if (serverProc) {
        try { serverProc.kill(); } catch { }
        serverProc = null;
    }
});
