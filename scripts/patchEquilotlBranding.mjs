#!/usr/bin/env node
/*
 * OpenCord, a Discord client mod
 * Copyright (c) 2026 OpenCord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { copyFileSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const equilotlDir = process.argv[2];
const assetsDir = process.argv[3];

if (!equilotlDir) {
    console.error("Usage: patchEquilotlBranding.mjs <equilotl-dir> [assets-dir]");
    process.exit(1);
}

function read(relativePath) {
    return readFileSync(join(equilotlDir, relativePath), "utf8");
}

function write(relativePath, contents) {
    writeFileSync(join(equilotlDir, relativePath), contents);
}

function walkGoFiles(dir) {
    const entries = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
            entries.push(...walkGoFiles(path));
        } else if (entry.isFile() && entry.name.endsWith(".go")) {
            entries.push(path);
        }
    }
    return entries;
}

// Keep upstream URL remaps as the baseline transformation.
const urlReplacements = {
    "https://api.github.com/repos/Equicord/Equicord/releases/latest": "https://api.github.com/repos/MasuRii/OpenCord/releases/latest",
    "https://equicord.org/releases/equicord": "https://github.com/MasuRii/OpenCord/releases/latest/download/latest.json",
    "https://api.github.com/repos/Equicord/Equilotl/releases/latest": "https://api.github.com/repos/MasuRii/OpenCord/releases/latest",
    "https://equicord.org/releases/equilotl": "https://github.com/MasuRii/OpenCord/releases/latest/download/latest.json",
    "https://github.com/Equicord/Equilotl/releases/latest/download/": "https://github.com/MasuRii/OpenCord/releases/latest/download/",
    "https://github.com/Equicord/Equilotl": "https://github.com/MasuRii/OpenCord"
};

const productNameReplacements = {
    // Installer asset names.
    "Equilotl.exe": "OpenCordInstaller.exe",
    "EquilotlCli.exe": "OpenCordInstallerCli.exe",
    "Equilotl-x11": "OpenCord-x11",
    "EquilotlCli-linux": "OpenCordCli-linux",
    "Equilotl-darwin-x64.zip": "OpenCord-darwin-x64.zip",
    "Equilotl-darwin-arm64.zip": "OpenCord-darwin-arm64.zip",
    "EquilotlCli-darwin-x64": "OpenCordCli-darwin-x64",
    "EquilotlCli-darwin-arm64": "OpenCordCli-darwin-arm64",
    "Equilotl.app": "OpenCordInstaller.app",
    "EquilotlUpdate": "OpenCordInstallerUpdate",
    // Visible installer product text.
    "\"Equilotl/\"": "\"OpenCordInstaller/\"",
    "\"Equilotl\"": "\"OpenCordInstaller\"",
    "Equilotl Version": "OpenCordInstaller Version",
    "Equilotl Cli": "OpenCordInstaller Cli",
    "Update Equilotl": "Update OpenCordInstaller",
    "Equilotl was run": "OpenCordInstaller was run",
    "Equilotl must not be run": "OpenCordInstaller must not be run"
};

const installedModReplacements = {
    // User-facing references to the mod being installed.
    "Install Equicord": "Install OpenCord",
    "Repair Equicord": "Repair OpenCord",
    "Uninstall Equicord": "Uninstall OpenCord",
    "Downloading latest Equicord files": "Downloading latest OpenCord files",
    "Otherwise, Equicord will likely not work": "Otherwise, OpenCord will likely not work",
    "Failed to install the latest Equicord builds from GitHub": "Failed to install the latest OpenCord builds from GitHub",
    "**Github** and **equicord.org** are the only official places to get Equicord": "**Github** is the only official place to get OpenCord",
    "Reinstall & Update Equicord": "Reinstall & Update OpenCord",
    "verify Equicord installed successfully": "verify OpenCord installed successfully",
    "otherwise Equicord will likely not work": "otherwise OpenCord will likely not work",
    "Equicord is in no way affiliated with OpenAsar": "OpenCord is in no way affiliated with OpenAsar",
    "Equicord will be downloaded to": "OpenCord will be downloaded to",
    "Local Equicord Version": "Local OpenCord Version",
    "Not updating Equicord due to being in DevMode": "Not updating OpenCord due to being in DevMode",
    "Latest Equicord Version": "Latest OpenCord Version"
};

const systemReplacements = {
    // Environment variables and on-disk paths the installer uses.
    "EQUICORD_USER_DATA_DIR": "OPENCORD_USER_DATA_DIR",
    "EQUICORD_DIRECTORY": "OPENCORD_DIRECTORY",
    "EQUICORD_DEV_INSTALL": "OPENCORD_DEV_INSTALL",
    "EquicordData": "OpenCordData",
    'appdir.New("Equicord")': 'appdir.New("OpenCord")',
    "equicord.asar": "opencord.asar",
    '`// Equicord (\\w+)`': '`// OpenCord (\\w+)`',
    "Found existing Equicord Install": "Found existing OpenCord Install",
    "non-Equicord app.asar": "non-OpenCord app.asar",
    "Using DISCORD_USER_DATA_DIR/../EquicordData": "Using DISCORD_USER_DATA_DIR/../OpenCordData",
    // Internal identifiers that surface in logs/errors pointing to the mod path.
    "EquicordDirectory": "OpenCordDirectory",
    "EquicordFile": "OpenCordFile",
    "equicordAsarPath": "openCordAsarPath",
    "isEquicordLoaderAppAsar": "isOpenCordLoaderAppAsar"
};

const goReplacements = {
    ...urlReplacements,
    ...productNameReplacements,
    ...installedModReplacements,
    ...systemReplacements
};

for (const path of walkGoFiles(equilotlDir)) {
    const relativePath = path.slice(equilotlDir.length + 1);
    let text = readFileSync(path, "utf8");
    const before = text;
    for (const [old, replacement] of Object.entries(goReplacements)) {
        text = text.split(old).join(replacement);
    }
    if (text !== before) {
        writeFileSync(path, text);
        console.log(`Patched ${relativePath}`);
    }
}

if (assetsDir) {
    const pngPath = join(assetsDir, "opencord-symbol-dark-256.png");
    const icoPath = join(assetsDir, "opencord-symbol-dark.ico");
    const icnsPath = join(assetsDir, "opencord-symbol-dark.icns");

    try {
        copyFileSync(pngPath, join(equilotlDir, "winres", "icon.png"));
        copyFileSync(icoPath, join(equilotlDir, "winres", "icon.ico"));
        console.log("Replaced Windows icon resources");
    } catch (err) {
        console.warn("Could not replace Windows icon resources:", err.message);
    }

    try {
        copyFileSync(icnsPath, join(equilotlDir, "macos", "icon.icns"));
        console.log("Replaced macOS icon resources");
    } catch (err) {
        console.warn("Could not replace macOS icon resources:", err.message);
    }

    try {
        let winres = read("winres/winres.json");
        winres = winres.replace("An Installer for the Equicord Discord Mod", "An Installer for the OpenCord Discord Mod");
        winres = winres.replace("\"CompanyName\": \"Equicord\"", "\"CompanyName\": \"OpenCord\"");
        winres = winres.replace(/Equilotl/g, "OpenCordInstaller");
        write("winres/winres.json", winres);
        console.log("Patched Windows resource manifest metadata");
    } catch (err) {
        console.warn("Could not patch winres.json:", err.message);
    }

    try {
        let plist = read("macos/Info.plist");
        plist = plist.replace("<string>Equilotl</string>", "<string>OpenCordInstaller</string>");
        plist = plist.replace("<string>org.equicord.equilotl</string>", "<string>org.opencord.opencordinstaller</string>");
        write("macos/Info.plist", plist);
        console.log("Patched macOS app bundle metadata");
    } catch (err) {
        console.warn("Could not patch Info.plist:", err.message);
    }
}
