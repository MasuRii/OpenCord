/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { isPluginEnabled, isPluginRequired } from "@api/PluginManager";
import { definePluginSettings, useSettings } from "@api/Settings";
import { getUserSettingLazy } from "@api/UserSettings";
import ErrorBoundary from "@components/ErrorBoundary";
import { WarningIcon } from "@components/Icons";
import { AddonCard } from "@components/settings";
import { ExcludedReasons, PluginDependencyList } from "@components/settings/tabs/plugins";
import { PluginCard } from "@components/settings/tabs/plugins/PluginCard";
import { TooltipContainer } from "@components/TooltipContainer";
import { gitHashShort } from "@shared/vencordUserAgent";
import { Logger } from "@utils/Logger";
import { tryOrElse } from "@utils/misc";
import { makeCodeblock } from "@utils/text";
import definePlugin, { OptionType } from "@utils/types";
import { Message } from "@vencord/discord-types";
import { ChannelStore, MessageActions, SelectedChannelStore, showToast, Toasts, Tooltip, useMemo, UserStore } from "@webpack/common";
import { JSX } from "react";

import plugins, { ExcludedPlugins, PluginMeta } from "~plugins";

const logger = new Logger("TestcordHelper");

const ShowCurrentGame = getUserSettingLazy<boolean>("status", "showCurrentGame")!;
const RenderEmbeds = getUserSettingLazy<boolean>("textAndImages", "renderEmbeds")!;

const MESSAGE_LIMIT = 1900;
const MB = 1024 * 1024;

const PLUGIN_PATTERN = /(?:testcordplugin|tcp):([^\s,;\n]+)/gi;
const PLUGIN_MATCH_PATTERN = /(?:testcordplugin|tcp):([^\s,;\n]+)/i;
const PLUGIN_LINK_PATTERN = /\[([^\]]+)]\(<?https:\/\/github\.com\/TestcordDev\/Testcord\/tree\/main\/src\/(?:plugins|equicordplugins|testcordplugins)\/[^>)]+>?\)/gi;
const PLUGIN_CARD_MARKER_PATTERN = /(?:testcordplugin|tcp):|github\.com\/TestcordDev\/Testcord\/tree\/main\/src\/(?:plugins|equicordplugins|testcordplugins)\//i;
const PLUGIN_RESOLVE_CACHE_LIMIT = 500;
const pluginResolveCache = new Map<string, string | null>();

interface PluginSearchEntry {
    name: string;
    lower: string;
    acronym: string;
    searchTerms?: string[];
    description?: string;
}

let pluginSearchData: PluginSearchEntry[] | undefined;

function round2(n: number) {
    return Math.floor(n * 100) / 100;
}

function getMemoryUsage(): string {
    const mem = (window as any).performance?.memory;
    if (!mem) return "N/A (API blocked)";
    return `${round2(mem.usedJSHeapSize / MB)}MB used / ${round2(mem.totalJSHeapSize / MB)}MB total (limit: ${round2(mem.jsHeapSizeLimit / MB)}MB)`;
}

const settings = definePluginSettings({
    enableCustomBadges: {
        type: OptionType.BOOLEAN,
        description: "Enable custom testcord badges from tbadges GitHub repository",
        default: true,
    },
    CarefulNetwork: {
        type: OptionType.BOOLEAN,
        description: "Dedupe and briefly cache repeated Testcord plugin network requests.",
        default: false,
    },
    performanceMode: {
        type: OptionType.BOOLEAN,
        description: "Show optional performance features. Nothing here is enabled unless its own toggle is on.",
        default: false,
    },
    performanceCarefulNetwork: {
        type: OptionType.BOOLEAN,
        description: "Use Testcord's request coordinator for supported plugin requests without changing Discord payloads.",
        default: false,
    },
    performanceBoundRequestCache: {
        type: OptionType.BOOLEAN,
        description: "Limit the request coordinator cache and remove expired entries to reduce memory usage.",
        default: false,
    },
    performanceRequestCacheEntries: {
        type: OptionType.SLIDER,
        description: "Maximum request coordinator cache entries when the cache limit is enabled.",
        markers: [50, 100, 250, 500, 1000],
        default: 250,
    },
    performanceDisablePluginCards: {
        type: OptionType.BOOLEAN,
        description: "Do not render Testcord plugin cards under chat messages.",
        default: false,
    },
    performanceCachePluginCards: {
        type: OptionType.BOOLEAN,
        description: "Cache plugin name lookups and skip plugin-card scans for messages that cannot contain plugin links.",
        default: false,
    }
});

function isPerformanceEnabled() {
    return settings.store.performanceMode === true;
}

function isPluginCardCacheEnabled() {
    return isPerformanceEnabled() && settings.store.performanceCachePluginCards === true;
}

function getPluginSearchData() {
    pluginSearchData ??= Object.keys(plugins).map(name => ({
        name,
        lower: name.toLowerCase(),
        acronym: name.match(/[A-Z]/g)?.join("").toLowerCase() ?? "",
        searchTerms: plugins[name].searchTerms?.map(t => t.toLowerCase()),
        description: plugins[name].description?.toLowerCase(),
    }));

    return pluginSearchData;
}

function getClient() {
    if (IS_DISCORD_DESKTOP) return `Discord Desktop v${DiscordNative.app.getVersion()}`;
    if (IS_VESKTOP) return `Vesktop v${VesktopNative.app.getVersion()}`;
    if (IS_EQUIBOP) {
        const hash = tryOrElse(() => VesktopNative.app.getGitHash?.(), null);
        const dev = tryOrElse(() => VesktopNative.app.isDevBuild?.(), false);
        const spoof = tryOrElse(() => VesktopNative.app.getPlatformSpoofInfo?.(), null);
        return `Equibop v${VesktopNative.app.getVersion()} [${hash?.slice(0, 7) ?? "?"}]${dev ? " DEV" : ""}${spoof?.spoofed ? ` (spoof: ${spoof.originalPlatform})` : ""}`;
    }
    if ("legcord" in window) return `LegCord v${(window as any).legcord.version}`;
    if ("goofcord" in window) return `GoofCord v${(window as any).goofcord.version}`;
    return typeof (window as any).unsafeWindow !== "undefined" ? "UserScript" : "Web";
}

async function buildDebugReport() {
    const { RELEASE_CHANNEL } = (window as any).GLOBAL_ENV;
    const client = getClient();
    const user = UserStore.getCurrentUser();
    const platform = IS_DISCORD_DESKTOP ? "Windows" : IS_WEB ? "Web" : "Unknown";

    const info = {
        Testcord: `v${(globalThis as any).VERSION} • ${gitHashShort} — ${Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format((globalThis as any).BUILD_TIMESTAMP)}`,
        Client: `${RELEASE_CHANNEL} ~ ${client}`,
        Platform: platform,
        "JS Memory": getMemoryUsage(),
    };

    const problematic = ["NoRPC", "NoProfileThemes", "NoMosaic", "NoRoleHeaders", "Ingtoninator", "NeverPausePreviews", "IdleAutoRestart"].filter(isPluginEnabled).sort();

    const flags = {
        "Activity Sharing Disabled": tryOrElse(() => !ShowCurrentGame.getSetting(), false),
        "Link Embeds Disabled": tryOrElse(() => !RenderEmbeds.getSetting(), false),
        "TestCord DevBuild": !IS_STANDALONE,
        "Equibop DevBuild": IS_EQUIBOP && tryOrElse(() => VesktopNative.app.isDevBuild?.(), false),
        "Platform Spoofed": (IS_EQUIBOP && tryOrElse(() => VesktopNative.app.getPlatformSpoofInfo?.(), null)?.spoofed) ?? false,
        ">2 Weeks Outdated": (globalThis as any).BUILD_TIMESTAMP < Date.now() - 12096e5,
    };

    let out = `>>> ${Object.entries(info).map(([k, v]) => `**${k}**: ${v}`).join("\n")}`;
    const activeFlags = Object.entries(flags).filter(([, v]) => v).map(([k]) => `\u26a0\ufe0f ${k}`).join("\n");
    if (activeFlags) out += "\n" + activeFlags;
    if (problematic.length) out += `\n\n**Potentially Problematic Plugins**: ${problematic.join(", ")}\n-# note, those plugins are just common issues and might not be the problem`;
    if (user) out += `\n\n**User**: ${user.username}#${user.discriminator} (\`${user.id}\`)`;

    return out.trim();
}

function chunkByLines(text: string, limit: number): string[] {
    const lines = text.split("\n");
    const chunks: string[] = [];
    let current: string[] = [];
    let currentLen = 0;

    for (const line of lines) {
        const addedLen = currentLen + (current.length ? 1 : 0) + line.length;
        if (addedLen > limit && current.length) {
            chunks.push(current.join("\n"));
            current = [line];
            currentLen = line.length;
        } else {
            current.push(line);
            currentLen = addedLen;
        }
    }
    if (current.length) chunks.push(current.join("\n"));
    return chunks;
}

async function sendMessage(channelId: string, content: string) {
    MessageActions.sendMessage(channelId, { content, invalidEmojis: [] }, undefined, {});
    await new Promise(r => setTimeout(r, 1000));
}

async function sendDebugReport() {
    const channelId = SelectedChannelStore.getChannelId();
    if (!channelId) {
        showToast("No channel selected. Open a text channel first.", Toasts.Type.FAILURE);
        return;
    }
    const channel = ChannelStore.getChannel(channelId);
    if (!channel || ![0, 1, 3].includes(channel.type)) {
        showToast("Cannot send messages in this channel type.", Toasts.Type.FAILURE);
        return;
    }

    const report = await buildDebugReport();

    if (report.length > MESSAGE_LIMIT) {
        const chunks = chunkByLines(report, MESSAGE_LIMIT);
        for (let i = 0; i < chunks.length; i++) {
            await sendMessage(channelId, `**Debug Report [${i + 1}/${chunks.length}]**\n${chunks[i]}`);
        }
    } else {
        await sendMessage(channelId, report);
    }

    const isApi = (name: string) => name.endsWith("API") || plugins[name]?.required;
    const enabled = Object.keys(PluginMeta).filter(p => isPluginEnabled(p) && !isApi(p));
    const stock = enabled.filter(p => !PluginMeta[p].userPlugin).sort();
    const user = enabled.filter(p => PluginMeta[p].userPlugin).sort();

    for (const [header, list] of [
        [`**Enabled Stock Plugins (${stock.length}):**`, stock],
        [`**Enabled User Plugins (${user.length}):**`, user],
    ] as const) {
        if (!list.length) continue;
        const max = MESSAGE_LIMIT - header.length - makeCodeblock("").length;
        let batch: string[] = [];
        let batchLen = 0;
        for (const name of list) {
            const piece = name + ", ";
            if (batchLen + piece.length > max && batch.length) {
                await sendMessage(channelId, `${header}\n${makeCodeblock(batch.join(", "))}`);
                batch = [name];
                batchLen = name.length;
            } else {
                batch.push(name);
                batchLen += piece.length;
            }
        }
        if (batch.length) await sendMessage(channelId, `${header}\n${makeCodeblock(batch.join(", "))}`);
    }

    showToast("Debug report sent!", Toasts.Type.SUCCESS);
}

function ChatPluginCard({ pluginName, description }: { pluginName: string; description?: string; }) {
    useSettings([`plugins.${pluginName ?? ""}.enabled`]);

    if (!pluginName) return null;

    const p = plugins[pluginName];
    const excludedPlugin = ExcludedPlugins[pluginName];

    if (excludedPlugin || !p) {
        const toolTipText = excludedPlugin
            ? `${pluginName} is only available on the ${ExcludedReasons[ExcludedPlugins[pluginName]]}`
            : "This plugin is not on this version of Testcord. Try updating!";

        const card = (
            <AddonCard
                name={pluginName}
                description={description || toolTipText}
                enabled={false}
                setEnabled={() => { }}
                disabled={true}
                infoButton={<WarningIcon />}
            />
        );

        return description
            ? <TooltipContainer text={toolTipText}>{card}</TooltipContainer>
            : card;
    }

    const onRestartNeeded = () => showToast("A restart is required for the change to take effect!");

    const depMap = useMemo(() => {
        const o = {} as Record<string, string[]>;
        for (const plugin in plugins) {
            const deps = plugins[plugin].dependencies;
            if (deps) {
                for (const dep of deps) {
                    o[dep] ??= [];
                    o[dep].push(plugin);
                }
            }
        }
        return o;
    }, []);

    const required = isPluginRequired(pluginName);
    const dependents = depMap[p.name]?.filter(d => isPluginEnabled(d));

    if (required) {
        const tooltipText = p.required || !dependents.length
            ? "This plugin is required for Testcord to function."
            : <PluginDependencyList deps={dependents} />;

        return (
            <Tooltip text={tooltipText} key={p.name}>
                {({ onMouseLeave, onMouseEnter }) =>
                    <PluginCard
                        key={p.name}
                        onMouseLeave={onMouseLeave}
                        onMouseEnter={onMouseEnter}
                        onRestartNeeded={onRestartNeeded}
                        plugin={p}
                        disabled
                    />
                }
            </Tooltip>
        );
    }

    return (
        <PluginCard
            key={p.name}
            onRestartNeeded={onRestartNeeded}
            plugin={p}
        />
    );
}

function resolvePluginName(search: string) {
    if (isPluginCardCacheEnabled()) {
        const cacheKey = search.toLowerCase();
        if (pluginResolveCache.has(cacheKey)) return pluginResolveCache.get(cacheKey) ?? undefined;

        const pluginName = resolvePluginNameCached(search);
        pluginResolveCache.set(cacheKey, pluginName ?? null);
        if (pluginResolveCache.size > PLUGIN_RESOLVE_CACHE_LIMIT) {
            const oldest = pluginResolveCache.keys().next().value;
            if (oldest !== undefined) pluginResolveCache.delete(oldest);
        }

        return pluginName;
    }

    return resolvePluginNameOriginal(search);
}

function resolvePluginNameOriginal(search: string) {
    const pluginNames = Object.keys(plugins);
    const words = search.trim().replace(/[.!?)]*$/, "").split(/\s+/);

    for (let i = words.length; i > 0; i--) {
        const query = words.slice(0, i).join(" ").toLowerCase();
        const normalizedQuery = query.replace(/\s+/g, "");

        const pluginName = pluginNames.find(name => name.toLowerCase() === normalizedQuery)
            ?? pluginNames.find(name => name.toLowerCase().startsWith(normalizedQuery))
            ?? pluginNames.find(name => name.match(/[A-Z]/g)?.join("").toLowerCase().includes(normalizedQuery))
            ?? pluginNames.find(name => name.toLowerCase().includes(normalizedQuery))
            ?? pluginNames.find(name => plugins[name].searchTerms?.some(t => t.toLowerCase().includes(query)))
            ?? pluginNames.find(name => plugins[name].description?.toLowerCase().includes(query));

        if (pluginName) return pluginName;
    }
}

function resolvePluginNameCached(search: string) {
    const pluginSearchData = getPluginSearchData();
    const words = search.trim().replace(/[.!?)]*$/, "").split(/\s+/);

    for (let i = words.length; i > 0; i--) {
        const query = words.slice(0, i).join(" ").toLowerCase();
        const normalizedQuery = query.replace(/\s+/g, "");

        const pluginName = pluginSearchData.find(p => p.lower === normalizedQuery)?.name
            ?? pluginSearchData.find(p => p.lower.startsWith(normalizedQuery))?.name
            ?? pluginSearchData.find(p => p.acronym.includes(normalizedQuery))?.name
            ?? pluginSearchData.find(p => p.lower.includes(normalizedQuery))?.name
            ?? pluginSearchData.find(p => p.searchTerms?.some(t => t.includes(query)))?.name
            ?? pluginSearchData.find(p => p.description?.includes(query))?.name;

        if (pluginName) return pluginName;
    }
}

function getPluginLink(pluginName: string) {
    return `https://github.com/TestcordDev/Testcord/tree/main/${PluginMeta[pluginName].folderName}`;
}

function replacePluginAliases(content: string) {
    return content.replace(PLUGIN_PATTERN, match => {
        const [, query] = PLUGIN_MATCH_PATTERN.exec(match) ?? [];
        const pluginName = query ? resolvePluginName(query) : undefined;

        if (!pluginName) return match;

        return `[${pluginName}](<${getPluginLink(pluginName)}>)${query?.match(/[.!?)]*$/)?.[0] ?? ""}`;
    });
}

const PluginCards = ErrorBoundary.wrap(function PluginCards({ message }: { message: Message; }) {
    if (isPerformanceEnabled() && settings.store.performanceDisablePluginCards) return null;
    if (isPluginCardCacheEnabled() && !PLUGIN_CARD_MARKER_PATTERN.test(message.content)) return null;

    const seenPlugins = new Set<string>();
    const pluginCards: JSX.Element[] = [];

    PLUGIN_PATTERN.lastIndex = 0;

    let match;
    while ((match = PLUGIN_PATTERN.exec(message.content)) !== null) {
        const pluginNameFromMessage = match[1]?.trim();
        const actualPluginName = pluginNameFromMessage ? resolvePluginName(pluginNameFromMessage) : undefined;
        const pluginName = actualPluginName || pluginNameFromMessage;

        if (!pluginName || seenPlugins.has(pluginName)) continue;
        seenPlugins.add(pluginName);

        pluginCards.push(
            <ChatPluginCard
                key={pluginName}
                pluginName={pluginName}
            />
        );
    }

    PLUGIN_LINK_PATTERN.lastIndex = 0;

    while ((match = PLUGIN_LINK_PATTERN.exec(message.content)) !== null) {
        const pluginNameFromMessage = match[1]?.trim();
        const actualPluginName = pluginNameFromMessage ? resolvePluginName(pluginNameFromMessage) : undefined;
        const pluginName = actualPluginName || pluginNameFromMessage;

        if (!pluginName || seenPlugins.has(pluginName)) continue;
        seenPlugins.add(pluginName);

        pluginCards.push(
            <ChatPluginCard
                key={pluginName}
                pluginName={pluginName}
            />
        );
    }

    if (pluginCards.length === 0) return null;

    return (
        <div className="vc-plugins-management-cards vc-plugins-grid" style={{ marginTop: "0px" }}>
            {pluginCards}
        </div>
    );
}, { noop: true });

let hotkeyHandler: ((e: KeyboardEvent) => void) | null = null;

export default definePlugin({
    name: "TestcordHelper",
    description: "Helper plugin for Testcord features, including custom badge management, debug reporting, and plugin info cards.",
    tags: ["Utility", "Developers"],
    authors: [{ name: "x2b", id: 996137713432530976n }],
    required: true,
    settings,
    dependencies: ["MessageAccessoriesAPI", "MessageEventsAPI"],

    onBeforeMessageSend(_, msg) {
        msg.content = replacePluginAliases(msg.content);
    },

    renderMessageAccessory(props) {
        return <PluginCards message={props.message} />;
    },

    start() {
        hotkeyHandler = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "h") {
                e.preventDefault();
                e.stopPropagation();
                showToast("Sending debug report to channel...", Toasts.Type.MESSAGE);
                sendDebugReport().catch(err => {
                    logger.error("Failed to send debug report:", err);
                    showToast(`Failed to send debug report: ${err.message}`, Toasts.Type.FAILURE);
                });
            }
        };
        document.addEventListener("keydown", hotkeyHandler, true);
    },

    stop() {
        if (hotkeyHandler) {
            document.removeEventListener("keydown", hotkeyHandler, true);
            hotkeyHandler = null;
        }
    }
});
