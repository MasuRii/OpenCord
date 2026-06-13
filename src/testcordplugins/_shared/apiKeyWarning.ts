/*
 * TestCord compatibility helpers for imported plugins.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { showToast, Toasts } from "@webpack/common";

export function showApiKeyWarning(pluginName: string) {
    showToast(`${pluginName} requires an API key before it can run.`, Toasts.Type.FAILURE);
}
