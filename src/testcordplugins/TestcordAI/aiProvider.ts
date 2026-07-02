/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Settings } from "@api/Settings";

import { groqChat, groqFetch } from "./groqManager";

export const PROVIDER_OPTIONS = [
    { label: "Groq (free)", value: "groq" },
    { label: "Homelander (free)", value: "homelander" },
    { label: "SwishAI", value: "swishai" },
    { label: "Unlimited Surf (free)", value: "unlimited-surf" },
    { label: "GPT-5.5 Proxy (free)", value: "gpt55-proxy" },
] as const;

export const LOCAL_PROVIDER_OPTIONS = [
    { label: "Use TestcordAI settings", value: "testcord" },
    ...PROVIDER_OPTIONS,
] as const;

export const HOMELANDER_MODEL_OPTIONS = [
    { label: "GPT-5.5", value: "openai/gpt-5.5" },
    { label: "GPT-5.2", value: "openai/gpt-5.2" },
    { label: "GLM 5.2", value: "@cf/zai-org/glm-5.2" },
    { label: "GLM 4.7 Flash", value: "@cf/zai-org/glm-4.7-flash" },
    { label: "Kimi K2.7 Code", value: "@cf/moonshotai/kimi-k2.7-code" },
    { label: "Kimi K2.6", value: "@cf/moonshotai/kimi-k2.6" },
    { label: "Kimi K2.5", value: "@cf/moonshotai/kimi-k2.5" },
    { label: "GPT OSS 120B", value: "@cf/openai/gpt-oss-120b" },
    { label: "GPT OSS 20B", value: "@cf/openai/gpt-oss-20b" },
    { label: "Llama 4 Scout", value: "@cf/meta/llama-4-scout-17b-16e-instruct" },
    { label: "Llama 3.3 70B Fast", value: "@cf/meta/llama-3.3-70b-instruct-fp8-fast" },
    { label: "Llama 3.2 11B Vision", value: "@cf/meta/llama-3.2-11b-vision-instruct" },
    { label: "Llama 3.2 3B", value: "@cf/meta/llama-3.2-3b-instruct" },
    { label: "Llama 3.2 1B", value: "@cf/meta/llama-3.2-1b-instruct" },
    { label: "Llama 3.1 8B Fast", value: "@cf/meta/llama-3.1-8b-instruct-fast" },
    { label: "Llama 3.1 8B FP8", value: "@cf/meta/llama-3.1-8b-instruct-fp8" },
    { label: "Llama 3.1 8B", value: "@cf/meta/llama-3.1-8b-instruct" },
    { label: "Llama 3.1 70B", value: "@cf/meta/llama-3.1-70b-instruct" },
    { label: "Qwen 3 30B", value: "@cf/qwen/qwen3-30b-a3b-fp8" },
    { label: "QwQ 32B", value: "@cf/qwen/qwq-32b" },
    { label: "Qwen 2.5 Coder 32B", value: "@cf/qwen/qwen2.5-coder-32b-instruct" },
    { label: "DeepSeek R1 Qwen 32B", value: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b" },
    { label: "Nemotron 3 120B", value: "@cf/nvidia/nemotron-3-120b-a12b" },
    { label: "Gemma 4 26B", value: "@cf/google/gemma-4-26b-a4b-it" },
    { label: "Gemma 3 12B", value: "@cf/google/gemma-3-12b-it" },
    { label: "SEA-LION V4 27B", value: "@cf/aisingapore/gemma-sea-lion-v4-27b-it" },
    { label: "Granite 4 Micro", value: "@cf/ibm-granite/granite-4.0-h-micro" },
    { label: "Mistral Small 3.1 24B", value: "@cf/mistralai/mistral-small-3.1-24b-instruct" },
    { label: "Mistral 7B", value: "@cf/mistral/mistral-7b-instruct-v0.1" },
    { label: "GPT-5.2 Alias", value: "gpt-5.2" },
    { label: "GPT-5.5 Alias", value: "gpt-5.5" },
] as const;

export const SWISHAI_MODEL_OPTIONS = [
    { label: "GPT-5.5", value: "gpt-5.5" },
    { label: "Claude Opus 4.8", value: "claude-opus-4.8" },
    { label: "Claude Opus 4.7", value: "claude-opus-4.7" },
    { label: "Claude Opus 4.8 [1M]", value: "claude-opus-4.8[1m]" },
    { label: "DeepSeek V4 Pro", value: "deepseek-v4-pro" },
    { label: "Claude DeepSeek V4 Pro", value: "claude-deepseek-v4-pro" },
    { label: "DeepSeek V4 Flash", value: "deepseek-v4-flash" },
    { label: "Claude DeepSeek V4 Flash", value: "claude-deepseek-v4-flash" },
    { label: "Nemotron Mini Vision", value: "nemotron-mini" },
    { label: "Claude Nemotron Mini", value: "claude-nemotron-mini" },
    { label: "Nemotron 3 Ultra Free", value: "nvidia/nemotron-3-ultra-550b-a55b:free" },
    { label: "Claude Nemotron 3 Ultra", value: "claude-nemotron-3-ultra-550b-a55b-free" },
    { label: "Claude Fable 5", value: "claude-fable-5" },
    { label: "Claude Fable 5 [1M]", value: "claude-fable-5[1m]" },
] as const;

export const SURF_MODEL_OPTIONS = [
    { label: "Claude Opus 4.8", value: "gateway-claude-opus-4-8" },
    { label: "Claude Opus 4.7", value: "gateway-claude-opus-4-7" },
    { label: "Claude Opus 4.6", value: "gateway-claude-opus-4-6" },
    { label: "Claude Opus 4.5", value: "gateway-claude-opus-4-5" },
    { label: "Claude Opus 4.1", value: "gateway-claude-opus-4-1" },
    { label: "Claude Sonnet 4.6", value: "gateway-claude-sonnet-4-6" },
    { label: "Claude Sonnet 4", value: "gateway-claude-sonnet-4" },
    { label: "GPT-5", value: "gateway-gpt-5" },
    { label: "GPT-5.5", value: "gateway-gpt-5-5" },
    { label: "GPT-5.4", value: "gateway-gpt-5-4" },
    { label: "GPT-5.3", value: "gateway-gpt-5-3" },
    { label: "GPT-5.1", value: "gateway-gpt-5-1" },
    { label: "GPT-5 Mini", value: "gateway-gpt-5-mini" },
    { label: "GPT-5 Nano", value: "gateway-gpt-5-nano" },
    { label: "GPT-5 Online", value: "gateway-gpt-5-online" },
    { label: "GPT-4o", value: "gateway-gpt-4o" },
    { label: "GPT-4.1 Mini", value: "gateway-gpt-4-1-mini" },
    { label: "GPT-4.1 Nano", value: "gateway-gpt-4-1-nano" },
    { label: "o3", value: "gateway-gpt-o3" },
    { label: "o3 Mini", value: "gateway-gpt-o3-mini" },
    { label: "o4-mini", value: "gateway-gpt-o4-mini" },
    { label: "Gemini 3.1 Pro", value: "gateway-gemini-3-1-pro" },
    { label: "Gemini 3 Pro", value: "gateway-gemini-3-pro" },
    { label: "Gemini 2.5 Pro", value: "gateway-google-2.5-pro" },
    { label: "Gemini 2.5 Flash", value: "gateway-gemini-2.5-flash" },
    { label: "DeepSeek V4 Pro", value: "gateway-deepseek-v4-pro" },
    { label: "DeepSeek V4 Flash", value: "gateway-deepseek-v4-flash" },
    { label: "DeepSeek R1", value: "gateway-deepseek-r1" },
    { label: "DeepSeek V3", value: "gateway-deepseek-v3" },
    { label: "Grok 4", value: "gateway-grok-4" },
    { label: "Qwen 3 Max", value: "gateway-qwen-3-max" },
    { label: "Qwen QwQ 32B", value: "gateway-qwen-qwq-32b" },
    { label: "Kimi K2", value: "gateway-deepinfra-kimi-k2" },
    { label: "Llama 3.3 70B", value: "gateway-llama-3-3-70b-versatile" },
] as const;

export type Provider = typeof PROVIDER_OPTIONS[number]["value"];
export type LocalProvider = typeof LOCAL_PROVIDER_OPTIONS[number]["value"];

export interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string | any[];
}

export interface TestcordChatOptions {
    messages: ChatMessage[];
    provider?: LocalProvider | string;
    groqModel?: string;
    homelanderModel?: string;
    swishAiModel?: string;
    surfModel?: string;
    temperature?: number;
    maxTokens?: number;
    forceModel?: string;
}

interface TestcordAISettings {
    provider?: Provider;
    model?: string;
    homelanderModel?: string;
    swishAiModel?: string;
    surfModel?: string;
    temperature?: number;
}

const SURF_API_KEY = "ua_girJGpKJqAgm_HsoezVO5TZKJJQu8Q4b";

function extractContentFromChunk(json: string): string {
    try {
        const obj = JSON.parse(json);
        if (typeof obj.delta === "string") return obj.delta;
        return obj.choices?.[0]?.delta?.content
            ?? obj.choices?.[0]?.message?.content
            ?? obj.content
            ?? obj.message?.content
            ?? obj.response
            ?? "";
    } catch {
        return "";
    }
}

function parseSSEChunks(text: string): string {
    let result = "";
    for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (trimmed === "[DONE]") break;
        if (trimmed.startsWith("data:")) {
            result += extractContentFromChunk(trimmed.slice(5).trim());
        } else if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
            result += extractContentFromChunk(trimmed);
        }
    }
    return result;
}

export async function readProviderResponse(res: Response): Promise<string> {
    const text = await res.text();
    const content = parseSSEChunks(text);
    if (content) return content;
    try {
        const data = JSON.parse(text);
        return data.response ?? data.content ?? data.message ?? data.choices?.[0]?.message?.content?.trim() ?? text;
    } catch {
        return text || "(empty response)";
    }
}

function toTextHistory(messages: ChatMessage[]): string {
    return messages.map(m => `${m.role === "assistant" ? "Assistant" : m.role === "system" ? "System" : "User"}: ${typeof m.content === "string" ? m.content : JSON.stringify(m.content)}`).join("\n");
}

function splitSystem(messages: ChatMessage[]) {
    const system = messages.find(m => m.role === "system")?.content;
    return {
        systemPrompt: typeof system === "string" ? system : "You are a helpful assistant.",
        chatMessages: messages.filter(m => m.role !== "system"),
    };
}

async function surfChat(messages: ChatMessage[], model: string, temperature?: number): Promise<string> {
    const { systemPrompt, chatMessages } = splitSystem(messages);
    const res = await groqFetch("https://unlimited.surf/api/chat", "POST", {
        Authorization: `Bearer ${SURF_API_KEY}`,
        "Content-Type": "application/json",
    }, JSON.stringify({
        message: `System instructions: ${systemPrompt}\n\nConversation:\n${toTextHistory(chatMessages)}`,
        model,
        effort: (temperature ?? 0.7) < 0.3 ? "high" : (temperature ?? 0.7) < 0.7 ? "medium" : "low",
    }));

    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Unlimited Surf API ${res.status}: ${body.slice(0, 200)}`);
    }

    return readProviderResponse(res);
}

async function openaiChat(baseUrl: string, model: string, apiKey: string, messages: ChatMessage[], temperature?: number, maxTokens?: number): Promise<string> {
    const res = await groqFetch(`${baseUrl}/v1/chat/completions`, "POST", {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
    }, JSON.stringify({
        model,
        temperature,
        max_tokens: maxTokens ?? 1000,
        messages,
    }));

    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`${baseUrl} ${res.status}: ${body.slice(0, 200)}`);
    }

    return readProviderResponse(res);
}

export function resolveProviderOptions(opts: TestcordChatOptions): { provider: string; homelanderModel: string; swishAiModel: string; surfModel: string; groqModel?: string; temperature?: number; } {
    const testcord = Settings.plugins.TestcordAI as TestcordAISettings | undefined;
    const useTestcord = !opts.provider || opts.provider === "testcord";
    return {
        provider: useTestcord ? testcord?.provider ?? "groq" : opts.provider ?? "groq",
        groqModel: useTestcord ? testcord?.model : opts.groqModel,
        homelanderModel: useTestcord ? testcord?.homelanderModel ?? "openai/gpt-5.5" : opts.homelanderModel ?? "openai/gpt-5.5",
        swishAiModel: useTestcord ? testcord?.swishAiModel ?? "gpt-5.5" : opts.swishAiModel ?? "gpt-5.5",
        surfModel: useTestcord ? testcord?.surfModel ?? "gateway-claude-opus-4-7" : opts.surfModel ?? "gateway-claude-opus-4-7",
        temperature: opts.temperature ?? (useTestcord ? testcord?.temperature : undefined),
    };
}

export async function testcordChat(opts: TestcordChatOptions): Promise<string> {
    const resolved = resolveProviderOptions(opts);
    const temperature = resolved.temperature ?? 0.7;

    if (resolved.provider === "homelander") {
        return openaiChat("https://homelander.ca", resolved.homelanderModel, "anything", opts.messages, temperature, opts.maxTokens);
    }

    if (resolved.provider === "swishai") {
        return openaiChat("https://swishai.up.railway.app", resolved.swishAiModel, "swishai", opts.messages, temperature, opts.maxTokens);
    }

    if (resolved.provider === "unlimited-surf") {
        return surfChat(opts.messages, resolved.surfModel, temperature);
    }

    if (resolved.provider === "gpt55-proxy") {
        return openaiChat("https://theproxy-production-e112.up.railway.app", "gpt-5.5", "admin", opts.messages, temperature, opts.maxTokens);
    }

    return groqChat({
        messages: opts.messages,
        temperature,
        maxTokens: opts.maxTokens,
        forceModel: opts.forceModel ?? (resolved.groqModel?.trim() || undefined),
    });
}

export function effectiveProviderRequiresGroqKey(provider?: string): boolean {
    return resolveProviderOptions({ messages: [], provider }).provider === "groq";
}
