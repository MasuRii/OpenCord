/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { MallCordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { Menu } from "@webpack/common";

const engines = [
    { id: "google",   label: "Google Lens", url: (u: string) => `https://lens.google.com/uploadbyurl?url=${u}` },
    { id: "yandex",   label: "Yandex",      url: (u: string) => `https://yandex.com/images/search?rpt=imageview&url=${u}` },
    { id: "saucenao", label: "SauceNAO",    url: (u: string) => `https://saucenao.com/search.php?url=${u}` },
    { id: "tineye",   label: "TinEye",      url: (u: string) => `https://tineye.com/search?url=${u}` },
];

function addSearchItems(children: React.ReactNode[], props: Record<string, unknown>) {
    const raw = (props.src ?? props.href ?? props.url) as string | undefined;
    if (!raw || !/^https?:\/\//.test(raw)) return;

    const encoded = encodeURIComponent(raw);

    children.push(
        <Menu.MenuSeparator key="imgSearch-sep" />,
        <Menu.MenuGroup label="Search Image" key="imgSearch-group">
            {engines.map(engine => (
                <Menu.MenuItem
                    key={`imgSearch-${engine.id}`}
                    id={`imgSearch-${engine.id}`}
                    label={engine.label}
                    action={() => window.open(engine.url(encoded), "_blank")}
                />
            ))}
        </Menu.MenuGroup>
    );
}

export default definePlugin({
    name: "ImageSearch",
    description: "Adds a 'Search Image' submenu to image context menus with Google Lens, Yandex, SauceNAO, and TinEye.",
    tags: ["Utility", "Media"],
    authors: [MallCordDevs.Sharp],

    contextMenus: {
        "message-media-context": addSearchItems,
        "image-context": addSearchItems,
    },
});
