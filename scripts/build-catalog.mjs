#!/usr/bin/env node

// Convert the local wallpaper candidates into Manager-native .codexskin
// packages and build the relative-path catalog consumed by the desktop app.
// The input directory is the output of Codex-App-Manager's wallpaper builder.

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(import.meta.dirname, "..");
const DEFAULT_INPUT = path.resolve(
  ROOT,
  "..",
  "Codex-App-Manager",
  "dist",
  "dream-skins-20260814-v3",
);
const VERSION = "1.0.0";
const CODE_THEME_ID = "absolutely";
const AUTHOR = "Codex App Manager Team";
const CODEX_VERIFIED = null;

const CSS = `/* Wallpaper skin: intentionally scoped for complete runtime removal. */
html.codex-theme-studio {
  color-scheme: dark !important;
}

html.codex-theme-studio body {
  background:
    linear-gradient(90deg, rgba(10, 14, 20, .92), rgba(10, 14, 20, .74) 52%, rgba(10, 14, 20, .52)),
    var(--cts-asset-background) center / cover no-repeat fixed,
    var(--cts-color-background) !important;
  color: var(--cts-color-text) !important;
}

html.codex-theme-studio .app-theme {
  background: transparent !important;
}

html.codex-theme-studio .app-shell-left-panel {
  background:
    linear-gradient(180deg, rgba(8, 12, 18, .98), rgba(18, 27, 40, .94)),
    var(--cts-asset-background) center / cover no-repeat !important;
  border-right: 1px solid var(--cts-color-line) !important;
  color: var(--cts-color-text) !important;
}

html.codex-theme-studio .app-shell-left-panel :is(nav, header, footer, div) {
  background-color: transparent !important;
}

html.codex-theme-studio .app-shell-left-panel :is(button, a, span, p, h1, h2, h3, label) {
  color: var(--cts-color-text) !important;
}

html.codex-theme-studio .app-shell-left-panel :is(button, a):hover,
html.codex-theme-studio .app-shell-left-panel [aria-current="page"] {
  background: color-mix(in srgb, var(--cts-color-accent) 18%, transparent) !important;
  box-shadow: inset 3px 0 0 var(--cts-color-accent) !important;
}

html.codex-theme-studio :is(main.main-surface, div.main-surface) {
  isolation: isolate;
  background:
    linear-gradient(90deg, rgba(12, 18, 27, .72), rgba(12, 18, 27, .48)),
    var(--cts-asset-background) center / cover no-repeat,
    var(--cts-color-background) !important;
}

html.codex-theme-studio :is(main.main-surface, div.main-surface) :is(input, textarea, [contenteditable="true"]) {
  background-color: color-mix(in srgb, var(--cts-color-panel) 88%, transparent) !important;
  border-color: var(--cts-color-line) !important;
  color: var(--cts-color-text) !important;
  caret-color: var(--cts-color-accent) !important;
}

html.codex-theme-studio :is(button, [role="button"]):focus-visible,
html.codex-theme-studio :is(input, textarea, [contenteditable="true"]):focus-visible {
  outline: 2px solid var(--cts-color-accent) !important;
  outline-offset: 2px;
}

html.codex-theme-studio :is(.bg-token-main-surface-primary, .bg-token-main-surface-secondary) {
  background-color: color-mix(in srgb, var(--cts-color-panel) 84%, transparent) !important;
}
`;

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
};
const INPUT = path.resolve(flag("input", DEFAULT_INPUT));

const hex = (value, fallback) => (/^#[0-9a-f]{6}$/iu.test(value ?? "") ? value : fallback);

function darken(value, amount = 0.28) {
  const color = hex(value, "#69a5fa");
  const channels = [0, 2, 4].map((offset) => Number.parseInt(color.slice(offset + 1, offset + 3), 16));
  return `#${channels.map((channel) => Math.round(channel * (1 - amount)).toString(16).padStart(2, "0")).join("")}`;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function writeJson(file, value) {
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function zipPackage(source, target) {
  try {
    execFileSync("zip", ["-q", "-X", "-r", target, "."], { cwd: source });
    return;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  // Windows 10/11 ships tar.exe with ZIP archive support. On minimal Unix
  // environments Python's standard library is the most reliable fallback.
  if (process.platform === "win32") {
    execFileSync("tar.exe", ["-a", "-c", "-f", target, "-C", source, "."]);
    return;
  }
  const python = [
    "import os, sys, zipfile",
    "source, target = sys.argv[1], sys.argv[2]",
    "with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as archive:",
    "    for root, _, files in os.walk(source):",
    "        for name in sorted(files):",
    "            full = os.path.join(root, name)",
    "            archive.write(full, os.path.relpath(full, source))",
  ].join("\n");
  execFileSync("python3", ["-c", python, source, target]);
}

async function copyTreeEntry(inputDir, outputDir, id, sourceRecord) {
  const oldTheme = JSON.parse(await fs.readFile(path.join(inputDir, "theme.json"), "utf8"));
  const oldColors = oldTheme.colors ?? {};
  const background = hex(oldColors.background, "#101820");
  const panel = hex(oldColors.panel, "#182536");
  const panelAlt = hex(oldColors.panelAlt, "#20334a");
  const accent = hex(oldColors.accent, "#69a5fa");
  const text = hex(oldColors.text, "#f3f7fb");
  const muted = hex(oldColors.muted, "#aeb9c5");
  const line = oldColors.line ?? accent;
  const lightAccent = darken(accent);

  const themeDir = path.join(ROOT, "themes", id);
  const packageDir = path.join(ROOT, ".staging", id);
  await fs.rm(themeDir, { recursive: true, force: true });
  await fs.rm(packageDir, { recursive: true, force: true });
  await fs.mkdir(path.join(themeDir, "assets"), { recursive: true });
  await fs.mkdir(path.join(themeDir, "previews"), { recursive: true });
  await fs.mkdir(path.join(packageDir, "assets"), { recursive: true });
  await fs.mkdir(path.join(packageDir, "previews"), { recursive: true });

  const sourceImage = path.join(inputDir, "background.webp");
  await fs.copyFile(sourceImage, path.join(themeDir, "assets", "background.webp"));
  await fs.copyFile(sourceImage, path.join(themeDir, "previews", "home.webp"));
  await fs.copyFile(sourceImage, path.join(packageDir, "assets", "background.webp"));
  await fs.copyFile(sourceImage, path.join(packageDir, "previews", "home.webp"));
  await fs.writeFile(path.join(themeDir, "theme.css"), CSS, "utf8");
  await fs.writeFile(path.join(packageDir, "theme.css"), CSS, "utf8");

  const theme = {
    schemaVersion: 2,
    id,
    name: oldTheme.name ?? id,
    description: `原创壁纸背景主题：${oldTheme.name ?? id}。仅提供视觉样式，品牌与 API 配置由 Manager 管理。`,
    version: VERSION,
    author: AUTHOR,
    codexVerified: CODEX_VERIFIED,
    appearance: "dual",
    license: "personal-use",
    category: "wallpaper",
    tags: ["wallpaper", "background"],
    previews: ["previews/home.webp"],
    colors: {
      background,
      panel,
      "panel-alt": panelAlt,
      accent,
      "accent-alt": hex(oldColors.accentAlt, accent),
      secondary: hex(oldColors.secondary, accent),
      highlight: hex(oldColors.highlight, accent),
      text,
      muted,
      line,
    },
    assets: { background: "assets/background.webp" },
    codexTheme: {
      appearanceTheme: "dark",
      codeThemeIds: { dark: CODE_THEME_ID, light: CODE_THEME_ID },
      dark: {
        accent,
        contrast: 60,
        ink: text,
        opaqueWindows: true,
        surface: background,
        fonts: { code: "SF Mono", ui: 'SF Pro Display, "PingFang SC"' },
        semanticColors: { diffAdded: "#46c077", diffRemoved: "#d64541", skill: accent },
      },
      light: {
        accent: lightAccent,
        contrast: 60,
        ink: "#1b2430",
        opaqueWindows: true,
        surface: "#f5f8fc",
        fonts: { code: "SF Mono", ui: 'SF Pro Display, "PingFang SC"' },
        semanticColors: { diffAdded: "#24844f", diffRemoved: "#b53632", skill: lightAccent },
      },
    },
  };
  await writeJson(path.join(themeDir, "theme.json"), theme);
  await writeJson(path.join(packageDir, "theme.json"), theme);

  const archive = path.join(ROOT, "packs", `${id}-${VERSION}.codexskin`);
  await fs.mkdir(path.join(ROOT, "packs"), { recursive: true });
  await fs.rm(archive, { force: true });
  zipPackage(packageDir, archive);
  const packBytes = await fs.readFile(archive);
  await fs.mkdir(path.join(ROOT, "previews"), { recursive: true });
  await fs.copyFile(path.join(themeDir, "previews", "home.webp"), path.join(ROOT, "previews", `${id}.webp`));

  sourceRecord.id = id;
  sourceRecord.name = theme.name;
  sourceRecord.description = theme.description;
  sourceRecord.version = VERSION;
  sourceRecord.author = AUTHOR;
  sourceRecord.appearance = "dual";
  sourceRecord.license = "personal-use";
  sourceRecord.category = "wallpaper";
  sourceRecord.tags = theme.tags;
  sourceRecord.codexVerified = CODEX_VERIFIED;
  sourceRecord.bytes = packBytes.length;
  sourceRecord.sha256 = sha256(packBytes);
  sourceRecord.pack = `packs/${id}-${VERSION}.codexskin`;
  sourceRecord.preview = `previews/${id}.webp`;
  return sourceRecord;
}

async function main() {
  const inputStat = await fs.stat(INPUT).catch(() => null);
  if (!inputStat?.isDirectory()) throw new Error(`Input directory does not exist: ${INPUT}`);
  await fs.rm(path.join(ROOT, "themes"), { recursive: true, force: true });
  await fs.rm(path.join(ROOT, "packs"), { recursive: true, force: true });
  await fs.rm(path.join(ROOT, "previews"), { recursive: true, force: true });
  await fs.rm(path.join(ROOT, ".staging"), { recursive: true, force: true });
  await fs.mkdir(path.join(ROOT, ".staging"), { recursive: true });

  const oldIndex = JSON.parse(await fs.readFile(path.join(INPUT, "index.json"), "utf8"));
  const records = [];
  for (const entry of oldIndex.themes ?? []) {
    if (entry.status !== "generated") continue;
    const inputDir = path.join(INPUT, entry.id);
    const record = { sourceFolder: entry.sourceFolder, sourceImage: entry.sourceImage, warning: entry.warning ?? null };
    records.push(await copyTreeEntry(inputDir, path.join(ROOT, "themes"), entry.id, record));
  }
  await fs.rm(path.join(ROOT, ".staging"), { recursive: true, force: true });
  records.sort((a, b) => a.id.localeCompare(b.id));
  await writeJson(path.join(ROOT, "index.json"), {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: "https://github.com/qq501987847/codex-app-manager-skins",
    assetSource: "Local wallpaper candidates supplied by the repository owner",
    sourceBuilder: "Codex-App-Manager/scripts/build-dream-skins-from-wallpapers.mjs",
    skippedFolder: oldIndex.skippedFolder ?? null,
    branding: "Brand, theme color and API address intentionally remain in the Manager.",
    skins: records,
  });
  process.stdout.write(JSON.stringify({ ok: true, skins: records.length, root: ROOT }, null, 2) + "\n");
}

main().catch((error) => {
  process.stderr.write(`${error?.stack ?? error}\n`);
  process.exitCode = 1;
});
