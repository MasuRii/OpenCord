/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./ContributorModal.css";

import { useSettings } from "@api/Settings";
import { Heading } from "@components/Heading";
import { Link } from "@components/Link";
import { Paragraph } from "@components/Paragraph";
import { EquicordDevsById, EquicordPlusDevsById, EsharqDevsById, IllegalcordDevsById, MallCordDevsById, OpenCordDevsById, TestCordDevsById, VencordDevsById } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { fetchUserProfile } from "@utils/discord";
import { pluralise } from "@utils/misc";
import { RenderModalProps, User } from "@vencord/discord-types";
import { IconUtils, Modal, openModal, showToast, useEffect, useMemo, UserProfileStore, useStateFromStores } from "@webpack/common";

import Plugins, { PluginMeta } from "~plugins";

import { GithubButton, WebsiteButton } from "./LinkIconButton";
import { PluginCard } from "./PluginCard";

const cl = classNameFactory("vc-author-modal-");
const SourceDevsById = [VencordDevsById, EquicordDevsById, OpenCordDevsById, IllegalcordDevsById, TestCordDevsById, EsharqDevsById, EquicordPlusDevsById, MallCordDevsById];

function getAuthorId(author: { id?: BigInt | string | number | bigint | null | undefined; }): string | null {
    if (author == null || author.id == null) return null;
    try {
        const id = String(author.id);
        if (!id || id === "0" || id === "0n") return null;
        const n = BigInt(id);
        if (n <= 0n) return null;
        return id;
    } catch {
        return null;
    }
}

function isRealDiscordUser(user: User): boolean {
    if (!user.id || user.bot) return false;
    if (user.id === "0" || user.id === "0n") return false;
    try {
        const id = BigInt(user.id);
        if (id <= 0n) return false;
    } catch {
        return false;
    }
    return true;
}

export function openContributorModal(user: User) {
    openModal(modalProps => <ContributorModal user={user} modalProps={modalProps} />);
}

function ContributorModal({ user, modalProps }: { user: User; modalProps: RenderModalProps; }) {
    useSettings();

    const profile = useStateFromStores([UserProfileStore], () => {
        if (!isRealDiscordUser(user)) return null;
        return UserProfileStore.getUserProfile(user.id as string);
    });

    useEffect(() => {
        if (isRealDiscordUser(user) && !profile)
            fetchUserProfile(user.id);
    }, [user.id, user.bot, profile]);

    const githubName = profile?.connectedAccounts?.find(a => a.type === "github")?.name;
    const website = profile?.connectedAccounts?.find(a => a.type === "domain")?.name;

    const plugins = useMemo(() => {
        const allPlugins = Object.values(Plugins);
        const isKnownPluginDev = SourceDevsById.some(devs => Object.hasOwn(devs, user.id));
        const pluginsByAuthor = isKnownPluginDev
            ? allPlugins.filter(p => p.authors.some(a => getAuthorId(a) === user.id))
            : allPlugins.filter(p =>
                PluginMeta[p.name]?.userPlugin && p.authors.some(a => getAuthorId(a) === user.id)
                || p.authors.some(a => a.name === user.username)
            );

        return pluginsByAuthor
            .filter(p => !p.name.endsWith("API"))
            .sort((a, b) => Number(a.required ?? false) - Number(b.required ?? false));
    }, [user.id, user.username]);

    const ContributedHyperLink = <Link href="https://github.com/Equicord/Equicord">contributed</Link>;

    const hasLinks = website || githubName;

    return (
        <Modal
            {...modalProps}
            title={
                <div className={cl("header")}>
                    <img
                        className={cl("avatar")}
                        src={(() => {
                            const fallbackAvatar = isRealDiscordUser(user)
                                ? user.getAvatarURL(void 0, 512, true)
                                : IconUtils.getDefaultAvatarURL(user.id);
                            return fallbackAvatar;
                        })()}
                        alt=""
                    />
                    <Heading tag="h2" className={cl("name")}>{user.username}</Heading>
                </div>
            }
            subtitle={
                plugins.length
                    ? (
                        <Paragraph>
                            {user.username} has {ContributedHyperLink} to {pluralise(plugins.length, "plugin")}!
                        </Paragraph>
                    )
                    : (
                        <Paragraph>
                            {user.username} has not made any plugins. They likely {ContributedHyperLink} in other ways!
                        </Paragraph>
                    )
            }
            actionBarInput={
                hasLinks && (
                    <div
                        className={cl("links")}
                        style={{ width: "100%", justifyContent: "flex-end" }}
                    >
                        {website && (
                            <WebsiteButton
                                text={website}
                                href={`https://${website}`}
                            />
                        )}
                        {githubName && (
                            <GithubButton
                                text={githubName}
                                href={`https://github.com/${githubName}`}
                            />
                        )}
                    </div>
                )
            }
        >
            <div className={cl("root")}>
                {!!plugins.length && (
                    <div className={cl("plugins")}>
                        {plugins.map(p =>
                            <PluginCard
                                key={p.name}
                                plugin={p}
                                disabled={p.required ?? false}
                                onRestartNeeded={() => showToast("Restart to apply changes!")}
                            />
                        )}
                    </div>
                )}
            </div>
        </Modal>
    );
}
