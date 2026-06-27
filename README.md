<div align="center">

<img alt="OpenCord symbol" src="./assets/branding/opencord-symbol-dark.svg" width="96" height="96">

# OpenCord

OpenCord is an open source Discord client mod forked from [Equicord](https://github.com/Equicord/Equicord) and [Vencord](https://github.com/Vendicated/Vencord), focused on a massive cross-community plugin catalog with 1138 plugin source folders. The desktop settings list currently shows about 795 visible plugins after build filters.

<p><a href="https://github.com/MasuRii/OpenCord/stargazers"><img alt="Stars" src="https://img.shields.io/badge/Stars-1-181717?style=flat&logo=github&logoColor=white"></a>&nbsp;&nbsp;<a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/License-GPL--3.0--or--later-blue?style=flat"></a>&nbsp;&nbsp;<a href="package.json"><img alt="Version" src="https://img.shields.io/badge/Version-1.14.15.1-blue?style=flat"></a>&nbsp;&nbsp;<a href="https://www.typescriptlang.org/"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-6.0.2-3178C6?style=flat&logo=typescript&logoColor=white"></a>&nbsp;&nbsp;<a href="https://pnpm.io/"><img alt="pnpm" src="https://img.shields.io/badge/pnpm-11.8.0-F69220?style=flat&logo=pnpm&logoColor=white"></a>&nbsp;&nbsp;<a href="https://equicord.org/discord"><img alt="Discord" src="https://img.shields.io/discord/1173279886065029291.svg?color=5865F2&label=Discord&logo=discord&logoColor=white"></a></p>

<strong>Plugin collections</strong><br>
<p><a href="https://github.com/Vendicated/Vencord"><img alt="Vencord logo" src="https://github.com/Vendicated.png?size=20" height="20"></a>&nbsp;<a href="https://github.com/Vendicated/Vencord"><img alt="Vencord plugins" src="https://img.shields.io/badge/Vencord-164-5865F2?style=flat"></a>&nbsp;&nbsp;<a href="https://github.com/Equicord/Equicord"><img alt="Equicord logo" src="https://github.com/Equicord.png?size=20" height="20"></a>&nbsp;<a href="https://github.com/Equicord/Equicord"><img alt="Equicord plugins" src="https://img.shields.io/badge/Equicord-200-768AD4?style=flat"></a>&nbsp;&nbsp;<a href="https://github.com/TestcordDev/TestCord"><img alt="TestCord logo" src="assets/branding/testcord-icon.png" height="20"></a>&nbsp;<a href="https://github.com/TestcordDev/TestCord"><img alt="TestCord plugins" src="https://img.shields.io/badge/TestCord-403-111827?style=flat"></a>&nbsp;&nbsp;<a href="https://github.com/ImHisako/Illegalcord"><img alt="Illegalcord logo" src="assets/branding/illegalcord-icon.png" height="20"></a>&nbsp;<a href="https://github.com/ImHisako/Illegalcord"><img alt="Illegalcord plugins" src="https://img.shields.io/badge/Illegalcord-66-8B5CF6?style=flat"></a>&nbsp;&nbsp;<a href="https://github.com/MallCord/MallCord"><img alt="MallCord logo" src="assets/branding/mallcord-icon.png" height="20"></a>&nbsp;<a href="https://github.com/MallCord/MallCord"><img alt="MallCord plugins" src="https://img.shields.io/badge/MallCord-267-10B981?style=flat"></a>&nbsp;&nbsp;<a href="https://github.com/Chaython/EquicordPlus"><img alt="Equicord+ logo" src="assets/branding/equicordplus-icon.png" height="20"></a>&nbsp;<a href="https://github.com/Chaython/EquicordPlus"><img alt="Equicord+ plugins" src="https://img.shields.io/badge/Equicord%2B-17-F59E0B?style=flat"></a>&nbsp;&nbsp;<a href="https://github.com/LOSTSTR/Esharq"><img alt="Esharq logo" src="assets/branding/esharq-icon.png" height="20"></a>&nbsp;<a href="https://github.com/LOSTSTR/Esharq"><img alt="Esharq plugins" src="https://img.shields.io/badge/Esharq-18-EF4444?style=flat"></a>&nbsp;&nbsp;<a href="https://github.com/MasuRii/OpenCord"><img alt="OpenCord logo" src="assets/branding/opencord-symbol-dark.svg" height="20"></a>&nbsp;<a href="https://github.com/MasuRii/OpenCord"><img alt="OpenCord plugins" src="https://img.shields.io/badge/OpenCord-3-0F172A?style=flat"></a></p>

[Quick Start](#quick-start) · [Features](#features) · [Plugin Collections](#plugin-collections) · [Installing](#installing--uninstalling) · [Dev Build](#installing-opencord-dev-build) · [Contributing](#contributing)

</div>

> OpenCord gives Discord power users a larger plugin library while preserving the Vencord and Equicord development model: TypeScript plugins, reusable Discord components, and source-first customization.

---

## Features

| Feature | Description |
|---|---|
| 1138 plugin source folders | Combines Vencord, Equicord, TestCord, Illegalcord, MallCord, Equicord+, Esharq, and OpenCord plugins. |
| About 795 visible plugins | Approximates the desktop in-app settings list; it can be lower because source folders include duplicate names, API/core helpers, and platform or dev-targeted entries filtered out at build time. |
| Cross-platform builds | Supports desktop injection and browser extension builds for Windows, macOS, Linux, and web. |
| Fast setup | Use the installer for normal usage or build from source with pnpm. |
| Developer friendly | TypeScript, React, webpack utilities, hot watch builds, and plugin-specific folders. |
| Community driven | Plugin collections come from multiple open source communities and individual maintainers. |
| Open source | Distributed under GPL-3.0-or-later. |

---

## Quick Start

<details open>
<summary>Windows</summary>

Download and run the GUI installer:

```powershell
Invoke-WebRequest -Uri "https://github.com/MasuRii/OpenCord/releases/latest/download/OpenCordInstaller.exe" -OutFile "OpenCordInstaller.exe"
Start-Process "OpenCordInstaller.exe"
```

</details>

<details>
<summary>macOS</summary>

Download the ZIP for your Mac, extract it, then open `OpenCordInstaller.app`.

- [X64 GUI](https://github.com/MasuRii/OpenCord/releases/latest/download/OpenCord-darwin-x64.zip)
- [ARM64 GUI](https://github.com/MasuRii/OpenCord/releases/latest/download/OpenCord-darwin-arm64.zip)

</details>

<details>
<summary>Linux</summary>

Run the installer script:

```shell
bash -c "$(curl -sS https://github.com/MasuRii/OpenCord/releases/latest/download/install.sh)"
```

</details>

> [!NOTE]
> OpenCord is a client modification. Read the [disclaimer](#disclaimer) before installing it on an account you cannot risk.

---

## Plugin Collections

| Collection | Plugins | Source |
|---|---:|---|
| Vencord | 164 | [Vendicated/Vencord](https://github.com/Vendicated/Vencord) |
| Equicord | 200 | [Equicord/Equicord](https://github.com/Equicord/Equicord) |
| TestCord | 403 | [TestcordDev/TestCord](https://github.com/TestcordDev/TestCord) |
| Illegalcord | 66 | [ImHisako/Illegalcord](https://github.com/ImHisako/Illegalcord) |
| MallCord | 267 | [MallCord/MallCord](https://github.com/MallCord/MallCord) |
| Equicord+ | 17 | [Chaython/EquicordPlus](https://github.com/Chaython/EquicordPlus) |
| Esharq | 18 | [LOSTSTR/Esharq](https://github.com/LOSTSTR/Esharq) |
| OpenCord | 3 | [MasuRii/OpenCord](https://github.com/MasuRii/OpenCord) |

<details>
<summary><strong>Where plugin folders live</strong></summary>

```text
src/plugins/                 Vencord plugins
src/equicordplugins/         Equicord plugins
src/testcordplugins/         TestCord plugins
src/illegalcordplugins/      Illegalcord plugins
src/mallcordplugins/         MallCord plugins
src/equicordplusplugins/     Equicord+ plugins
src/esharqplugins/           Esharq plugins
src/opencordplugins/         OpenCord plugins
```

</details>

---

## Installing / Uninstalling

> [!NOTE]
> OpenCord currently uses Equilotl as its desktop installer backend, but these downloads are mirrored through OpenCord releases.

<details open>
<summary><strong>Windows</strong></summary>

- [GUI Installer](https://github.com/MasuRii/OpenCord/releases/latest/download/OpenCordInstaller.exe)
- [CLI Installer](https://github.com/MasuRii/OpenCord/releases/latest/download/OpenCordInstallerCli.exe)

</details>

<details>
<summary><strong>macOS</strong></summary>

- [X64 GUI](https://github.com/MasuRii/OpenCord/releases/latest/download/OpenCord-darwin-x64.zip)
- [ARM64 GUI](https://github.com/MasuRii/OpenCord/releases/latest/download/OpenCord-darwin-arm64.zip)

</details>

<details>
<summary><strong>Linux</strong></summary>

- [GUI Installer](https://github.com/MasuRii/OpenCord/releases/latest/download/OpenCord-x11)
- [CLI Installer](https://github.com/MasuRii/OpenCord/releases/latest/download/OpenCordCli-linux)
- [Install script](https://github.com/MasuRii/OpenCord/releases/latest/download/install.sh)

</details>

---

## Installing OpenCord Dev Build

> [!NOTE]
> These steps are for building OpenCord from source. Most users should use the [Quick Start](#quick-start) installer.

### Dependencies

| Dependency | Version |
|---|---|
| Node.js | 18 or newer |
| pnpm | 11.0.9 |
| Git | Current stable |

Install pnpm globally if needed:

```shell
npm i -g pnpm
```

### Build from source

```shell
git clone https://github.com/MasuRii/OpenCord
cd OpenCord
pnpm install --frozen-lockfile
pnpm build
pnpm inject
```

### Web extension build

```shell
pnpm buildWeb
```

After building the web extension, locate the ZIP file in `dist` and follow your browser's custom extension installation guide. Firefox extension ZIPs require Firefox Developer Edition.

> [!WARNING]
> Do not run inject/build commands from an admin or root terminal. It can damage your Discord/OpenCord installation and force a reinstall.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript |
| Runtime | Node.js 18+ |
| Package manager | pnpm 11.8.0 |
| UI | React through Discord-native components |
| Bundling | Custom webpack-based build pipeline |
| Styling | CSS plus managed runtime styles |
| Validation | TypeScript, ESLint, Stylelint, patch linting, and build checks |

---

## Contributing

1. Fork the repository.
2. Create a branch: `git checkout -b feature/amazing-feature`.
3. Make a focused change that follows `AGENTS.md`.
4. Commit with a clear message.
5. Push and open a pull request.

Join the [Discord server](https://equicord.org/discord) if you need setup help or want to discuss plugin ideas.

---

## Credits

Thank you to [Vendicated](https://github.com/Vendicated) for creating [Vencord](https://github.com/Vendicated/Vencord), [Equicord](https://github.com/Equicord/Equicord) and its contributors for building on that foundation, and [Suncord](https://github.com/verticalsync/Suncord) by [verticalsync](https://github.com/verticalsync) for helping when needed.

---

## Star History

<a href="https://star-history.com/#MasuRii/OpenCord&Timeline">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=MasuRii/OpenCord&type=Timeline&theme=dark" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=MasuRii/OpenCord&type=Timeline" />
    <img alt="OpenCord star history chart" src="https://api.star-history.com/svg?repos=MasuRii/OpenCord&type=Timeline" />
  </picture>
</a>

---

## License

Distributed under the [GPL-3.0-or-later](LICENSE) license.

---

## Disclaimer

Discord is a trademark of Discord Inc., mentioned here solely for descriptive purposes. This project is not affiliated with or endorsed by Discord Inc.

Vencord and Equicord are not connected to OpenCord. All donation links go to their respective projects.

<details>
<summary>Using OpenCord violates Discord's terms of service</summary>

Client modifications are against Discord's Terms of Service.

Discord is generally indifferent toward client mods, and there are no known cases of users being banned only for using them. You should still avoid plugins that implement abusive behavior.

If your account is essential to you and losing it would be a disaster, do not use any client mod. Also avoid posting screenshots with OpenCord in places where client mods could get you banned.

</details>
