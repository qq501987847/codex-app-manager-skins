# Codex App Manager Skins

这是 AWAI 的自有皮肤目录，提供可由 Codex App Manager 直接安装的 `.codexskin` 包。

## 目录结构

- `themes/<id>/`：可编辑的主题源文件。
- `packs/<id>-<version>.codexskin`：Manager 可导入的发布包。
- `previews/<id>.webp`：商店目录封面。
- `index.json`：只使用相对路径的在线目录，Manager 会在下载前校验 SHA-256。

GitHub 是主源，Gitee 是备用源。两个仓库应保持同一份内容和分支结构。

## 本地重建

先在 Manager 仓库生成当天的 AWAI 皮肤候选，再在本仓库重建目录：

```bash
cd ../Codex-App-Manager
node scripts/build-dream-skins-from-wallpapers.mjs
cd ../Codex-App-Manager-Skins
node scripts/build-catalog.mjs
```

脚本会重新生成 `themes/`、`packs/`、`previews/` 和 `index.json`。`codeThemeIds` 使用 Codex 内置的 `absolutely`，这是当前 Manager 原生主题契约中的默认可用代码主题 ID。

当前包已通过 Manager 引擎校验，但尚未在 Windows Codex 中逐套真机确认，因此 `codexVerified` 暂时为空。真机验证后再写入实际 Codex 版本，避免制造错误的兼容性标记。

## 发布注意

这些主题使用仓库所有者提供的壁纸，默认许可证为 `personal-use`。发布包含人物、商标或第三方素材的壁纸前，请确认你拥有相应的再分发权利。

AWAI 品牌、`#69A5FA` 管理器主题色和 `api.awai.cc` 地址由 Manager 负责展示和配置；皮肤包使用 `awai-<序号>` 作为稳定 ID。
