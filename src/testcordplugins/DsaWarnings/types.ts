/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface CordCatUserInfo {
    id: string;
    username?: string;
    global_name?: string;
    discriminator?: string;
    avatar?: string;
    banner?: string;
    public_flags?: number;
    accent_color?: number | null;
    clan?: CordCatGuildIdentity | null;
    primary_guild?: CordCatGuildIdentity | null;
}

export interface CordCatGuildIdentity {
    tag: string;
    identity_guild_id: string;
    identity_enabled: boolean;
}

export interface DsaAction {
    uuid: string;
    parsedId: string;
    decisionVisibility: string | string[] | null;
    endDateVisibilityRestriction: string | null;
    decisionMonetary: string | null;
    endDateMonetaryRestriction: string | null;
    decisionProvision: string | null;
    endDateServiceRestriction: string | null;
    decisionAccount: string | null;
    endDateAccountRestriction: string | null;
    decisionGround: string;
    incompatibleContentGround: string;
    incompatibleContentExplanation: string;
    incompatibleContentIllegal: string | boolean | null;
    category: string;
    categorySpecification: string | string[] | null;
    categorySpecificationOther: string | null;
    contentType: string | string[];
    applicationDate: string;
    decisionFacts: string;
    automatedDetection: string | boolean;
    sourceType: string;
    createdAt: string;
}

export interface BreachRecord {
    source: string;
    categories?: string[];
    id?: string;
    no?: string;
    discordid?: string;
    username?: string;
    discordname?: string;
    discriminator?: string;
    tag?: string;
    ip?: string;
    date?: string;
}

export interface BreachError {
    status: number | string;
    message: string;
}

export type DsaLookupResult =
    | {
        kind: "ready";
        userInfo: CordCatUserInfo | null;
        actions: DsaAction[];
        breaches: BreachRecord[];
        breachStatus: "ready" | "error" | "unavailable";
        breachError: string | null;
        breachCount: number;
    }
    | { kind: "unavailable"; error?: string; }
    | { kind: "error"; error?: string; };

export interface NativeCordCatResultOk {
    ok: true;
    status: number;
    body: string;
}

export interface NativeCordCatResultError {
    ok: false;
    error: string;
}

export type NativeCordCatResult = NativeCordCatResultOk | NativeCordCatResultError;
