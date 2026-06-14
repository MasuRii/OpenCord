#!/usr/bin/env node
/*
 * OpenCord, a Discord client mod
 * Copyright (c) 2026 OpenCord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
/*
 * RED validation checks for OpenCord release asset naming, plugin-sync schedule,
 * and README plugin-count wording.
 *
 * These checks are intentionally static: they read source/configuration files
 * only and do not perform network calls or execute installer binaries.
 *
 * Expected state after the requested fixes:
 *   - README.md refers to "plugin source folders" instead of implying all source
 *     folders are user-visible injected plugins.
 *   - README.md, misc/install.sh, and scripts/runInstaller.mjs use OpenCord-branded
 *     installer asset names while keeping Equilotl credit.
 *   - .github/workflows/build.yml publishes OpenCord-branded installer artifacts.
 *   - .github/workflows/plugin-sync.yml runs daily at 06:00 UTC.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const failures = [];
const passes = [];

function readProjectFile(relativePath) {
    return readFileSync(path.join(root, relativePath), "utf8");
}

function fail(message) {
    return { pass: false, message };
}

function pass() {
    return { pass: true };
}

function check(name, assertion) {
    try {
        const result = assertion();
        if (result?.pass) {
            passes.push(name);
        } else {
            failures.push({ name, message: result?.message ?? "check returned a failing result" });
        }
    } catch (error) {
        failures.push({
            name,
            message: error instanceof Error ? error.stack ?? error.message : String(error),
        });
    }
}

const readme = readProjectFile("README.md");
const buildYml = readProjectFile(".github/workflows/build.yml");
const pluginSyncYml = readProjectFile(".github/workflows/plugin-sync.yml");
const installSh = readProjectFile("misc/install.sh");
const runInstaller = readProjectFile("scripts/runInstaller.mjs");
const updateReadmeMetrics = readProjectFile("scripts/updateReadmeMetrics.mjs");
const patchBranding = readProjectFile("scripts/patchEquilotlBranding.mjs");

function extractWorkflowJob(yaml, jobName) {
    const lines = yaml.split(/\r?\n/);
    const startIndex = lines.findIndex(line => line.trim() === `${jobName}:`);
    if (startIndex === -1) return "";

    const baseIndent = lines[startIndex].match(/^(\s*)/)[1].length;
    const endIndex = lines.findIndex((line, idx) => {
        if (idx <= startIndex || !line.trim()) return false;
        const indent = line.match(/^(\s*)/)[1].length;
        return indent <= baseIndent && /^[A-Za-z_][A-Za-z0-9_]*:/.test(line.trim());
    });

    return lines.slice(startIndex, endIndex === -1 ? undefined : endIndex).join("\n");
}

const opencordInstallerAssets = {
    windowsGui: "OpenCordInstaller.exe",
    windowsCli: "OpenCordInstallerCli.exe",
    linuxGui: "OpenCord-x11",
    linuxCli: "OpenCordCli-linux",
    darwinX64Zip: "OpenCord-darwin-x64.zip",
    darwinArm64Zip: "OpenCord-darwin-arm64.zip",
    darwinX64Cli: "OpenCordCli-darwin-x64",
    darwinArm64Cli: "OpenCordCli-darwin-arm64",
};

function hasReleaseLink(fileContents, assetName) {
    return fileContents.includes(` releases/latest/download/${assetName}`)
        || fileContents.includes(`/${assetName}`);
}

// ---------------------------------------------------------------------------
// README plugin-count wording
// ---------------------------------------------------------------------------

check("README tagline calls plugin folders 'source folders'", () => {
    const taglineMatch = readme.match(/focused on a massive cross-community plugin catalog with \d+ plugin[^.]*\./);
    if (!taglineMatch) {
        return fail("could not locate tagline plugin-count sentence");
    }

    if (!/\d+ plugin source folders\./.test(taglineMatch[0])) {
        return fail(`tagline currently reads: ${JSON.stringify(taglineMatch[0])}; expected it to include "plugin source folders"`);
    }

    return pass();
});

check("README feature table calls plugin folders 'source folders'", () => {
    const rowMatch = readme.match(/\| \d+ plugin[^|]* \| Combines/);
    if (!rowMatch) {
        return fail("could not locate feature table plugin-count row");
    }

    if (!/\| \d+ plugin source folders \|/.test(rowMatch[0])) {
        return fail(`feature table row currently reads: ${JSON.stringify(rowMatch[0])}; expected "plugin source folders"`);
    }

    return pass();
});

// ---------------------------------------------------------------------------
// Release asset naming in README
// ---------------------------------------------------------------------------

check("README Windows GUI installer link is OpenCord-branded", () => {
    if (/Equilotl\.exe/i.test(readme)) {
        return fail("README still links to legacy Equilotl.exe installer");
    }
    if (!readme.includes(`releases/latest/download/${opencordInstallerAssets.windowsGui}`)) {
        return fail(`README does not link to ${opencordInstallerAssets.windowsGui}`);
    }
    return pass();
});

check("README Windows CLI installer link is OpenCord-branded", () => {
    if (/EquilotlCli\.exe/i.test(readme)) {
        return fail("README still links to legacy EquilotlCli.exe installer");
    }
    if (!readme.includes(`releases/latest/download/${opencordInstallerAssets.windowsCli}`)) {
        return fail(`README does not link to ${opencordInstallerAssets.windowsCli}`);
    }
    return pass();
});

check("README macOS x64 installer link is OpenCord-branded", () => {
    if (/Equilotl-darwin-x64\.zip/i.test(readme)) {
        return fail("README still links to legacy Equilotl-darwin-x64.zip installer");
    }
    if (!readme.includes(`releases/latest/download/${opencordInstallerAssets.darwinX64Zip}`)) {
        return fail(`README does not link to ${opencordInstallerAssets.darwinX64Zip}`);
    }
    return pass();
});

check("README macOS arm64 installer link is OpenCord-branded", () => {
    if (/Equilotl-darwin-arm64\.zip/i.test(readme)) {
        return fail("README still links to legacy Equilotl-darwin-arm64.zip installer");
    }
    if (!readme.includes(`releases/latest/download/${opencordInstallerAssets.darwinArm64Zip}`)) {
        return fail(`README does not link to ${opencordInstallerAssets.darwinArm64Zip}`);
    }
    return pass();
});

check("README Linux GUI installer link is OpenCord-branded", () => {
    if (/Equilotl-x11/i.test(readme)) {
        return fail("README still links to legacy Equilotl-x11 installer");
    }
    if (!readme.includes(`releases/latest/download/${opencordInstallerAssets.linuxGui}`)) {
        return fail(`README does not link to ${opencordInstallerAssets.linuxGui}`);
    }
    return pass();
});

check("README Linux CLI installer link is OpenCord-branded", () => {
    if (/EquilotlCli-linux/i.test(readme)) {
        return fail("README still links to legacy EquilotlCli-linux installer");
    }
    if (!readme.includes(`releases/latest/download/${opencordInstallerAssets.linuxCli}`)) {
        return fail(`README does not link to ${opencordInstallerAssets.linuxCli}`);
    }
    return pass();
});

// ---------------------------------------------------------------------------
// Equilotl credit retention
// ---------------------------------------------------------------------------

check("README retains Equilotl installer credit", () => {
    const installSection = readme.split("## Installing / Uninstalling")[1]?.split("\n## ")[0] ?? "";
    const creditNote = installSection.match(/Equilotl/i);
    const creditWording = installSection.match(/desktop installer backend/i);

    if (!creditNote || !creditWording) {
        return fail("README installer section must keep a credit note acknowledging Equilotl as the desktop installer backend");
    }

    return pass();
});

// ---------------------------------------------------------------------------
// Local installer scripts
// ---------------------------------------------------------------------------

check("misc/install.sh uses OpenCord-branded installer asset name", () => {
    if (/Equilotl/i.test(installSh)) {
        return fail("install.sh still references legacy Equilotl names");
    }
    if (!installSh.includes(opencordInstallerAssets.linuxCli)) {
        return fail(`install.sh does not reference ${opencordInstallerAssets.linuxCli}`);
    }
    return pass();
});

check("scripts/runInstaller.mjs uses OpenCord-branded installer asset names", () => {
    if (/Equilotl/i.test(runInstaller)) {
        return fail("scripts/runInstaller.mjs still references legacy Equilotl names");
    }

    for (const [label, assetName] of Object.entries({
        "Windows CLI": opencordInstallerAssets.windowsCli,
        "Linux CLI": opencordInstallerAssets.linuxCli,
        "macOS x64 zip": opencordInstallerAssets.darwinX64Zip,
        "macOS arm64 zip": opencordInstallerAssets.darwinArm64Zip,
    })) {
        if (!runInstaller.includes(assetName)) {
            return fail(`scripts/runInstaller.mjs does not reference ${label} asset ${assetName}`);
        }
    }

    return pass();
});

check("scripts/runInstaller.mjs extracts an OpenCord-branded macOS app bundle", () => {
    if (/Equilotl\.app/i.test(runInstaller)) {
        return fail("scripts/runInstaller.mjs still extracts legacy Equilotl.app bundle");
    }
    if (!runInstaller.includes("OpenCordInstaller.app")) {
        return fail("scripts/runInstaller.mjs must reference OpenCordInstaller.app for macOS");
    }
    return pass();
});

check("misc/install.sh passes OpenCord-branded environment variables to the installer", () => {
    if (/OPENCORD_USER_DATA_DIR/.test(installSh) && /OPENCORD_DIRECTORY/.test(installSh) && /OPENCORD_DEV_INSTALL/.test(installSh)) {
        return pass();
    }
    return fail("install.sh must set OPENCORD_USER_DATA_DIR, OPENCORD_DIRECTORY, and OPENCORD_DEV_INSTALL for the patched OpenCord installer");
});

check("scripts/patchEquilotlBranding.mjs renames installer environment variables", () => {
    if (/"EQUICORD_USER_DATA_DIR":\s*"OPENCORD_USER_DATA_DIR"/.test(patchBranding)
        && /"EQUICORD_DIRECTORY":\s*"OPENCORD_DIRECTORY"/.test(patchBranding)
        && /"EQUICORD_DEV_INSTALL":\s*"OPENCORD_DEV_INSTALL"/.test(patchBranding)) {
        return pass();
    }
    return fail("patch script does not remap EQUICORD_* installer environment variables to OPENCORD_*");
});

check("scripts/patchEquilotlBranding.mjs renames on-disk Equicord paths to OpenCord", () => {
    if (/"equicord\.asar":\s*"opencord\.asar"/.test(patchBranding)
        && /'appdir\.New\("Equicord"\)':\s*'appdir\.New\("OpenCord"\)'/.test(patchBranding)
        && /"EquicordData":\s*"OpenCordData"/.test(patchBranding)) {
        return pass();
    }
    return fail("patch script does not rebrand Equicord on-disk paths (asar, appdir, data dir) to OpenCord");
});

check("scripts/patchEquilotlBranding.mjs updates the asar version-detection regex", () => {
    if (patchBranding.includes('`// OpenCord (\\\\w+)`')) {
        return pass();
    }
    return fail("patch script does not update the asar header regex from Equicord to OpenCord");
});

check("scripts/patchEquilotlBranding.mjs preserves upstream Equicord credit", () => {
    // A generic Equicord -> OpenCord replacement would wipe the upstream copyright
    // notices and user-facing credit that the task requires us to keep.
    if (/["']Equicord["']\s*:\s*["']OpenCord["']/.test(patchBranding)) {
        return fail("patch script has a generic Equicord -> OpenCord replacement that would remove upstream credit");
    }
    return pass();
});

check("CI release workflow publishes a latest.json installer fallback", () => {
    if (!buildYml.includes("latest.json")) {
        return fail("build.yml does not reference latest.json");
    }
    if (!/Upload latest\.json installer fallback/.test(buildYml)) {
        return fail("build.yml does not upload latest.json to the release");
    }
    return pass();
});

// ---------------------------------------------------------------------------
// CI release asset naming
// ---------------------------------------------------------------------------

check("CI Windows build outputs OpenCord-branded installer executables", () => {
    const windowsJob = extractWorkflowJob(buildYml, "InstallerWindows");
    if (!windowsJob) {
        return fail("could not locate InstallerWindows job");
    }

    if (/Equilotl\.exe/i.test(windowsJob) || /EquilotlCli\.exe/i.test(windowsJob)) {
        return fail("Windows job still produces Equilotl.exe / EquilotlCli.exe");
    }
    if (!windowsJob.includes(opencordInstallerAssets.windowsGui) || !windowsJob.includes(opencordInstallerAssets.windowsCli)) {
        return fail(`Windows job must build ${opencordInstallerAssets.windowsGui} and ${opencordInstallerAssets.windowsCli}`);
    }

    return pass();
});

check("CI Linux build outputs OpenCord-branded installer binaries", () => {
    const linuxJob = extractWorkflowJob(buildYml, "InstallerLinux");
    if (!linuxJob) {
        return fail("could not locate InstallerLinux job");
    }

    if (/Equilotl-x11/i.test(linuxJob) || /EquilotlCli-linux/i.test(linuxJob)) {
        return fail("Linux job still produces Equilotl-x11 / EquilotlCli-linux");
    }
    if (!linuxJob.includes(opencordInstallerAssets.linuxGui) || !linuxJob.includes(opencordInstallerAssets.linuxCli)) {
        return fail(`Linux job must build ${opencordInstallerAssets.linuxGui} and ${opencordInstallerAssets.linuxCli}`);
    }

    return pass();
});

check("CI macOS build outputs OpenCord-branded installer archives and CLI binaries", () => {
    const macJob = extractWorkflowJob(buildYml, "InstallerMac");
    if (!macJob) {
        return fail("could not locate InstallerMac job");
    }

    if (
        /Equilotl-darwin-x64\.zip/i.test(macJob) ||
        /Equilotl-darwin-arm64\.zip/i.test(macJob) ||
        /EquilotlCli-darwin/i.test(macJob)
    ) {
        return fail("macOS job still produces Equilotl-darwin-* archives or EquilotlCli-darwin binaries");
    }

    for (const assetName of [
        opencordInstallerAssets.darwinX64Zip,
        opencordInstallerAssets.darwinArm64Zip,
        opencordInstallerAssets.darwinX64Cli,
        opencordInstallerAssets.darwinArm64Cli,
    ]) {
        if (!macJob.includes(assetName)) {
            return fail(`macOS job must build ${assetName}`);
        }
    }

    return pass();
});

// ---------------------------------------------------------------------------
// Visible in-app plugin metric
// ---------------------------------------------------------------------------

function readmeVisibleMetric() {
    return readme.match(/\b(\d+)\+?\s+visible plugins?\b/i);
}

function readmeSourceFolderMetric() {
    return readme.match(/with\s+(\d+)\+?\s+plugin source folders?\./i)
        ?? readme.match(/\|\s+(\d+)\+?\s+plugin source folders?\s+\|/);
}

check("README includes a visible in-app plugin metric", () => {
    const match = readmeVisibleMetric();
    if (!match) {
        return fail("README is missing a 'visible plugin(s)' metric that reflects the in-app count shown to users");
    }

    const count = Number(match[1]);
    if (count < 500) {
        return fail(`README visible plugin count ${count} appears too low to be a credible in-app metric`);
    }

    return pass();
});

check("README visible plugin count reflects desktop semantics, not the web-only count", () => {
    const match = readmeVisibleMetric();
    if (!match) {
        return fail("cannot check desktop visible count because README has no visible plugin metric");
    }

    const count = Number(match[1]);
    if (count === 758 || count < 779) {
        return fail(`README visible plugin count ${count} is below the desktop-visible range and may be the accidental web-build count`);
    }

    return pass();
});

check("README visible plugin count is not larger than the source folder count", () => {
    const visibleMatch = readmeVisibleMetric();
    const sourceMatch = readmeSourceFolderMetric();

    if (!visibleMatch) {
        return fail("cannot compare visible count because README has no visible plugin metric");
    }
    if (!sourceMatch) {
        return fail("cannot compare because README source folder metric is missing");
    }

    const visible = Number(visibleMatch[1]);
    const source = Number(sourceMatch[1]);

    if (visible > source) {
        return fail(`README claims ${visible} visible plugins, which is larger than the ${source} source folders`);
    }

    return pass();
});

check("updateReadmeMetrics.mjs computes and logs a visible plugin count", () => {
    const hasVisibleIdentifier = /\bvisiblePlugins?\b/i.test(updateReadmeMetrics);
    const logsVisibleCount = /console\.log\s*\(\s*[`"'][^`"']*?\bvisible plugins?\b/i.test(updateReadmeMetrics);

    if (!hasVisibleIdentifier) {
        return fail("scripts/updateReadmeMetrics.mjs does not declare a visible plugin count");
    }
    if (!logsVisibleCount) {
        return fail("scripts/updateReadmeMetrics.mjs does not log a visible plugin count");
    }

    return pass();
});

check("updateReadmeMetrics.mjs uses top-level plugin metadata for visible filtering", () => {
    if (!/function getPluginMetadata\b/.test(updateReadmeMetrics) || !/ts\.isCallExpression/.test(updateReadmeMetrics)) {
        return fail("visible metric should inspect the definePlugin object instead of scanning raw source text");
    }
    if (!/propertyName === "hidden"/.test(updateReadmeMetrics) || !/propertyName === "required"/.test(updateReadmeMetrics)) {
        return fail("visible metric must inspect top-level hidden and required plugin properties");
    }
    if (/new RegExp\s*\(\s*`\\\\b\$\{property\}\\\\s\*:/.test(updateReadmeMetrics)) {
        return fail("visible metric appears to use the old broad boolean-property regex that matched nested hidden settings");
    }

    return pass();
});

check("updateReadmeMetrics.mjs updates a README visible-plugin metric", () => {
    const updatesReadmeVisible = /replaceOne\s*\(\s*[\s\S]*?visible plugins?/i.test(updateReadmeMetrics)
        || /replaceOne\s*\([^)]*visible/i.test(updateReadmeMetrics);

    if (!updatesReadmeVisible) {
        return fail("scripts/updateReadmeMetrics.mjs does not automate updates of a README 'visible plugins' metric");
    }

    return pass();
});

// ---------------------------------------------------------------------------
// Plugin sync schedule
// ---------------------------------------------------------------------------

check("Plugin sync workflow runs daily", () => {
    const cronMatch = pluginSyncYml.match(/- cron:\s*"([^"]+)"/);
    if (!cronMatch) {
        return fail("could not locate plugin-sync cron schedule");
    }

    const cron = cronMatch[1].trim();
    if (cron !== "0 6 * * *") {
        return fail(`plugin-sync cron is ${JSON.stringify(cron)}; expected "0 6 * * *" for a daily 06:00 UTC run`);
    }

    return pass();
});

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

if (failures.length) {
    console.error("Release/sync/plugin-count RED tests failed:");
    for (const { name, message } of failures) {
        console.error(`\n[FAIL] ${name}\n${message.split("\n").map(line => `  ${line}`).join("\n")}`);
    }
    console.error(`\n${passes.length} passed, ${failures.length} failed.`);
    process.exit(1);
}

console.log(`Release/sync/plugin-count RED tests passed: ${passes.length} checks.`);
