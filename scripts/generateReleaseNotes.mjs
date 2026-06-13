/*
 * OpenCord, a Discord client mod
 * Copyright (c) 2026 OpenCord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const tag = `v${packageJson.version}`;

function git(args) {
    return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function getPreviousTag() {
    try {
        return git(["tag", "--list", "v*", "--sort=-v:refname"])
            .split("\n")
            .filter(Boolean)
            .find(existingTag => existingTag !== tag);
    } catch {
        return undefined;
    }
}

function getCommits(previousTag) {
    const range = previousTag ? `${previousTag}..HEAD` : "HEAD";
    const output = git(["log", range, "--max-count=20", "--pretty=format:%H%x1f%an%x1f%ae%x1f%s%x1e"]);

    return output
        .split("\x1e")
        .filter(Boolean)
        .map(line => {
            const [hash, author, email, subject] = line.trim().split("\x1f");
            return { hash, author, email, subject };
        })
        .filter(commit => !commit.subject.startsWith("docs: update README metrics"));
}

function categoryFor(subject) {
    if (/^fix(?:\(.+\))?:/.test(subject)) return "Bugfixes";
    if (/^docs(?:\(.+\))?:/.test(subject)) return "Documentation";
    if (/^ci(?:\(.+\))?:/.test(subject)) return "CI";
    return "Improvements";
}

function contributorName(commit) {
    const match = commit.email.match(/^\d+\+([^@]+)@users\.noreply\.github\.com$/);
    if (match) return `@${match[1]}`;

    return commit.author;
}

const commits = getCommits(getPreviousTag());
const groups = new Map([
    ["Improvements", []],
    ["Bugfixes", []],
    ["Documentation", []],
    ["CI", []]
]);
const contributors = new Map();

for (const commit of commits) {
    groups.get(categoryFor(commit.subject)).push(commit);

    const name = contributorName(commit);
    const entries = contributors.get(name) ?? [];
    entries.push(commit);
    contributors.set(name, entries);
}

const lines = ["## Core", ""];
for (const [name, entries] of groups) {
    if (!entries.length) continue;

    lines.push(`### ${name}`, "");
    for (const commit of entries) {
        lines.push(`- ${commit.subject} (${commit.hash.slice(0, 7)})`);
    }
    lines.push("");
}

if (!commits.length) {
    lines.push("### Improvements", "", "- Published OpenCord release assets.", "");
}

if (contributors.size) {
    lines.push(`**Thank you to ${contributors.size} community contributor${contributors.size === 1 ? "" : "s"}:**`);
    for (const [name, entries] of contributors) {
        lines.push(`- ${name}:`);
        for (const commit of entries) {
            lines.push(`  - ${commit.subject} (${commit.hash.slice(0, 7)})`);
        }
    }
    lines.push("");
}

process.stdout.write(lines.join("\n"));
