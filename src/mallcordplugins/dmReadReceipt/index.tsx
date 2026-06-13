/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { MallCordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { MessageStore, React, TypingStore, UserStore, useStateFromStores } from "@webpack/common";

import { MessageDecorationProps } from "../../api/MessageDecorations";

function SeenIndicator({ message, channel }: MessageDecorationProps) {
    const me = UserStore.getCurrentUser()?.id;
    if (!me || message.author.id !== me || !channel.isDM()) return null;

    const recipientId = channel.recipients?.[0];
    if (!recipientId) return null;

    const isTyping = useStateFromStores([TypingStore], () =>
        (TypingStore as any).isTyping(channel.id, recipientId) as boolean
    );

    const hasSeen = useStateFromStores([MessageStore], () => {
        const msgs = MessageStore.getMessages(channel.id);
        if (!msgs) return false;
        const msgTs = new Date(message.timestamp).getTime();
        return msgs.some((m: { author: { id: string; }; timestamp: string; }) =>
            m.author.id === recipientId && new Date(m.timestamp).getTime() > msgTs
        );
    });

    if (!isTyping && !hasSeen) return null;

    return (
        <span style={{ fontSize: "10px", color: "var(--text-muted)", marginLeft: "4px" }}>
            {isTyping ? "Seen · typing..." : "Seen ✓"}
        </span>
    );
}

export default definePlugin({
    name: "DmReadReceipt",
    description: "Shows a Seen indicator on your messages in DMs when the other person has read them.",
    tags: ["Chat", "Utility"],
    authors: [MallCordDevs.Sharp],
    dependencies: ["MessageDecorationsAPI"],

    renderMessageDecoration: props => <SeenIndicator {...props} />,
});
