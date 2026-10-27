# 发布与自动更新

## 一次性配置

应用更新使用 Tauri updater，需要一对签名密钥。密钥已在生成时写入本机、公钥已写入 `src-tauri/tauri.conf.json`：

- 私钥：`~/.tauri/project_manager.key`（无密码，**不要提交进仓库**）
- 公钥：`tauri.conf.json` → `plugins.updater.pubkey`

在 GitHub 仓库 **Settings → Secrets and variables → Actions** 添加：

| Secret | 值 |
| --- | --- |
| `TAURI_SIGNING_PRIVATE_KEY` | `~/.tauri/project_manager.key` 文件的完整内容（单行 base64） |

用下面的命令复制到剪贴板：

```bash
pbcopy < ~/.tauri/project_manager.key
```

私钥没设密码，所以**不需要** `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`（GitHub 也不接受空值 secret）。

换密钥时：重新执行 `pnpm tauri signer generate -w ~/.tauri/project_manager.key`，把新公钥替换到 `tauri.conf.json`，并更新上面的 secret。换公钥后，已经在用户机器上的旧版本将无法验证新签名，等于更新链路断开。

## 两条发布通道

`.github/workflows/release.yml` 在 macOS 上构建 universal（Intel + Apple Silicon）产物：

| 触发 | 产物 | Release |
| --- | --- | --- |
| push `main` | `Project Manager_0.1.<构建号>_universal.dmg` + `.app.tar.gz` + `latest.json` | tag `latest`，标记为 prerelease；每次覆盖上一批资产 |
| push tag `v1.0.0` | `Project Manager_1.0.0_universal.dmg` + `.app.tar.gz` + `latest.json` | 正式 Release `v1.0.0` |

- `main` 的构建号取自 GitHub Actions 的 `run_number`，只增不减，latest 通道的产物可以互相升级。
- 正式版本号取自 tag（去掉 `v` 前缀），构建时写入 `tauri.conf.json`，仓库里的 `0.1.0` 只是开发默认值。

## 自动更新怎么走

- 应用内配置的更新端点是 `https://github.com/swaince/project_manager/releases/latest/download/latest.json`。
- GitHub 的 `releases/latest` 会跳过 prerelease，所以只有 **tag 正式版本**会被所有客户端发现；`main` 的 latest 构建不会把正式版用户带到开发版本上。
- 如果希望客户端始终跟进 `main` 的构建（开发通道），把 `tauri.conf.json` 里的 endpoint 改成 `https://github.com/swaince/project_manager/releases/download/latest/latest.json` 即可——但那样正式版用户也会被升级到 main 构建。
- 用户在「设置 → 版本与更新 → 检查更新」里检测、下载、安装，安装完成后应用自动重启。
- `latest.json` 里同时写入 `darwin-x86_64` 和 `darwin-aarch64` 两个平台键，指向同一个 universal 产物，Intel 和 Apple Silicon 都能更新。

## 发布一个版本

```bash
git tag v1.0.0
git push origin v1.0.0
```

等 Actions 跑完，GitHub Release 里会出现 dmg、`.app.tar.gz` 及其 `.sig`、`latest.json`。之后装过旧版本的机器点「检查更新」就能升到 1.0.0。

## 本地构建注意

`tauri.conf.json` 开了 `createUpdaterArtifacts`，本地 `pnpm tauri:build` 也需要签名私钥，否则打包会失败：

```bash
TAURI_SIGNING_PRIVATE_KEY=~/.tauri/project_manager.key pnpm tauri:build
```

`pnpm tauri:dev` 不受影响。

## 签名与公证

当前没有配置 Apple Developer 证书：CI 产物是 ad-hoc 签名、未公证。用户从 GitHub 下载的 dmg 首次打开需要在 Finder 里右键 →「打开」绕过 Gatekeeper；自动更新本身不受影响。如果以后要做正式分发，在 workflow 里加 `APPLE_CERTIFICATE`、`APPLE_SIGNING_IDENTITY`、`APPLE_ID` 等 secret 即可，`tauri-action` 会自动签名并公证。
