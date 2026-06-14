#!/usr/bin/env node
/*
 * OpenCord, a Discord client mod
 * Copyright (c) 2026 OpenCord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
/*
 * RED validation checks for release versioning/tag automation and the Windows
 * installer documentation / install.sh guard.
 *
 * These checks are intentionally static: they read source/configuration files
 * only and do not perform network calls or execute installer binaries.
 *
 * Expected state after the requested fixes:
 *   - .github/workflows/build.yml no longer re-uses an existing GitHub release
 *     on ordinary main pushes. A version-versus-latest-tag gate skips tag
 *     creation, release creation/editing, and asset upload when package.json
 *     has not advanced beyond the latest v* tag.
 *   - CI has a guarded, automated workflow that bumps package.json and pushes
 *     a new v* tag (so there is always a fresh version to release).
 *   - README.md "Quick Start" is platform-specific and no longer presents the
 *     Linux/macOS bash install.sh command as the universal first step.
 *   - misc/install.sh aborts early on Windows / MSYS / Cygwin and points users
 *     to the Windows .exe installer.
 */

import { readFileSync, readdirSync } from "node:fs";
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

function extractSteps(jobYaml) {
    const lines = jobYaml.split(/\r?\n/);
    const steps = [];
    let current = [];

    for (const line of lines) {
        if (/^\s*- /.test(line)) {
            if (current.length) steps.push(current.join("\n"));
            current = [line];
        } else {
            current.push(line);
        }
    }
    if (current.length) steps.push(current.join("\n"));

    return steps;
}

function stepHasReleaseGuard(stepBlock) {
    const lines = stepBlock.split(/\r?\n/);
    return lines.some(line => {
        const trimmed = line.trim();
        if (!trimmed.startsWith("if:")) return false;
        return /release/.test(trimmed) && /['"]true['"]/.test(trimmed);
    });
}

function hasLoopGuard(text) {
    return /github\.actor\s*!=\s*['"]github-actions(\[bot\])?['"]/.test(text)
        || /^concurrency:/m.test(text);
}

function hasAutoBumpAndTag(text) {
    const bumpsVersion = /\b(?:npm|pnpm)\s+version\b/.test(text)
        || (/git\s+add\s+.*package\.json/.test(text) && /\bversion\b/i.test(text));
    const createsAndPushesTag = /git\s+tag\s+v/.test(text)
        && /git\s+push\s+(?:origin\s+)?(?:HEAD\s+)?"?v/.test(text);
    return bumpsVersion && createsAndPushesTag;
}

function extractJobHeader(jobYaml) {
    const lines = jobYaml.split(/\r?\n/);
    const header = [];
    for (const line of lines) {
        if (/^\s*steps:\s*$/.test(line)) break;
        header.push(line);
    }
    return header.join("\n");
}

// ---------------------------------------------------------------------------
// File contents
// ---------------------------------------------------------------------------

const buildYml = readProjectFile(".github/workflows/build.yml");
const readme = readProjectFile("README.md");
const installSh = readProjectFile("misc/install.sh");

const workflowsDir = path.join(root, ".github/workflows");
const workflowFileNames = readdirSync(workflowsDir).filter(name => name.endsWith(".yml"));
const workflows = workflowFileNames.map(name => ({
    name,
    text: readProjectFile(`.github/workflows/${name}`),
}));
const combinedWorkflowsText = workflows.map(w => w.text).join("\n");

const buildJob = extractWorkflowJob(buildYml, "Build");
const buildSteps = buildJob ? extractSteps(buildJob) : [];

// ---------------------------------------------------------------------------
// Release versioning / tag automation
// ---------------------------------------------------------------------------

check("Build workflow has a package-version-vs-latest-tag gate", () => {
    if (!buildJob) {
        return fail("could not locate the Build job in .github/workflows/build.yml");
    }

    const hasCheckStep = buildSteps.some(step =>
        /sort\s+-V/.test(step)
        && /release=(true|false)/.test(step)
        && /package\.json/.test(step),
    );

    if (!hasCheckStep) {
        return fail(
            "Build job is missing a step that compares package.json version against the latest v* tag and outputs release=true/false. "
            + "The current job always proceeds to create/edit the release derived from package.json, so repeated main pushes reuse the same release."
        );
    }

    return pass();
});

check("Publish GitHub release step is conditional on a new version", () => {
    if (!buildJob) {
        return fail("could not locate the Build job in .github/workflows/build.yml");
    }

    const publishStep = buildSteps.find(step => /gh\s+release\s+(edit|create)/.test(step));
    if (!publishStep) {
        return fail("could not locate the 'Publish GitHub release' step in the Build job");
    }

    if (!stepHasReleaseGuard(publishStep)) {
        return fail(
            "The 'Publish GitHub release' step runs unconditionally on every main push. "
            + "When package.json has not been bumped it edits (gh release edit) or recreates the existing release instead of skipping."
        );
    }

    return pass();
});

check("Tag creation and push are conditional on a new version", () => {
    if (!buildJob) {
        return fail("could not locate the Build job in .github/workflows/build.yml");
    }

    const tagStep = buildSteps.find(step => /git\s+tag\s+/.test(step) && /git\s+push\s+origin/.test(step));
    if (!tagStep) {
        return fail("could not locate the tag creation/push step in the Build job");
    }

    if (!stepHasReleaseGuard(tagStep)) {
        return fail(
            "The tag creation/push step is unconditional. Each main push will recreate/push the same v* tag and keep mutating the same release."
        );
    }

    return pass();
});

check("latest.json fallback steps are conditional on a new version", () => {
    if (!buildJob) {
        return fail("could not locate the Build job in .github/workflows/build.yml");
    }

    const latestSteps = buildSteps.filter(step => /latest\.json/.test(step));
    if (latestSteps.length === 0) {
        return fail("could not locate any latest.json generation/upload steps in the Build job");
    }

    const unguarded = latestSteps.filter(step => !stepHasReleaseGuard(step));
    if (unguarded.length > 0) {
        return fail(
            `${unguarded.length} latest.json step(s) run unconditionally and will read/attach to an existing release even when the version has not changed.`
        );
    }

    return pass();
});

check("Build workflow never edits or clobbers an existing release on ordinary pushes", () => {
    if (!buildJob) {
        return fail("could not locate the Build job in .github/workflows/build.yml");
    }

    // If the new-version gate is present and conditional, this is satisfied.
    const hasCheckStep = buildSteps.some(step =>
        /sort\s+-V/.test(step) && /release=(true|false)/.test(step) && /package\.json/.test(step),
    );

    if (hasCheckStep) {
        const releaseSteps = buildSteps.filter(step =>
            /gh\s+release\s+edit/.test(step)
            || /gh\s+release\s+upload.*--clobber/.test(step),
        );
        const unguarded = releaseSteps.filter(step => !stepHasReleaseGuard(step));
        if (unguarded.length === 0) {
            return pass();
        }
    }

    if (/gh\s+release\s+edit/.test(buildJob)) {
        return fail(
            "Build job contains 'gh release edit'. Without a reliable new-version gate this overwrites the notes/title of an existing release on every push."
        );
    }

    if (/--clobber/.test(buildJob)) {
        return fail(
            "Build job uses 'gh release upload ... --clobber'. Without a reliable new-version gate this replaces assets on an already-published release."
        );
    }

    return fail(
        "Build job is missing a reliable new-version gate, so existing releases cannot be protected from edits/clobbers."
    );
});

check("Publish GitHub release step guards --latest so old tags cannot demote latest", () => {
    if (!buildJob) {
        return fail("could not locate the Build job in .github/workflows/build.yml");
    }

    const publishStep = buildSteps.find(step => /gh\s+release\s+(edit|create)/.test(step));
    if (!publishStep) {
        return fail("could not locate the 'Publish GitHub release' step in the Build job");
    }

    const hasIsLatestDetermination = buildSteps.some(step =>
        /id:\s*is_latest/.test(step)
        && /is_latest\s*=\s*(?:true|false|\$)/i.test(step)
        && /latest(?:_tag)?|\$pkg|\$latest|\$VERSION|steps\.tag\.outputs\.latest/i.test(step)
    );

    const runBlock = publishStep.split(/\r?\n/).slice(1).join("\n");
    const hasHardcodedLatest = /gh\s+release\s+(?:edit|create)\b[^#]*--latest/.test(runBlock);

    if (hasHardcodedLatest && !hasIsLatestDetermination) {
        return fail(
            "The publish step hardcodes --latest on gh release create/edit commands and the Build job has no "
            + "is_latest determination step. Pushing an older v* tag would move GitHub's 'latest' release pointer backward."
        );
    }

    if (hasHardcodedLatest) {
        return fail(
            "The publish step still hardcodes --latest on gh release commands. After computing is_latest, "
            + "--latest must be supplied through that variable/conditional so older tags are not marked latest."
        );
    }

    if (!hasIsLatestDetermination) {
        return fail(
            "Build job has no step that computes is_latest=true/false by comparing the package version to the "
            + "latest tag, so --latest cannot be safely guarded."
        );
    }

    return pass();
});

check("Build workflow jobs skip branch pushes by github-actions[bot] while allowing tag pushes", () => {
    if (!buildYml) {
        return fail("could not read .github/workflows/build.yml");
    }

    const releaseJobs = ["InstallerLinux", "InstallerWindows", "InstallerMac", "Build"];
    const missing = [];

    for (const jobName of releaseJobs) {
        const jobYaml = extractWorkflowJob(buildYml, jobName);
        if (!jobYaml) {
            missing.push(`${jobName}: job not found`);
            continue;
        }

        const jobHeader = extractJobHeader(jobYaml);
        const hasTagAllow = /github\.ref_type\s*==\s*['"]tag['"]/.test(jobHeader);
        const hasBotBlock = /github\.actor\s*!=\s*['"]github-actions\[bot\]['"]/.test(jobHeader);
        const hasOrCombination = /\|\|/.test(jobHeader);

        if (!(hasTagAllow && hasBotBlock && hasOrCombination)) {
            missing.push(`${jobName}: missing 'if: github.ref_type == 'tag' || github.actor != 'github-actions[bot]' guard`);
        }
    }

    if (missing.length > 0) {
        return fail(
            "Release jobs must skip branch pushes authored by github-actions[bot] while still running for "
            + "tag pushes; otherwise the auto-bump's commit push and tag push trigger two duplicate release builds that race. "
            + "Missing guards:\n" + missing.join("\n")
        );
    }

    return pass();
});

check("README Quick Start is platform-specific before mentioning bash install.sh", () => {
    const quickStartMatch = readme.match(/##\s+Quick\s+Start[\s\S]*?(?=\n##\s)/i);
    if (!quickStartMatch) {
        return fail("could not locate ## Quick Start section in README.md");
    }

    const section = quickStartMatch[0];

    // Accept explicit Windows instructions, either as sub-heading or details block.
    const hasWindowsSubsection = /#{2,4}\s*Windows|<summary>\s*Windows\s*<\/summary>/i.test(section);
    const hasWindowsExe = /OpenCordInstaller.*\.exe/i.test(section);

    if (!hasWindowsSubsection || !hasWindowsExe) {
        return fail(
            "README 'Quick Start' must contain a dedicated Windows subsection pointing users to the .exe installers before (or instead of) the bash install.sh command."
        );
    }

    return pass();
});

check("README Quick Start does not present bash install.sh as the default for Windows", () => {
    const quickStartMatch = readme.match(/##\s+Quick\s+Start[\s\S]*?(?=\n##\s)/i);
    if (!quickStartMatch) {
        return fail("could not locate ## Quick Start section in README.md");
    }

    const section = quickStartMatch[0];
    const hasBashInstallBlock = /```[a-z]*\s*\n?bash\s+-c\s+"[^"]*install\.sh/.test(section)
        || /```[a-z]*[\s\S]*?install\.sh[\s\S]*?```/.test(section);

    if (!hasBashInstallBlock) {
        // No bash block at all in Quick Start -- that's fine.
        return pass();
    }

    const hasWindowsExeBlock = /```[a-z]*[\s\S]*?OpenCordInstaller.*\.exe[\s\S]*?```/.test(section);
    const hasWindowsNote = /Windows users?\s+(should|must|can).*\.exe/i.test(section);

    if (!hasWindowsExeBlock && !hasWindowsNote) {
        return fail(
            "README 'Quick Start' shows a bash install.sh command but gives Windows users no equivalent .exe instruction in the same section."
        );
    }

    return pass();
});

check("misc/install.sh guards against Windows/MSYS/Cygwin execution", () => {
    // Abort if run on a Windows-like shell environment.
    const hasWindowsDetection = /CYGWIN|MINGW|MSYS|win32/i.test(installSh);
    const hasAbortBeforeWork = /(?:CYGWIN|MINGW|MSYS|win32)[\s\S]{0,400}\bexit\b/i.test(installSh);

    if (!hasWindowsDetection || !hasAbortBeforeWork) {
        return fail(
            "misc/install.sh must detect Windows/MSYS/Cygwin early (e.g. via uname -s or OSTYPE) and exit before downloading the Linux ELF installer."
        );
    }

    return pass();
});

check("misc/install.sh Windows guard points to the Windows installer", () => {
    const guardRegion = installSh.match(/(?:CYGWIN|MINGW|MSYS|win32)[\s\S]{0,600}/i)?.[0] ?? "";
    if (!guardRegion) {
        return fail("could not locate a Windows guard region in misc/install.sh");
    }

    if (!/OpenCordInstaller.*\.exe/i.test(guardRegion) && !/releases\/latest\/download\/OpenCordInstaller/i.test(guardRegion)) {
        return fail(
            "The Windows guard in misc/install.sh must tell users to download OpenCordInstaller.exe / OpenCordInstallerCli.exe."
        );
    }

    return pass();
});

// ---------------------------------------------------------------------------
// Automated version-bump / tag workflow
// ---------------------------------------------------------------------------

check("CI has an automated workflow that bumps package.json and creates a v* tag", () => {
    const autoWorkflow = workflows.find(w => hasAutoBumpAndTag(w.text));

    if (!autoWorkflow) {
        return fail(
            "None of the .github/workflows/*.yml files both bump package.json and push a new v* tag. "
            + "Add a guarded workflow that increments the version (e.g. npm version patch) and pushes the resulting v* tag so releases are always fresh."
        );
    }

    passes.push(`detected auto version/tag workflow: ${autoWorkflow.name}`);
    return pass();
});

check("Automated version/tag workflow includes a guard against self-triggered loops", () => {
    const autoWorkflow = workflows.find(w => hasAutoBumpAndTag(w.text));

    if (!autoWorkflow) {
        return fail("cannot check loop guard because no automated version/tag workflow was found");
    }

    if (!hasLoopGuard(autoWorkflow.text)) {
        return fail(
            `The automated version/tag workflow (${autoWorkflow.name}) must include a loop guard `
            + "(e.g. github.actor != 'github-actions[bot]' or concurrency:) so its own commit/tag does not trigger infinite runs."
        );
    }

    return pass();
});

check("Pushing workflows can be skipped on bot-authored commits", () => {
    // The main build workflow pushes tags; the version-bump workflow pushes commits/tags.
    // At least one of them should ignore bot-authored pushes to avoid runaway loops.
    const pushingWorkflows = workflows.filter(w => /git\s+push/.test(w.text) || /gh\s+release\s+/.test(w.text));
    const guarded = pushingWorkflows.some(w => hasLoopGuard(w.text));

    if (!guarded) {
        return fail(
            "No workflow that pushes tags or releases has a loop guard. If an automated bump commits package.json, "
            + "the resulting push could recursively re-trigger the same workflows."
        );
    }

    return pass();
});

check("Automated bump workflow uses pnpm version patch", () => {
    const autoWorkflow = workflows.find(w => hasAutoBumpAndTag(w.text));

    if (!autoWorkflow) {
        return fail("cannot check version command because no automated version/tag workflow was found");
    }

    if (!/pnpm\s+version\s+patch\s+--no-git-tag-version/.test(autoWorkflow.text)) {
        return fail(
            `The automated bump workflow (${autoWorkflow.name}) must use 'pnpm version patch --no-git-tag-version' `
            + "because this project uses pnpm-lock.yaml (not package-lock.json); using 'npm version patch' can introduce an npm lockfile."
        );
    }

    return pass();
});

check("Automated bump workflow pushes commit and tag in one atomic command", () => {
    const autoWorkflow = workflows.find(w => hasAutoBumpAndTag(w.text));

    if (!autoWorkflow) {
        return fail("cannot check push command because no automated version/tag workflow was found");
    }

    // A single git push with both HEAD and the tag keeps main and the tag in sync.
    if (!/git\s+push\s+origin\s+HEAD\s+v\$\{VERSION\}/.test(autoWorkflow.text)) {
        return fail(
            `The automated bump workflow (${autoWorkflow.name}) must push the commit and tag together with `
            + "'git push origin HEAD v${VERSION}'. Two separate pushes risk main advancing while the tag push fails."
        );
    }

    return pass();
});

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

if (failures.length) {
    console.error("Release versioning / Windows installer docs RED tests failed:");
    for (const { name, message } of failures) {
        console.error(`\n[FAIL] ${name}\n${message.split("\n").map(line => `  ${line}`).join("\n")}`);
    }
    console.error(`\n${passes.length} passed, ${failures.length} failed.`);
    process.exit(1);
}

console.log(`Release versioning / Windows installer docs RED tests passed: ${passes.length} checks.`);
