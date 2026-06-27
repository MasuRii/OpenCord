/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IpcMainInvokeEvent } from "electron";

export interface NativeWebhookResponse {
    status: number;
    data: string;
}

const ALLOWED_WEBHOOK_HOSTS = ["discord.com", "canary.discord.com", "ptb.discord.com", "discordapp.com"];

function isValidWebhookUrl(webhookUrl: string): boolean {
    let url: URL;
    try {
        url = new URL(webhookUrl);
    } catch {
        return false;
    }
    return url.protocol === "https:"
        && ALLOWED_WEBHOOK_HOSTS.includes(url.hostname)
        && url.pathname.startsWith("/api/webhooks/");
}

export async function sendWebhook(
    _: IpcMainInvokeEvent,
    webhookUrl: string,
    payload: string,
): Promise<NativeWebhookResponse> {
    if (typeof webhookUrl !== "string" || typeof payload !== "string") {
        return { status: -1, data: "Invalid request." };
    }

    if (!isValidWebhookUrl(webhookUrl)) {
        return { status: -1, data: "Invalid webhook URL." };
    }

    try {
        const response = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
        });

        return {
            status: response.status,
            data: await response.text(),
        };
    } catch (error) {
        return {
            status: -1,
            data: error instanceof Error ? error.message : String(error),
        };
    }
}
