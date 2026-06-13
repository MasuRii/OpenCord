#!/usr/bin/env node
/*
 * RED validation checks for external provider plugin metadata, links, badges,
 * and dummy/zero-ID author safety.
 *
 * These checks are intentionally static: they read source/configuration files
 * only and do not import or execute synced provider plugin code.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const failures = [];
const passes = [];

function readProjectFile(relativePath) {
    return readFileSync(path.join(root, relativePath), "utf8");
}

function projectFileExists(relativePath) {
    return existsSync(path.join(root, relativePath));
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

const pluginModal = readProjectFile("src/components/settings/tabs/plugins/PluginModal.tsx");
const contributorModal = readProjectFile("src/components/settings/tabs/plugins/ContributorModal.tsx");
const pluginCard = readProjectFile("src/components/settings/tabs/plugins/PluginCard.tsx");
const modulesDts = readProjectFile("src/modules.d.ts");
const buildCommon = readProjectFile("scripts/build/common.mjs");
const generatePluginList = readProjectFile("scripts/generatePluginList.ts");
const utils = readProjectFile("scripts/utils.ts");
const syncConfig = JSON.parse(readProjectFile(".github/plugin-sync-config.json"));

const providerFixtures = [
    {
        provider: "illegalcord",
        pluginName: "AnonLi",
        localFolder: "src/illegalcordplugins/AnonLiDrop",
        expectedSourceUrl: "https://github.com/ImHisako/Illegalcord/tree/main/src/userplugins/AnonLiDrop",
    },
    {
        provider: "testcord",
        pluginName: "Abbreviation",
        localFolder: "src/testcordplugins/abreviation",
        expectedSourceUrl: "https://github.com/TestcordDev/TestCord/tree/main/src/testcordplugins/abreviation",
    },
    {
        provider: "mallcord",
        pluginName: "AntiNickname",
        localFolder: "src/mallcordplugins/antiNickname",
        expectedSourceUrl: "https://github.com/MallCord/MallCord/tree/main/src/mallcordplugins/antiNickname",
    },
];

const expectedBadgeAssets = [
    "assets/branding/illegalcord-icon.png",
    "assets/branding/testcord-icon.png",
    "assets/branding/esharq-icon.png",
    "assets/branding/equicordplus-icon.png",
    "assets/branding/mallcord-icon.png",
];

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getBase64PngImports(source) {
    return [...source.matchAll(/import\s+([A-Za-z_$][\w$]*)\s+from\s+"file:\/\/([^";]+\.png\?base64)";/g)]
        .map(match => ({ localName: match[1], specifier: match[2] }));
}

function hasPngDataUriConversion(source, localName) {
    const escapedName = escapeRegExp(localName);
    return new RegExp(`data:image\\/png;base64,[^;\\n]*\\b${escapedName}\\b|\\b${escapedName}\\b[^;\\n]*data:image\\/png;base64,`).test(source)
        || new RegExp(`(?:png|image|badge|asset|toDataUri|dataUri)[\\w$]*\\(\\s*${escapedName}\\s*\\)`, "i").test(source);
}

check("external provider fixtures are represented by sync configuration and local folders", () => {
    const sourceNames = new Set(syncConfig.sources?.map(source => source.name));
    const missingSources = providerFixtures
        .map(fixture => fixture.provider)
        .filter(provider => !sourceNames.has(provider));
    const missingFolders = providerFixtures
        .map(fixture => fixture.localFolder)
        .filter(folder => !projectFileExists(folder));

    if (missingSources.length || missingFolders.length) {
        return fail([
            missingSources.length ? `missing sync sources: ${missingSources.join(", ")}` : null,
            missingFolders.length ? `missing local fixture folders: ${missingFolders.join(", ")}` : null,
        ].filter(Boolean).join("; "));
    }

    return pass();
});

check("PluginMeta generation carries provider repository/upstream metadata for external plugins", () => {
    const hasOnlyLocalFolderMeta = /JSON\.stringify\(\{\s*folderName,\s*userPlugin\s*\}\)/.test(buildCommon);
    const hasProviderSourceFields = /sourceRepo|providerRepo|upstreamRepo/.test(buildCommon)
        && /sourceBranch|providerBranch|upstreamBranch/.test(buildCommon)
        && /sourceFolder|upstreamFolder|upstreamDir/.test(buildCommon);

    if (hasOnlyLocalFolderMeta || !hasProviderSourceFields) {
        return fail([
            "PluginMeta currently exposes only local folderName/userPlugin data, so PluginModal cannot build upstream provider source links.",
            "Expected generated metadata to include provider repo, branch, and upstream folder/path for synced providers.",
            "Sample expected sources:",
            ...providerFixtures.map(fixture => `  - ${fixture.pluginName}: ${fixture.expectedSourceUrl}`),
        ].join("\n"));
    }

    return pass();
});

check("plugin JSON generation preserves provider/source metadata for external providers", () => {
    const utilsHasProviderFields = /sourceRepo|providerRepo|upstreamRepo/.test(utils)
        && /sourceBranch|providerBranch|upstreamBranch/.test(utils)
        && /sourceFolder|upstreamFolder|upstreamDir/.test(utils);
    const generatorReadsSyncConfig = /plugin-sync-config\.json|syncConfig|sources/.test(generatePluginList);

    if (!utilsHasProviderFields || !generatorReadsSyncConfig) {
        return fail([
            "Generated plugin JSON does not currently preserve provider repo/branch/upstream path metadata from .github/plugin-sync-config.json.",
            "Expected scripts/utils.ts PluginData and scripts/generatePluginList.ts to retain enough source metadata for external provider URLs.",
        ].join("\n"));
    }

    return pass();
});

check("PluginModal does not send every non-Vencord website link to equicord.org", () => {
    const hardCodedEquicordFallback = /https:\/\/equicord\.org\/plugins\/\$\{plugin\.name\}/.test(pluginModal);

    if (hardCodedEquicordFallback) {
        return fail([
            "PluginModal still hard-codes all non-Vencord plugin websites to https://equicord.org/plugins/${plugin.name}.",
            "External provider plugins must use provider-aware website behavior or omit a website link when no provider website exists.",
            ...providerFixtures.map(fixture => `  - ${fixture.pluginName} should not render https://equicord.org/plugins/${fixture.pluginName}`),
        ].join("\n"));
    }

    return pass();
});

check("PluginModal source links use provider upstream URLs instead of the OpenCord remote plus local folder", () => {
    const usesLocalOpenCordSource = /github\.com\/\$\{gitRemote\}\/tree\/main\/\$\{pluginMeta\.folderName\}/.test(pluginModal)
        || (/gitRemote/.test(pluginModal) && /pluginMeta\.folderName/.test(pluginModal) && /Source Code/.test(pluginModal));

    if (usesLocalOpenCordSource) {
        return fail([
            "PluginModal still builds Source Code links from gitRemote + pluginMeta.folderName, which points external providers at OpenCord local mirror paths.",
            "Expected source links for synced providers to point at their upstream repositories:",
            ...providerFixtures.map(fixture => `  - ${fixture.pluginName}: ${fixture.expectedSourceUrl}`),
        ].join("\n"));
    }

    return pass();
});

check("ContributorModal guards Discord profile lookup for dummy, bot, zero, or synthetic author IDs", () => {
    const unguardedProfileLookup = /UserProfileStore\.getUserProfile\(user\.id\)/.test(contributorModal);
    const hasReusableRealUserGuard = /isRealDiscordUser|isValidDiscordUser|canFetchProfile|isDummyUser|isSyntheticUser|isSafeProfileUser/.test(contributorModal);
    const guardRejectsZeroOrSyntheticIds = /\b0n?\b|<=\s*0|startsWith\("-"\)|BigInt\(user\.id\)/.test(contributorModal);

    if (unguardedProfileLookup || !hasReusableRealUserGuard || !guardRejectsZeroOrSyntheticIds) {
        return fail([
            "ContributorModal can still read UserProfileStore.getUserProfile(user.id) before proving the author is a real Discord user.",
            "Expected a reusable guard that rejects dummy bot users, zero IDs, and generated/synthetic negative IDs before profile/avatar APIs are used.",
        ].join("\n"));
    }

    return pass();
});

check("ContributorModal guards avatar URL access for dummy or malformed users", () => {
    const unguardedAvatarLookup = /src=\{user\.getAvatarURL\(void 0, 512, true\)\}/.test(contributorModal);
    const hasAvatarFallback = /defaultAvatar|fallbackAvatar|avatarUrl|safeAvatar|getAvatarURL\?\./.test(contributorModal);

    if (unguardedAvatarLookup || !hasAvatarFallback) {
        return fail([
            "ContributorModal still calls user.getAvatarURL(void 0, 512, true) directly in the modal header.",
            "Expected dummy/name-only contributors to render with a safe fallback avatar instead of unguarded Discord avatar APIs.",
        ].join("\n"));
    }

    return pass();
});

check("ContributorModal plugin matching is null-safe for every plugin author while opening a real provider author", () => {
    const unsafeAuthorIdDereferences = [...contributorModal.matchAll(/\b[A-Za-z_$][\w$]*\.id\.toString\(\)/g)].map(match => match[0]);
    const hasSafeAuthorComparison = /authorIdMatches|safeAuthorId|getAuthorId|matchesContributor|sameContributor/.test(contributorModal)
        || /\?\.toString\(\)|String\([^)]*\.id\)|\.id\s*!=\s*null|typeof\s+[^)]*\.id/.test(contributorModal);

    if (unsafeAuthorIdDereferences.length || !hasSafeAuthorComparison) {
        return fail([
            "ContributorModal still scans all plugin authors with direct author.id.toString() calls while resolving the clicked user's contributed plugins.",
            "That path can crash even when the clicked provider author is real, because one malformed, zero-ID, or name-only author in any synced provider plugin aborts the whole modal render.",
            unsafeAuthorIdDereferences.length
                ? `Unsafe dereferences found: ${[...new Set(unsafeAuthorIdDereferences)].join(", ")}`
                : "Expected a reusable null-safe author comparison helper before scanning Plugins.",
            "Expected behavior: compare author IDs only after verifying the metadata author has a usable id, and fall back to name matching without throwing.",
        ].join("\n"));
    }

    return pass();
});

check("external provider badges use local original image assets instead of generated text SVG data URIs", () => {
    const generatedBadgeFactoryPresent = /function\s+makeSourceBadgeSvg|makeSourceBadgeSvg\(/.test(pluginCard);
    const generatedDataUriPresent = /data:image\/svg\+xml/.test(pluginCard);
    const missingAssetFiles = expectedBadgeAssets.filter(asset => !projectFileExists(asset));
    const missingAssetReferences = expectedBadgeAssets.filter(asset => {
        const fileName = path.basename(asset);
        return !pluginCard.includes(fileName);
    });

    if (generatedBadgeFactoryPresent || generatedDataUriPresent || missingAssetFiles.length || missingAssetReferences.length) {
        return fail([
            generatedBadgeFactoryPresent || generatedDataUriPresent
                ? "PluginCard still generates external provider badges as text SVG data URIs."
                : null,
            missingAssetFiles.length
                ? `Missing local provider badge image assets: ${missingAssetFiles.join(", ")}`
                : null,
            missingAssetReferences.length
                ? `PluginCard does not reference local provider badge assets: ${missingAssetReferences.join(", ")}`
                : null,
            "Expected original provider image assets under assets/branding/ to be imported/referenced locally.",
        ].filter(Boolean).join("\n"));
    }

    return pass();
});

check("PluginCard renders PNG provider badge imports as image/png data URIs, not raw base64 strings", () => {
    const pngImports = getBase64PngImports(pluginCard)
        .filter(imported => expectedBadgeAssets.some(asset => imported.specifier.endsWith(path.basename(asset) + "?base64")));
    const rawImgSrcImports = pngImports
        .filter(imported => new RegExp(`src:\\s*${escapeRegExp(imported.localName)}\\b`).test(pluginCard))
        .map(imported => imported.localName);
    const importsWithoutPngMime = pngImports
        .filter(imported => !hasPngDataUriConversion(pluginCard, imported.localName))
        .map(imported => imported.localName);
    const hasPngMimePrefix = /data:image\/png;base64,/.test(pluginCard);

    if (!pngImports.length || rawImgSrcImports.length || importsWithoutPngMime.length || !hasPngMimePrefix) {
        return fail([
            !pngImports.length
                ? "PluginCard does not import provider PNG badges through the expected file://*.png?base64 path."
                : null,
            rawImgSrcImports.length
                ? `Provider badge imports are assigned directly to <img src> as raw base64 strings: ${rawImgSrcImports.join(", ")}`
                : null,
            importsWithoutPngMime.length
                ? `Provider badge imports are not wrapped with an image/png data URI prefix before rendering: ${importsWithoutPngMime.join(", ")}`
                : null,
            !hasPngMimePrefix
                ? "PluginCard has no data:image/png;base64, MIME prefix for PNG badge assets."
                : null,
            "Expected rendered provider badges to use img-ready data URLs such as data:image/png;base64,<asset> so Discord/Electron does not display blank logos.",
        ].filter(Boolean).join("\n"));
    }

    return pass();
});

check("PNG badge base64 imports have an explicit module declaration instead of a generic file string", () => {
    const hasExplicitPngBase64Module = /declare\s+module\s+"file:\/\/\*\.png\?base64"/.test(modulesDts)
        || /declare\s+module\s+"\*\.png\?base64"/.test(modulesDts);
    const hasGenericFileModule = /declare\s+module\s+"file:\/\/\*"/.test(modulesDts);

    if (!hasExplicitPngBase64Module) {
        return fail([
            "src/modules.d.ts only declares generic file://* imports, so TypeScript cannot distinguish raw ?base64 PNG payloads from img-ready URLs.",
            hasGenericFileModule
                ? "Generic file://* declaration found without a narrower file://*.png?base64 declaration."
                : "No file://*.png?base64 declaration found.",
            "Expected an explicit PNG/base64 module contract so future badge code cannot accidentally pass bare base64 strings to <img src>.",
        ].join("\n"));
    }

    return pass();
});

console.log("RED provider link/author/badge validation");
console.log(`Passed: ${passes.length}`);
console.log(`Failed: ${failures.length}`);

if (passes.length) {
    console.log("\nPassing checks:");
    for (const name of passes) console.log(`  ✓ ${name}`);
}

if (failures.length) {
    console.error("\nFailing checks:");
    failures.forEach((failure, index) => {
        console.error(`\n${index + 1}) ${failure.name}`);
        console.error(failure.message);
    });
    process.exitCode = 1;
}
