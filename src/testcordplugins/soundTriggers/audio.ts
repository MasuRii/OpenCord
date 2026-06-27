/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";

import { settings, SoundTrigger } from "./index";

type SoundTriggerMatch = SoundTrigger & {
    index: number;
};

let cachedTriggers: { regex: RegExp; trigger: SoundTrigger; }[] = [];
let lastTriggersStr = "";

export const findAndPlayTriggers = async (message: string) => {
    const triggersStr = JSON.stringify(settings.store.soundTriggers);
    if (triggersStr !== lastTriggersStr) {
        lastTriggersStr = triggersStr;
        cachedTriggers = (settings.store.soundTriggers as SoundTrigger[]).map(trigger => ({
            regex: new RegExp(trigger.patterns.join("|"), trigger.caseSensitive ? "g" : "gi"),
            trigger
        }));
    }

    const triggers = cachedTriggers
        .flatMap(({ regex, trigger }) => {
            regex.lastIndex = 0;
            return [...message.matchAll(regex)].map(m => ({ ...trigger, index: m.index }));
        })
        .filter((t): t is SoundTriggerMatch => t.index !== undefined)
        .toSorted((t, u) => t.index - u.index);

    try {
        for (const trigger of triggers) {
            await playTrigger(trigger);
        }
    } catch (e) {
        new Logger("SoundTrigger").error(e);
    }
};

const playTrigger = async (trigger: SoundTrigger): Promise<void> => {
    return new Promise((resolve, reject) => {
        const audio = document.createElement("audio");
        audio.src = trigger.sound;
        audio.volume = trigger.volume;
        audio.onended = () => resolve();
        audio.onerror = () => reject();
        audio.play();
    });
};
