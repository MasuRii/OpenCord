/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { showNotice } from "@api/Notices";
import { hasAnyVisibleSettings, isPluginEnabled, pluginRequiresRestart, startDependenciesRecursive, startPlugin, stopPlugin } from "@api/PluginManager";
import { Settings } from "@api/Settings";
import { CogWheel, InfoIcon } from "@components/Icons";
import { AddonCard } from "@components/settings/AddonCard";
import { classNameFactory } from "@utils/css";
import { Logger } from "@utils/Logger";
import { Plugin } from "@utils/types";
import { React, showToast, Toasts } from "@webpack/common";
import equicordplusIcon from "file://../../../../../assets/branding/equicordplus-icon.png?base64";
import esharqIcon from "file://../../../../../assets/branding/esharq-icon.png?base64";
import illegalcordIcon from "file://../../../../../assets/branding/illegalcord-icon.png?base64";
import mallcordIcon from "file://../../../../../assets/branding/mallcord-icon.png?base64";
import opencordSymbol from "file://../../../../../assets/branding/opencord-symbol-dark.svg?base64";
import testcordIcon from "file://../../../../../assets/branding/testcord-icon.png?base64";

import { PluginMeta } from "~plugins";

import { openPluginModal } from "./PluginModal";

const logger = new Logger("PluginCard");
const cl = classNameFactory("vc-plugins-");
const OPENCORD_SYMBOL_URL = "data:image/" + "svg+xml;base64," + opencordSymbol;
const ILLEGALCORD_ICON_URL = "data:image/png;base64," + illegalcordIcon;
const TESTCORD_ICON_URL = "data:image/png;base64," + testcordIcon;
const ESHARQ_ICON_URL = "data:image/png;base64," + esharqIcon;
const EQUICORDPLUS_ICON_URL = "data:image/png;base64," + equicordplusIcon;
const MALLCORD_ICON_URL = "data:image/png;base64," + mallcordIcon;

interface PluginCardProps extends React.HTMLProps<HTMLDivElement> {
    plugin: Plugin;
    disabled?: boolean;
    onRestartNeeded(name: string, key: string): void;
    isNew?: boolean;
    onMouseEnter?: React.MouseEventHandler<HTMLDivElement>;
    onMouseLeave?: React.MouseEventHandler<HTMLDivElement>;
}

export function PluginCard({ plugin, disabled, onRestartNeeded, onMouseEnter, onMouseLeave, isNew }: PluginCardProps) {
    const settings = Settings.plugins[plugin.name];
    const pluginMeta = PluginMeta[plugin.name];
    const { folderName } = pluginMeta;
    const isOpenCordPlugin = folderName.startsWith("src/opencordplugins/") ?? false;
    const isEquicordPlugin = folderName.startsWith("src/equicordplugins/") ?? false;
    const isVencordPlugin = folderName.startsWith("src/plugins/") ?? false;
    const isIllegalcordPlugin = folderName.startsWith("src/illegalcordplugins/") ?? false;
    const isTestCordPlugin = folderName.startsWith("src/testcordplugins/") ?? false;
    const isEsharqPlugin = folderName.startsWith("src/esharqplugins/") ?? false;
    const isEquicordPlusPlugin = folderName.startsWith("src/equicordplusplugins/") ?? false;
    const isMallCordPlugin = folderName.startsWith("src/mallcordplugins/") ?? false;
    const isUserPlugin = pluginMeta?.userPlugin ?? false;
    const isModifiedPlugin = plugin.isModified ?? false;

    const isEnabled = () => isPluginEnabled(plugin.name);

    function toggleEnabled() {
        const wasEnabled = isEnabled();

        // If we're enabling a plugin, make sure all deps are enabled recursively.
        if (!wasEnabled) {
            const { restartNeeded, failures } = startDependenciesRecursive(plugin);

            if (failures.length) {
                logger.error(`Failed to start dependencies for ${plugin.name}: ${failures.join(", ")}`);
                showNotice("Failed to start dependencies: " + failures.join(", "), "Close", () => null);
                return;
            }

            if (restartNeeded) {
                // If any dependencies have patches, don't start the plugin yet.
                settings.enabled = true;
                onRestartNeeded(plugin.name, "enabled");
                return;
            }
        }

        // if the plugin requires a restart, don't use stopPlugin/startPlugin. Wait for restart to apply changes.
        if (pluginRequiresRestart(plugin)) {
            settings.enabled = !wasEnabled;
            onRestartNeeded(plugin.name, "enabled");
            return;
        }

        // If the plugin is enabled, but hasn't been started, then we can just toggle it off.
        if (wasEnabled && !plugin.started) {
            settings.enabled = !wasEnabled;
            return;
        }

        const result = wasEnabled ? stopPlugin(plugin) : startPlugin(plugin);

        if (!result) {
            settings.enabled = false;

            const msg = `Error while ${wasEnabled ? "stopping" : "starting"} plugin ${plugin.name}`;
            showToast(msg, Toasts.Type.FAILURE, {
                position: Toasts.Position.BOTTOM,
            });

            return;
        }

        settings.enabled = !wasEnabled;
    }

    const pluginInfo = [
        {
            condition: isModifiedPlugin,
            src: "https://equicord.org/assets/icons/equicord/modified.png",
            alt: "Modified",
            title: "Modified Vencord Plugin"
        },
        {
            condition: isOpenCordPlugin,
            src: OPENCORD_SYMBOL_URL,
            alt: "OpenCord",
            title: "OpenCord Plugin"
        },
        {
            condition: isEquicordPlugin,
            src: "https://equicord.org/assets/favicon.png",
            alt: "Equicord",
            title: "Equicord Plugin"
        },
        {
            condition: isIllegalcordPlugin,
            src: ILLEGALCORD_ICON_URL,
            alt: "Illegalcord",
            title: "Illegalcord Plugin"
        },
        {
            condition: isTestCordPlugin,
            src: TESTCORD_ICON_URL,
            alt: "TestCord",
            title: "TestCord Plugin"
        },
        {
            condition: isEsharqPlugin,
            src: ESHARQ_ICON_URL,
            alt: "Esharq",
            title: "Esharq Plugin"
        },
        {
            condition: isEquicordPlusPlugin,
            src: EQUICORDPLUS_ICON_URL,
            alt: "EquicordPlus",
            title: "EquicordPlus Plugin"
        },
        {
            condition: isMallCordPlugin,
            src: MALLCORD_ICON_URL,
            alt: "MallCord",
            title: "MallCord Plugin"
        },
        {
            condition: isVencordPlugin,
            src: "https://equicord.org/assets/icons/vencord/icon-light.png",
            alt: "Vencord",
            title: "Vencord Plugin"
        },
        {
            condition: isUserPlugin,
            src: "https://equicord.org/assets/icons/misc/userplugin.png",
            alt: "User",
            title: "User Plugin"
        }
    ];

    const pluginDetails = pluginInfo.find(p => p.condition);

    const sourceBadge = pluginDetails ? (
        <img
            src={pluginDetails.src}
            alt={pluginDetails.alt}
            className={cl("source")}
        />
    ) : null;

    const tooltip = pluginDetails?.title || "Unknown Plugin";

    return (
        <AddonCard
            name={plugin.name}
            sourceBadge={sourceBadge}
            tooltip={tooltip}
            description={plugin.description}
            isNew={isNew}
            enabled={isEnabled()}
            setEnabled={toggleEnabled}
            disabled={disabled}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            infoButton={
                <button
                    aria-label="Plugin details"
                    onClick={() => openPluginModal(plugin, onRestartNeeded)}
                    className={cl("info-button")}
                >
                    {hasAnyVisibleSettings(plugin)
                        ? <CogWheel className={cl("info-icon")} />
                        : <InfoIcon className={cl("info-icon")} />
                    }
                </button>
            } />
    );
}
