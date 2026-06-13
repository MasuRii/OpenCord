/*
 * Equicord, a Discord client mod
 * Copyright (c) 2024 Nightcord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { RelationshipStore, Toasts } from "@webpack/common";

const RelationshipActions = findByPropsLazy("removeFriend", "sendFriendRequest");

// RelationshipType 4 = OUTGOING_REQUEST
const OUTGOING_REQUEST = 4;

function cancelRequest(userId: string) {
    try {
        RelationshipActions.removeFriend(userId);
        Toasts.show({
            message: "Friend request cancelled ✓",
            type: Toasts.Type.SUCCESS,
            id: Toasts.genId(),
        });
    } catch (e) {
        console.error("[CancelFriendRequest] Error:", e);
    }
}

function getUserIdFromOutgoingRelationships(): string | null {
    try {
        const rels = (RelationshipStore as any).getRelationships?.() ?? {};
        for (const [uid, type] of Object.entries(rels)) {
            if (type === OUTGOING_REQUEST) return uid;
        }
    } catch {}
    return null;
}

let observer: MutationObserver | null = null;

function patchBtn(btn: HTMLElement, userId: string) {
    if (btn.dataset.cfp) return;
    btn.dataset.cfp = "1";
    btn.addEventListener("click", (e: MouseEvent) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        cancelRequest(userId);
    }, true);
    // Remove disabled if present so the click is possible
    btn.removeAttribute("disabled");
    btn.style.cursor = "pointer";
    btn.style.opacity = "1";
}

function scan(root: Document | Element = document) {
    // ── Case 1: profile popup ─────────────────────────────────────────────────
    // aria-label="Outgoing Friend Request" — invariant regardless of UI language
    root.querySelectorAll<HTMLElement>('button[aria-label="Outgoing Friend Request"]').forEach(btn => {
        // Find the userId via the profile container
        const profileContainer = btn.closest("[class*='profileButtons']") 
            ?? btn.closest("[class*='profileHeader']")
            ?? btn.closest("[class*='inner']");
        if (!profileContainer) return;

        // Look for an avatar with Discord CDN that contains the userId
        const wholeModal = btn.closest("[class*='modal'], [class*='userPopout'], [class*='profileBody']")
            ?? document;
        const avatarImg = wholeModal?.querySelector?.("img[src*='cdn.discordapp.com/avatars/']");
        if (avatarImg) {
            const m = avatarImg.getAttribute("src")?.match(/avatars\/(\d+)\//);
            if (m) { patchBtn(btn, m[1]); return; }
        }
        // Fallback: look via pending relationships (if only 1 outgoing request)
        const uid = getUserIdFromOutgoingRelationships();
        if (uid) patchBtn(btn, uid);
    });

    // ── Case 2: DM header ────────────────────────────────────────────────────
    // The "Friend Request Sent" button is disabled + secondary in the DM header
    // Structure: div.container_b50d96 > div.inline_b50d96 > button[disabled].secondary
    root.querySelectorAll<HTMLElement>('button[disabled][class*="secondary"]').forEach(btn => {
        // Check that we're in a DM header (not elsewhere)
        const container = btn.closest("[class*='container_b50d96'], [class*='dmWelcome'], [class*='privateChannelEmptyMessage']");
        if (!container) return;

        // Get the userId via the avatar in this header
        const avatarImg = container.querySelector("img[src*='cdn.discordapp.com/avatars/']");
        if (avatarImg) {
            const m = avatarImg.getAttribute("src")?.match(/avatars\/(\d+)\//);
            if (m) {
                const relType = (RelationshipStore as any).getRelationshipType(m[1]);
                if (relType === OUTGOING_REQUEST) { patchBtn(btn, m[1]); return; }
            }
        }

        // Fallback: via outgoing relationships
        const uid = getUserIdFromOutgoingRelationships();
        if (uid) {
            const relType = (RelationshipStore as any).getRelationshipType(uid);
            if (relType === OUTGOING_REQUEST) patchBtn(btn, uid);
        }
    });
}

export default definePlugin({
    name: "CancelFriendRequestNC",
    description: "Cancels a pending friend request by clicking the button again.",
    tags: ["Friends", "Utility"],
    authors: [{ name: "Nightcord", id: 0n }],

    start() {
        observer = new MutationObserver(mutations => {
            for (const m of mutations) {
                for (const node of m.addedNodes) {
                    if (node instanceof HTMLElement) scan(node);
                }
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        scan(document);
        console.log("[CancelFriendRequest] Started ✓");
    },

    stop() {
        observer?.disconnect();
        observer = null;
        document.querySelectorAll<HTMLElement>("[data-cfp]").forEach(el => {
            delete el.dataset.cfp;
        });
        console.log("[CancelFriendRequest] Stopped.");
    },
});
