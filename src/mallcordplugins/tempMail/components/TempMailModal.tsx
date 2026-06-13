/*
 * MallCord TempMail — Modal UI
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "../styles.css";

import { copyToClipboard } from "@utils/clipboard";
import type { RenderModalProps } from "@vencord/discord-types";
import { Button, Modal, React, showToast, TextInput, Toasts, useEffect, useRef, useState } from "@webpack/common";

import {
    createAccount, deleteAccount, deleteMessage,
    getDomains, getMessage, getMessages, getToken,
    randomString, TmAttachment, TmMessage, TmMessageFull,
} from "../api";
import {
    getActiveId, getDataStorePath, getSavedAccounts, getSavedMessages,
    mergeAndSaveMessages, deleteMessageFromStore,
    removeAccount, SavedAccount, saveAccount, setActiveId,
} from "../store";

type View = "inbox" | "message" | "new" | "accounts";

export function TempMailModal({ modalProps }: { modalProps: RenderModalProps; }) {
    const [view, setView] = useState<View>("inbox");
    const [accounts, setAccounts] = useState<SavedAccount[]>([]);
    const [active, setActive] = useState<SavedAccount | null>(null);
    const [messages, setMessages] = useState<TmMessage[]>([]);
    const [openMsg, setOpenMsg] = useState<TmMessageFull | null>(null);
    const [loading, setLoading] = useState(false);
    const [msgLoading, setMsgLoading] = useState(false);
    const [error, setError] = useState("");
    const [domains, setDomains] = useState<string[]>([]);
    const [selDomain, setSelDomain] = useState("");
    const [customUser, setCustomUser] = useState("");
    const [bodyMode, setBodyMode] = useState<"html" | "text">("html");
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const pollRef = useRef<any>(null);

    useEffect(() => {
        (async () => {
            const saved = await getSavedAccounts();
            setAccounts(saved);
            const id = await getActiveId();
            const act = saved.find(a => a.id === id) ?? saved[0] ?? null;
            setActive(act);
            if (act) {
                const stored = await getSavedMessages(act.id);
                if (stored.length) setMessages(stored);
                fetchInbox(act);
            }
        })();
        fetchDomains();
        return () => clearInterval(pollRef.current);
    }, []);

    useEffect(() => {
        clearInterval(pollRef.current);
        if (!active) return;
        pollRef.current = setInterval(() => fetchInbox(active, true), 15_000);
        return () => clearInterval(pollRef.current);
    }, [active]);

    // Resize iframe to content height after HTML loads
    useEffect(() => {
        if (!iframeRef.current) return;
        const resize = (): void => {
            try {
                const doc = iframeRef.current?.contentDocument;
                if (doc?.body) {
                    iframeRef.current!.style.height = doc.body.scrollHeight + 32 + "px";
                }
            } catch { }
        };
        const el = iframeRef.current;
        el.addEventListener("load", resize);
        return () => el.removeEventListener("load", resize);
    }, [openMsg, bodyMode]);

    async function fetchDomains() {
        try {
            const d = await getDomains();
            const names = d.filter(x => x.isActive).map(x => x.domain);
            setDomains(names);
            if (names.length) setSelDomain(names[0]);
        } catch { }
    }

    async function fetchInbox(acc: SavedAccount, silent = false) {
        if (!silent) setLoading(true);
        setError("");
        try {
            const fresh = await getMessages(acc.token);
            const merged = await mergeAndSaveMessages(acc.id, fresh);
            setMessages(merged);
        } catch (e: any) {
            if (!silent) setError("Failed to load inbox: " + e.message);
        } finally {
            if (!silent) setLoading(false);
        }
    }

    async function openMessage(msg: TmMessage) {
        if (!active) return;
        setMsgLoading(true);
        setBodyMode("html");
        try {
            const full = await getMessage(msg.id, active.token);
            setOpenMsg(full);
            setView("message");
        } catch (e: any) {
            setError("Could not load message: " + e.message);
        } finally {
            setMsgLoading(false);
        }
    }

    async function handleDeleteMessage(id: string) {
        if (!active) return;
        try { await deleteMessage(id, active.token); } catch { }
        await deleteMessageFromStore(active.id, id);
        setMessages(m => m.filter(x => x.id !== id));
        if (openMsg?.id === id) { setOpenMsg(null); setView("inbox"); }
    }

    async function createAddress(random: boolean) {
        const domain = selDomain || domains[0];
        if (!domain) { setError("No domains available yet."); return; }
        const user = random ? randomString(10) : customUser.trim();
        if (!user) { setError("Enter a username first."); return; }
        setLoading(true); setError("");
        try {
            const address = `${user}@${domain}`;
            const password = randomString(16);
            const { id } = await createAccount(address, password);
            const token = await getToken(address, password);
            const acc: SavedAccount = { id, address, token, createdAt: Date.now() };
            await saveAccount(acc);
            await setActiveId(id);
            const fresh = await getSavedAccounts();
            setAccounts(fresh);
            setActive(acc);
            setMessages([]);
            fetchInbox(acc);
            setView("inbox");
            setCustomUser("");
            showToast("Created: " + address, Toasts.Type.SUCCESS);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    async function switchTo(acc: SavedAccount) {
        setActive(acc);
        await setActiveId(acc.id);
        const stored = await getSavedMessages(acc.id);
        setMessages(stored);
        fetchInbox(acc);
        setView("inbox");
    }

    async function deleteAcc(acc: SavedAccount) {
        if (!confirm(`Delete ${acc.address} permanently?`)) return;
        try { await deleteAccount(acc.id, acc.token); } catch { }
        await removeAccount(acc.id);
        const fresh = await getSavedAccounts();
        setAccounts(fresh);
        if (active?.id === acc.id) {
            const next = fresh[0] ?? null;
            setActive(next);
            setMessages([]);
            if (next) { await setActiveId(next.id); fetchInbox(next); }
        }
    }

    // Build iframe HTML that allows images and opens links safely
    function buildIframeHtml(html: string) {
        return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  html,body{margin:0;padding:0;background:#1e2030;color:#e2e8f0;font-family:'Segoe UI',Arial,sans-serif;font-size:14px;line-height:1.7;}
  body{padding:16px;}
  img{max-width:100%;height:auto;border-radius:6px;display:block;margin:6px 0;}
  a{color:#a78bfa;word-break:break-all;}
  a:hover{color:#c4b5fd;}
  table{max-width:100%!important;border-collapse:collapse;}
  td,th{word-break:break-word;padding:4px 6px;}
  pre,code{background:#12141e;border-radius:4px;padding:2px 6px;font-size:13px;color:#c9d1d9;}
  blockquote{border-left:3px solid #6c63ff;margin:8px 0;padding:4px 12px;color:#8892b0;}
  *{box-sizing:border-box;}
</style></head><body>${html}</body></html>`;
    }

    const unread = messages.filter(m => !m.seen).length;

    // Sender display: show "Name <email>" or just email
    function fmtSender(from: { address: string; name: string; }) {
        if (!from) return "Unknown";
        if (from.name && from.name !== from.address) return `${from.name} <${from.address}>`;
        return from.address;
    }

    // Attachment icon based on content type
    function attachIcon(ct: string) {
        if (ct.startsWith("image/")) return "🖼️";
        if (ct.startsWith("video/")) return "🎬";
        if (ct.startsWith("audio/")) return "🎵";
        if (ct.includes("pdf")) return "📄";
        if (ct.includes("zip") || ct.includes("rar") || ct.includes("7z")) return "🗜️";
        return "📎";
    }

    const hasHtml = (openMsg?.html?.length ?? 0) > 0;
    const hasText = !!openMsg?.text;
    const hasAttachments = (openMsg?.attachments?.length ?? 0) > 0;

    return (
        <Modal {...modalProps} size="lg" title="Temp Mail">
            <div className="tm-shell">

                {/* ── Sidebar ─────────────────────────────────────── */}
                <div className="tm-sidebar">
                    <div className="tm-brand">
                        <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor"><path d="M20 4H4C2.9 4 2 4.9 2 6v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z" /></svg>
                        <span>Temp Mail</span>
                    </div>

                    {active && (
                        <div className="tm-active-addr">
                            <div className="tm-active-label">Active</div>
                            <div className="tm-active-text">{active.address}</div>
                            <button className="tm-copy-btn" onClick={() => { copyToClipboard(active.address); showToast("Copied!", Toasts.Type.SUCCESS); }}>
                                Copy address
                            </button>
                        </div>
                    )}

                    <nav className="tm-nav">
                        <button className={`tm-nav-item ${view === "inbox" ? "tm-active" : ""}`} onClick={() => setView("inbox")}>
                            <span className="tm-nav-icon">📥</span>
                            <span>Inbox</span>
                            {unread > 0 && <span className="tm-unread-pill">{unread}</span>}
                        </button>
                        <button className={`tm-nav-item ${view === "accounts" ? "tm-active" : ""}`} onClick={() => setView("accounts")}>
                            <span className="tm-nav-icon">👤</span>
                            <span>Accounts</span>
                            <span className="tm-count-dim">{accounts.length}</span>
                        </button>
                        <button className={`tm-nav-item ${view === "new" ? "tm-active" : ""}`} onClick={() => setView("new")}>
                            <span className="tm-nav-icon">✉</span>
                            <span>New address</span>
                        </button>
                    </nav>

                    <div className="tm-sidebar-footer">
                        <div className="tm-storage-info">
                            <span className="tm-storage-icon">💾</span>
                            <div>
                                <div className="tm-storage-title">Emails saved to</div>
                                <div className="tm-storage-path">{getDataStorePath()}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Content ─────────────────────────────────────── */}
                <div className="tm-content">
                    {error && (
                        <div className="tm-error-bar">
                            <span>⚠ {error}</span>
                            <button onClick={() => setError("")}>✕</button>
                        </div>
                    )}

                    {/* ── INBOX ── */}
                    {view === "inbox" && (
                        <div className="tm-view">
                            <div className="tm-view-header">
                                <div>
                                    <div className="tm-view-title">Inbox</div>
                                    {active && <div className="tm-view-sub">{active.address}</div>}
                                </div>
                                <button className="tm-icon-btn" title="Refresh" onClick={() => active && fetchInbox(active)} disabled={loading}>
                                    <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor"><path d="M17.65 6.35A7.95 7.95 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" /></svg>
                                </button>
                            </div>

                            {!active && (
                                <div className="tm-empty-state">
                                    <div className="tm-empty-icon">✉</div>
                                    <div className="tm-empty-title">No account yet</div>
                                    <div className="tm-empty-sub">Create a temporary address to start receiving emails</div>
                                    <button className="tm-btn-primary" onClick={() => setView("new")}>Create address</button>
                                </div>
                            )}

                            {active && loading && <div className="tm-spinner">Loading…</div>}

                            {active && !loading && messages.length === 0 && (
                                <div className="tm-empty-state">
                                    <div className="tm-empty-icon">📭</div>
                                    <div className="tm-empty-title">No messages yet</div>
                                    <div className="tm-empty-sub">Auto-refreshes every 15 seconds</div>
                                </div>
                            )}

                            {active && !loading && messages.length > 0 && (
                                <div className="tm-message-list">
                                    {messages.map(m => (
                                        <div key={m.id} className={`tm-msg-row ${!m.seen ? "tm-msg-unread" : ""}`} onClick={() => openMessage(m)}>
                                            <div className="tm-msg-left">
                                                {/* Sender email always visible */}
                                                <div className="tm-msg-from">
                                                    {m.from.name
                                                        ? <>{m.from.name} <span className="tm-msg-from-addr">&lt;{m.from.address}&gt;</span></>
                                                        : m.from.address}
                                                </div>
                                                <div className="tm-msg-subject">{m.subject || "(no subject)"}</div>
                                                <div className="tm-msg-preview">{m.intro}</div>
                                            </div>
                                            <div className="tm-msg-right">
                                                <div className="tm-msg-time">{fmtDate(m.createdAt)}</div>
                                                <button className="tm-del-btn" title="Delete" onClick={e => { e.stopPropagation(); handleDeleteMessage(m.id); }}>
                                                    <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── MESSAGE VIEW ── */}
                    {view === "message" && (
                        <div className="tm-view">
                            <div className="tm-view-header">
                                <button className="tm-back-btn" onClick={() => setView("inbox")}>← Back</button>
                                <div className="tm-msg-view-tabs">
                                    {hasHtml && (
                                        <button
                                            className={`tm-tab-btn ${bodyMode === "html" ? "tm-tab-active" : ""}`}
                                            onClick={() => setBodyMode("html")}
                                        >
                                            Rendered
                                        </button>
                                    )}
                                    {hasText && (
                                        <button
                                            className={`tm-tab-btn ${bodyMode === "text" ? "tm-tab-active" : ""}`}
                                            onClick={() => setBodyMode("text")}
                                        >
                                            Plain text
                                        </button>
                                    )}
                                </div>
                                {openMsg && (
                                    <button className="tm-btn-danger-sm" onClick={() => openMsg && handleDeleteMessage(openMsg.id)}>Delete</button>
                                )}
                            </div>

                            {msgLoading && <div className="tm-spinner">Loading message…</div>}

                            {openMsg && !msgLoading && (
                                <div className="tm-msg-view">
                                    {/* Subject */}
                                    <div className="tm-msg-view-subject">{openMsg.subject || "(no subject)"}</div>

                                    {/* Meta — sender email always shown */}
                                    <div className="tm-msg-view-meta">
                                        <div className="tm-meta-row">
                                            <span className="tm-meta-label">From</span>
                                            <span className="tm-meta-val">
                                                {openMsg.from.name
                                                    ? <><strong>{openMsg.from.name}</strong> <span className="tm-meta-email">&lt;{openMsg.from.address}&gt;</span></>
                                                    : <strong>{openMsg.from.address}</strong>
                                                }
                                                <button
                                                    className="tm-meta-copy"
                                                    title="Copy sender email"
                                                    onClick={() => { copyToClipboard(openMsg.from.address); showToast("Copied!", Toasts.Type.SUCCESS); }}
                                                >
                                                    <svg viewBox="0 0 24 24" width={12} height={12} fill="currentColor"><path d="M16 1H4C2.9 1 2 1.9 2 3v14h2V3h12V1zm3 4H8C6.9 5 6 5.9 6 7v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" /></svg>
                                                </button>
                                            </span>
                                        </div>
                                        {openMsg.to?.length > 0 && (
                                            <div className="tm-meta-row">
                                                <span className="tm-meta-label">To</span>
                                                <span className="tm-meta-val">{openMsg.to.map(t => t.address).join(", ")}</span>
                                            </div>
                                        )}
                                        <div className="tm-meta-row">
                                            <span className="tm-meta-label">Date</span>
                                            <span className="tm-meta-val">{new Date(openMsg.createdAt).toLocaleString()}</span>
                                        </div>
                                    </div>

                                    {/* Body */}
                                    <div className="tm-msg-view-body">
                                        {/* HTML view — iframe with images + links enabled */}
                                        {bodyMode === "html" && hasHtml && (
                                            <iframe
                                                ref={iframeRef}
                                                className="tm-email-iframe"
                                                title="Email content"
                                                sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                                                srcDoc={buildIframeHtml(
                                                    Array.isArray(openMsg.html)
                                                        ? openMsg.html.join("")
                                                        : (openMsg.html ?? "")
                                                )}
                                            />
                                        )}

                                        {/* Plain text view — selectable, white, readable */}
                                        {(bodyMode === "text" || (!hasHtml && hasText)) && (
                                            <div className="tm-email-text" style={{ userSelect: "text" }}>
                                                {openMsg.text}
                                            </div>
                                        )}

                                        {!hasHtml && !hasText && (
                                            <div className="tm-email-empty">(No content)</div>
                                        )}
                                    </div>

                                    {/* Attachments */}
                                    {hasAttachments && (
                                        <div className="tm-attachments">
                                            <div className="tm-attach-label">Attachments ({openMsg.attachments!.length})</div>
                                            <div className="tm-attach-list">
                                                {openMsg.attachments!.map((att: TmAttachment) => (
                                                    <div key={att.id} className="tm-attach-item">
                                                        <span className="tm-attach-icon">{attachIcon(att.contentType)}</span>
                                                        <span className="tm-attach-name" title={att.filename}>{att.filename}</span>
                                                        <span className="tm-attach-size">{fmtSize(att.size)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── ACCOUNTS ── */}
                    {view === "accounts" && (
                        <div className="tm-view">
                            <div className="tm-view-header">
                                <div className="tm-view-title">Accounts</div>
                                <button className="tm-btn-primary-sm" onClick={() => setView("new")}>+ New</button>
                            </div>
                            {accounts.length === 0 && (
                                <div className="tm-empty-state">
                                    <div className="tm-empty-icon">👤</div>
                                    <div className="tm-empty-title">No saved accounts</div>
                                </div>
                            )}
                            <div className="tm-account-list">
                                {accounts.map(acc => (
                                    <div key={acc.id} className={`tm-account-card ${active?.id === acc.id ? "tm-account-active" : ""}`}>
                                        <div className="tm-account-main">
                                            {active?.id === acc.id && <span className="tm-active-dot" />}
                                            <div>
                                                <div className="tm-account-addr">{acc.address}</div>
                                                <div className="tm-account-date">Created {new Date(acc.createdAt).toLocaleDateString()}</div>
                                            </div>
                                        </div>
                                        <div className="tm-account-btns">
                                            {active?.id !== acc.id && (
                                                <button className="tm-btn-primary-sm" onClick={() => switchTo(acc)}>Use</button>
                                            )}
                                            <button className="tm-icon-btn" title="Copy" onClick={() => { copyToClipboard(acc.address); showToast("Copied!", Toasts.Type.SUCCESS); }}>
                                                <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor"><path d="M16 1H4C2.9 1 2 1.9 2 3v14h2V3h12V1zm3 4H8C6.9 5 6 5.9 6 7v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" /></svg>
                                            </button>
                                            <button className="tm-icon-btn tm-icon-btn-danger" title="Delete account" onClick={() => deleteAcc(acc)}>
                                                <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── NEW ADDRESS ── */}
                    {view === "new" && (
                        <div className="tm-view">
                            <div className="tm-view-header">
                                <div className="tm-view-title">New address</div>
                            </div>
                            <div className="tm-new-section">
                                <div className="tm-new-label">Quick generate</div>
                                <div className="tm-new-desc">Creates a random address instantly</div>
                                <button className="tm-btn-primary" onClick={() => createAddress(true)} disabled={loading || !domains.length}>
                                    {loading ? "Creating…" : "⚡ Generate random address"}
                                </button>
                            </div>

                            <div className="tm-divider"><span>or choose your own</span></div>

                            <div className="tm-new-section">
                                <div className="tm-new-label">Custom address</div>
                                <div className="tm-custom-input-row">
                                    <TextInput
                                        placeholder="username"
                                        value={customUser}
                                        onChange={v => setCustomUser(v)}
                                        className="tm-text-input"
                                    />
                                    <span className="tm-at-sign">@</span>
                                    <select className="tm-domain-select" value={selDomain} onChange={e => setSelDomain(e.currentTarget.value)}>
                                        {domains.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>
                                <button
                                    className="tm-btn-primary"
                                    onClick={() => createAddress(false)}
                                    disabled={loading || !customUser.trim() || !domains.length}
                                >
                                    {loading ? "Creating…" : "Create address"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
}

function fmtDate(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function fmtSize(bytes: number) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
