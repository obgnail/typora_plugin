# macOS 实验性 Beta

[English](macos.md) · [安全审计](macos-security-audit.md) · [发布说明草稿](releases/v0.1.0-macos-beta.md)

本流程仅验证了 macOS arm64/x86_64 上的 Typora **1.14.15**。安装器会复制并临时签名一个私人开发副本；它未经 Apple 公证，也不是 Typora 官方版本。请勿分发修改后的 `Typora.app`。

## 环境与安装

需要 `/Applications/Typora.app` 中的 1.14.15 正版应用、PATH 中的 Node.js 22/24 LTS，以及未被 iCloud/File Provider 同步的本地目录。安装、更新和卸载前必须完全退出 Typora。

```bash
plugin/bin/install_macos.sh --dry-run
plugin/bin/install_macos.sh --yes
codesign --verify --deep --strict --verbose=2 /private/tmp/Typora-Plugin-Beta.app
open -n /private/tmp/Typora-Plugin-Beta.app
```

默认目标为 `/private/tmp/Typora-Plugin-Beta.app`，不会修改 `/Applications/Typora.app`。安装器会检查版本和架构、备份原始状态、写入外部配置、轮换桥接令牌、创建最小权限 LaunchAgent，并从内到外进行 ad-hoc 签名。重复安装是幂等的。

诊断命令：

```bash
plugin/bin/diagnose_macos.sh --app /private/tmp/Typora-Plugin-Beta.app
```

## 卸载

```bash
plugin/bin/uninstall_macos.sh --app /private/tmp/Typora-Plugin-Beta.app --yes
```

卸载器会停止并删除 LaunchAgent、恢复原始 `index.html` 和插件目录、删除桥接凭据并重新签名隔离副本。用户配置和事务备份会保留；再次卸载不会报错。

## 安全模型

桥接服务只监听 `127.0.0.1`，要求 256 位令牌及精确的 `Origin: null`/`file://`，只开放有限 RPC 方法，并限制请求和读取大小。插件目录只读，只有 `~/.config/typora_plugin` 可写；路径中的符号链接会被拒绝，不提供 Shell 或通用网络执行能力。

WKWebView 的本地文件使用 `null` Origin，因此必须接受它，但 Origin 本身不能证明调用者身份。令牌嵌入在私人应用副本中，同一 macOS 用户运行的其他进程仍可读取。这是同一用户的信任边界，并非完整沙箱。

## 已验证插件

| 插件 | UI 与交互 | 持久化 | 快捷键 | 结果 |
|---|---|---|---|---|
| `callouts` | 原生提示块及折叠悬停 | 不适用 | 未配置 | 可用 |
| `editor_width_slider` | 对话框及 73% 宽度调整 | 通过 | 未配置 | 可用 |
| `collapse_paragraph` | Command+点击折叠/展开 | 通过 | 通过 | 可用 |
| `fence_enhance` | 工具栏及真实代码块折叠 | 通过 | 默认未配置 | 可用 |
| `command_palette` | 搜索、Esc 关闭 | 不适用 | `Control/Command+Shift+P` 通过 | 可用 |
| `markmap` | SVG 节点及 Fit 操作 | 会话内 | 默认未配置 | 可用 |

实际测试使用 `/private/tmp` 中的 Typora 1.14.15、真实 Markdown 文档、认证运行报告，并在启动后观察 14 秒。框架多次冷启动成功；卸载/重装同时有真实应用测试和自动回归测试。

## 已知限制

- ad-hoc 签名仅用于本机开发；不是 Apple 公证或可分发签名。
- 只声明上述六个插件与 Typora 1.14.15 兼容，其他插件尚未验证。
- 需要用户级 LaunchAgent，并占用本地端口 45678。
- 不要放在桌面/iCloud/File Provider 同步位置；扩展属性可能破坏签名。
- 不会自动移除 quarantine，不会关闭 SIP 或 Gatekeeper，也不会修改 Typora 压缩源码。
