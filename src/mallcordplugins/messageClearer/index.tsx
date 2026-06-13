/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { Button } from "@components/Button";
import ErrorBoundary from "@components/ErrorBoundary";
import { MallCordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { Constants, Modal, openModal, RestAPI, SelectedChannelStore, showToast, Toasts, UserStore } from "@webpack/common";
import { React, useState } from "@webpack/common";

function TrashIcon({ size = 20, color = "currentColor" }: { size?: number; color?: string; }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <path fill={color} d="M5 6.75C5 6.336 5.336 6 5.75 6H8.128C8.422 6 8.683 5.82 8.785 5.546L9.072 4.785C9.312 4.145 9.92 3.723 10.603 3.723H13.397C14.08 3.723 14.688 4.145 14.928 4.785L15.215 5.546C15.317 5.82 15.578 6 15.872 6H18.25C18.664 6 19 6.336 19 6.75C19 7.164 18.664 7.5 18.25 7.5H5.75C5.336 7.5 5 7.164 5 6.75Z" />
            <path fill={color} fillRule="evenodd" clipRule="evenodd" d="M5.168 9H18.832L18.192 18.048C18.087 19.485 16.889 20.598 15.449 20.598H8.551C7.111 20.598 5.913 19.485 5.808 18.048L5.168 9ZM10 12C10 11.448 9.552 11 9 11 8.448 11 8 11.448 8 12V16C8 16.552 8.448 17 9 17 9.552 17 10 16.552 10 16V12ZM15 11C15.552 11 16 11.448 16 12V16C16 16.552 15.552 17 15 17 14.448 17 14 16.552 14 16V12C14 11.448 14.448 11 15 11ZM12 11C12.552 11 13 11.448 13 12V16C13 16.552 12.552 17 12 17 11.448 17 11 16.552 11 16V12C11 11.448 11.448 11 12 11Z" />
        </svg>
    );
}

let cancelled = false;

function sleep(ms: number) {
    return new Promise(r => setTimeout(r, ms));
}

async function fetchMyMessages(channelId: string, limit: number) {
    const me = UserStore.getCurrentUser();
    if (!me) return [];

    const results: any[] = [];
    let before: string | undefined;

    while (results.length < limit && !cancelled) {
        const query: any = { limit: 100 };
        if (before) query.before = before;

        let batch: any[];
        try {
            const res = await RestAPI.get({ url: Constants.Endpoints.MESSAGES(channelId), query });
            batch = res.body ?? [];
        } catch {
            break;
        }

        if (!batch.length) break;
        results.push(...batch.filter(m => m.author.id === me.id));
        before = batch[batch.length - 1]?.id;
        if (batch.length < 100) break;
    }

    return results.slice(0, limit);
}

async function runDeletion(
    channelId: string,
    messages: any[],
    onProgress: (done: number, total: number) => void,
    onDone: (deleted: number) => void
) {
    const total = messages.length;
    let deleted = 0;

    async function worker(start: number) {
        for (let i = start; i < messages.length; i += 3) {
            if (cancelled) return;
            const msg = messages[i];

            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    await RestAPI.del({ url: Constants.Endpoints.MESSAGE(channelId, msg.id) });
                    deleted++;
                    onProgress(deleted, total);
                    break;
                } catch (e: any) {
                    if (e?.status === 429) {
                        await sleep((e?.body?.retry_after ?? 1) * 1000 + 500);
                    } else {
                        break;
                    }
                }
            }

            await sleep(1050);
        }
    }

    await Promise.all([worker(0), worker(1), worker(2)]);
    onDone(deleted);
}

const PRESETS = [10, 25, 50, 100, 200, 500];
type Phase = "idle" | "fetching" | "running" | "done" | "stopped";

function ClearModal({ modalProps, channelId }: { modalProps: any; channelId: string; }) {
    const [amount, setAmount] = useState(25);
    const [custom, setCustom] = useState("");
    const [phase, setPhase] = useState<Phase>("idle");
    const [progress, setProgress] = useState({ done: 0, total: 0 });

    const count = custom.trim() ? Math.max(1, Math.min(10000, parseInt(custom) || 25)) : amount;

    async function start() {
        cancelled = false;
        setPhase("fetching");
        setProgress({ done: 0, total: 0 });

        const messages = await fetchMyMessages(channelId, count);
        if (!messages.length || cancelled) {
            setPhase(cancelled ? "stopped" : "done");
            return;
        }

        setPhase("running");
        await runDeletion(
            channelId,
            messages,
            (done, total) => setProgress({ done, total }),
            done => {
                setProgress(p => ({ ...p, done }));
                setPhase(cancelled ? "stopped" : "done");
            }
        );
    }

    function stop() {
        cancelled = true;
    }

    function reset() {
        setPhase("idle");
        setProgress({ done: 0, total: 0 });
    }

    return (
        <Modal {...modalProps} size="sm" title="">
            <div className="mc-wrap">
                <div className="mc-head">
                    <div className="mc-head-icon">
                        <TrashIcon size={20} color="#f23f42" />
                    </div>
                    <div className="mc-head-text">
                        <div className="mc-head-title">Clear My Messages</div>
                        <div className="mc-head-sub">Deletes your messages in this channel or DM</div>
                    </div>
                </div>
                <div className="mc-divider" />

                {phase === "idle" && (
                    <div className="mc-body">
                        <div className="mc-label">Amount to delete</div>
                        <div className="mc-chips">
                            {PRESETS.map(n => (
                                <button
                                    key={n}
                                    className={"mc-chip" + (amount === n && !custom ? " active" : "")}
                                    onClick={() => { setAmount(n); setCustom(""); }}
                                >
                                    {n}
                                </button>
                            ))}
                        </div>
                        <input
                            className="mc-input"
                            type="number"
                            min={1}
                            max={10000}
                            placeholder="Custom amount…"
                            value={custom}
                            onChange={e => setCustom(e.currentTarget.value)}
                        />
                        <div className="mc-note">
                            Up to <strong>{count}</strong> of your messages will be deleted. This can't be undone.
                        </div>
                        <div className="mc-row">
                            <Button variant="dangerPrimary" size="medium" onClick={start}>
                                Delete {count} message{count !== 1 ? "s" : ""}
                            </Button>
                            <Button variant="secondary" size="medium" onClick={() => modalProps.onClose()}>
                                Cancel
                            </Button>
                        </div>
                    </div>
                )}

                {phase === "fetching" && (
                    <div className="mc-status">
                        <div className="mc-spinner" />
                        <div className="mc-status-text">Finding your messages…</div>
                    </div>
                )}

                {phase === "running" && (
                    <div className="mc-status">
                        <div className="mc-status-text">Deleting {progress.done} / {progress.total}</div>
                        <div className="mc-bar">
                            <div
                                className="mc-bar-fill"
                                style={{ width: progress.total > 0 ? `${(progress.done / progress.total) * 100}%` : "4%" }}
                            />
                        </div>
                        <div className="mc-status-sub">{progress.total - progress.done} remaining</div>
                        <Button variant="secondary" size="small" onClick={stop}>Stop</Button>
                    </div>
                )}

                {(phase === "done" || phase === "stopped") && (
                    <div className="mc-result">
                        <div className={"mc-result-icon " + (phase === "done" ? "success" : "warn")}>
                            {phase === "done" ? "✓" : "■"}
                        </div>
                        <div className="mc-result-title">{phase === "done" ? "Done" : "Stopped"}</div>
                        <div className="mc-result-sub">
                            Deleted <strong>{progress.done}</strong> message{progress.done !== 1 ? "s" : ""}
                        </div>
                        <div className="mc-row">
                            <Button variant="primary" size="small" onClick={reset}>Delete more</Button>
                            <Button variant="secondary" size="small" onClick={() => modalProps.onClose()}>Close</Button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
}

const ClearButton: ChatBarButtonFactory = ({ isAnyChat }) => {
    if (!isAnyChat) return null;

    return (
        <ChatBarButton
            tooltip="Clear My Messages"
            onClick={() => {
                const channelId = SelectedChannelStore.getChannelId();
                if (!channelId) {
                    showToast("No channel open", Toasts.Type.FAILURE);
                    return;
                }
                openModal(props => <ClearModal modalProps={props} channelId={channelId} />);
            }}
        >
            <TrashIcon />
        </ChatBarButton>
    );
};

export default definePlugin({
    name: "MessageClearer",
    description: "Adds a button to the chat bar to delete your own messages in any channel or DM.",
    authors: [MallCordDevs.lastclipped],
    tags: ["Chat", "Utility"],
    dependencies: ["ChatInputButtonAPI"],
    chatBarButton: {
        icon: () => <TrashIcon /> as any,
        render: ErrorBoundary.wrap(ClearButton, { noop: true }) as any,
    },
});
