/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { existsSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { getEntryPoint, isPluginFile, parseDevs, parseEquicordDevs, parseEquicordPlusDevs, parseEsharqDevs, parseFile, parseIllegalcordDevs, parseMallCordDevs, parseTestCordDevs, PluginData } from "./utils";

(async () => {
    // Load plugin sync config so provider metadata is preserved in generated JSON
    const syncConfig = JSON.parse(readFileSync(".github/plugin-sync-config.json", "utf-8"));
    if (!syncConfig.sources) throw new Error("Invalid plugin-sync-config.json");

    parseDevs();
    parseEquicordDevs();
    parseIllegalcordDevs();
    parseTestCordDevs();
    parseEsharqDevs();
    parseEquicordPlusDevs();
    parseMallCordDevs();

    const args = process.argv.slice(2);

    const equicordFlag = args.includes("--equicord");
    const opencordFlag = args.includes("--opencord");
    const vencordFlag = args.includes("--vencord");
    const illegalcordFlag = args.includes("--illegalcord");
    const testCordFlag = args.includes("--testcord");
    const esharqFlag = args.includes("--esharq");
    const equicordPlusFlag = args.includes("--equicordplus");
    const mallCordFlag = args.includes("--mallcord");

    let dirs: string[];

    if (equicordFlag) {
        dirs = ["src/equicordplugins/_core", "src/equicordplugins"];
    } else if (opencordFlag) {
        dirs = ["src/opencordplugins/_core", "src/opencordplugins"];
    } else if (vencordFlag) {
        dirs = ["src/plugins", "src/plugins/_core"];
    } else if (illegalcordFlag) {
        dirs = ["src/illegalcordplugins/_core", "src/illegalcordplugins"];
    } else if (testCordFlag) {
        dirs = ["src/testcordplugins/_core", "src/testcordplugins"];
    } else if (esharqFlag) {
        dirs = ["src/esharqplugins/_core", "src/esharqplugins"];
    } else if (equicordPlusFlag) {
        dirs = ["src/equicordplusplugins/_core", "src/equicordplusplugins"];
    } else if (mallCordFlag) {
        dirs = ["src/mallcordplugins/_core", "src/mallcordplugins"];
    } else {
        dirs = [
            "src/plugins", "src/plugins/_core",
            "src/equicordplugins/_core", "src/equicordplugins",
            "src/opencordplugins/_core", "src/opencordplugins",
            "src/illegalcordplugins/_core", "src/illegalcordplugins",
            "src/testcordplugins/_core", "src/testcordplugins",
            "src/esharqplugins/_core", "src/esharqplugins",
            "src/equicordplusplugins/_core", "src/equicordplusplugins",
            "src/mallcordplugins/_core", "src/mallcordplugins"
        ];
    }

    dirs = dirs.filter(existsSync);

    const outputPath = args.find(a => !a.startsWith("--")) ?? null;

    const plugins = [] as PluginData[];

    await Promise.all(
        dirs.flatMap(dir =>
            readdirSync(dir, { withFileTypes: true })
                .filter(isPluginFile)
                .map(async dirent => {
                    try {
                        const [data] = await parseFile(await getEntryPoint(dir, dirent));
                        plugins.sort().push(data);
                    } catch (e) {
                        console.warn(`[plugin-list] Skipping ${dirent.name}: ${(e as Error).message}`);
                    }
                })
        )
    );

    const data = JSON.stringify(plugins);

    if (outputPath) {
        writeFileSync(outputPath, data);
    } else {
        console.log(data);
    }
})();
