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

import { Dirent, readdirSync, readFileSync, writeFileSync } from "fs";
import { access, readFile } from "fs/promises";
import { dirname, join, sep } from "path";
import { normalize as posixNormalize, sep as posixSep } from "path/posix";
import { BigIntLiteral, CallExpression, createSourceFile, ExportDeclaration, Expression, Identifier, isArrayLiteralExpression, isAsExpression, isBigIntLiteral, isCallExpression, isExportAssignment, isExportDeclaration, isIdentifier, isNamedExports, isNoSubstitutionTemplateLiteral, isNumericLiteral, isObjectLiteralExpression, isParenthesizedExpression, isPropertyAccessExpression, isPropertyAssignment, isSatisfiesExpression, isStringLiteral, isVariableStatement, NamedDeclaration, NodeArray, ObjectLiteralExpression, PropertyAssignment, ScriptTarget, StringLiteral, SyntaxKind } from "typescript";

import { getPluginTarget } from "./utils.mjs";

let syncConfig: { sources: Array<{ local_dir: string; repo: string; branch: string; upstream_dirs: string[]; }>; } | null = null;
try {
    syncConfig = JSON.parse(readFileSync(".github/plugin-sync-config.json", "utf8"));
} catch {
    syncConfig = null;
}

export interface Dev {
    name: string;
    id: string;
}

export interface Command {
    name: string;
    description: string;
}

export interface PluginData {
    name: string;
    description: string;
    tags: string[];
    searchTerms: string[];
    authors: Dev[];
    dependencies: string[];
    hasPatches: boolean;
    hasCommands: boolean;
    commands: Command[];
    required: boolean;
    enabledByDefault: boolean;
    target: "discordDesktop" | "vesktop" | "equibop" | "desktop" | "web" | "dev";
    filePath: string;
    dirName: string;
    isModified: boolean;
    sourceRepo?: string;
    sourceBranch?: string;
    sourceFolder?: string;
}

export const devs = {} as Record<string, Dev>;
export const equicordDevs = {} as Record<string, Dev>;
export const illegalcordDevs = {} as Record<string, Dev>;
export const testCordDevs = {} as Record<string, Dev>;
export const esharqDevs = {} as Record<string, Dev>;
export const equicordPlusDevs = {} as Record<string, Dev>;
export const mallCordDevs = {} as Record<string, Dev>;

const devGroups = {
    Devs: devs,
    EquicordDevs: equicordDevs,
    IllegalcordDevs: illegalcordDevs,
    TestCordDevs: testCordDevs,
    TestcordDevs: testCordDevs,
    EsharqDevs: esharqDevs,
    EquicordPlusDevs: equicordPlusDevs,
    MallCordDevs: mallCordDevs,
};

export function getName(node: NamedDeclaration) {
    if (!node.name) return undefined;
    if (isIdentifier(node.name) || isStringLiteral(node.name)) return node.name.text;
    return undefined;
}

export function hasName(node: NamedDeclaration, name: string) {
    return getName(node) === name;
}

export function getObjectProp(node: ObjectLiteralExpression, name: string) {
    const prop = node.properties.find(p => hasName(p, name));
    if (prop && isPropertyAssignment(prop)) return prop.initializer;
    return prop;
}

function getObjectPropInitializer(node: ObjectLiteralExpression, name: string) {
    const prop = node.properties.find(p => hasName(p, name));
    return prop && isPropertyAssignment(prop) ? prop.initializer : undefined;
}

function unwrapExpression(node: Expression): Expression {
    let value = node;

    while (isParenthesizedExpression(value) || isAsExpression(value) || isSatisfiesExpression(value)) {
        value = value.expression;
    }

    return value;
}

function readStaticString(node: Expression | undefined, stringConstants: Map<string, string>): string | undefined {
    if (!node) return undefined;

    const value = unwrapExpression(node);

    if (isStringLiteral(value) || isNoSubstitutionTemplateLiteral(value)) return value.text;
    if (isIdentifier(value)) return stringConstants.get(value.text);

    if (isCallExpression(value)) {
        const literalArgs = value.arguments
            .map(arg => readStaticString(arg, stringConstants))
            .filter((arg): arg is string => typeof arg === "string");

        return literalArgs.at(-1);
    }

    return undefined;
}

function readStaticId(node: Expression | undefined): string | undefined {
    if (!node) return undefined;

    const value = unwrapExpression(node);

    if (isBigIntLiteral(value)) return value.text.slice(0, -1);
    if (isNumericLiteral(value) || isStringLiteral(value)) return value.text;

    return undefined;
}

function getDefinePluginCall(node: Expression): CallExpression | undefined {
    const value = unwrapExpression(node);
    if (!isCallExpression(value) || !isIdentifier(value.expression) || value.expression.text !== "definePlugin") return undefined;
    return value;
}

function getDefaultReExportModule(node: ExportDeclaration) {
    if (!node.moduleSpecifier || !isStringLiteral(node.moduleSpecifier) || !node.exportClause || !isNamedExports(node.exportClause)) return undefined;

    const exportsDefault = node.exportClause.elements.some(e => (e.propertyName ?? e.name).text === "default");
    return exportsDefault ? node.moduleSpecifier.text : undefined;
}

async function resolveDefaultReExport(fileName: string, modulePath: string) {
    if (!modulePath.startsWith(".")) return undefined;

    const base = join(dirname(fileName), modulePath);
    const candidates = [
        base,
        `${base}.ts`,
        `${base}.tsx`,
        `${base}.js`,
        `${base}.jsx`,
        join(base, "index.ts"),
        join(base, "index.tsx")
    ];

    for (const candidate of candidates) {
        try {
            await access(candidate);
            return candidate;
        } catch { }
    }

    return undefined;
}

function parseDevGroup(groupName: keyof typeof devGroups) {
    const file = createSourceFile("constants.ts", readFileSync("src/utils/constants.ts", "utf8"), ScriptTarget.Latest);
    const target = devGroups[groupName];

    for (const child of file.getChildAt(0).getChildren()) {
        if (!isVariableStatement(child)) continue;

        const devsDeclaration = child.declarationList.declarations.find(d => hasName(d, groupName));
        if (!devsDeclaration?.initializer || !isCallExpression(devsDeclaration.initializer)) continue;

        const value = devsDeclaration.initializer.arguments[0];

        if (!isSatisfiesExpression(value) || !isObjectLiteralExpression(value.expression)) throw new Error(`Failed to parse ${groupName}: not an object literal`);

        for (const prop of value.expression.properties) {
            const name = (prop.name as Identifier).text;
            const value = isPropertyAssignment(prop) ? prop.initializer : prop;

            if (!isObjectLiteralExpression(value)) throw new Error(`Failed to parse ${groupName}: ${name} is not an object literal`);

            target[name] = {
                name: (getObjectProp(value, "name") as StringLiteral).text,
                id: (getObjectProp(value, "id") as BigIntLiteral).text.slice(0, -1)
            };
        }

        return;
    }

    throw new Error(`Could not find ${groupName} constant`);
}

export function parseDevs() {
    parseDevGroup("Devs");
}

export function parseEquicordDevs() {
    parseDevGroup("EquicordDevs");
}

export function parseIllegalcordDevs() {
    parseDevGroup("IllegalcordDevs");
}

export function parseTestCordDevs() {
    parseDevGroup("TestCordDevs");
}

export function parseEsharqDevs() {
    parseDevGroup("EsharqDevs");
}

export function parseEquicordPlusDevs() {
    parseDevGroup("EquicordPlusDevs");
}

export function parseMallCordDevs() {
    parseDevGroup("MallCordDevs");
}

export async function parseFile(fileName: string, seen = new Set<string>(), entryFileName = fileName) {
    const file = createSourceFile(fileName, await readFile(fileName, "utf8"), ScriptTarget.Latest);

    const fail = (reason: string) => {
        return new Error(`Invalid plugin ${entryFileName}, because ${reason}`);
    };

    if (seen.has(fileName)) throw fail("default re-export cycle detected");
    seen.add(fileName);

    const stringConstants = new Map<string, string>();
    const pluginDefinitions = new Map<string, CallExpression>();

    for (const node of file.getChildAt(0).getChildren()) {
        if (!isVariableStatement(node)) continue;

        for (const declaration of node.declarationList.declarations) {
            if (!isIdentifier(declaration.name) || !declaration.initializer) continue;

            const stringValue = readStaticString(declaration.initializer, stringConstants);
            if (stringValue !== undefined) stringConstants.set(declaration.name.text, stringValue);

            const pluginCall = getDefinePluginCall(declaration.initializer);
            if (pluginCall) pluginDefinitions.set(declaration.name.text, pluginCall);
        }
    }

    for (const node of file.getChildAt(0).getChildren()) {
        if (isExportDeclaration(node)) {
            const modulePath = getDefaultReExportModule(node);
            if (!modulePath) continue;

            const resolved = await resolveDefaultReExport(fileName, modulePath);
            if (!resolved) throw fail(`default re-export target ${modulePath} could not be resolved`);

            return parseFile(resolved, seen, entryFileName);
        }

        if (!isExportAssignment(node)) continue;

        const exportExpression = unwrapExpression(node.expression);
        const call = getDefinePluginCall(exportExpression) ?? (isIdentifier(exportExpression) ? pluginDefinitions.get(exportExpression.text) : undefined);
        if (!call) continue;

        const pluginArg = call.arguments[0];
        if (!pluginArg) throw fail("no object literal passed to definePlugin");

        const pluginObj = unwrapExpression(pluginArg);
        if (!isObjectLiteralExpression(pluginObj)) throw fail("no object literal passed to definePlugin");

        const data = {
            hasPatches: false,
            hasCommands: false,
            enabledByDefault: false,
            required: false,
            isModified: false,
            tags: [] as string[],
            searchTerms: [] as string[],
        } as PluginData;

        for (const prop of pluginObj.properties) {
            const key = getName(prop);
            const value = isPropertyAssignment(prop) ? prop.initializer : prop as unknown as Expression;

            switch (key) {
                case "name":
                case "description": {
                    const stringValue = readStaticString(value, stringConstants);
                    if (stringValue === undefined) throw fail(`${key} is not a static string`);
                    data[key] = stringValue;
                    break;
                }
                case "patches":
                    data.hasPatches = true;
                    break;
                case "commands":
                    data.hasCommands = true;
                    if (isArrayLiteralExpression(value)) {
                        data.commands = value.elements.map((e) => {
                            if (isObjectLiteralExpression(e)) {
                                const nameProperty = e.properties.find((p): p is PropertyAssignment =>
                                    isPropertyAssignment(p) && isIdentifier(p.name) && p.name.escapedText === "name"
                                );
                                const descriptionProperty = e.properties.find((p): p is PropertyAssignment =>
                                    isPropertyAssignment(p) && isIdentifier(p.name) && p.name.escapedText === "description"
                                );
                                if (!nameProperty || !descriptionProperty) throw fail("command missing required properties");
                                const name = readStaticString(nameProperty.initializer, stringConstants) ?? "";
                                const description = readStaticString(descriptionProperty.initializer, stringConstants) ?? "";
                                return { name, description };
                            } else if (isCallExpression(e) && isIdentifier(e.expression)) {
                                const [nameArg] = e.arguments;
                                const name = readStaticString(nameArg, stringConstants);
                                if (name === undefined) throw fail("first argument must be a string");
                                return { name, description: "" };
                            } else if (e.kind === SyntaxKind.SpreadElement) {
                                return undefined;
                            }
                            throw fail("commands array contains invalid elements");
                        }).filter((c): c is { name: string; description: string; } => Boolean(c)) as Command[];
                    } else if (isIdentifier(value)) {
                        data.commands = [];
                    } else {
                        throw fail("commands is not an array literal or identifier");
                    }
                    break;
                case "authors":
                    if (!isArrayLiteralExpression(value)) throw fail("authors is not an array literal");
                    data.authors = value.elements.map(e => {
                        const authorValue = unwrapExpression(e);

                        if (isPropertyAccessExpression(authorValue)) {
                            const authorName = getName(authorValue)!;
                            const groupName = isIdentifier(authorValue.expression) ? authorValue.expression.text : undefined;
                            const sourceGroup = groupName ? devGroups[groupName as keyof typeof devGroups] : undefined;
                            const d = sourceGroup?.[authorName] ?? Object.values(devGroups).find(group => group[authorName])?.[authorName];

                            if (!d) throw fail(`couldn't look up author ${authorName}`);
                            return d;
                        }

                        if (isObjectLiteralExpression(authorValue)) {
                            const name = readStaticString(getObjectPropInitializer(authorValue, "name"), stringConstants);
                            const id = readStaticId(getObjectPropInitializer(authorValue, "id"));
                            if (!name || id === undefined) throw fail("author object is missing static name or id");
                            return { name, id };
                        }

                        throw fail("authors array contains invalid elements");
                    });
                    break;
                case "tags":
                case "searchTerms":
                    if (!isArrayLiteralExpression(value)) throw fail(`${key} is not an array literal`);
                    data[key] = value.elements.map(e => {
                        const stringValue = readStaticString(e, stringConstants);
                        if (stringValue === undefined) throw fail(`${key} array contains non-string literals`);
                        return stringValue;
                    });
                    break;
                case "dependencies":
                    if (!isArrayLiteralExpression(value)) throw fail("dependencies is not an array literal");
                    const { elements } = value;
                    if (elements.some(e => readStaticString(e, stringConstants) === undefined)) throw fail("dependencies array contains non-string elements");
                    data.dependencies = (elements as NodeArray<StringLiteral>).map(e => readStaticString(e, stringConstants)!);
                    break;
                case "required":
                case "isModified":
                case "enabledByDefault":
                    data[key] = value.kind === SyntaxKind.TrueKeyword;
                    break;
            }
        }

        if (!data.name || !data.description || !data.authors) throw fail("name, description or authors are missing");

        const target = getPluginTarget(entryFileName);
        if (target) {
            if (!["web", "discordDesktop", "vesktop", "equibop", "desktop", "dev"].includes(target)) throw fail(`invalid target ${target}`);
            data.target = target as any;
        }

        data.filePath = posixNormalize(entryFileName)
            .split(sep)
            .join(posixSep)
            .replace(/\/index\.([jt]sx?)$/, "");

        data.dirName = posixNormalize(entryFileName)
            .split(sep)
            .join(posixSep)
            .replace(/\/index\.([jt]sx?)$/, "")
            .replace(/^src\/(?:plugins|equicordplugins|opencordplugins|illegalcordplugins|testcordplugins|esharqplugins|equicordplusplugins|mallcordplugins)\//, "");

        if (syncConfig) {
            const normalizedPath = posixNormalize(entryFileName).replace(/\\/g, "/");
            const source = syncConfig.sources.find(s => normalizedPath.startsWith(s.local_dir + "/"));
            if (source) {
                data.sourceRepo = source.repo;
                data.sourceBranch = source.branch;
                data.sourceFolder = source.upstream_dirs[0];
            }
        }

        return [data] as const;
    }

    throw fail("no default export called 'definePlugin' found");
}

export async function getEntryPoint(dir: string, dirent: Dirent) {
    const base = join(dir, dirent.name);
    if (!dirent.isDirectory()) return base;

    for (const name of ["index.ts", "index.tsx"]) {
        const full = join(base, name);
        try {
            await access(full);
            return full;
        } catch { }
    }

    throw new Error(`${dirent.name}: Couldn't find entry point`);
}

export function isPluginFile({ name }: { name: string; }) {
    if (name === "index.ts") return false;
    return !name.startsWith("_") && !name.startsWith(".");
}
