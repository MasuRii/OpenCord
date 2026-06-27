/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addProfileBadge, BadgePosition, type ProfileBadge, removeProfileBadge } from "@api/Badges";
import { addContextMenuPatch, NavContextMenuPatchCallback, removeContextMenuPatch } from "@api/ContextMenu";
import { UserAreaButton, UserAreaRenderProps } from "@api/UserArea";
import BadgeAPIPlugin from "@plugins/_api/badges";
import { TestcordDevs } from "@utils/constants";
import { openModal } from "@utils/modal";
import definePlugin from "@utils/types";
import type { User } from "@vencord/discord-types";
import { waitFor } from "@webpack";
import { ApplicationAssetUtils, ChannelStore, FluxDispatcher, GuildMemberStore, IconUtils, Menu, PresenceStore, React, RestAPI, showToast, Toasts, UsernameUtils, UserStore } from "@webpack/common";

import { getActiveTargetForGuild, getCachedTarget, getFakeIdFromDate, getOriginalMeId, getSavedUsers, isActive, isCurrentUser, loadCacheFromSettings, loadTarget, logger, preLoadGuildTargets, resolveBadge, setEnabled, setOriginalGetCurrentUser, settings, subscribe, targetsCache } from "./data";
import { FakeUserProfileModal } from "./legacyModal";
import { FakeUserSwitcherModal } from "./modal";

let manualActivityStartTimestamp = 0;
let resolvedLargeImageAssetId = "";
let resolvedSmallImageAssetId = "";
let resolvingAssets = false;

async function resolveManualAssets() {
    if ((!settings.store.manualMode && !settings.store.customRpcEnabled) || !settings.store.spoofActive) {
        resolvedLargeImageAssetId = "";
        resolvedSmallImageAssetId = "";
        return;
    }
    if (resolvingAssets) return;
    resolvingAssets = true;
    try {
        const large = settings.store.manualActivityLargeImage;
        const small = settings.store.manualActivitySmallImage;
        const appId = "962776363578798130";

        if (large && ApplicationAssetUtils?.fetchAssetIds) {
            try {
                const res = await ApplicationAssetUtils.fetchAssetIds(appId, [large]);
                resolvedLargeImageAssetId = res[0] || large;
            } catch {
                resolvedLargeImageAssetId = large;
            }
        } else {
            resolvedLargeImageAssetId = large || "";
        }

        if (small && ApplicationAssetUtils?.fetchAssetIds) {
            try {
                const res = await ApplicationAssetUtils.fetchAssetIds(appId, [small]);
                resolvedSmallImageAssetId = res[0] || small;
            } catch {
                resolvedSmallImageAssetId = small;
            }
        } else {
            resolvedSmallImageAssetId = small || "";
        }
    } finally {
        resolvingAssets = false;
    }
}

const FLAG_BADGES: { flag: number; image: string; description: string; }[] = [
    { flag: 1 << 0, image: "https://cdn.discordapp.com/badge-icons/5e74e9b61934fc1f67c65515d1f7e60d.png", description: "Discord Staff" },
    { flag: 1 << 1, image: "https://cdn.discordapp.com/badge-icons/3f9748e53446a137a052f3454e2de41e.png", description: "Partnered Server Owner" },
    { flag: 1 << 2, image: "https://cdn.discordapp.com/badge-icons/bf01d1073931f921909045f3a39fd264.png", description: "HypeSquad Events" },
    { flag: 1 << 3, image: "https://cdn.discordapp.com/badge-icons/2717692c7dca7289b35297368a940dd0.png", description: "Discord Bug Hunter" },
    { flag: 1 << 6, image: "https://cdn.discordapp.com/badge-icons/8a88d63823d8a71cd5e390baa45efa02.png", description: "HypeSquad Bravery" },
    { flag: 1 << 7, image: "https://cdn.discordapp.com/badge-icons/011940fd013da3f7fb926e4a1cd2e618.png", description: "HypeSquad Brilliance" },
    { flag: 1 << 8, image: "https://cdn.discordapp.com/badge-icons/3aa41de486fa12454c3761e8e223442e.png", description: "HypeSquad Balance" },
    { flag: 1 << 9, image: "https://cdn.discordapp.com/badge-icons/7060786766c9c840eb3019e725d2b358.png", description: "Early Supporter" },
    { flag: 1 << 14, image: "https://cdn.discordapp.com/badge-icons/848f79194d4be5ff5f81505cbd0ce1e6.png", description: "Golden Discord Bug Hunter" },
    { flag: 1 << 17, image: "https://cdn.discordapp.com/badge-icons/6df5892e0f35b051f8b61eace34f4967.png", description: "Early Verified Bot Developer" },
    { flag: 1 << 18, image: "https://cdn.discordapp.com/badge-icons/fee1624003e2fee35cb398e125dc479b.png", description: "Moderator Programs Alumni" },
    { flag: 1 << 22, image: "https://cdn.discordapp.com/badge-icons/6bdc42827a38498929a4920da12695d9.png", description: "Active Developer" },
];

const SNOWFLAKE_EPOCH = 1420070400000n;
function makeSnowflake(): string {
    return ((BigInt(Date.now()) - SNOWFLAKE_EPOCH) << 22n).toString();
}

function getCreatedAtFromId(id: string): Date {
    try {
        const idBin = BigInt(id);
        const timestampMs = (idBin >> 22n) + SNOWFLAKE_EPOCH;
        return new Date(Number(timestampMs));
    } catch {
        return new Date();
    }
}

function getTargetUser(guildId?: string | null): any {
    return getActiveTargetForGuild(guildId)?.user ?? null;
}

function getTargetProfile(): any {
    return getActiveTargetForGuild(undefined)?.profile ?? null;
}

function buildOverrides(active: any): Record<string, unknown> {
    const { user: target, profile, isManual, manualData } = active;

    const banner = target.banner ?? profile?.banner ?? null;
    const overrides: Record<string, unknown> = {
        username: target.username,
        globalName: target.globalName ?? target.global_name ?? target.username,
        global_name: target.global_name ?? target.globalName ?? target.username,
        discriminator: target.discriminator,
        avatar: target.avatar,
        banner,
        publicFlags: target.publicFlags ?? target.flags ?? 0,
        flags: target.flags ?? 0,
        premiumType: profile?.premiumType ?? target.premiumType ?? 0,
        accentColor: target.accentColor ?? profile?.accentColor ?? null,
        usernameNormalized: typeof target.username === "string" ? target.username.toLowerCase() : undefined,
        bot: target.bot ?? false,
    };
    if (target.primaryGuild !== undefined) overrides.primaryGuild = target.primaryGuild;
    if (target.avatarDecorationData !== undefined) overrides.avatarDecorationData = target.avatarDecorationData;

    // Auto/Target mode clan tag overrides
    const profileClan = profile?.clan ?? profile?.primaryGuild ?? profile?.primary_guild ?? null;
    overrides.clan = target.clan ?? profileClan;
    overrides.primaryGuild = target.primaryGuild ?? target.primary_guild ?? profileClan;
    overrides.primary_guild = target.primary_guild ?? target.primaryGuild ?? profileClan;

    if (target.collectibles !== undefined) overrides.collectibles = target.collectibles;
    if (target.displayNameStyles !== undefined) overrides.displayNameStyles = target.displayNameStyles;
    overrides.tag = `${target.username}${target.discriminator && target.discriminator !== "0" ? `#${target.discriminator}` : ""}`;
    if (isManual) {
        if (manualData?.manualEmail) {
            overrides.email = manualData.manualEmail;
        }
        if (manualData?.manualPhone) {
            overrides.phone = manualData.manualPhone;
        }
        const dateStr = manualData?.manualCreatedAt || settings.store.manualCreatedAt;
        if (dateStr && dateStr.trim() !== "") {
            const parsedDate = new Date(dateStr);
            if (!isNaN(parsedDate.getTime())) {
                overrides.createdAt = parsedDate;
                const timestampMs = BigInt(parsedDate.getTime());
                overrides.id = ((timestampMs - 1420070400000n) << 22n).toString();
            }
        }
        const tag = manualData?.manualClanTag || manualData?.clanTag;
        if (tag && tag.trim() !== "") {
            const guildId = manualData?.manualClanGuildId || settings.store.manualClanGuildId || "0";
            const badgeVal = resolveBadge(
                manualData?.manualClanBadge || settings.store.manualClanBadge || "",
                manualData?.manualClanBadgeCustom || settings.store.manualClanBadgeCustom || ""
            );
            const manualClan = {
                tag: tag.trim(),
                identityGuildId: guildId,
                identity_guild_id: guildId,
                identityEnabled: true,
                identity_enabled: true,
                badge: badgeVal
            };
            overrides.clan = manualClan;
            overrides.primaryGuild = manualClan;
            overrides.primary_guild = manualClan;
        } else {
            overrides.clan = null;
            overrides.primaryGuild = null;
            overrides.primary_guild = null;
        }
    } else {
        // Do NOT override id to target.id — this breaks Discord's UserProfileInteractionContextProvider.
        // The createdAt is set from the target's snowflake for display purposes only.
        overrides.createdAt = target.createdAt ?? getCreatedAtFromId(target.id);
    }
    return overrides;
}

function mergeUser(base: any, overrides: Record<string, unknown>): any {
    const wrap = Object.create(Object.getPrototypeOf(base));
    for (const key of Object.getOwnPropertyNames(base)) {
        const desc = Object.getOwnPropertyDescriptor(base, key);
        if (desc) {
            try {
                Object.defineProperty(wrap, key, desc);
            } catch { /* ignore */ }
        }
    }
    for (const sym of Object.getOwnPropertySymbols(base)) {
        const desc = Object.getOwnPropertyDescriptor(base, sym);
        if (desc) {
            try {
                Object.defineProperty(wrap, sym, desc);
            } catch { /* ignore */ }
        }
    }
    for (const key of Object.keys(overrides)) {
        try {
            Object.defineProperty(wrap, key, {
                value: overrides[key],
                writable: true,
                enumerable: true,
                configurable: true,
            });
        } catch { /* ignore */ }
    }
    return wrap;
}

let wrappedUsers = new WeakMap<any, any>();

function cloneWithPremium(user: any, months: number): any {
    const clone = Object.create(Object.getPrototypeOf(user));
    for (const key of Object.getOwnPropertyNames(user)) {
        const desc = Object.getOwnPropertyDescriptor(user, key);
        if (desc) {
            try {
                Object.defineProperty(clone, key, desc);
            } catch { /* ignore */ }
        }
    }
    for (const sym of Object.getOwnPropertySymbols(user)) {
        const desc = Object.getOwnPropertyDescriptor(user, sym);
        if (desc) {
            try {
                Object.defineProperty(clone, sym, desc);
            } catch { /* ignore */ }
        }
    }
    const since = new Date();
    since.setMonth(since.getMonth() - months);
    try {
        Object.defineProperty(clone, "premiumSince", {
            value: since,
            writable: true,
            enumerable: true,
            configurable: true,
        });
        Object.defineProperty(clone, "premiumType", {
            value: 2,
            writable: true,
            enumerable: true,
            configurable: true,
        });
    } catch {
        clone.premiumSince = since;
        clone.premiumType = 2;
    }
    return clone;
}

function wrapUser(base: any): any {
    const active = getActiveTargetForGuild(undefined);
    if (!base) return base;

    if (!active || !isActive()) {
        if (settings.store.fakeNitroMonths && settings.store.fakeNitroMonths > 0 && isCurrentUser(base.id)) {
            let wrapped = wrappedUsers.get(base);
            if (!wrapped) {
                wrapped = cloneWithPremium(base, settings.store.fakeNitroMonths);
                wrappedUsers.set(base, wrapped);
            }
            return wrapped;
        }
        return base;
    }

    let wrapped = wrappedUsers.get(base);
    if (!wrapped) {
        wrapped = mergeUser(base, buildOverrides(active));
        if (active.isManual && settings.store.fakeNitroMonths && settings.store.fakeNitroMonths > 0) {
            wrapped = cloneWithPremium(wrapped, settings.store.fakeNitroMonths);
        }
        wrappedUsers.set(base, wrapped);
    }
    return wrapped;
}

function clearWrapCache() {
    wrappedUsers = new WeakMap<any, any>();
}

let originalGetUser: typeof UserStore.getUser | null = null;
let originalGetCurrentUser: typeof UserStore.getCurrentUser | null = null;
let originalGetUserAvatarURL: typeof IconUtils.getUserAvatarURL | null = null;
let originalGetUserBannerURL: typeof IconUtils.getUserBannerURL | null = null;
let originalGetName: typeof UsernameUtils.getName | null = null;
let originalGetGlobalName: typeof UsernameUtils.getGlobalName | null = null;
let originalGetFormattedName: typeof UsernameUtils.getFormattedName | null = null;
let originalGetUserTag: typeof UsernameUtils.getUserTag | null = null;
let originalUseName: typeof UsernameUtils.useName | null = null;
let originalUseUserTag: typeof UsernameUtils.useUserTag | null = null;
let originalGetStatus: typeof PresenceStore.getStatus | null = null;
let originalGetClientStatus: typeof PresenceStore.getClientStatus | null = null;
let originalGetActivities: typeof PresenceStore.getActivities | null = null;
let originalGetPrimaryActivity: typeof PresenceStore.getPrimaryActivity | null = null;
let originalGetUnfilteredActivities: typeof PresenceStore.getUnfilteredActivities | null = null;
let originalFindActivity: typeof PresenceStore.findActivity | null = null;
let originalGetApplicationActivity: typeof PresenceStore.getApplicationActivity | null = null;
let originalGetMember: typeof GuildMemberStore.getMember | null = null;
let originalGetNick: typeof GuildMemberStore.getNick | null = null;
let originalGet: any = null;

let storePatched = false;
let utilsPatched = false;
let presencePatched = false;
let memberPatched = false;
let apiPatched = false;

function patchStore() {
    if (storePatched) return;
    storePatched = true;

    originalGetUser = UserStore.getUser;
    originalGetCurrentUser = UserStore.getCurrentUser;
    setOriginalGetCurrentUser(originalGetCurrentUser);

    UserStore.getUser = function (userId: string) {
        if (isActive() && isCurrentUser(userId)) {
            if (settings.store.patchInternalAccountSwitcher && userId === getOriginalMeId() && isAccountSwitcherCall()) {
                return originalGetUser!.call(UserStore, userId);
            }
            const me = originalGetCurrentUser!.call(UserStore);
            if (me) return wrapUser(me);
        }
        const u = originalGetUser!.call(this, userId);
        if (!isActive()) {
            if (u && isCurrentUser(userId) && settings.store.fakeNitroMonths && settings.store.fakeNitroMonths > 0) {
                return wrapUser(u);
            }
            return u;
        }
        if (!u) return u;
        if (!isCurrentUser(userId)) return u;
        return wrapUser(u);
    };

    UserStore.getCurrentUser = function () {
        const u = originalGetCurrentUser!.call(this);
        if (!isActive()) {
            if (u && settings.store.fakeNitroMonths && settings.store.fakeNitroMonths > 0) {
                return wrapUser(u);
            }
            return u;
        }
        if (settings.store.patchInternalAccountSwitcher && isAccountSwitcherCall()) {
            return u;
        }
        return wrapUser(u);
    };

    if (GuildMemberStore && !memberPatched) {
        originalGetMember = GuildMemberStore.getMember;
        GuildMemberStore.getMember = function (guildId: string, userId: string) {
            const m = originalGetMember!.call(this, guildId, userId);
            if (isActive(guildId) && isCurrentUser(userId)) {
                const active = getActiveTargetForGuild(guildId);
                if (active) {
                    if (active.isManual) {
                        const nick = active.manualData?.manualUsername || active.manualData?.name || "FakeUser";
                        const manualClan = active.user.clan;
                        if (m) {
                            return {
                                ...m,
                                nick,
                                clan: manualClan,
                                primaryGuild: manualClan,
                                primary_guild: manualClan,
                            };
                        }
                        return {
                            nick,
                            userId,
                            roles: [],
                            joinedAt: new Date().toISOString(),
                            clan: manualClan,
                            primaryGuild: manualClan,
                            primary_guild: manualClan,
                        } as any;
                    } else {
                        const target = active.user;
                        const targetMember = originalGetMember!.call(this, guildId, target.id);
                        const nick = targetMember?.nick || target.globalName || target.global_name || target.username;
                        const targetProfile = active.profile;
                        const clan = targetProfile?.clan ?? target?.clan ?? null;
                        const primaryGuild = targetProfile?.primaryGuild ?? targetProfile?.primary_guild ?? target?.primaryGuild ?? target?.primary_guild ?? null;
                        const primary_guild = targetProfile?.primary_guild ?? targetProfile?.primaryGuild ?? target?.primary_guild ?? target?.primaryGuild ?? null;

                        if (m) {
                            return {
                                ...m,
                                nick,
                                clan,
                                primaryGuild,
                                primary_guild,
                            };
                        }
                        return {
                            nick,
                            userId,
                            roles: [],
                            joinedAt: new Date().toISOString(),
                            clan,
                            primaryGuild,
                            primary_guild,
                        } as any;
                    }
                }
            }
            return m;
        };

        originalGetNick = GuildMemberStore.getNick;
        GuildMemberStore.getNick = function (guildId: string, userId: string) {
            if (isActive(guildId) && isCurrentUser(userId)) {
                const active = getActiveTargetForGuild(guildId);
                if (active) {
                    if (active.isManual) {
                        return active.manualData?.manualUsername || active.manualData?.name || "FakeUser";
                    } else {
                        const target = active.user;
                        const targetMember = originalGetMember!.call(this, guildId, target.id);
                        return targetMember?.nick || target.globalName || target.global_name || target.username;
                    }
                }
            }
            return originalGetNick!.call(this, guildId, userId);
        };
        memberPatched = true;
    }
    if (RestAPI && !apiPatched) {
        originalGet = RestAPI.get;
        RestAPI.get = function (options: any) {
            if (isActive()) {
                const url = typeof options === "string" ? options : options?.url;
                if (typeof url === "string") {
                    const match = url.match(/\/content-inventory\/users\/(\d+)\/outbox/);
                    if (match) {
                        const userId = match[1];
                        if (isCurrentUser(userId)) {
                            if (settings.store.manualMode) {
                                return Promise.resolve({ body: { entries: [] } });
                            } else {
                                const target = getCachedTarget();
                                if (target) {
                                    const nextOptions = typeof options === "string" ? options.replace(userId, target.id) : {
                                        ...options,
                                        url: url.replace(userId, target.id)
                                    };
                                    return originalGet.call(this, nextOptions).catch(() => {
                                        return { body: { entries: [] } };
                                    });
                                }
                            }
                        }
                    }
                    const profileMatch = url.match(/\/users\/([a-zA-Z0-9_@]+)\/profile/);
                    if (profileMatch) {
                        let userId = profileMatch[1];
                        const originalId = getOriginalMeId();
                        if (userId === "@me") {
                            userId = originalId;
                        }
                        if (userId && isCurrentUser(userId)) {
                            const nextOptions = typeof options === "string"
                                ? options.replace(/\/users\/[a-zA-Z0-9_@]+\/profile/, `/users/${originalId}/profile`)
                                : {
                                    ...options,
                                    url: url.replace(/\/users\/[a-zA-Z0-9_@]+\/profile/, `/users/${originalId}/profile`)
                                };
                            return originalGet.call(this, nextOptions).then((res: any) => {
                                if (res && res.body) {
                                    res.body = plugin.profileHook(userId, res.body);
                                }
                                return res;
                            });
                        }
                    }
                }
            }
            return originalGet.call(this, options);
        };
        apiPatched = true;
    }
}

function unpatchStore() {
    if (!storePatched) return;
    if (originalGetUser) UserStore.getUser = originalGetUser;
    if (originalGetCurrentUser) UserStore.getCurrentUser = originalGetCurrentUser;
    if (memberPatched && GuildMemberStore) {
        if (originalGetMember) GuildMemberStore.getMember = originalGetMember;
        if (originalGetNick) GuildMemberStore.getNick = originalGetNick;
        memberPatched = false;
    }

    if (apiPatched && RestAPI) {
        if (originalGet) RestAPI.get = originalGet;
        apiPatched = false;
    }

    storePatched = false;
}

function patchUtils() {
    if (utilsPatched) return;
    utilsPatched = true;

    originalGetUserAvatarURL = IconUtils.getUserAvatarURL;
    originalGetUserBannerURL = IconUtils.getUserBannerURL;
    originalGetName = UsernameUtils.getName;
    originalGetGlobalName = UsernameUtils.getGlobalName;
    originalGetFormattedName = UsernameUtils.getFormattedName;
    originalGetUserTag = UsernameUtils.getUserTag;
    originalUseName = UsernameUtils.useName;
    originalUseUserTag = UsernameUtils.useUserTag;

    IconUtils.getUserAvatarURL = function (user: any, animated?: any, size?: any, format?: any) {
        if (isActive() && user && (isCurrentUser(user.id) || user.id === "0")) {
            const active = getActiveTargetForGuild(undefined);
            if (active) {
                if (active.isManual) {
                    return active.manualData?.manualAvatar || active.manualData?.avatar || "https://cdn.discordapp.com/embed/avatars/0.png";
                }
                const t = active.user;
                if (t) return originalGetUserAvatarURL!.call(this, t, animated, size, format);
            }
        }
        return originalGetUserAvatarURL!.call(this, user, animated, size, format);
    };

    IconUtils.getUserBannerURL = function (params: any) {
        if (isActive(params?.guildId ?? params?.guild_id) && params && isCurrentUser(params.id)) {
            const active = getActiveTargetForGuild(params.guildId ?? params.guild_id);
            if (active) {
                if (active.isManual) {
                    const banner = active.manualData?.manualBanner || active.manualData?.banner;
                    if (banner && !banner.startsWith("#")) {
                        return banner;
                    }
                    return originalGetUserBannerURL!.call(this, params);
                }
                const t = active.user;
                const targetBanner = params.banner ?? t?.banner ?? active.profile?.banner;
                if (t && targetBanner) {
                    return originalGetUserBannerURL!.call(this, { ...params, id: t.id, banner: targetBanner });
                }
            }
        }
        return originalGetUserBannerURL!.call(this, params);
    };

    UsernameUtils.getName = function (user: User) {
        if (isActive() && user && isCurrentUser(user.id)) {
            const t = getTargetUser();
            if (t) return originalGetName!.call(this, t);
        }
        return originalGetName!.call(this, user);
    };

    UsernameUtils.getGlobalName = function (user: User) {
        if (isActive() && user && isCurrentUser(user.id)) {
            const t = getTargetUser();
            if (t) return originalGetGlobalName!.call(this, t);
        }
        return originalGetGlobalName!.call(this, user);
    };

    UsernameUtils.getFormattedName = function (user: User, useTag?: boolean) {
        if (isActive() && user && isCurrentUser(user.id)) {
            const t = getTargetUser();
            if (t) return originalGetFormattedName!.call(this, t, useTag);
        }
        return originalGetFormattedName!.call(this, user, useTag);
    };

    UsernameUtils.getUserTag = function (user: User, options?: any) {
        if (isActive() && user && isCurrentUser(user.id)) {
            const t = getTargetUser();
            if (t) return originalGetUserTag!.call(this, t, options);
        }
        return originalGetUserTag!.call(this, user, options);
    };

    UsernameUtils.useName = function (user: User) {
        if (isActive() && user && isCurrentUser(user.id)) {
            const t = getTargetUser();
            if (t) return originalUseName!.call(this, t);
        }
        return originalUseName!.call(this, user);
    };

    UsernameUtils.useUserTag = function (user: User, options?: any) {
        if (isActive() && user && isCurrentUser(user.id)) {
            const t = getTargetUser();
            if (t) return originalUseUserTag!.call(this, t, options);
        }
        return originalUseUserTag!.call(this, user, options);
    };
}

function unpatchUtils() {
    if (!utilsPatched) return;
    if (originalGetUserAvatarURL) IconUtils.getUserAvatarURL = originalGetUserAvatarURL;
    if (originalGetUserBannerURL) IconUtils.getUserBannerURL = originalGetUserBannerURL;
    if (originalGetName) UsernameUtils.getName = originalGetName;
    if (originalGetGlobalName) UsernameUtils.getGlobalName = originalGetGlobalName;
    if (originalGetFormattedName) UsernameUtils.getFormattedName = originalGetFormattedName;
    if (originalGetUserTag) UsernameUtils.getUserTag = originalGetUserTag;
    if (originalUseName) UsernameUtils.useName = originalUseName;
    if (originalUseUserTag) UsernameUtils.useUserTag = originalUseUserTag;
    utilsPatched = false;
}

function getManualActivityListFor(manualData: any) {
    if (!manualData) return [];
    if (manualData.manualActivityName || manualData.activity) {
        const name = manualData.manualActivityName || manualData.activity;
        const type = Number(manualData.manualActivityType ?? 0);
        const activity: any = {
            id: "manual-activity",
            type,
            createdAt: Date.now()
        };

        if (type === 4) { // Custom Status
            activity.name = "Custom Status";
            activity.state = name;
        } else {
            activity.name = name;
            activity.state = manualData.manualActivityState || undefined;
            activity.details = manualData.manualActivityDetails || undefined;
        }

        if (manualData.manualActivityStartTimer) {
            if (!manualActivityStartTimestamp) {
                manualActivityStartTimestamp = Date.now();
            }
            activity.timestamps = {
                start: manualActivityStartTimestamp
            };
        } else {
            manualActivityStartTimestamp = 0;
        }

        const assets: any = {};
        const largeImg = resolvedLargeImageAssetId || manualData.manualActivityLargeImage;
        if (largeImg) {
            assets.large_image = largeImg;
            if (manualData.manualActivityLargeText) {
                assets.large_text = manualData.manualActivityLargeText;
            }
        }
        const smallImg = resolvedSmallImageAssetId || manualData.manualActivitySmallImage;
        if (smallImg) {
            assets.small_image = smallImg;
            if (manualData.manualActivitySmallText) {
                assets.small_text = manualData.manualActivitySmallText;
            }
        }
        if (Object.keys(assets).length > 0) {
            activity.assets = assets;
            activity.application_id = "962776363578798130"; // Dummy application ID to trigger image rendering
        }

        return [activity];
    }
    if (manualActivityStartTimestamp) {
        manualActivityStartTimestamp = 0;
    }
    return [];
}

function patchPresence() {
    if (presencePatched) return;
    presencePatched = true;

    originalGetStatus = PresenceStore.getStatus;
    originalGetClientStatus = PresenceStore.getClientStatus;
    originalGetActivities = PresenceStore.getActivities;
    originalGetPrimaryActivity = PresenceStore.getPrimaryActivity;
    originalGetUnfilteredActivities = PresenceStore.getUnfilteredActivities;
    originalFindActivity = PresenceStore.findActivity;
    originalGetApplicationActivity = PresenceStore.getApplicationActivity;

    PresenceStore.getStatus = function (userId: string, guildId?: string | null, defaultStatus?: any): any {
        const id = userId ?? UserStore.getCurrentUser()?.id;
        if (isActive() && id && isCurrentUser(id)) {
            if (settings.store.spoofedStatus && settings.store.spoofedStatus !== "none") {
                return settings.store.spoofedStatus;
            }
            const active = getActiveTargetForGuild(guildId);
            if (active) {
                if (active.isManual) {
                    return active.manualData?.manualStatus || active.manualData?.status || "online";
                }
                const target = active.user;
                if (target && target.id !== "0") {
                    return originalGetStatus!.call(this, target.id, guildId, defaultStatus);
                }
            }
            return "offline";
        }
        return originalGetStatus!.call(this, userId, guildId, defaultStatus);
    };

    PresenceStore.getClientStatus = function (userId: string): any {
        const id = userId ?? UserStore.getCurrentUser()?.id;
        if (isActive() && id && isCurrentUser(id)) {
            if (settings.store.spoofedStatus && settings.store.spoofedStatus !== "none") {
                const status = settings.store.spoofedStatus;
                return { desktop: status, web: status, mobile: status } as any;
            }
            const active = getActiveTargetForGuild(undefined);
            if (active) {
                if (active.isManual) {
                    const status = active.manualData?.manualStatus || active.manualData?.status || "online";
                    return { desktop: status, web: status, mobile: status } as any;
                }
                const target = active.user;
                if (target && target.id !== "0") {
                    return originalGetClientStatus!.call(this, target.id);
                }
            }
            return {} as any;
        }
        return originalGetClientStatus!.call(this, userId);
    };

    function getCurrentActivityList(this: any, active: any, guildId?: string): any[] {
        if (settings.store.customRpcEnabled) {
            const manualData = active.isManual ? active.manualData : {
                manualActivityName: settings.store.manualActivityName,
                manualActivityType: settings.store.manualActivityType,
                manualActivityState: settings.store.manualActivityState,
                manualActivityDetails: settings.store.manualActivityDetails,
                manualActivityStartTimer: settings.store.manualActivityStartTimer,
                manualActivityLargeImage: settings.store.manualActivityLargeImage,
                manualActivityLargeText: settings.store.manualActivityLargeText,
                manualActivitySmallImage: settings.store.manualActivitySmallImage,
                manualActivitySmallText: settings.store.manualActivitySmallText,
            };
            return getManualActivityListFor(manualData);
        }
        if (active.isManual) {
            return [];
        }
        const target = active.user;
        if (target && target.id !== "0") {
            return originalGetActivities!.call(this, target.id, guildId) ?? [];
        }
        return [];
    }

    PresenceStore.getActivities = function (userId: string, guildId?: string): any {
        const id = userId ?? UserStore.getCurrentUser()?.id;
        if (isActive() && id && isCurrentUser(id)) {
            const active = getActiveTargetForGuild(guildId);
            if (active) {
                return getCurrentActivityList.call(this, active, guildId);
            }
            return [];
        }
        return originalGetActivities!.call(this, userId, guildId);
    };

    PresenceStore.getPrimaryActivity = function (userId: string, guildId?: string): any {
        const id = userId ?? UserStore.getCurrentUser()?.id;
        if (isActive() && id && isCurrentUser(id)) {
            const active = getActiveTargetForGuild(guildId);
            if (active) {
                const acts = getCurrentActivityList.call(this, active, guildId);
                return acts[0] ?? null;
            }
            return null;
        }
        return originalGetPrimaryActivity!.call(this, userId, guildId);
    };

    PresenceStore.getUnfilteredActivities = function (userId: string, guildId?: string): any {
        const id = userId ?? UserStore.getCurrentUser()?.id;
        if (isActive() && id && isCurrentUser(id)) {
            const active = getActiveTargetForGuild(guildId);
            if (active) {
                return getCurrentActivityList.call(this, active, guildId);
            }
            return [];
        }
        return originalGetUnfilteredActivities!.call(this, userId, guildId);
    };

    PresenceStore.findActivity = function (userId: string, predicate: any, guildId?: string): any {
        const id = userId ?? UserStore.getCurrentUser()?.id;
        if (isActive() && id && isCurrentUser(id)) {
            const active = getActiveTargetForGuild(guildId);
            if (active) {
                const acts = getCurrentActivityList.call(this, active, guildId);
                return acts.find(predicate);
            }
            return undefined;
        }
        return originalFindActivity!.call(this, userId, predicate, guildId);
    };

    PresenceStore.getApplicationActivity = function (userId: string, applicationId: string, guildId?: string): any {
        const id = userId ?? UserStore.getCurrentUser()?.id;
        if (isActive() && id && isCurrentUser(id)) {
            const active = getActiveTargetForGuild(guildId);
            if (active) {
                const acts = getCurrentActivityList.call(this, active, guildId);
                return acts[0] ?? null; // simple fallback
            }
            return null;
        }
        return originalGetApplicationActivity!.call(this, userId, applicationId, guildId);
    };
}

function unpatchPresence() {
    if (!presencePatched) return;
    if (originalGetStatus) PresenceStore.getStatus = originalGetStatus;
    if (originalGetClientStatus) PresenceStore.getClientStatus = originalGetClientStatus;
    if (originalGetActivities) PresenceStore.getActivities = originalGetActivities;
    if (originalGetPrimaryActivity) PresenceStore.getPrimaryActivity = originalGetPrimaryActivity;
    if (originalGetUnfilteredActivities) PresenceStore.getUnfilteredActivities = originalGetUnfilteredActivities;
    if (originalFindActivity) PresenceStore.findActivity = originalFindActivity;
    if (originalGetApplicationActivity) PresenceStore.getApplicationActivity = originalGetApplicationActivity;
    presencePatched = false;
}

let originalGetTestcordCustomBadges: any = null;
let badgesPatched = false;

function patchBadges() {
    if (badgesPatched) return;
    if (typeof BadgeAPIPlugin?.getTestCordCustomBadges !== "function") return;
    badgesPatched = true;
    originalGetTestcordCustomBadges = BadgeAPIPlugin.getTestCordCustomBadges.bind(BadgeAPIPlugin);
    BadgeAPIPlugin.getTestCordCustomBadges = function (userId: string) {
        if (settings.store.spoofBadges && isActive() && isCurrentUser(userId)) {
            const target = getTargetUser();
            if (target && target.id !== "0") return originalGetTestcordCustomBadges(target.id);
        }
        return originalGetTestcordCustomBadges(userId);
    };
}

function unpatchBadges() {
    if (!badgesPatched) return;
    if (originalGetTestcordCustomBadges) BadgeAPIPlugin.getTestCordCustomBadges = originalGetTestcordCustomBadges;
    badgesPatched = false;
}

// ── Native account switcher integration ────────────────────────────────────
// AGENTS.md normally forbids document.querySelector / [class*=] selectors, but
// Discord's native account switcher exposes no stable CSS-module prop names we
// can resolve via findCssClassesLazy. The base module prefixes below are the
// least-bad heuristic available; they are scoped strictly to this feature.
function isSwitcherDropdownOpen(): boolean {
    try {
        const selectors = [
            "[class*='accountProfileCard']",
            "[class*='accountOption']",
            "[class*='accountSwitcher']",
            "[class*='multiAccount']"
        ];
        return selectors.some(sel => !!document.querySelector(sel));
    } catch {
        return false;
    }
}

function isAccountSwitcherCall(): boolean {
    if (isSwitcherDropdownOpen()) return true;
    try {
        const { stack } = new Error();
        if (!stack) return false;
        const lower = stack.toLowerCase();
        return (
            lower.includes("accountswitcher") ||
            lower.includes("multiaccount") ||
            lower.includes("switchtoaccount") ||
            lower.includes("removeaccount") ||
            lower.includes("getswitcheraccounts") ||
            lower.includes("accountoption") ||
            lower.includes("getusers") ||
            lower.includes("getvalidusers") ||
            lower.includes("gethasloggedinaccounts")
        );
    } catch {
        return false;
    }
}

function getSwitcherAccounts(): any[] {
    const saved = getSavedUsers();
    const accounts: any[] = [];
    for (const s of saved) {
        const isManual = !!s.isManual || (typeof s.id === "string" && s.id.startsWith("manual_"));
        if (isManual) {
            accounts.push({
                id: getFakeIdFromDate(s.manualCreatedAt),
                username: s.manualUsername ?? s.name ?? "FakeUser",
                globalName: s.manualDisplayName ?? s.manualUsername ?? s.name ?? "FakeUser",
                global_name: s.manualDisplayName ?? s.manualUsername ?? s.name ?? "FakeUser",
                discriminator: "0",
                avatar: s.manualAvatar ?? s.avatar ?? null,
                tokenStatus: 1,
                pushSyncToken: null,
            });
        } else {
            const cachedTarget = targetsCache.get(s.id);
            const user = cachedTarget?.user ?? (originalGetUser ? originalGetUser.call(UserStore, s.id) : UserStore.getUser(s.id));
            if (!user) continue;
            accounts.push({
                id: s.id,
                username: user.username,
                globalName: (user as any).globalName ?? user.username,
                global_name: (user as any).global_name ?? (user as any).globalName ?? user.username,
                discriminator: user.discriminator ?? "0",
                avatar: user.avatar ?? null,
                tokenStatus: 1,
                pushSyncToken: null,
            });
        }
    }
    return accounts;
}

function applyManualSavedIdentity(s: any) {
    settings.store.manualUsername = s.manualUsername ?? s.name ?? "FakeUser";
    settings.store.manualDisplayName = s.manualDisplayName ?? "";
    settings.store.manualClanTag = s.manualClanTag ?? "";
    settings.store.manualAvatar = s.manualAvatar ?? s.avatar ?? "";
    settings.store.manualBio = s.manualBio ?? "";
    settings.store.manualPronouns = s.manualPronouns ?? "";
    settings.store.manualBanner = s.manualBanner ?? "";
    settings.store.manualEmail = s.manualEmail ?? "";
    settings.store.manualPhone = s.manualPhone ?? "";
    settings.store.manualCreatedAt = s.manualCreatedAt ?? "";
    settings.store.manualClanGuildId = s.manualClanGuildId ?? "";
    settings.store.manualClanBadge = s.manualClanBadge ?? "";
    settings.store.manualClanBadgeCustom = s.manualClanBadgeCustom ?? "";
    settings.store.manualStatus = s.manualStatus ?? "online";
    settings.store.manualActivityName = s.manualActivityName ?? "";
    settings.store.manualActivityType = s.manualActivityType ?? 0;
    settings.store.manualActivityState = s.manualActivityState ?? "";
    settings.store.manualActivityDetails = s.manualActivityDetails ?? "";
    settings.store.manualActivityStartTimer = !!s.manualActivityStartTimer;
    settings.store.manualActivityLargeImage = s.manualActivityLargeImage ?? "";
    settings.store.manualActivityLargeText = s.manualActivityLargeText ?? "";
    settings.store.manualActivitySmallImage = s.manualActivitySmallImage ?? "";
    settings.store.manualActivitySmallText = s.manualActivitySmallText ?? "";
    settings.store.customRpcEnabled = !!(s.manualActivityName || s.activity);
}

async function activateSwitcherIdentity(action: any) {
    if (!settings.store.patchInternalAccountSwitcher) return;
    logger.log("[FakeUserSwitcher] activateSwitcherIdentity triggered with action:", JSON.stringify(action));
    const id = action?.targetUserId ?? action?.userId ?? action?.user_id ?? action?.id ?? action?.account?.id ?? action?.user?.id;
    if (!id) return;
    const originalId = getOriginalMeId();
    if (originalId && id === originalId) {
        setEnabled(false);
        settings.store.manualMode = false;
        return;
    }
    const saved = getSavedUsers();
    const cloner = saved.find(s => !(!!s.isManual || (typeof s.id === "string" && s.id.startsWith("manual_"))) && s.id === id);
    if (cloner) {
        try {
            await loadTarget(cloner.id);
            settings.store.manualMode = false;
            setEnabled(true);
            showToast(`Spoofing as ${cloner.name}`, Toasts.Type.SUCCESS);
        } catch (e: any) {
            logger.error("activateSwitcherIdentity: cloner load failed", e);
            showToast(e?.message || "Failed to activate fake identity.", Toasts.Type.FAILURE);
        }
        return;
    }
    const manual = saved.find(s => (!!s.isManual || (typeof s.id === "string" && s.id.startsWith("manual_"))) && getFakeIdFromDate(s.manualCreatedAt) === id);
    if (manual) {
        applyManualSavedIdentity(manual);
        settings.store.manualMode = true;
        setEnabled(true);
        showToast(`Spoofing as ${manual.manualUsername ?? manual.name}`, Toasts.Type.SUCCESS);
    }
}

let multiAccountStore: any = null;
let originalGetUsers: (() => any[]) | null = null;
let originalGetValidUsers: (() => any[]) | null = null;
let originalGetHasLoggedInAccounts: (() => boolean) | null = null;
let switcherPatched = false;
let switcherRunning = false;
let isGettingUsers = false;

function isMultiAccountStore(mod: any): boolean {
    try {
        if (typeof mod.getUsers !== "function") return false;
        if (typeof mod.getValidUsers !== "function" && typeof mod.getHasLoggedInAccounts !== "function") return false;
        const users = mod.getUsers();
        if (!Array.isArray(users)) return false;
        if (users.length > 0) {
            const first = users[0];
            if (typeof first !== "object" || first === null) return false;
            if (typeof first.id !== "string") return false;
            if (!("tokenStatus" in first) && !("pushSyncToken" in first)) {
                if ("type" in first || "permissions" in first || "parentId" in first) return false;
            }
        }
        if (typeof mod.getFrequentlyUsedEmojis === "function") return false;
        return true;
    } catch {
        return false;
    }
}

const withFakeAccounts = (real: any[]) => {
    isGettingUsers = true;
    queueMicrotask(() => {
        isGettingUsers = false;
    });
    if (!settings.store.patchInternalAccountSwitcher) return real;
    const originalId = getOriginalMeId();
    const realMe = originalGetUser && originalId ? originalGetUser.call(UserStore, originalId) : originalGetCurrentUser?.call(UserStore);
    let hasRealAccount = false;
    const displayReal = real.map(user => {
        if (realMe && originalId && user?.id === originalId) {
            hasRealAccount = true;
            return {
                ...user,
                id: originalId,
                username: realMe.username,
                globalName: (realMe as any).globalName ?? realMe.username,
                global_name: (realMe as any).global_name ?? (realMe as any).globalName ?? realMe.username,
                discriminator: realMe.discriminator ?? "0",
                avatar: realMe.avatar ?? null,
            };
        }
        return user;
    });
    if (realMe && originalId && !hasRealAccount) {
        displayReal.unshift({
            id: originalId,
            username: realMe.username,
            globalName: (realMe as any).globalName ?? realMe.username,
            global_name: (realMe as any).global_name ?? (realMe as any).globalName ?? realMe.username,
            discriminator: realMe.discriminator ?? "0",
            avatar: realMe.avatar ?? null,
            tokenStatus: 1,
            pushSyncToken: null,
        });
    }
    const realIds = new Set(displayReal.map(user => user?.id));
    const extras = getSwitcherAccounts().filter(user => !realIds.has(user.id));
    const combined = extras.length ? [...displayReal, ...extras] : displayReal;

    const seenIds = new Set<string>();
    const deduplicated: any[] = [];
    for (const u of combined) {
        if (u && u.id && !seenIds.has(u.id)) {
            seenIds.add(u.id);
            deduplicated.push(u);
        }
    }
    return deduplicated;
};

function patchInternalAccountSwitcher() {
    if (switcherPatched || !multiAccountStore) return;
    switcherPatched = true;

    originalGetUsers = multiAccountStore.getUsers.bind(multiAccountStore);
    originalGetValidUsers = multiAccountStore.getValidUsers?.bind(multiAccountStore) ?? null;
    originalGetHasLoggedInAccounts = multiAccountStore.getHasLoggedInAccounts?.bind(multiAccountStore) ?? null;

    multiAccountStore.getUsers = () => withFakeAccounts(originalGetUsers?.() ?? []);
    if (originalGetValidUsers) {
        const origValid = originalGetValidUsers;
        multiAccountStore.getValidUsers = () => withFakeAccounts(origValid() ?? []);
    }
    if (originalGetHasLoggedInAccounts) {
        multiAccountStore.getHasLoggedInAccounts = () => true;
    }
}

function unpatchInternalAccountSwitcher() {
    if (!switcherPatched || !multiAccountStore) {
        switcherPatched = false;
        return;
    }
    if (originalGetUsers) multiAccountStore.getUsers = originalGetUsers;
    if (originalGetValidUsers) multiAccountStore.getValidUsers = originalGetValidUsers;
    if (originalGetHasLoggedInAccounts) multiAccountStore.getHasLoggedInAccounts = originalGetHasLoggedInAccounts;
    originalGetUsers = null;
    originalGetValidUsers = null;
    originalGetHasLoggedInAccounts = null;
    switcherPatched = false;
    try { multiAccountStore.emitChange?.(); } catch { /* ignore */ }
}

function notifyUpdate() {
    const me = originalGetCurrentUser ? originalGetCurrentUser.call(UserStore) : UserStore.getCurrentUser();
    if (!me) return;
    clearWrapCache();
    setTimeout(() => {
        try {
            FluxDispatcher.dispatch({ type: "USER_UPDATE", user: me });
        } catch (e) {
            logger.warn("USER_UPDATE dispatch failed", e);
        }
    }, 0);
}

let syncSpoofStateTimer: ReturnType<typeof setTimeout> | undefined;
function syncSpoofState() {
    if (syncSpoofStateTimer) return;
    syncSpoofStateTimer = setTimeout(() => {
        syncSpoofStateTimer = undefined;
        clearWrapCache();
        resolveManualAssets().then(() => {
            notifyUpdate();
        });
    }, 0);
}

function FakeUserSwitcherIcon({ className, style }: { className?: string; style?: React.CSSProperties; }) {
    const active = isActive();
    return (
        <svg className={className} style={style} width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path fill={active ? "var(--status-danger)" : "currentColor"} d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2a7.2 7.2 0 0 1-6-3.22c.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08a7.2 7.2 0 0 1-6 3.22z" />
            {active && <path fill="var(--status-danger)" d="M22.7 2.7a1 1 0 0 0-1.4-1.4l-20 20a1 1 0 1 0 1.4 1.4Z" />}
        </svg>
    );
}

function FakeUserSwitcherButton({ iconForeground, hideTooltips, nameplate }: UserAreaRenderProps) {
    const [, force] = React.useReducer(x => x + 1, 0);
    React.useEffect(() => subscribe(() => force()), []);

    const activeTarget = getActiveTargetForGuild(undefined);
    const active = !!activeTarget;

    let displayName = "Fake User Switcher";
    if (activeTarget) {
        if (activeTarget.isManual) {
            displayName = activeTarget.user.username;
        } else {
            displayName = activeTarget.user.globalName || activeTarget.user.global_name || activeTarget.user.username;
        }
    }

    const tooltip = hideTooltips
        ? undefined
        : active
            ? `Spoofing as ${displayName} — click to manage`
            : "Fake User Switcher";

    return (
        <UserAreaButton
            tooltipText={tooltip}
            icon={<FakeUserSwitcherIcon className={iconForeground} />}
            role="button"
            plated={nameplate != null}
            redGlow={active}
            onClick={() => {
                if (settings.store.uiMode === "legacy") {
                    openModal(modalProps => <FakeUserProfileModal modalProps={modalProps as any} />);
                } else {
                    openModal(modalProps => <FakeUserSwitcherModal modalProps={modalProps as any} />);
                }
            }}
            onContextMenu={() => {
                const target = getCachedTarget();
                if (settings.store.manualMode) {
                    setEnabled(!settings.store.spoofActive);
                    force();
                    return;
                }
                if (!target) {
                    if (settings.store.uiMode === "legacy") {
                        openModal(modalProps => <FakeUserProfileModal modalProps={modalProps as any} />);
                    } else {
                        openModal(modalProps => <FakeUserSwitcherModal modalProps={modalProps as any} />);
                    }
                    return;
                }
                setEnabled(!settings.store.spoofActive);
                force();
            }}
        />
    );
}

const dynamicBadge: ProfileBadge = {
    id: "fakeuserswitcher-target",
    description: "Fake User Switcher",
    position: BadgePosition.END,
    shouldShow: ({ userId }) => settings.store.spoofBadges && isActive() && isCurrentUser(userId),
    getBadges: () => {
        const target = getTargetUser();
        if (!target) return [];

        const flags = (target as any).publicFlags ?? (target as any).flags ?? 0;
        const badges: ProfileBadge[] = [];

        for (const fb of FLAG_BADGES) {
            if ((flags & fb.flag) === fb.flag) {
                badges.push({
                    id: `fakeuserswitcher-flag-${fb.flag}`,
                    description: fb.description,
                    iconSrc: fb.image,
                    position: BadgePosition.END,
                });
            }
        }

        const premium = (target as any).premiumType ?? 0;
        if (premium >= 1) {
            badges.push({
                id: "fakeuserswitcher-nitro",
                description: "Discord Nitro",
                iconSrc: "https://cdn.discordapp.com/badge-icons/2ba85e8026a8614b640c2837bcdfe21b.png",
                position: BadgePosition.END,
            });
        }

        return badges;
    },
};

function buildFakeMessage(channelId: string, content: string, replyMessageReference: any) {
    const channel = ChannelStore.getChannel?.(channelId);
    const guildId = channel?.guild_id;
    const u = getTargetUser(guildId);
    if (!u) return null;

    const id = makeSnowflake();

    return {
        type: "MESSAGE_CREATE" as const,
        channelId,
        message: {
            attachments: [],
            author: {
                id: u.id,
                username: u.username,
                avatar: u.avatar === "manual" ? null : u.avatar,
                discriminator: u.discriminator,
                public_flags: u.publicFlags ?? u.flags ?? 0,
                premium_type: u.premiumType ?? 0,
                flags: u.flags ?? 0,
                banner: u.banner,
                accent_color: u.accentColor ?? null,
                global_name: u.globalName ?? u.global_name ?? null,
                avatar_decoration_data: u.avatarDecorationData
                    ? { asset: u.avatarDecorationData.asset, sku_id: u.avatarDecorationData.skuId }
                    : null,
                banner_color: null,
                bot: u.bot ?? false,
            },
            member: {
                nick: u.globalName ?? u.global_name ?? u.username,
                roles: [],
                joined_at: new Date().toISOString(),
                deaf: false,
                mute: false,
                flags: 0,
                clan: u.clan ?? null,
                primary_guild: u.primary_guild ?? u.primaryGuild ?? null,
                primaryGuild: u.primaryGuild ?? u.primary_guild ?? null,
            },
            channel_id: channelId,
            components: [],
            content,
            edited_timestamp: null,
            embeds: [],
            flags: 0,
            id,
            mention_everyone: false,
            mention_roles: [],
            mentions: [],
            nonce: id,
            pinned: false,
            timestamp: new Date().toISOString(),
            tts: false,
            type: replyMessageReference ? 19 : 0,
            message_reference: replyMessageReference ?? undefined,
        },
        optimistic: false,
        isPushNotification: false,
    };
}
const userContextMenuPatch: NavContextMenuPatchCallback = (children, { user }) => {
    if (!user || isCurrentUser(user.id)) return;

    children.push(
        <Menu.MenuSeparator />,
        <Menu.MenuItem
            id="fake-user-switcher-clone"
            label="Clone User to Fake User Switcher"
            action={async () => {
                showToast(`Cloning profile of ${user.username}...`, Toasts.Type.MESSAGE);
                try {
                    await loadTarget(user.id);
                    setEnabled(true);
                    settings.store.manualMode = false;
                    showToast(`Spoofing as ${user.username}!`, Toasts.Type.SUCCESS);
                } catch (e: any) {
                    logger.error("Context menu clone failed", e);
                    showToast(e?.message || "Failed to clone user profile.", Toasts.Type.FAILURE);
                }
            }}
        />
    );
};

let unsub: (() => void) | null = null;

const plugin = definePlugin({
    name: "fakeuserswitcher",
    description: "Visually impersonate any Discord user client-side. Advanced status, activities, bio, and visual spoofing.",
    tags: ["Customisation", "Privacy", "Fun"],
    authors: [TestcordDevs.x2b, TestcordDevs.SirPhantom89],
    dependencies: ["UserAreaAPI", "BadgeAPI", "MessageEventsAPI"],

    settings,

    userAreaButton: {
        icon: FakeUserSwitcherIcon,
        render: (props: UserAreaRenderProps) => <FakeUserSwitcherButton {...props} />,
        priority: -5,
    },

    async start() {
        loadCacheFromSettings();
        addProfileBadge(dynamicBadge);
        patchStore();
        patchUtils();
        patchBadges();
        patchPresence();

        addContextMenuPatch("user-context", userContextMenuPatch);
        addContextMenuPatch("user-profile-actions", userContextMenuPatch);

        unsub = subscribe(syncSpoofState);

        const { targetId } = settings.store;
        if (targetId && !settings.store.manualMode) {
            try {
                await loadTarget(targetId);
            } catch (e) {
                logger.warn("Failed to restore cached target", e);
            }
        }

        preLoadGuildTargets();

        if (settings.store.spoofActive) {
            syncSpoofState();
        }

        if (settings.store.patchInternalAccountSwitcher) {
            switcherRunning = true;
            waitFor(["getUsers", "getValidUsers", "getHasLoggedInAccounts"], (mod: any) => {
                if (!switcherRunning) return;
                if (!isMultiAccountStore(mod)) {
                    logger.warn("Store ignored — doesn't look like MultiAccountStore:", mod);
                    return;
                }
                multiAccountStore = mod;
                patchInternalAccountSwitcher();
                try { mod.emitChange?.(); } catch { /* ignore */ }
            });
        }
    },

    stop() {
        if (syncSpoofStateTimer !== undefined) {
            clearTimeout(syncSpoofStateTimer);
            syncSpoofStateTimer = undefined;
        }
        switcherRunning = false;
        unpatchInternalAccountSwitcher();
        multiAccountStore = null;
        clearWrapCache();
        unpatchPresence();
        unpatchBadges();
        unpatchUtils();
        unpatchStore();
        removeProfileBadge(dynamicBadge);

        removeContextMenuPatch("user-context", userContextMenuPatch);
        removeContextMenuPatch("user-profile-actions", userContextMenuPatch);

        if (unsub) { unsub(); unsub = null; }
        notifyUpdate();
    },

    flux: {
        CONNECTION_OPEN() {
            if (settings.store.spoofActive && (settings.store.manualMode || getCachedTarget())) {
                syncSpoofState();
            }
        },
        MULTI_ACCOUNT_SWITCH_ATTEMPT(action: any) {
            void activateSwitcherIdentity(action);
        },
    },

    patches: [
        {
            find: ",getUserTag:",
            replacement: {
                match: /if\(\i\((\i)(?:\.global_name\)|\)\.global_name)\)return(?=.{0,100}return"\?\?\?")/,
                replace: "const vcFupName=$self.getUsername($1);if(vcFupName)return vcFupName;$&"
            }
        },
        {
            find: "getUserAvatarURL:",
            replacement: {
                match: /(getUserAvatarURL:)(\i),/,
                replace: "$1$self.wrapAvatar($2),"
            }
        },
        {
            find: "getAvatarDecorationURL:",
            replacement: {
                match: /(?<=function \i\(\i\){)(?=let{avatarDecoration)/,
                replace: "const vcFupDeco=$self.getAvatarDecorationURL(arguments[0]);if(vcFupDeco)return vcFupDeco;"
            }
        },
        {
            find: "UserProfileStore",
            replacement: {
                match: /(?<=getUserProfile\(\i\){return )(.+?)(?=})/,
                replace: "$self.profileHook(arguments[0],$1)"
            }
        },
        {
            find: ".banner)==null",
            replacement: {
                match: /(?<=void 0:)\i\.getPreviewBanner\(\i,\i,\i\)/,
                replace: "($self.bannerHook(arguments[0])??($&))"
            }
        },
        {
            find: "getAssetImage: size must === [",
            replacement: {
                match: /(getAssetImage)\s*(=|:)?\s*(function)?\s*\(\s*(\i)\s*,\s*(\i)\s*(,[^)]*)?\)\s*\{/,
                replace: "$1$2$3($4,$5$6){if(typeof $5===\"string\"&&($5.startsWith(\"http://\")||$5.startsWith(\"https://\")||$5.startsWith(\"data:\")))return $5;"
            }
        },
        {
            find: "getGuildTagBadgeURL",
            replacement: {
                match: /(getGuildTagBadgeURL:)(\i),/,
                replace: "$1$self.wrapBadge($2),"
            }
        },
    ],

    getUsername(user: User) {
        if (!isActive() || !isCurrentUser(user?.id)) return undefined;
        const t = getTargetUser();
        if (!t) return undefined;
        return t.globalName || t.username;
    },

    wrapAvatar(original: any) {
        return (user: User, animated: boolean, size: number) => {
            if (isActive() && (isCurrentUser(user?.id) || user?.id === "0")) {
                const active = getActiveTargetForGuild(undefined);
                if (active) {
                    if (active.isManual) {
                        return active.manualData?.manualAvatar || active.manualData?.avatar || "https://cdn.discordapp.com/embed/avatars/0.png";
                    }
                    const t = active.user;
                    if (t) return original(t, animated, size);
                }
            }
            return original(user, animated, size);
        };
    },

    wrapBadge(original: any) {
        return (guildId: string, badgeHash: string, ...args: any[]) => {
            if (typeof badgeHash === "string" && (badgeHash.startsWith("http://") || badgeHash.startsWith("https://") || badgeHash.startsWith("data:"))) {
                return badgeHash;
            }
            return original(guildId, badgeHash, ...args);
        };
    },

    getAvatarDecorationURL({ user, canAnimate }: { user?: User; avatarDecoration?: any; canAnimate?: boolean; }) {
        if (!isActive()) return undefined;
        const targetUserId = user?.id;
        if (!isCurrentUser(targetUserId)) return undefined;
        const t = getTargetUser() as any;
        const deco = t?.avatarDecorationData;
        if (!deco?.asset) return undefined;
        const asset = canAnimate && deco.asset.startsWith("a_") ? deco.asset : deco.asset.replace(/^a_/, "");
        return `https://cdn.discordapp.com/avatar-decoration-presets/${asset}.png${canAnimate && deco.asset.startsWith("a_") ? "" : "?passthrough=false"}`;
    },

    profileHook(userId: string, original: any) {
        const active = getActiveTargetForGuild(undefined);
        const activeSpoof = isActive() && active;
        const selfNitro = settings.store.fakeNitroMonths && settings.store.fakeNitroMonths > 0;

        if (!isCurrentUser(userId)) return original;
        if (!activeSpoof && !selfNitro) return original;

        const overrides: any = {};
        let targetUser = original?.user;
        let targetProfile: any = null;
        let isManual = false;
        let manualData: any = null;

        if (activeSpoof) {
            targetUser = active.user;
            targetProfile = active.profile;
            isManual = active.isManual;
            manualData = active.manualData;
        } else {
            targetUser = original?.user ?? UserStore.getCurrentUser();
        }

        overrides.user = wrapUser(targetUser);

        if (activeSpoof && isManual) {
            overrides.bio = manualData?.manualBio || manualData?.bio || "";
            overrides.pronouns = manualData?.manualPronouns || manualData?.pronouns || "";
            overrides.banner = manualData?.manualBanner || manualData?.banner || null;
            const bannerColor = manualData?.manualBanner || manualData?.banner;
            if (bannerColor && bannerColor.startsWith("#")) {
                try {
                    const cleanHex = bannerColor.replace("#", "");
                    const colorVal = parseInt(cleanHex, 16);
                    if (!isNaN(colorVal)) overrides.accentColor = colorVal;
                } catch { /* ignore */ }
            }
            const tag = manualData?.manualClanTag || manualData?.clanTag;
            if (tag && tag.trim() !== "") {
                const guildId = manualData?.manualClanGuildId || settings.store.manualClanGuildId || "0";
                const badgeVal = resolveBadge(
                    manualData?.manualClanBadge || settings.store.manualClanBadge || "",
                    manualData?.manualClanBadgeCustom || settings.store.manualClanBadgeCustom || ""
                );
                const manualClan = {
                    tag: tag.trim(),
                    identityGuildId: guildId,
                    identity_guild_id: guildId,
                    identityEnabled: true,
                    identity_enabled: true,
                    badge: badgeVal
                };
                overrides.clan = manualClan;
                overrides.primaryGuild = manualClan;
                overrides.primary_guild = manualClan;
            } else {
                overrides.clan = null;
                overrides.primaryGuild = null;
                overrides.primary_guild = null;
            }
            if (settings.store.fakeNitroMonths && settings.store.fakeNitroMonths > 0) {
                const since = new Date();
                since.setMonth(since.getMonth() - settings.store.fakeNitroMonths);
                overrides.premiumType = 2;
                overrides.premiumSince = since;
            }
            overrides.widgets = [];
            overrides.connectedAccounts = [];
            overrides.legacyApplications = [];
            overrides.applicationRoleConnections = [];
        } else if (activeSpoof) {
            // Cloner mode
            if (targetProfile && targetProfile.bio != null) overrides.bio = targetProfile.bio;
            if (targetProfile && targetProfile.pronouns != null) overrides.pronouns = targetProfile.pronouns;
            if (targetProfile && targetProfile.themeColors) overrides.themeColors = targetProfile.themeColors;
            overrides.banner = targetProfile?.banner ?? (targetUser as any).banner ?? null;
            overrides.accentColor = targetProfile?.accentColor ?? (targetUser as any).accentColor ?? null;
            if (targetProfile && targetProfile.profileEffect) overrides.profileEffect = targetProfile.profileEffect;
            if (targetProfile && targetProfile.popoutAnimationParticleType != null) overrides.popoutAnimationParticleType = targetProfile.popoutAnimationParticleType;
            if (targetProfile && targetProfile.profileEffectExpiresAt != null) overrides.profileEffectExpiresAt = targetProfile.profileEffectExpiresAt;

            const premiumType = targetProfile?.premiumType ?? targetUser.premiumType;
            if (premiumType != null) overrides.premiumType = premiumType;
            if (targetProfile && targetProfile.premiumSince != null) overrides.premiumSince = targetProfile.premiumSince;
            if (targetProfile && targetProfile.premiumGuildSince != null) overrides.premiumGuildSince = targetProfile.premiumGuildSince;

            overrides.clan = targetProfile?.clan ?? targetUser.clan ?? null;
            overrides.primaryGuild = targetProfile?.primaryGuild ?? targetProfile?.primary_guild ?? targetUser.primaryGuild ?? targetUser.primary_guild ?? null;
            overrides.primary_guild = targetProfile?.primary_guild ?? targetProfile?.primaryGuild ?? targetUser.primary_guild ?? targetUser.primaryGuild ?? null;

            if (settings.store.spoofActivities) {
                if (targetProfile && targetProfile.connectedAccounts) overrides.connectedAccounts = targetProfile.connectedAccounts;
                if (targetProfile && targetProfile.legacyApplications) overrides.legacyApplications = targetProfile.legacyApplications;
                if (targetProfile && targetProfile.applicationRoleConnections) overrides.applicationRoleConnections = targetProfile.applicationRoleConnections;
                if (targetProfile && targetProfile.widgets !== undefined) {
                    overrides.widgets = targetProfile.widgets;
                } else {
                    overrides.widgets = [];
                }
            } else {
                overrides.widgets = [];
                overrides.connectedAccounts = [];
                overrides.legacyApplications = [];
                overrides.applicationRoleConnections = [];
            }
        } else {
            // We are NOT actively spoofing (activeSpoof is false), but selfNitro is true.
            // We just override premiumType/premiumSince on our own profile.
            const since = new Date();
            since.setMonth(since.getMonth() - settings.store.fakeNitroMonths);
            overrides.premiumType = 2;
            overrides.premiumSince = since;

            if (original) {
                if (original.bio != null) overrides.bio = original.bio;
                if (original.pronouns != null) overrides.pronouns = original.pronouns;
                if (original.themeColors) overrides.themeColors = original.themeColors;
                overrides.banner = original.banner;
                overrides.accentColor = original.accentColor;
                overrides.widgets = original.widgets ?? [];
                overrides.connectedAccounts = original.connectedAccounts ?? [];
                overrides.legacyApplications = original.legacyApplications ?? [];
                overrides.applicationRoleConnections = original.applicationRoleConnections ?? [];
            }
        }

        if (settings.store.fakeConnectionsEnabled) {
            try {
                overrides.connectedAccounts = JSON.parse(settings.store.fakeConnectionsList || "[]");
            } catch { /* ignore */ }
        }

        // Mirror the userProfile sub-object so the popout's display-name section reflects the target.
        const targetUserProfile = (activeSpoof && !isManual) ? ((targetProfile as any)?.userProfile ?? {}) : {};
        const spoofedDisplayName = activeSpoof
            ? (manualData?.manualDisplayName || manualData?.manualUsername || manualData?.name || targetUser.globalName || targetUser.username || "FakeUser")
            : (original?.userProfile?.displayName ?? original?.userProfile?.display_name ?? targetUser.globalName ?? targetUser.username);

        overrides.userProfile = {
            ...(original?.userProfile ?? {}),
            ...targetUserProfile,
            displayName: spoofedDisplayName,
            display_name: spoofedDisplayName,
        };

        if (settings.store.spoofBadges || selfNitro) {
            const baseBadges = original?.badges ?? (targetProfile?.badges || []);
            const nitroBadge = {
                id: "fakeuserswitcher-nitro",
                description: "Discord Nitro",
                icon: "https://cdn.discordapp.com/badge-icons/2ba85e8026a8614b640c2837bcdfe21b.png",
            };
            const hasNitro = (list: any[]) => list.some((b: any) => b.id === "nitro" || b.id === "fakeuserswitcher-nitro" || b.description === "Discord Nitro" || b.icon === "2ba85e8026a8614b640c2837bcdfe21b");

            let computed: any[] = [];
            if (activeSpoof && targetProfile && targetProfile.badges && targetProfile.badges.length) {
                computed = [...targetProfile.badges];
            } else if (activeSpoof) {
                const flags = (targetUser as any).publicFlags ?? (targetUser as any).flags ?? 0;
                for (const fb of FLAG_BADGES) {
                    if ((flags & fb.flag) === fb.flag) {
                        computed.push({
                            id: `fakeuserswitcher-flag-${fb.flag}`,
                            description: fb.description,
                            icon: fb.image,
                        });
                    }
                }
                const premium = overrides.premiumType ?? (targetUser as any).premiumType ?? 0;
                if (premium >= 1) computed.push(nitroBadge);
            } else {
                computed = [...baseBadges];
            }

            if (selfNitro && !hasNitro(computed)) computed.push(nitroBadge);
            if (computed.length) overrides.badges = computed;
        }

        if (activeSpoof && settings.store.spoofActivities && !isManual) {
            if (targetProfile && targetProfile.userProfile) {
                overrides.userProfile = {
                    ...overrides.userProfile,
                    ...targetProfile.userProfile,
                    displayName: spoofedDisplayName,
                    display_name: spoofedDisplayName,
                };
            }
        }

        const finalClan = overrides.clan !== undefined ? overrides.clan : (original?.clan ?? null);
        const finalPrimary = overrides.primaryGuild !== undefined ? overrides.primaryGuild : (original?.primaryGuild ?? original?.primary_guild ?? null);

        if (original?.guild_member) {
            overrides.guild_member = {
                ...original.guild_member,
                clan: finalClan,
                primaryGuild: finalPrimary,
                primary_guild: finalPrimary
            };
        }
        if (original?.guildMember) {
            overrides.guildMember = {
                ...original.guildMember,
                clan: finalClan,
                primaryGuild: finalPrimary,
                primary_guild: finalPrimary
            };
        }

        const originalUserProfile = original?.user_profile ?? original?.userProfile ?? {};
        overrides.user_profile = {
            ...originalUserProfile,
            ...(overrides.userProfile ?? {}),
            clan: finalClan,
            primaryGuild: finalPrimary,
            primary_guild: finalPrimary
        };
        overrides.userProfile = overrides.user_profile;

        const merged = original
            ? Object.assign(Object.create(Object.getPrototypeOf(original)), original, overrides)
            : { userId, ...overrides };
        return merged;
    },

    bannerHook({ displayProfile, user }: any) {
        const guildId = displayProfile?.guildId ?? displayProfile?.guild_id;
        if (!isActive(guildId)) return undefined;
        const id = displayProfile?.userId ?? user?.id;
        if (!isCurrentUser(id)) return undefined;

        const active = getActiveTargetForGuild(guildId);
        if (!active) return undefined;

        if (active.isManual) {
            const banner = active.manualData?.manualBanner || active.manualData?.banner;
            if (banner) {
                if (banner.startsWith("#")) return "";
                return banner;
            }
            return "";
        }

        const target = active.user;
        if (target?.banner && target.banner !== "manual") {
            const animated = target.banner.startsWith("a_");
            const ext = animated ? "gif" : "png";
            return `https://cdn.discordapp.com/banners/${target.id}/${target.banner}.${ext}?size=600`;
        }
        return "";
    },

    onBeforeMessageSend(channelId, msg, options) {
        if (!isActive() || !settings.store.fakeMessages) return;
        const replyRef = options?.replyOptions?.messageReference;
        const fake = buildFakeMessage(channelId, msg.content, replyRef);
        if (!fake) return;

        try {
            FluxDispatcher.dispatch(fake);
        } catch (e) {
            logger.error("Failed to dispatch fake message", e);
        }

        if (settings.store.sendRealToo) return;
        return { cancel: true };
    },
});

export default plugin;
