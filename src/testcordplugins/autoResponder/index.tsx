/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChatBarButton } from "@api/ChatButtons";
import { addChannelToolbarButton, addHeaderBarButton, ChannelToolbarButton, HeaderBarButton, removeChannelToolbarButton, removeHeaderBarButton } from "@api/HeaderBar";
import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { ChannelStore, React,RestAPI, UserStore } from "@webpack/common";

import { getGroqKey,groqChat } from "../nightcordAI/groqManager";

const MessageStore = findByPropsLazy("getMessages");

const settings = definePluginSettings({
    location: {
        type: OptionType.SELECT,
        description: "Where to show the button",
        options: [
            { label: "Chat bar", value: "chatbar", default: true },
            { label: "Header bar", value: "headerbar" },
            { label: "Channel toolbar", value: "channeltoolbar" },
            { label: "Disabled", value: "disabled" },
        ],
        restartNeeded: true,
    },
    warning: {
        type: OptionType.COMPONENT,
        component: () => (
            <div style={{
                backgroundColor: "rgba(250, 166, 26, 0.1)",
                border: "1px solid var(--status-warning)",
                borderRadius: "8px",
                padding: "12px",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                color: "#FFFFFF"
            }}>
                <span style={{ fontSize: "24px" }}>⚠️</span>
                <div>
                    <div style={{ fontWeight: "bold", color: "var(--status-warning)" }}>API Key Required</div>
                    <div style={{ fontSize: "13px", marginTop: "4px" }}>
                        AutoResponder requires a Groq API Key to function.
                        Please configure it once in the <strong>NightcordAI</strong> settings.
                    </div>
                </div>
            </div>
        )
    },
    isActive: {
        type: OptionType.BOOLEAN,
        description: "AutoResponder functional status",
        default: false,
        restartNeeded: false
    },
    personalInfo: {
        type: OptionType.STRING,
        description: "Personal Information (Name, Age, Location, etc.)",
        default: "",
        restartNeeded: false,
    },
    writingStyle: {
        type: OptionType.STRING,
        description: "Your Writing Style (e.g. casual, no caps, use 'ptn', etc.)",
        default: "",
        restartNeeded: false,
    },
    customInstructions: {
        type: OptionType.STRING,
        description: "Custom Instructions (What to say or NOT to say)",
        default: "",
        restartNeeded: false,
    },
    blacklistedWords: {
        type: OptionType.STRING,
        description: "Blacklisted Words or Topics (comma separated)",
        default: "",
        restartNeeded: false,
    },
    blacklistedUsers: {
        type: OptionType.STRING,
        description: "Blacklisted User IDs (comma separated) — AutoResponder will not reply to these users.",
        default: "",
        restartNeeded: false,
    },
    delayMin: {
        type: OptionType.NUMBER,
        description: "Minimum Delay (seconds)",
        default: 5,
        restartNeeded: false,
    },
    delayMax: {
        type: OptionType.NUMBER,
        description: "Maximum Delay (seconds)",
        default: 12,
        restartNeeded: false,
    }
});

const DS_STYLE_KEY = "auto-responder-global-style";

let lastMessageId = "";
const cachedGlobalStyle = "";
const pendingResponses = new Set<ReturnType<typeof setTimeout>>();

async function handleMessage(message: any) {
    if (!settings.store.isActive) return;

    const currentUser = UserStore.getCurrentUser();
    if (!currentUser || message.author.id === currentUser.id) return;

    // User blacklist check
    const blacklistedUsers = settings.store.blacklistedUsers?.split(",").map((id: string) => id.trim()) || [];
    if (blacklistedUsers.includes(message.author.id)) {
        console.log(`[AutoResponder] Skipping blacklisted user: ${message.author.username} (${message.author.id})`);
        return;
    }

    if (message.id === lastMessageId) return;

    const channel = ChannelStore.getChannel(message.channel_id);
    // STRICT RESTRICTION: Only DMs (Type 1)
    if (!channel || channel.type !== 1) return;

    lastMessageId = message.id;

    try {
        const apiKey = await getGroqKey();
        if (!apiKey) {
            try {
                const { openConfirmationModal } = findByPropsLazy("openConfirmationModal");
                openConfirmationModal({
                    header: "API Key Required",
                    content: "AutoResponder requires a Groq API Key to function. Please configure it once in the NightcordAI settings.",
                    confirmText: "Configure NightcordAI",
                    cancelText: "Cancel",
                    onConfirm: () => {
                        const { openModal } = findByPropsLazy("openModal");
                        // Logic to open NightcordAI settings if possible
                    }
                });
            } catch (e) {
                console.error("[AutoResponder] API Key missing and could not open modal", e);
            }
            return;
        }

        // Retrieve recent history for coherence
        let localHistory = "";
        try {
            const msgs = MessageStore.getMessages(message.channel_id).toArray().slice(-15);
            localHistory = msgs.map((m: any) => {
                const author = m.author.id === currentUser.id ? "ME" : "FRIEND";
                return `${author}: ${m.content}`;
            }).join("\n");
        } catch { }

        const prompt = `You are the user (ME). Reply to the last message from FRIEND.
        
MY PERSONAL INFO:
${settings.store.personalInfo}

MY INSTRUCTIONS:
${settings.store.customInstructions}

BLACKLIST:
${settings.store.blacklistedWords}

HISTORY:
${localHistory}

LATEST MESSAGE : "${message.content}"

BEHAVIOR RULES (CRUCIAL):
1. SHORT REPLIES: Keep responses concise (1 or 2 sentences max). Don't write long paragraphs.
2. DISCREET INFO: Only use my personal info (e.g. Paris) if relevant. Don't bring everything back to Paris in every message.
3. NATURAL WRITTEN STYLE: In text, you don't say "uh..." or "wait" when thinking. Just give the result or continue the sentence. Remove all traces of oral hesitation.
4. HUMAN: Talk like a buddy on Discord (light SMS language allowed if my style permits it).

MISSION:
Reply naturally. ONLY RETURN THE TEXT OF YOUR REPLY.`;

        const reply = await groqChat({
            messages: [
                { role: "system", content: "You are an ultra-customizable AutoResponder for Discord." },
                { role: "user", content: prompt }
            ],
            temperature: 0.7,
            maxTokens: 500
        });

        if (reply && !reply.startsWith("❌")) {
            // Realistic delay: fixed base + time proportional to message length
            const baseDelay = Math.floor(Math.random() * (settings.store.delayMax - settings.store.delayMin + 1) + settings.store.delayMin);
            const extraDelay = reply.length > 100 ? 2 : 0; // +2s si message long
            const totalDelay = (baseDelay + extraDelay) * 1000;

            try {
                const TypingActions = findByPropsLazy("startTyping");
                TypingActions.startTyping(message.channel_id);
            } catch { }

            const timeout = setTimeout(async () => {
                pendingResponses.delete(timeout);
                if (!settings.store.isActive) return;
                await RestAPI.post({
                    url: `/channels/${message.channel_id}/messages`,
                    body: { content: reply }
                });
            }, totalDelay);
            pendingResponses.add(timeout);
        }
    } catch (err) {
        console.error("[AutoResponder] Error:", err);
    }
}

const messageCreateListener = (data: any) => {
    // Discord dispatch MESSAGE_CREATE structure can vary
    const msg = data.message || data;
    if (msg && msg.author) {
        handleMessage(msg);
    }
};

const KeyboardIcon = (props: any) => (
    <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
    >
        <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
        <line x1="6" y1="8" x2="6" y2="8" />
        <line x1="10" y1="8" x2="10" y2="8" />
        <line x1="14" y1="8" x2="14" y2="8" />
        <line x1="18" y1="8" x2="18" y2="8" />
        <line x1="6" y1="12" x2="6" y2="12" />
        <line x1="10" y1="12" x2="10" y2="12" />
        <line x1="14" y1="12" x2="14" y2="12" />
        <line x1="18" y1="12" x2="18" y2="12" />
        <line x1="7" y1="16" x2="17" y2="16" />
        {!props.enabled && <line x1="22" y1="2" x2="2" y2="22" stroke="var(--status-danger)" strokeWidth="2.5" />}
    </svg>
);

let _forceUpdate: () => void = () => { };
function forceRerender() {
    _forceUpdate();
}

const AutoResponderButton = () => {
    const [, setTick] = React.useState(0);
    const isEnabled = settings.store.isActive;

    React.useEffect(() => {
        _forceUpdate = () => setTick(t => t + 1);
        return () => { _forceUpdate = () => { }; };
    }, []);

    if (settings.store.location !== "chatbar") return null;
    const toggle = async () => {
        const newState = !settings.store.isActive;

        if (newState) {
            const key = await getGroqKey();
            if (!key) {
                try {
                    const { openConfirmationModal } = findByPropsLazy("openConfirmationModal");
                    openConfirmationModal({
                        header: "API Key Required",
                        content: "AutoResponder requires a Groq API Key to function. Please configure it once in the NightcordAI settings.",
                        confirmText: "Close",
                        confirmColor: "brand"
                    });
                } catch { }
                return;
            }
        }

        settings.store.isActive = newState;
        setTick(t => t + 1);
    };

    return (
        <ChatBarButton
            tooltip={`AutoResponder: ${isEnabled ? "ON" : "OFF"}`}
            onClick={toggle}
        >
            <KeyboardIcon enabled={isEnabled} style={{ color: isEnabled ? "var(--brand-experiment)" : "var(--interactive-normal)" }} />
        </ChatBarButton>
    );
};

export default definePlugin({
    name: "AutoResponder",
    description: "Automatically reply to DMs using AI to match your writing style.",
    tags: ["Chat", "Nightcord"],
    authors: [{ name: "Nightcord", id: 0n }],
    dependencies: ["HeaderBarAPI"],
    settings,
    chatBarButton: {
        icon: KeyboardIcon,
        render: AutoResponderButton,
    },

    flux: {
        async MESSAGE_CREATE(data: any) {
            const msg = data.message || data;
            if (msg && msg.author) {
                handleMessage(msg);
            }
        }
    },

    start() {
        const { location } = settings.store;
        if (location === "headerbar") {
            addHeaderBarButton("AutoResponder", () => (
                <HeaderBarButton
                    icon={() => <KeyboardIcon enabled={settings.store.isActive} />}
                    tooltip={`AutoResponder: ${settings.store.isActive ? "ON" : "OFF"}`}
                    onClick={() => { settings.store.isActive = !settings.store.isActive; }}
                />
            ), 5);
        } else if (location === "channeltoolbar") {
            addChannelToolbarButton("AutoResponder", () => (
                <ChannelToolbarButton
                    icon={() => <KeyboardIcon enabled={settings.store.isActive} />}
                    tooltip={`AutoResponder: ${settings.store.isActive ? "ON" : "OFF"}`}
                    onClick={() => { settings.store.isActive = !settings.store.isActive; }}
                />
            ), 5);
        }
    },

    stop() {
        for (const timeout of pendingResponses) clearTimeout(timeout);
        pendingResponses.clear();
        removeHeaderBarButton("AutoResponder");
        removeChannelToolbarButton("AutoResponder");
    }
});
