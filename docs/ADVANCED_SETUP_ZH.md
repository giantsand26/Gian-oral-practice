# Gian Oral Practice 中文高级手动安装与维护

本文件面向希望手工管理服务的高级用户。普通用户请优先按照根目录 README 的
“中文小白安装指南”，把技术配置交给 Codex。

## 手动安装

```bash
git clone https://github.com/giantsand26/Gian-oral-practice.git
cd Gian-oral-practice
node --version
npm --version
npm ci
npm run build
npm test
GIAN_ALLOWED_HOSTS="<你的准确Tailscale主机名>.ts.net" npm start
```

服务地址：

- 统一入口：`http://127.0.0.1:3000`
- 内部 Web：`http://127.0.0.1:3001`
- 私有 API：`http://127.0.0.1:8787`
- 健康检查：`http://127.0.0.1:8787/api/health`

## 手动建立 Codex 配置

```bash
cp AGENTS.example.md AGENTS.md
```

替换：

- `<CHATGPT_PROJECT_ID>`
- `<PRIMARY_CHAT_THREAD_ID>`
- `<HISTORICAL_CHAT_THREAD_ID_OR_NONE>`
- `<ABSOLUTE_APP_DIRECTORY>`
- `<IANA_TIMEZONE>`

`AGENTS.md` 已被 Git 忽略，不应公开。

## 手动设置 LaunchAgent

```bash
which npm
pwd
mkdir -p "$HOME/Library/LaunchAgents"
cp ops/com.gian.oral-practice.plist.example \
  "$HOME/Library/LaunchAgents/com.gian.oral-practice.plist"
```

编辑复制后的 plist：

- `<ABSOLUTE_APP_DIRECTORY>` 替换为 `pwd` 的结果；
- `<ABSOLUTE_NPM_PATH>` 替换为 `which npm` 的结果。
- `<EXACT_TAILSCALE_HOSTNAME>` 替换为 `tailscale serve status` 显示的准确
  `.ts.net` 主机名，不要填写通配符或其他域名。

加载：

```bash
launchctl bootstrap "gui/$(id -u)" \
  "$HOME/Library/LaunchAgents/com.gian.oral-practice.plist"
launchctl kickstart -k "gui/$(id -u)/com.gian.oral-practice"
```

重新加载前先运行：

```bash
launchctl bootout "gui/$(id -u)" \
  "$HOME/Library/LaunchAgents/com.gian.oral-practice.plist"
```

日志：

- `.runtime/app.stdout.log`
- `.runtime/app.stderr.log`

## 手动配置 Tailscale

```bash
tailscale serve --bg --https=443 3000
tailscale serve status
```

只使用 Serve，禁止 Funnel。保持服务绑定 `127.0.0.1`。
服务只接受 localhost 和你在 `GIAN_ALLOWED_HOSTS` 中明确填写的 Tailscale
主机名；这是为了防止恶意网页借 DNS 重绑定读取本地练习记录。

## 手动导入报告

可信 JSON 必须保存为：

```text
.runtime/incoming/<report-id>.json
```

文件名必须与报告 ID 一致：

```bash
node server/import-report.mjs \
  "/绝对路径/Gian-oral-practice/.runtime/incoming/<report-id>.json"
```

导入器拒绝目录外文件、符号链接、超过 256 KiB 的文件和文件名与 ID 不一致的
报告。重复导入视为成功，内容冲突不会覆盖。

## 备份与升级

- App 停止时备份 `.runtime/practices.json`。
- 升级前备份整个 `.runtime/`。
- 运行 `git pull`、`npm ci`、`npm run build` 后重启 LaunchAgent。
- 不要把 `.runtime/`、`AGENTS.md` 或真实报告提交到 Git。

## 开发验证

```bash
npm run typecheck
npm run lint
npm test
npm audit --omit=dev
```

不要盲目运行 `npm audit fix --force`。
