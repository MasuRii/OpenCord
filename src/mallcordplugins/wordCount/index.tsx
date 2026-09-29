/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { MallCordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { React } from "@webpack/common";

const settings = definePluginSettings({
    showWords: {
        type: OptionType.BOOLEAN,
        description: "Show word count",
        default: true,
    },
    showChars: {
        type: OptionType.BOOLEAN,
        description: "Show character count",
        default: true,
    },
    warnAt: {
        type: OptionType.NUMBER,
        description: "Highlight counter when character count exceeds this (0 to disable)",
        default: 1800,
    },
});

function CounterDisplay({ chars, words }: { chars: number; words: number; }) {
    const { showWords, showChars, warnAt } = settings.store;
    if (!showWords && !showChars) return null;
    if (chars === 0) return null;

    const warn = warnAt > 0 && chars >= warnAt;
    const parts: string[] = [];
    if (showWords) parts.push(`${words}w`);
    if (showChars) parts.push(`${chars}/2000`);

    return (
        <span style={{
            fontSize: 11,
            color: warn ? "var(--status-danger)" : "var(--text-muted)",
            fontVariantNumeric: "tabular-nums",
            userSelect: "none",
            pointerEvents: "none",
        }}>
            {parts.join(" · ")}
        </span>
    );
}

export default definePlugin({
    name: "WordCount",
    description: "Shows a live word and character count while typing a message.",
    authors: [MallCordDevs.Sharp],
    tags: ["chat", "productivity", "counter"],
    settings,

    patches: [
        {
            find: "TEXTAREA_KEYBOARD_SUBMIT_DISABLED",
            replacement: {
                match: /(onChange:(\i),)/,
                replace: "$1 __wc_onChange:$2,",
            },
            noWarn: true,
        },
        {
            find: "\.TEXTAREA_KEYBOARD_SUBMIT_DISABLED",
            replacement: {
                match: /(\(0,\i\.jsx\)\(\i\.default,\{[^}]{0,300}TEXTAREA_KEYBOARD_SUBMIT_DISABLED[^}]*\}\))/,
                replace: "[$1,$self.Counter()]",
            },
            noWarn: true,
        },
    ],

    _chars: 0,
    _words: 0,
    _setter: null as ((chars: number, words: number) => void) | null,

    Counter() {
        const [chars, setChars] = React.useState(0);
        const [words, setWords] = React.useState(0);

        React.useEffect(() => {
            this._setter = (c, w) => { setChars(c); setWords(w); };
            return () => { this._setter = null; };
        }, []);

        return <CounterDisplay chars={chars} words={words} />;
    },

    onInput(value: string) {
        const c = value.length;
        const w = value.trim() === "" ? 0 : value.trim().split(/\s+/).length;
        this._chars = c;
        this._words = w;
        this._setter?.(c, w);
    },

    start() { },
    stop() {
        this._setter = null;
    },
});
