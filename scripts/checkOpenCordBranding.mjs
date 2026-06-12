/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { existsSync, readFileSync, readdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const readme = readFileSync(join(root, "README.md"), "utf8");
const readmeCredits = readme.split("## Credits")[1]?.split("\n## ")[0] ?? "";
const readmeDisclaimer = readme.split("## Disclaimer")[1]?.split("\n## ")[0] ?? "";
const about = readFileSync(join(root, "src", "main", "about.html"), "utf8");
const aboutAcknowledgements = about.split("<h2>Acknowledgements</h2>")[1]?.split("</section>")[0] ?? "";
const supportHelper = readFileSync(join(root, "src", "plugins", "_core", "supportHelper.tsx"), "utf8");
const trustedRolesBlock = supportHelper.split("const TrustedRolesIds = [")[1]?.split("];", 1)[0] ?? "";
const discordDevBannerConsts = readFileSync(join(root, "src", "equicordplugins", "discordDevBanner", "components", "consts.ts"), "utf8");
const agentGuidanceFiles = ["AGENTS.md", "CLAUDE.md", "GEMINI.md"];
const agentGuidanceDocs = Object.fromEntries(agentGuidanceFiles.map(relativePath => [
    relativePath,
    readFileSync(join(root, relativePath), "utf8"),
]));
const agents = agentGuidanceDocs["AGENTS.md"];
const constants = readFileSync(join(root, "src", "utils", "constants.ts"), "utf8");
const vencordPluginRoot = join(root, "src", "plugins");
const equicordPluginRoot = join(root, "src", "equicordplugins");
const opencordPluginRoot = join(root, "src", "opencordplugins");
const canonicalOpenCordDarkSymbol = "assets/branding/opencord-symbol-dark.svg";
const canonicalOpenCordLightSymbol = "assets/branding/opencord-symbol-light.svg";
const browserOpenCordDarkSymbol = "browser/opencord-symbol-dark.svg";
const canonicalOpenCordSymbolMarker = "opencord-symbol-dark.svg";
const legacyOpenCordSymbolMarker = "opencord-symbol.svg";
const legacyOpenCordSymbolArtifacts = [
    "assets/branding/opencord-symbol.svg",
    "assets/branding/opencord-symbol-candidate-01-open-orbit.svg",
    "assets/branding/opencord-symbol-candidate-02-unlocked-chat.svg",
    "assets/branding/opencord-symbol-candidate-03-chat-gate.svg",
    "assets/branding/opencord-symbol-candidate-04-open-node.svg",
    "assets/branding/opencord-symbol-candidate-05-open-bubble.svg",
    "assets/branding/opencord-symbol-candidates.md",
    "assets/branding/v2/opencord-symbol-candidates-v2.md",
    "assets/branding/v2/opencord-symbol-candidate-v2-01-halo-arc.svg",
    "assets/branding/v2/opencord-symbol-candidate-v2-02-open-beacon.svg",
    "assets/branding/v2/opencord-symbol-candidate-v2-03-prism-core.svg",
    "assets/branding/v2/opencord-symbol-candidate-v2-04-breach.svg",
    "assets/branding/v2/opencord-symbol-candidate-v2-05-dual-helix.svg",
    "assets/branding/v3/opencord-symbol-candidates-v3.md",
    "assets/branding/v3/opencord-symbol-candidate-v3-01-open-core.svg",
    "assets/branding/v3/opencord-symbol-candidate-v3-02-open-gate.svg",
    "assets/branding/v3/opencord-symbol-candidate-v3-03-open-path.svg",
    "assets/branding/v3/opencord-symbol-candidate-v3-04-open-sign.svg",
    "assets/branding/v3/opencord-symbol-candidate-v3-05-open-arc.svg",
    "browser/opencord-symbol.svg",
];

const failures = [];

function expectEqual(label, actual, expected) {
    if (actual !== expected) failures.push(`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
}

function expectIncludes(label, actual, expected) {
    if (!actual.includes(expected)) failures.push(`${label}: expected to include ${JSON.stringify(expected)}`);
}

function expectNotIncludes(label, actual, unexpected) {
    if (actual.includes(unexpected)) failures.push(`${label}: expected not to include ${JSON.stringify(unexpected)}`);
}

function expectFileNotIncludes(relativePath, label, unexpected) {
    const contents = readFileSync(join(root, relativePath), "utf8");
    expectNotIncludes(`${relativePath} ${label}`, contents, unexpected);
}

function expectPathExists(label, relativePath) {
    if (!existsSync(join(root, relativePath))) failures.push(`${label}: expected ${relativePath} to exist`);
}

function expectPathNotExists(label, relativePath) {
    if (existsSync(join(root, relativePath))) failures.push(`${label}: expected ${relativePath} not to exist`);
}

function expectFileIncludes(relativePath, label, expected) {
    const contents = readFileSync(join(root, relativePath), "utf8");
    expectIncludes(`${relativePath} ${label}`, contents, expected);
}

function expectAgentGuidanceIncludes(label, expected) {
    for (const [relativePath, contents] of Object.entries(agentGuidanceDocs)) {
        expectIncludes(`${relativePath} ${label}`, contents, expected);
    }
}

function expectAgentGuidanceNotIncludes(label, unexpected) {
    for (const [relativePath, contents] of Object.entries(agentGuidanceDocs)) {
        expectNotIncludes(`${relativePath} ${label}`, contents, unexpected);
    }
}

function expectSvgSymbolSplit(label, relativePath, expectedClass, unexpectedClass) {
    const path = join(root, relativePath);
    if (!existsSync(path)) return;

    const contents = readFileSync(path, "utf8");
    expectIncludes(`${label} SVG root`, contents, "<svg");
    expectIncludes(`${label} cropped production viewBox`, contents, "viewBox=\"0 0 500 500\"");
    expectNotIncludes(`${label} dark showcase label`, contents, "DARK MODE");
    expectNotIncludes(`${label} light showcase label`, contents, "LIGHT MODE");
    expectIncludes(`${label} expected split styling`, contents, expectedClass);
    expectNotIncludes(`${label} opposite split styling`, contents, unexpectedClass);
}

function expectNoLegacyVariableMismatch(label, contents) {
    const mismatches = contents
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => /^"\{equicord(?:Icon|Version|Hash|Platform)\} - .*OpenCord.*",?$/.test(line))
        .filter(line => !/legacy variable name/i.test(line));

    if (mismatches.length) {
        failures.push(`${label}: expected legacy {equicord*} variable descriptions not to describe OpenCord without legacy context (${mismatches.join("; ")})`);
    }
}

function expectPluginTree(label, path) {
    if (!existsSync(path)) {
        failures.push(`${label}: expected directory to exist`);
        return;
    }

    if (!readdirSync(path, { withFileTypes: true }).some(entry => entry.isDirectory())) {
        failures.push(`${label}: expected directory to contain plugin folders`);
    }
}

function readSourceTree(path) {
    if (!existsSync(path)) return "";

    let contents = "";
    for (const entry of readdirSync(path, { withFileTypes: true })) {
        const entryPath = join(path, entry.name);
        if (entry.isDirectory()) contents += readSourceTree(entryPath);
        else if (/\.[cm]?[jt]sx?$/.test(entry.name)) contents += readFileSync(entryPath, "utf8");
    }

    return contents;
}

expectEqual("package.json name", packageJson.name, "opencord");
expectEqual("package.json author", packageJson.author, "OpenCord");
expectEqual("package.json homepage", packageJson.homepage, "https://github.com/OpenCord/OpenCord#readme");
expectEqual("package.json bugs.url", packageJson.bugs?.url, "https://github.com/OpenCord/OpenCord/issues");
expectEqual("package.json repository.url", packageJson.repository?.url, "git+https://github.com/OpenCord/OpenCord.git");
expectIncludes("README primary heading", readme, "# [](https://github.com/OpenCord/OpenCord) OpenCord");
expectIncludes("README product description", readme, "OpenCord is a fork of [Vencord](https://github.com/Vendicated/Vencord)");
expectIncludes("README credits Equicord upstream acknowledgement", readmeCredits, "[Equicord](https://github.com/Equicord/Equicord)");
expectIncludes("README disclaimer dual upstream credit", readmeDisclaimer, "Vencord and Equicord are not connected to OpenCord");
expectIncludes("about acknowledgements Equicord upstream project", aboutAcknowledgements, "<a href=\"https://github.com/Equicord/Equicord\" target=\"_blank\">Equicord</a>");
expectIncludes("about Suncord historical Equicord merge wording", aboutAcknowledgements, "merged into Equicord");
expectIncludes("supportHelper OpenCord team Discord role provenance", trustedRolesBlock, "OPENCORD_TEAM, // Equicord Team (Discord role)");
expectIncludes("supportHelper donor Discord role provenance", trustedRolesBlock, "DONOR_ROLE_ID, // Equicord Donor (Discord role)");
expectIncludes("supportHelper contributor Discord role provenance", trustedRolesBlock, "CONTRIB_ROLE_ID, // Equicord Contributor (Discord role)");
expectNoLegacyVariableMismatch("discordDevBanner OpenCord description for legacy Equicord variables", discordDevBannerConsts);

expectPluginTree("src/plugins Vencord-origin plugin tree", vencordPluginRoot);
expectPluginTree("src/equicordplugins Equicord-origin plugin tree", equicordPluginRoot);
expectPluginTree("src/opencordplugins OpenCord-origin plugin tree", opencordPluginRoot);
expectPathExists("aiTranslate.desktop OpenCord namespace", "src/opencordplugins/aiTranslate.desktop");
expectPathNotExists("aiTranslate.desktop legacy Equicord namespace", "src/equicordplugins/aiTranslate.desktop");

const pluginSources = readSourceTree(vencordPluginRoot);
const equicordPluginSources = readSourceTree(equicordPluginRoot);
const allPluginSources = `${pluginSources}\n${equicordPluginSources}`;

expectIncludes("src/plugins Vencord author attribution", pluginSources, "authors: [Devs.");
expectIncludes("src/equicordplugins Equicord author attribution", equicordPluginSources, "EquicordDevs.");
expectIncludes("Vencord contributor constants", constants, "export const Devs");
expectIncludes("Equicord contributor constants", constants, "export const EquicordDevs");
expectIncludes("Vencord contributor lookup", constants, "export const VencordDevsById");
expectIncludes("Equicord contributor lookup", constants, "export const EquicordDevsById");
expectNotIncludes("legacy plugin author attribution", allPluginSources, "OpenCordDevs");
expectIncludes("new source Vencord header rule", agents, "* Vencord, a Discord client mod");
expectIncludes("new source Vendicated copyright rule", agents, "Vendicated and contributors");
expectIncludes("new source SPDX rule", agents, "SPDX-License-Identifier: GPL-3.0-or-later");
expectIncludes("new source upstream attribution rule", agents, "upstream attribution is kept across the whole tree");

// Agent guidance docs must use current OpenCord product wording while keeping
// Vencord SPDX attribution and real Equicord contributor identifiers intact.
expectAgentGuidanceIncludes("OpenCord heading", "# OpenCord Rules");
expectAgentGuidanceIncludes("OpenCord-only SPDX guidance", "even on new OpenCord-only files");
expectAgentGuidanceIncludes("OpenCord fork attribution", "OpenCord is a Vencord fork");
expectAgentGuidanceIncludes("preserved SPDX naming warning", "Don't change it to \"OpenCord\" or \"Equicord\".");
expectAgentGuidanceIncludes("OpenCord plugin path option", "`src/opencordplugins/<name>/index.tsx`");
expectAgentGuidanceIncludes("OpenCord modified plugin wording", "`isModified?: true` marks an upstream Vencord plugin OpenCord modified.");
expectAgentGuidanceIncludes("OpenCord bundle wording", "They only exist in OpenCord's bundle.");
expectAgentGuidanceIncludes("OpenCord version constant description", "| `VERSION` | OpenCord version string |");
expectAgentGuidanceNotIncludes("legacy Equicord heading", "# Equicord Rules");
expectAgentGuidanceNotIncludes("legacy Equicord-only SPDX guidance", "even on new Equicord-only files");
expectAgentGuidanceNotIncludes("legacy Equicord fork attribution", "Equicord is a Vencord fork");
expectAgentGuidanceNotIncludes("legacy SPDX naming warning", "Don't change it to \"Equicord\".");
expectAgentGuidanceNotIncludes("missing OpenCord plugin path sentence", "`src/plugins/<name>/index.tsx` or `src/equicordplugins/<name>/index.tsx`. Single-file plugins still get a folder.");
expectAgentGuidanceNotIncludes("legacy modified plugin wording", "`isModified?: true` marks an upstream Vencord plugin Equicord modified.");
expectAgentGuidanceNotIncludes("legacy bundle wording", "They only exist in Equicord's bundle.");
expectAgentGuidanceNotIncludes("legacy version constant description", "| `VERSION` | Equicord version string |");

// Targeted residual product-branding guard. These exact checks intentionally avoid
// plugin-origin directories, contributor attribution namespaces, legacy compatibility
// aliases, and external infrastructure URLs that must remain Equicord/Vencord until
// separate ownership or infrastructure migrations occur.
expectFileNotIncludes("packages/discord-types/README.md", "product description", "created for Equicord");
expectFileNotIncludes("packages/discord-types/README.md", "npm package examples", "@equicord/discord-types");
expectFileNotIncludes("packages/vencord-types/README.md", "package heading", "# Equicord Types");
expectFileNotIncludes("packages/vencord-types/README.md", "package description", "Equicord's api");
expectFileNotIncludes("packages/vencord-types/README.md", "npm package examples", "@equicord/types");
expectFileNotIncludes("src/Vencord.ts", "auto-update notice", "Equicord has been updated!");
expectFileNotIncludes("src/Vencord.ts", "available update notice", "A new version of Equicord is available!");
expectFileNotIncludes("src/Vencord.ts", "tray update notice", "An Equicord update is available!");
expectFileNotIncludes("src/Vencord.ts", "repair error copy", "Failed to repair Equicord");
expectFileNotIncludes("src/Vencord.ts", "development build warning", "Development build of Equicord");
expectFileNotIncludes("src/utils/Logger.ts", "reporter prefix", "[Equicord]");
expectFileNotIncludes("src/utils/Logger.ts", "console badge", "%c Equicord %c");
expectFileNotIncludes("src/plugins/crashHandler/index.ts", "crash update prompt", "there is a Equicord update available");
expectFileNotIncludes("src/plugins/experiments/index.tsx", "experiments warning", "Equicord is not responsible");
expectFileNotIncludes("src/utils/themes/usercss/compiler.ts", "default usercss metadata start", "/* ==Equicord== */");
expectFileNotIncludes("src/utils/themes/usercss/compiler.ts", "default usercss metadata end", "/* ==/Equicord== */");
expectFileNotIncludes("src/utils/themes/usercss/compiler.ts", "unknown preprocessor copy", "which isn't known to Equicord");
expectFileNotIncludes("src/plugins/xsOverlay/index.tsx", "websocket client identifier", "?client=Equicord");
expectFileNotIncludes("src/plugins/xsOverlay/index.tsx", "notification source app", "sourceApp: \"Equicord\"");

// Final leftover guards from the rebrand reconciliation. These exact checks are
// scoped to the confirmed files/strings so intentional attribution, plugin
// provenance, route ids, and compatibility aliases remain allowed.
expectFileNotIncludes("scripts/generateReport.ts", "reporter parser legacy console tag", "firstArg === \"[Equicord]\"");
expectFileIncludes("src/components/settings/tabs/plugins/index.tsx", "OpenCord plugin filter label", "label: \"Show OpenCord\"");
expectFileIncludes("src/components/settings/tabs/plugins/index.tsx", "OpenCord plugin filter origin detection", "src/opencordplugins/");
expectFileIncludes("src/components/settings/tabs/plugins/index.tsx", "Equicord plugin filter label", "label: \"Show Equicord\"");
expectFileNotIncludes("src/debug/runReporter.ts", "Equicord object comment", "the Equicord object");
expectFileNotIncludes("src/debug/runReporter.ts", "Equicord code comment", "of Equicord code");

// Additional exact-string guards for product-facing leftovers found by final
// verification. These are intentionally narrow so Equicord/Vencord plugin
// origin attribution, route ids, compatibility aliases, and infrastructure URLs
// remain allowed.
expectFileNotIncludes("misc/install.sh", "updater credit", "Modified by PhoenixAceVFX for Equicord Updater");
expectFileNotIncludes("src/debug/runReporter.ts", "reporter name", "Equicord Reporter");
expectFileNotIncludes("src/equicordplugins/commandPalette/commands/equicord.tsx", "settings command title", "Open Equicord Settings");
expectFileNotIncludes("src/equicordplugins/commandPalette/commands/openSettings.ts", "settings route label", "label: \"Equicord\"");
expectFileNotIncludes("src/equicordplugins/commandPalette/commands/openSettings.ts", "updater route label", "label: \"Equicord Updater\"");
expectFileNotIncludes("src/equicordplugins/discordDevBanner/components/consts.ts", "version variable label", "Version of Equicord");
expectFileNotIncludes("src/equicordplugins/keyboardNavigation/commands.tsx", "update notification title", "A Equicord update is available!");
expectFileNotIncludes("src/equicordplugins/musicControls/spotify/lyrics/providers/lrclibAPI/index.ts", "lyrics user agent", "SpotifyLyrics for Equicord");
expectFileNotIncludes("src/equicordplugins/newPluginsManager/index.tsx", "new plugins description", "new plugins are added to Equicord");
expectFileNotIncludes("src/equicordplugins/quoter/index.tsx", "default watermark", "Made with Equicord");
expectFileNotIncludes("src/equicordplugins/snowfall/index.tsx", "performance warning copy", "average Equicord extension");
expectFileNotIncludes("src/equicordplugins/title/index.ts", "default title", "default: \"Equicord\"");
expectFileNotIncludes("src/equicordplugins/userpluginInstaller.dev/index.tsx", "userplugin warning", "Equicord does not moderate userplugins");
expectFileNotIncludes("src/plugins/_api/badges/modals.tsx", "donor modal copy", "development of Equicord");
expectFileNotIncludes("src/plugins/platformIndicators/index.tsx", "platform indicator label", "label: \"Equicord\"");

// OpenCord-owned plugin namespace guards. These checks stay scoped to plugin
// discovery and source badges so contributor attribution remains unaffected.
expectFileIncludes("scripts/build/common.mjs", "OpenCord plugin API scanning", "\"opencordplugins/_api\"");
expectFileIncludes("scripts/build/common.mjs", "OpenCord plugin core scanning", "\"opencordplugins/_core\"");
expectFileIncludes("scripts/build/common.mjs", "OpenCord plugin scanning", "\"opencordplugins\"");
expectFileIncludes("scripts/build/build.mjs", "OpenCord native plugin scanning", "\"opencordplugins\"");
expectFileIncludes("src/components/settings/tabs/plugins/PluginCard.tsx", "OpenCord plugin origin detection", "src/opencordplugins/");
expectFileIncludes("src/components/settings/tabs/plugins/PluginCard.tsx", "OpenCord plugin badge alt text", "alt: \"OpenCord\"");

// Canonical logo replacement guards. These are intentionally narrow: they only
// verify the user-provided symbol split, reject known prior logo attempts, and
// require current logo consumers to use the dark SVG as the default asset.
expectPathExists("canonical OpenCord dark SVG symbol", canonicalOpenCordDarkSymbol);
expectPathExists("canonical OpenCord light SVG symbol", canonicalOpenCordLightSymbol);
expectPathExists("browser extension dark SVG symbol", browserOpenCordDarkSymbol);
expectSvgSymbolSplit("canonical OpenCord dark SVG symbol", canonicalOpenCordDarkSymbol, "dark-letter", "light-letter");
expectSvgSymbolSplit("canonical OpenCord light SVG symbol", canonicalOpenCordLightSymbol, "light-letter", "dark-letter");
for (const legacyOpenCordSymbolArtifact of legacyOpenCordSymbolArtifacts) {
    expectPathNotExists("legacy OpenCord symbol artifact", legacyOpenCordSymbolArtifact);
}
expectFileIncludes("src/components/settings/tabs/plugins/PluginCard.tsx", "OpenCord plugin badge canonical dark symbol", canonicalOpenCordSymbolMarker);
expectFileNotIncludes("src/components/settings/tabs/plugins/PluginCard.tsx", "OpenCord plugin badge legacy symbol", legacyOpenCordSymbolMarker);
expectFileIncludes("src/components/settings/tabs/sync/CloudTab.tsx", "settings cloud canonical dark symbol", canonicalOpenCordSymbolMarker);
expectFileNotIncludes("src/components/settings/tabs/sync/CloudTab.tsx", "settings cloud legacy symbol", legacyOpenCordSymbolMarker);
expectFileIncludes("src/main/about.html", "about page canonical dark symbol", canonicalOpenCordSymbolMarker);
expectFileNotIncludes("src/main/about.html", "about page legacy symbol", legacyOpenCordSymbolMarker);
expectFileIncludes("browser/userscript.meta.js", "userscript icon canonical dark symbol", canonicalOpenCordSymbolMarker);
expectFileNotIncludes("browser/userscript.meta.js", "userscript icon legacy symbol", legacyOpenCordSymbolMarker);
expectFileIncludes("browser/manifest.json", "primary extension icon canonical dark symbol", canonicalOpenCordSymbolMarker);
expectFileNotIncludes("browser/manifest.json", "primary extension icon legacy symbol", legacyOpenCordSymbolMarker);
expectFileIncludes("browser/manifestv2.json", "primary extension icon canonical dark symbol", canonicalOpenCordSymbolMarker);
expectFileNotIncludes("browser/manifestv2.json", "primary extension icon legacy symbol", legacyOpenCordSymbolMarker);
expectFileIncludes("scripts/build/buildWeb.mjs", "chromium/firefox extension packaged dark symbol", canonicalOpenCordSymbolMarker);
expectFileNotIncludes("scripts/build/buildWeb.mjs", "chromium/firefox extension packaged legacy symbol", legacyOpenCordSymbolMarker);

if (failures.length) {
    console.error("OpenCord branding validation failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
}

console.log("OpenCord branding validation passed.");
