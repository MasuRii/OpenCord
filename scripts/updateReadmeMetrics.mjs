/*
 * OpenCord, a Discord client mod
 * Copyright (c) 2026 OpenCord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import ts from "typescript";

const collections = [
    {
        name: "Vencord",
        dir: "src/plugins",
        source: "[Vendicated/Vencord](https://github.com/Vendicated/Vencord)",
        url: "https://github.com/Vendicated/Vencord",
        logo: "https://github.com/Vendicated.png?size=20",
        color: "5865F2"
    },
    {
        name: "Equicord",
        dir: "src/equicordplugins",
        source: "[Equicord/Equicord](https://github.com/Equicord/Equicord)",
        url: "https://github.com/Equicord/Equicord",
        logo: "https://github.com/Equicord.png?size=20",
        color: "768AD4"
    },
    {
        name: "TestCord",
        dir: "src/testcordplugins",
        source: "[TestcordDev/TestCord](https://github.com/TestcordDev/TestCord)",
        url: "https://github.com/TestcordDev/TestCord",
        logo: "assets/branding/testcord-icon.png",
        color: "111827"
    },
    {
        name: "Illegalcord",
        dir: "src/illegalcordplugins",
        source: "[ImHisako/Illegalcord](https://github.com/ImHisako/Illegalcord)",
        url: "https://github.com/ImHisako/Illegalcord",
        logo: "assets/branding/illegalcord-icon.png",
        color: "8B5CF6"
    },
    {
        name: "MallCord",
        dir: "src/mallcordplugins",
        source: "[MallCord/MallCord](https://github.com/MallCord/MallCord)",
        url: "https://github.com/MallCord/MallCord",
        logo: "assets/branding/mallcord-icon.png",
        color: "10B981"
    },
    {
        name: "Equicord+",
        dir: "src/equicordplusplugins",
        source: "[Chaython/EquicordPlus](https://github.com/Chaython/EquicordPlus)",
        url: "https://github.com/Chaython/EquicordPlus",
        logo: "assets/branding/equicordplus-icon.png",
        color: "F59E0B"
    },
    {
        name: "Esharq",
        dir: "src/esharqplugins",
        source: "[LOSTSTR/Esharq](https://github.com/LOSTSTR/Esharq)",
        url: "https://github.com/LOSTSTR/Esharq",
        logo: "assets/branding/esharq-icon.png",
        color: "EF4444"
    },
    {
        name: "OpenCord",
        dir: "src/opencordplugins",
        source: "[MasuRii/OpenCord](https://github.com/MasuRii/OpenCord)",
        url: "https://github.com/MasuRii/OpenCord",
        logo: "assets/branding/opencord-symbol-dark.svg",
        color: "0F172A"
    }
];

function countPluginDirs(dir) {
    return readdirSync(dir, { withFileTypes: true }).filter(entry => entry.isDirectory()).length;
}

const visiblePluginDirs = [
    "plugins/_api", "plugins/_core", "plugins",
    "equicordplugins/_api", "equicordplugins/_core", "equicordplugins",
    "opencordplugins/_api", "opencordplugins/_core", "opencordplugins",
    "illegalcordplugins/_api", "illegalcordplugins/_core", "illegalcordplugins",
    "testcordplugins/_api", "testcordplugins/_core", "testcordplugins",
    "esharqplugins/_api", "esharqplugins/_core", "esharqplugins",
    "equicordplusplugins/_api", "equicordplusplugins/_core", "equicordplusplugins",
    "mallcordplugins/_api", "mallcordplugins/_core", "mallcordplugins"
];

function getPluginTarget(filePath) {
    const pathParts = filePath.split(/[/\\]/);
    if (/^index\.tsx?$/.test(pathParts.at(-1))) pathParts.pop();

    const identifier = pathParts.at(-1).replace(/\.tsx?$/, "");
    const identifierBits = identifier.split(".");
    return identifierBits.length === 1 ? null : identifierBits.at(-1);
}

function isExcludedFromDesktopBuild(target) {
    return target === "dev"
        || target === "web"
        || target === "vesktop"
        || target === "equibop";
}

function readPluginEntryContent(fullPath, entry) {
    if (entry.isFile()) return readFileSync(fullPath, "utf8");

    for (const file of ["index.ts", "index.tsx"]) {
        const entryPath = join(fullPath, file);
        if (existsSync(entryPath)) return readFileSync(entryPath, "utf8");
    }

    return null;
}

function getStaticPropertyName(name, sourceFile) {
    if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
    return name.getText(sourceFile);
}

function getPluginMetadata(content) {
    const sourceFile = ts.createSourceFile("plugin.tsx", content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const metadata = {
        name: null,
        hidden: false,
        required: false,
        hasSettings: false
    };

    function visit(node) {
        if (ts.isCallExpression(node)
            && ts.isIdentifier(node.expression)
            && node.expression.text === "definePlugin"
            && ts.isObjectLiteralExpression(node.arguments[0])) {
            for (const property of node.arguments[0].properties) {
                if (ts.isShorthandPropertyAssignment(property)) {
                    if (property.name.text === "settings") metadata.hasSettings = true;
                    continue;
                }

                if (!ts.isPropertyAssignment(property)) continue;

                const propertyName = getStaticPropertyName(property.name, sourceFile);
                if (propertyName === "name"
                    && (ts.isStringLiteral(property.initializer) || ts.isNoSubstitutionTemplateLiteral(property.initializer))) {
                    metadata.name = property.initializer.text;
                } else if (propertyName === "hidden" && property.initializer.kind === ts.SyntaxKind.TrueKeyword) {
                    metadata.hidden = true;
                } else if (propertyName === "required" && property.initializer.kind === ts.SyntaxKind.TrueKeyword) {
                    metadata.required = true;
                } else if (propertyName === "settings") {
                    metadata.hasSettings = true;
                }
            }
        }

        ts.forEachChild(node, visit);
    }

    visit(sourceFile);
    return metadata;
}

function countVisiblePlugins() {
    const pluginsByName = new Map();

    for (const dir of visiblePluginDirs) {
        const fullDir = join("src", dir);
        if (!existsSync(fullDir)) continue;

        for (const entry of readdirSync(fullDir, { withFileTypes: true })) {
            const fileName = entry.name;
            if (fileName.startsWith("_") || fileName.startsWith(".") || fileName === "index.ts") continue;
            if (/\.(zip|rar|7z|tar|gz|bz2)/.test(fileName)) continue;

            const target = getPluginTarget(fileName);
            if (target && isExcludedFromDesktopBuild(target)) continue;

            const content = readPluginEntryContent(join(fullDir, fileName), entry);
            if (!content) continue;

            const plugin = getPluginMetadata(content);
            if (!plugin.name) continue;

            pluginsByName.set(plugin.name, plugin);
        }
    }

    return [...pluginsByName.values()].filter(plugin => {
        return !plugin.hidden
            && !plugin.required
            && (!plugin.name.endsWith("API") || plugin.hasSettings);
    }).length;
}

function cleanVersion(version) {
    return version.replace(/^[~^]/, "");
}

function badgeValue(value) {
    return encodeURIComponent(value).replace(/-/g, "--");
}

function getCurrentStaticStars(readme) {
    return readme.match(/img\.shields\.io\/badge\/Stars-(\d+)-/)?.[1] ?? "1";
}

async function getStarCount(fallback) {
    const token = process.env.GITHUB_TOKEN;
    if (!token) return fallback;

    const repo = process.env.GITHUB_REPOSITORY ?? "MasuRii/OpenCord";
    const res = await fetch(`https://api.github.com/repos/${repo}`, {
        headers: {
            "Accept": "application/vnd.github+json",
            "Authorization": `Bearer ${token}`,
            "User-Agent": "OpenCord README metrics"
        }
    });

    if (!res.ok) return fallback;

    const data = await res.json();
    return typeof data.stargazers_count === "number"
        ? String(data.stargazers_count)
        : fallback;
}

function replaceOne(content, pattern, replacement, label) {
    if (!pattern.test(content)) {
        throw new Error(`Could not update ${label}.`);
    }

    return content.replace(pattern, replacement);
}

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const metrics = collections.map(collection => ({
    ...collection,
    count: countPluginDirs(collection.dir)
}));
const totalPlugins = metrics.reduce((total, collection) => total + collection.count, 0);
const visiblePlugins = countVisiblePlugins();
const typeScriptVersion = cleanVersion(packageJson.devDependencies.typescript);
const packageManagerVersion = packageJson.packageManager.replace("@", "-");
const readmePath = "README.md";
let readme = readFileSync(readmePath, "utf8");
const starCount = await getStarCount(getCurrentStaticStars(readme));
const license = packageJson.license;
const version = packageJson.version;

const mainBadgeRow = `<p><a href="https://github.com/MasuRii/OpenCord/stargazers"><img alt="Stars" src="https://img.shields.io/badge/Stars-${badgeValue(starCount)}-181717?style=flat&logo=github&logoColor=white"></a>&nbsp;&nbsp;<a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/License-${badgeValue(license)}-blue?style=flat"></a>&nbsp;&nbsp;<a href="package.json"><img alt="Version" src="https://img.shields.io/badge/Version-${badgeValue(version)}-blue?style=flat"></a>&nbsp;&nbsp;<a href="https://www.typescriptlang.org/"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-${typeScriptVersion}-3178C6?style=flat&logo=typescript&logoColor=white"></a>&nbsp;&nbsp;<a href="https://pnpm.io/"><img alt="pnpm" src="https://img.shields.io/badge/${packageManagerVersion}-F69220?style=flat&logo=pnpm&logoColor=white"></a>&nbsp;&nbsp;<a href="https://equicord.org/discord"><img alt="Discord" src="https://img.shields.io/discord/1173279886065029291.svg?color=5865F2&label=Discord&logo=discord&logoColor=white"></a></p>`;

const pluginBadgeRow = `<strong>Plugin collections</strong><br>\n<p>${metrics.map(collection => {
    const label = encodeURIComponent(collection.name).replace(/%20/g, "%20");
    return `<a href="${collection.url}"><img alt="${collection.name} logo" src="${collection.logo}" height="20"></a>&nbsp;<a href="${collection.url}"><img alt="${collection.name} plugins" src="https://img.shields.io/badge/${label}-${collection.count}-${collection.color}?style=flat"></a>`;
}).join("&nbsp;&nbsp;")}</p>`;

const collectionRows = metrics.map(collection => `| ${collection.name} | ${collection.count} | ${collection.source} |`).join("\n");

readme = replaceOne(
    readme,
    /OpenCord is an open source Discord client mod forked from \[Equicord\]\(https:\/\/github\.com\/Equicord\/Equicord\) and \[Vencord\]\(https:\/\/github\.com\/Vendicated\/Vencord\), focused on a massive cross-community plugin catalog with \d+\+? plugin source folders\.(?: The desktop settings list currently shows about \d+\+? visible plugins after build filters\.)?/,
    `OpenCord is an open source Discord client mod forked from [Equicord](https://github.com/Equicord/Equicord) and [Vencord](https://github.com/Vendicated/Vencord), focused on a massive cross-community plugin catalog with ${totalPlugins} plugin source folders. The desktop settings list currently shows about ${visiblePlugins} visible plugins after build filters.`,
    "README tagline plugin totals"
);
readme = replaceOne(
    readme,
    /<p><a href="https:\/\/github\.com\/MasuRii\/OpenCord\/stargazers"><img alt="Stars".*?<\/p>/,
    mainBadgeRow,
    "main badge row"
);
readme = replaceOne(
    readme,
    /<strong>Plugin collections<\/strong><br>\n<p><a href="https:\/\/github\.com\/Vendicated\/Vencord"><img alt="Vencord logo".*?<\/p>/,
    pluginBadgeRow,
    "plugin collection badge row"
);
readme = replaceOne(
    readme,
    /\| \d+\+? plugin source folders \| Combines Vencord, Equicord, TestCord, Illegalcord, MallCord, Equicord\+, Esharq, and OpenCord plugins\. \|(?:\n\| About \d+\+? visible plugins \| [^\n]+ \|)?/,
    `| ${totalPlugins} plugin source folders | Combines Vencord, Equicord, TestCord, Illegalcord, MallCord, Equicord+, Esharq, and OpenCord plugins. |\n| About ${visiblePlugins} visible plugins | Approximates the desktop in-app settings list; it can be lower because source folders include duplicate names, API/core helpers, and platform or dev-targeted entries filtered out at build time. |`,
    "features visible plugin totals"
);
readme = replaceOne(
    readme,
    /\| Vencord \| \d+ \| \[Vendicated\/Vencord\]\(https:\/\/github\.com\/Vendicated\/Vencord\) \|\n\| Equicord \| \d+ \| \[Equicord\/Equicord\]\(https:\/\/github\.com\/Equicord\/Equicord\) \|\n\| TestCord \| \d+ \| \[TestcordDev\/TestCord\]\(https:\/\/github\.com\/TestcordDev\/TestCord\) \|\n\| Illegalcord \| \d+ \| \[ImHisako\/Illegalcord\]\(https:\/\/github\.com\/ImHisako\/Illegalcord\) \|\n\| MallCord \| \d+ \| \[MallCord\/MallCord\]\(https:\/\/github\.com\/MallCord\/MallCord\) \|\n\| Equicord\+ \| \d+ \| \[Chaython\/EquicordPlus\]\(https:\/\/github\.com\/Chaython\/EquicordPlus\) \|\n\| Esharq \| \d+ \| \[LOSTSTR\/Esharq\]\(https:\/\/github\.com\/LOSTSTR\/Esharq\) \|\n\| OpenCord \| \d+ \| \[MasuRii\/OpenCord\]\(https:\/\/github\.com\/MasuRii\/OpenCord\) \|/,
    collectionRows,
    "plugin collection table"
);
readme = replaceOne(
    readme,
    /\| Package manager \| pnpm [^|]+ \|/,
    `| Package manager | pnpm ${packageJson.packageManager.split("@")[1]} |`,
    "package manager version"
);

writeFileSync(readmePath, readme);
console.log(`Updated README metrics for ${totalPlugins} plugin source folders and ${visiblePlugins} visible plugins.`);
for (const collection of metrics) {
    console.log(`${collection.name}: ${collection.count}`);
}
