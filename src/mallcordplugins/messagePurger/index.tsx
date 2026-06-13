/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addHeaderBarButton, HeaderBarButton, removeHeaderBarButton } from "@api/HeaderBar";
import { Logger } from "@utils/Logger";
import {
    ModalCloseButton as ModalCloseButton_,
    ModalContent as ModalContent_,
    ModalFooter as ModalFooter_,
    ModalHeader as ModalHeader_,
    ModalRoot as ModalRoot_,
    openModal,
} from "@utils/modal";
import { MallCordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { React, RestAPI, SelectedChannelStore, Toasts, UserStore } from "@webpack/common";

const logger = new Logger("MessagePurger");
const MessageStore = findByPropsLazy("getMessages", "getMessage");

const ModalRoot = ModalRoot_ as React.ComponentType<any>;
const ModalHeader = ModalHeader_ as React.ComponentType<any>;
const ModalContent = ModalContent_ as React.ComponentType<any>;
const ModalFooter = ModalFooter_ as React.ComponentType<any>;
const ModalCloseButton = ModalCloseButton_ as React.ComponentType<any>;

const DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
}

async function purge(channelId: string, limit: number, onProgress: (done: number, total: number) => void): Promise<void> {
    const me = UserStore.getCurrentUser();
    if (!me) return;

    const allMessages: any[] = [];
    const stored = MessageStore.getMessages(channelId);
    if (stored) {
        const arr: any[] = stored.toArray ? stored.toArray() : Array.from(stored._array ?? []);
        for (const msg of arr) {
            if (msg.author?.id === me.id) allMessages.push(msg);
        }
    }

    allMessages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const targets = allMessages.slice(0, limit);
    const total = targets.length;

    for (let i = 0; i < targets.length; i++) {
        try {
            await RestAPI.del({ url: `/channels/${channelId}/messages/${targets[i].id}` });
        } catch (e) {
            logger.warn("Failed to delete message", targets[i].id, e);
        }
        onProgress(i + 1, total);
        if (i < targets.length - 1) await sleep(DELAY_MS);
    }
}

const btnStyle: React.CSSProperties = {
    border: "none", borderRadius: 6, padding: "7px 16px", cursor: "pointer",
    fontSize: 13, fontWeight: 600, fontFamily: "var(--font-primary)",
};
const inputStyle: React.CSSProperties = {
    background: "var(--input-background)", border: "1px solid var(--background-modifier-accent)",
    borderRadius: 6, color: "var(--text-normal)", fontSize: 14, padding: "6px 10px",
    outline: "none", fontFamily: "var(--font-primary)", width: 80, textAlign: "center",
};

function PurgerModal({ rootProps }: { rootProps: any; }) {
    const [limit, setLimit] = React.useState(20);
    const [running, setRunning] = React.useState(false);
    const [progress, setProgress] = React.useState<{ done: number; total: number; } | null>(null);
    const [done, setDone] = React.useState(false);
    const abortRef = React.useRef(false);

    async function start() {
        const channelId = SelectedChannelStore.getChannelId();
        if (!channelId) return;

        abortRef.current = false;
        setRunning(true);
        setDone(false);
        setProgress({ done: 0, total: limit });

        try {
            await purge(channelId, limit, (d, t) => setProgress({ done: d, total: t }));
        } catch (e) {
            logger.error("Purge error:", e);
        }

        setRunning(false);
        setDone(true);
        Toasts.show({ message: "Message purge complete.", type: Toasts.Type.SUCCESS, id: Toasts.genId() });
    }

    function close() {
        abortRef.current = true;
        rootProps.onClose();
    }

    return (
        <ModalRoot {...rootProps} size="small">
            <ModalHeader separator={false}>
                <span style={{ fontWeight: 700, fontSize: 16, color: "var(--header-primary)" }}>Message Purger</span>
                <ModalCloseButton onClick={close} style={{ marginLeft: "auto" }} />
            </ModalHeader>
            <ModalContent>
                <div style={{ padding: "16px 0", display: "flex", flexDirection: "column", gap: 14 }}>
                    <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>
                        Deletes your most recent messages from the current channel. Only messages
                        loaded in the chat are eligible (scroll up to load more).
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ color: "var(--text-normal)", fontSize: 13 }}>Delete up to</span>
                        <input
                            style={inputStyle}
                            type="number"
                            min={1}
                            max={200}
                            value={limit}
                            disabled={running}
                            onChange={e => setLimit(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
                        />
                        <span style={{ color: "var(--text-normal)", fontSize: 13 }}>of your messages</span>
                    </div>
                    {progress && (
                        <div>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12, color: "var(--text-muted)" }}>
                                <span>{done ? "Done!" : "Deleting…"}</span>
                                <span>{progress.done} / {progress.total}</span>
                            </div>
                            <div style={{ height: 6, background: "var(--background-modifier-accent)", borderRadius: 3, overflow: "hidden" }}>
                                <div style={{
                                    height: "100%",
                                    width: `${progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0}%`,
                                    background: done ? "var(--status-positive)" : "var(--brand-500)",
                                    borderRadius: 3,
                                    transition: "width 0.2s",
                                }} />
                            </div>
                        </div>
                    )}
                    <p style={{ color: "var(--text-danger)", fontSize: 12, margin: 0 }}>
                        ⚠ This is irreversible. Deleted messages cannot be recovered.
                    </p>
                </div>
            </ModalContent>
            <ModalFooter>
                <button style={{ ...btnStyle, background: "transparent", color: "var(--text-muted)" }} onClick={close}>Close</button>
                <button
                    style={{ ...btnStyle, background: running ? "var(--background-modifier-accent)" : "var(--status-danger)", color: "#fff", marginLeft: "auto", opacity: running ? 0.6 : 1 }}
                    disabled={running}
                    onClick={start}
                >
                    {running ? "Deleting…" : "Delete Messages"}
                </button>
            </ModalFooter>
        </ModalRoot>
    );
}

function TrashIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2h4a1 1 0 1 1 0 2h-1.1l-.9 12.1A3 3 0 0 1 17 23H7a3 3 0 0 1-3-2.9L3.1 8H2a1 1 0 0 1 0-2h4V4Zm2 0v2h6V4H9ZM5.1 8l.9 11.9a1 1 0 0 0 1 .1h10a1 1 0 0 0 1-.1L14.9 8H5.1Z" />
        </svg>
    );
}

export default definePlugin({
    name: "MessagePurger",
    description: "Delete your recent messages from the current channel with a safe rate-limit-aware pace.",
    authors: [MallCordDevs.Sharp],
    tags: ["Utility", "Chat"],
    dependencies: ["HeaderBarAPI"],

    start() {
        addHeaderBarButton("msg-purger-btn", () => (
            <HeaderBarButton
                icon={TrashIcon}
                tooltip="Message Purger"
                onClick={() => openModal(props => <PurgerModal rootProps={props} />)}
            />
        ), 7);
    },

    stop() {
        removeHeaderBarButton("msg-purger-btn");
    },
});
