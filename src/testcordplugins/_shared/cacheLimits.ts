/*
 * TestCord compatibility helpers for imported plugins.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

let cacheLimitsDisabled = false;

export function disableCacheLimits() {
    cacheLimitsDisabled = true;
}

export function resetCacheLimits() {
    cacheLimitsDisabled = false;
}

export function areCacheLimitsDisabled() {
    return cacheLimitsDisabled;
}
