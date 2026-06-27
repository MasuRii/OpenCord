/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { fetchUserProfile } from "@utils/discord";
import { Logger } from "@utils/Logger";
import { OptionType } from "@utils/types";
import type { User } from "@vencord/discord-types";
import { SelectedGuildStore, UserProfileStore, UserStore, UserUtils } from "@webpack/common";

export const logger = new Logger("FakeUserSwitcher");

export interface CachedTarget {
    id: string;
    user: User;
    profile: any;
    fetchedAt: number;
}

let cached: CachedTarget | null = null;
const subscribers = new Set<() => void>();
const loadingGuildTargets = new Set<string>();

export function notify() {
    for (const fn of subscribers) {
        try { fn(); } catch (e) { logger.error("subscriber failed", e); }
    }
}

export function subscribe(fn: () => void) {
    subscribers.add(fn);
    return () => { subscribers.delete(fn); };
}

export function getCachedTarget() {
    return cached;
}

export function clearTarget() {
    cached = null;
    settings.store.targetId = "";
    settings.store.spoofActive = false;
    notify();
}

const ID_RE = /^\d{17,20}$/;

export function resolveTargetUserId(input: string): string | null {
    const trimmed = input.trim().replace(/^@/, "");
    if (!trimmed) return null;
    if (ID_RE.test(trimmed)) return trimmed;

    const fromTag = UserStore.findByTag(trimmed) ?? UserStore.findByTag(trimmed, null);
    if (fromTag) return fromTag.id;

    const lower = trimmed.toLowerCase();
    let matchId: string | null = null;
    UserStore.forEach(u => {
        if (
            u.username.toLowerCase() === lower
            || u.globalName?.toLowerCase() === lower
            || u.tag.toLowerCase() === lower
        ) {
            matchId = u.id;
            return false;
        }
    });
    return matchId;
}

export const targetsCache = new Map<string, CachedTarget>();

export function saveCache() {
    try {
        const serialized = Array.from(targetsCache.entries()).map(([id, target]) => {
            return [id, {
                id: target.id,
                user: target.user,
                profile: target.profile,
                fetchedAt: target.fetchedAt
            }];
        });
        settings.store.cachedProfiles = JSON.stringify(serialized);
    } catch (e) {
        logger.error("Failed to save targetsCache to settings", e);
    }
}

export function loadCacheFromSettings() {
    try {
        const data = settings.store.cachedProfiles;
        if (!data || data === "{}") return;
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
            for (const [id, target] of parsed) {
                targetsCache.set(id, target as CachedTarget);
            }
        }
    } catch (e) {
        logger.error("Failed to load targetsCache from settings", e);
    }
}

export async function loadTarget(input: string, saveToSettings = true): Promise<CachedTarget> {
    const targetId = resolveTargetUserId(input);
    if (!targetId) {
        throw new Error("Could not find a cached user with that username. Please use their user ID.");
    }
    let user = UserStore.getUser(targetId);
    if (!user) {
        try {
            user = await UserUtils.getUser(targetId);
        } catch (e) {
            logger.error("Failed to fetch user", e);
            throw new Error("Could not load that user. Check the ID.");
        }
    }
    if (!user) throw new Error("Could not load that user. Check the ID.");

    let profile: any = null;
    try {
        profile = await fetchUserProfile(targetId, undefined, false);
    } catch (e) {
        logger.warn("Failed to fetch profile, falling back to user only", e);
        profile = UserProfileStore.getUserProfile(targetId);
    }

    user = UserStore.getUser(targetId) ?? user;

    const result = {
        id: targetId,
        user,
        profile,
        fetchedAt: Date.now(),
    };
    targetsCache.set(targetId, result);
    saveCache();
    if (saveToSettings) {
        cached = result;
        settings.store.targetId = targetId;
    }
    notify();
    return result;
}

let originalGetCurrentUser: typeof UserStore.getCurrentUser | null = null;
export function setOriginalGetCurrentUser(fn: typeof UserStore.getCurrentUser) {
    originalGetCurrentUser = fn;
}

let originalMeId = "";
export function getOriginalMeId(): string {
    if (!originalMeId) {
        const me = originalGetCurrentUser ? originalGetCurrentUser.call(UserStore) : UserStore.getCurrentUser();
        if (me) originalMeId = me.id;
    }
    return originalMeId;
}

export function getFakeIdFromDate(dateStr: string | null | undefined): string {
    if (!dateStr || dateStr.trim() === "") return "0";
    try {
        const parsedDate = new Date(dateStr);
        if (!isNaN(parsedDate.getTime())) {
            const timestampMs = BigInt(parsedDate.getTime());
            return ((timestampMs - 1420070400000n) << 22n).toString();
        }
    } catch { /* ignore */ }
    return "0";
}

export function isCurrentUser(userId: string | null | undefined): boolean {
    if (!userId) return false;
    const originalId = getOriginalMeId();
    if (originalId && userId === originalId) return true;
    const active = getActiveTargetForGuild(undefined);
    if (active && active.user?.id === userId) return true;
    return false;
}

export function resolveBadge(badge: string, custom: string): string | null {
    if (badge === "custom") {
        return custom && custom.trim() !== "" ? custom.trim() : null;
    }
    if (badge && badge !== "") {
        const presets: Record<string, string> = {
            sword: "https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/sword.svg",
            leaf: "https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/leaf.svg",
            flame: "https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/flame.svg",
            heart: "https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/heart.svg",
            compass: "https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/compass.svg",
            trophy: "https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/trophy.svg",
            shield: "https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/shield.svg",
            crown: "https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/crown.svg",
            star: "https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/star.svg",
            moon: "https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/moon.svg",
            zap: "https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/zap.svg",
            skull: "https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/skull.svg"
        };
        return presets[badge] || null;
    }
    return null;
}

export function getActiveTargetForGuild(guildId: string | null | undefined): { user: any; profile: any; isManual: boolean; manualData?: any; } | null {
    if (!settings.store.spoofActive) return null;
    const gId = guildId ?? SelectedGuildStore?.getGuildId?.();
    if (gId) {
        try {
            const map = JSON.parse(settings.store.guildIdentities || "{}");
            const savedId = map[gId];
            if (savedId) {
                const saved = getSavedUsers();
                const found = saved.find(s => s.id === savedId);
                if (found) {
                    if ((found as any).isManual) {
                        const badgeVal = resolveBadge((found as any).manualClanBadge || "", (found as any).manualClanBadgeCustom || "");
                        const manualClan = (found as any).manualClanTag && (found as any).manualClanTag.trim() !== "" ? {
                            tag: (found as any).manualClanTag.trim(),
                            identityGuildId: (found as any).manualClanGuildId || "0",
                            identity_guild_id: (found as any).manualClanGuildId || "0",
                            identityEnabled: true,
                            identity_enabled: true,
                            badge: badgeVal
                        } : null;
                        const manualId = getFakeIdFromDate((found as any).manualCreatedAt);
                        const foundUsername = (found as any).manualUsername || found.name || "FakeUser";
                        const foundDisplayName = (found as any).manualDisplayName || foundUsername;
                        return {
                            isManual: true,
                            manualData: found,
                            user: {
                                id: manualId,
                                username: foundUsername,
                                globalName: foundDisplayName,
                                global_name: foundDisplayName,
                                discriminator: "0",
                                avatar: (found as any).manualAvatar || "manual",
                                clan: manualClan,
                                primaryGuild: manualClan,
                                primary_guild: manualClan,
                            },
                            profile: {
                                bio: (found as any).manualBio || "",
                                pronouns: (found as any).manualPronouns || "",
                                banner: (found as any).manualBanner || null,
                                badges: [],
                                clan: manualClan,
                                primaryGuild: manualClan,
                                primary_guild: manualClan,
                            }
                        };
                    } else {
                        const cachedTarget = targetsCache.get(found.id) ?? (cached && cached.id === found.id ? cached : null);
                        if (cachedTarget) {
                            return {
                                isManual: false,
                                user: cachedTarget.user,
                                profile: cachedTarget.profile
                            };
                        } else {
                            // Start fetching target profile in the background
                            if (!loadingGuildTargets.has(found.id)) {
                                loadingGuildTargets.add(found.id);
                                loadTarget(found.id, false).then(() => {
                                    loadingGuildTargets.delete(found.id);
                                }).catch(e => {
                                    loadingGuildTargets.delete(found.id);
                                    logger.error("Failed to lazy load guild target profile", found.id, e);
                                });
                            }
                        }
                    }
                }
            }
        } catch { /* ignore */ }
    }
    // Fallback to global
    if (settings.store.manualMode) {
        const badgeVal = resolveBadge(settings.store.manualClanBadge || "", settings.store.manualClanBadgeCustom || "");
        const manualClan = settings.store.manualClanTag && settings.store.manualClanTag.trim() !== "" ? {
            tag: settings.store.manualClanTag.trim(),
            identityGuildId: settings.store.manualClanGuildId || "0",
            identity_guild_id: settings.store.manualClanGuildId || "0",
            identityEnabled: true,
            identity_enabled: true,
            badge: badgeVal
        } : null;
        const manualId = getFakeIdFromDate(settings.store.manualCreatedAt);
        return {
            isManual: true,
            manualData: {
                manualUsername: settings.store.manualUsername,
                manualDisplayName: settings.store.manualDisplayName,
                manualClanTag: settings.store.manualClanTag,
                manualAvatar: settings.store.manualAvatar,
                manualBio: settings.store.manualBio,
                manualPronouns: settings.store.manualPronouns,
                manualBanner: settings.store.manualBanner,
                manualEmail: settings.store.manualEmail,
                manualPhone: settings.store.manualPhone,
                manualStatus: settings.store.manualStatus,
                manualActivityName: settings.store.manualActivityName,
                manualActivityType: settings.store.manualActivityType,
                manualActivityState: settings.store.manualActivityState,
                manualActivityDetails: settings.store.manualActivityDetails,
                manualActivityStartTimer: settings.store.manualActivityStartTimer,
                manualActivityLargeImage: settings.store.manualActivityLargeImage,
                manualActivityLargeText: settings.store.manualActivityLargeText,
                manualActivitySmallImage: settings.store.manualActivitySmallImage,
                manualActivitySmallText: settings.store.manualActivitySmallText,
                manualCreatedAt: settings.store.manualCreatedAt,
                manualClanGuildId: settings.store.manualClanGuildId,
                manualClanBadge: settings.store.manualClanBadge,
                manualClanBadgeCustom: settings.store.manualClanBadgeCustom,
            },
            user: {
                id: manualId,
                username: settings.store.manualUsername || "FakeUser",
                globalName: settings.store.manualDisplayName || settings.store.manualUsername || "FakeUser",
                global_name: settings.store.manualDisplayName || settings.store.manualUsername || "FakeUser",
                discriminator: "0",
                avatar: settings.store.manualAvatar || "manual",
                clan: manualClan,
                primaryGuild: manualClan,
                primary_guild: manualClan,
            },
            profile: {
                bio: settings.store.manualBio || "",
                pronouns: settings.store.manualPronouns || "",
                banner: settings.store.manualBanner || null,
                badges: [],
                clan: manualClan,
                primaryGuild: manualClan,
                primary_guild: manualClan,
            }
        };
    }
    if (cached) {
        return {
            isManual: false,
            user: cached.user,
            profile: cached.profile
        };
    }
    return null;
}

export function isActive(guildId?: string | null): boolean {
    if (settings.store.spoofedStatus && settings.store.spoofedStatus !== "none") return true;
    if (!settings.store.spoofActive) return false;
    const active = getActiveTargetForGuild(guildId);
    return !!active;
}

export function setEnabled(value: boolean) {
    settings.store.spoofActive = value;
    notify();
}

export interface SavedUser {
    id: string;
    name: string;
    username?: string;
    avatar: string | null;
    isManual?: boolean;
    manualUsername?: string;
    manualDisplayName?: string;
    manualClanTag?: string;
    manualAvatar?: string;
    manualBio?: string;
    manualPronouns?: string;
    manualBanner?: string;
    manualEmail?: string;
    manualPhone?: string;
    manualStatus?: string;
    manualActivityName?: string;
    manualActivityType?: number;
    manualActivityState?: string;
    manualActivityDetails?: string;
    manualActivityStartTimer?: boolean;
    manualActivityLargeImage?: string;
    manualActivityLargeText?: string;
    manualActivitySmallImage?: string;
    manualActivitySmallText?: string;
    manualCreatedAt?: string;
    manualClanGuildId?: string;
    manualClanBadge?: string;
    manualClanBadgeCustom?: string;
}

export function getSavedUsers(): SavedUser[] {
    try {
        const parsed = JSON.parse(settings.store.savedUsers || "[]");
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function setSavedUsers(list: SavedUser[]) {
    settings.store.savedUsers = JSON.stringify(list);
}

export function preLoadGuildTargets() {
    try {
        const map = JSON.parse(settings.store.guildIdentities || "{}");
        const saved = getSavedUsers();
        for (const savedId of Object.values(map) as string[]) {
            if (savedId) {
                const found = saved.find(s => s.id === savedId);
                if (found && !(found as any).isManual) {
                    loadTarget(found.id, false).catch(e => {
                        logger.warn("Failed to pre-load guild target profile", found.id, e);
                    });
                }
            }
        }
    } catch (e) {
        logger.warn("Failed to parse guildIdentities during pre-load", e);
    }
}

export const settings = definePluginSettings({
    spoofActive: {
        type: OptionType.BOOLEAN,
        description: "Whether the spoof is currently active.",
        default: false,
    },
    targetId: {
        type: OptionType.STRING,
        description: "User ID to impersonate visually.",
        default: "",
    },
    fakeMessages: {
        type: OptionType.BOOLEAN,
        description: "When sending a message, post a local fake one as the target user instead of really sending it.",
        default: true,
    },
    sendRealToo: {
        type: OptionType.BOOLEAN,
        description: "Also send the real message to the channel (in addition to the fake one). Off means client-side only.",
        default: false,
    },
    spoofBadges: {
        type: OptionType.BOOLEAN,
        description: "Mirror the target's badges onto your client-side profile.",
        default: true,
    },
    spoofActivities: {
        type: OptionType.BOOLEAN,
        description: "Mirror the target's connected accounts and game collection.",
        default: true,
    },
    patchInternalAccountSwitcher: {
        type: OptionType.BOOLEAN,
        description: "Inject fake identities into Discord's native account switcher and let them be activated from there.",
        default: false,
        restartNeeded: true,
    },
    savedUsers: {
        type: OptionType.STRING,
        description: "Saved user IDs (JSON)",
        default: "[]",
        hidden: true,
    },
    manualMode: {
        type: OptionType.BOOLEAN,
        description: "Use a custom username and avatar instead of cloning a user ID.",
        default: false,
        hidden: true,
    },
    manualUsername: {
        type: OptionType.STRING,
        description: "Custom username for manual mode.",
        default: "FakeUser",
        hidden: true,
    },
    manualDisplayName: {
        type: OptionType.STRING,
        description: "Custom display name for manual mode (separate from username).",
        default: "",
        hidden: true,
    },
    manualClanTag: {
        type: OptionType.STRING,
        description: "Custom server tag for manual mode.",
        default: "",
        hidden: true,
    },
    manualAvatar: {
        type: OptionType.STRING,
        description: "Custom avatar URL for manual mode.",
        default: "",
        hidden: true,
    },
    manualBio: {
        type: OptionType.STRING,
        description: "Custom bio / About Me in manual mode.",
        default: "",
        hidden: true,
    },
    manualPronouns: {
        type: OptionType.STRING,
        description: "Custom pronouns in manual mode.",
        default: "",
        hidden: true,
    },
    manualBanner: {
        type: OptionType.STRING,
        description: "Custom banner image URL or solid color hex in manual mode.",
        default: "",
        hidden: true,
    },
    manualEmail: {
        type: OptionType.STRING,
        description: "Custom email for manual mode.",
        default: "",
        hidden: true,
    },
    manualPhone: {
        type: OptionType.STRING,
        description: "Custom phone number for manual mode.",
        default: "",
        hidden: true,
    },
    manualStatus: {
        type: OptionType.SELECT,
        description: "Spoofed status in manual mode.",
        default: "online",
        options: [
            { label: "Online", value: "online", default: true },
            { label: "Idle", value: "idle" },
            { label: "Do Not Disturb", value: "dnd" },
            { label: "Offline", value: "offline" }
        ],
        hidden: true,
    },
    manualActivityName: {
        type: OptionType.STRING,
        description: "Spoofed activity name in manual mode.",
        default: "",
        hidden: true,
    },
    manualActivityType: {
        type: OptionType.SELECT,
        description: "Spoofed activity type in manual mode.",
        default: 0,
        options: [
            { label: "Playing", value: 0, default: true },
            { label: "Streaming", value: 1 },
            { label: "Listening to", value: 2 },
            { label: "Watching", value: 3 },
            { label: "Custom Status", value: 4 },
            { label: "Competing in", value: 5 }
        ],
        hidden: true,
    },
    manualActivityState: {
        type: OptionType.STRING,
        description: "Spoofed activity state (e.g. In Match, Chilling).",
        default: "",
        hidden: true,
    },
    manualActivityDetails: {
        type: OptionType.STRING,
        description: "Spoofed activity details (e.g. Playing Solo, Level 42).",
        default: "",
        hidden: true,
    },
    manualActivityStartTimer: {
        type: OptionType.BOOLEAN,
        description: "Show a timer (time elapsed) in custom manual activity.",
        default: false,
        hidden: true,
    },
    manualActivityStartTimestamp: {
        type: OptionType.NUMBER,
        description: "Internal start timestamp for manual activity.",
        default: 0,
        hidden: true,
    },
    manualActivityLargeImage: {
        type: OptionType.STRING,
        description: "Custom activity Large Image URL or key.",
        default: "",
        hidden: true,
    },
    manualActivityLargeText: {
        type: OptionType.STRING,
        description: "Custom activity Large Image hover text.",
        default: "",
        hidden: true,
    },
    manualActivitySmallImage: {
        type: OptionType.STRING,
        description: "Custom activity Small Image URL or key.",
        default: "",
        hidden: true,
    },
    manualActivitySmallText: {
        type: OptionType.STRING,
        description: "Custom activity Small Image hover text.",
        default: "",
        hidden: true,
    },
    uiMode: {
        type: OptionType.SELECT,
        description: "Which user profile spoofing UI mode to use.",
        default: "modern",
        options: [
            { label: "legacy", value: "legacy" },
            { label: "modern", value: "modern", default: true }
        ],
    },
    disableAnimations: {
        type: OptionType.BOOLEAN,
        description: "Disable all transitions and animations in the visual settings switcher.",
        default: false,
    },
    configExpanded: {
        type: OptionType.BOOLEAN,
        description: "Whether the configuration accordion is expanded.",
        default: true,
        hidden: true,
    },
    manualExpanded: {
        type: OptionType.BOOLEAN,
        description: "Whether the manual spoofing accordion is expanded.",
        default: false,
        hidden: true,
    },
    guildIdentities: {
        type: OptionType.STRING,
        description: "Guild specific identities mapped (JSON)",
        default: "{}",
        hidden: true,
    },
    cachedProfiles: {
        type: OptionType.STRING,
        description: "Persistent cache of target profiles (JSON)",
        default: "[]",
        hidden: true,
    },
    customRpcEnabled: {
        type: OptionType.BOOLEAN,
        description: "Enable custom Rich Presence activity spoofing.",
        default: false,
    },
    fakeConnectionsEnabled: {
        type: OptionType.BOOLEAN,
        description: "Enable custom fake connections on your profile.",
        default: false,
    },
    fakeConnectionsList: {
        type: OptionType.STRING,
        description: "List of fake connections (JSON)",
        default: "[]",
        hidden: true,
    },
    customRpcExpanded: {
        type: OptionType.BOOLEAN,
        description: "Whether the custom RPC accordion is expanded.",
        default: false,
        hidden: true,
    },
    connectionsExpanded: {
        type: OptionType.BOOLEAN,
        description: "Whether the fake connections accordion is expanded.",
        default: false,
        hidden: true,
    },
    spoofedStatus: {
        type: OptionType.STRING,
        description: "Override your client-side presence status globally.",
        default: "none",
    },
    manualCreatedAt: {
        type: OptionType.STRING,
        description: "Custom creation date in manual mode.",
        default: "",
        hidden: true,
    },
    manualClanGuildId: {
        type: OptionType.STRING,
        description: "Guild/server ID whose icon is used for the server tag in manual mode.",
        default: "",
        hidden: true,
    },
    manualClanBadge: {
        type: OptionType.STRING,
        description: "Predefined badge type for the server tag.",
        default: "",
        hidden: true,
    },
    manualClanBadgeCustom: {
        type: OptionType.STRING,
        description: "Custom badge hash or direct image URL.",
        default: "",
        hidden: true,
    },
    fakeNitroMonths: {
        type: OptionType.NUMBER,
        description: "Spoof client-side Nitro age in months (0 to disable).",
        default: 0,
        onChange() {
            notify();
        }
    },
    nitroExpanded: {
        type: OptionType.BOOLEAN,
        description: "Whether the fake Nitro accordion is expanded.",
        default: false,
        hidden: true,
    },
});
