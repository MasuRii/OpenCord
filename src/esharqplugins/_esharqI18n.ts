import { Settings } from "@api/Settings";

export function isArabicMode() {
    return Boolean(Settings.plugins.Settings?.arabicMode);
}

export function t(arabic: string, english = arabic) {
    return isArabicMode() ? arabic : english;
}
