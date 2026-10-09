# Typora 插件安装器（installer）

把第三方 Typora 插件包安装进 Typora 的 `plugin` 目录：**复制核心文件 + 合并配置**，并保证插件能被加载、能出现在右键菜单、且点击有效。

- 形态：**Windows GUI 可执行文件**（自包含单文件 exe，目标机无需安装 .NET），同时提供命令行版本给自动化使用。
- 位置：本目录自成一体（`installer/`），不改动 `plugin/`、`develop/` 下的任何产品代码，便于单独提 PR 与维护。
- 网络：**完全离线**。安装器只读本地目录，不下载任何东西。

---

## 1. 快速开始

### 1.1 GUI（推荐）

1. 拿到 `dist/win-x64/TyporaPluginInstaller.exe`（自己构建见第 6 节）。
2. 双击运行，界面里：
   - **插件包目录**：插件作者提供的目录，里面必须有 `installer.toml`。
   - **plugin 目录**：Typora 的插件目录，通常是 `<Typora 安装目录>/resources/plugin`
     （免费版 0.9.98 是 `<Typora>/resources/app/plugin`）。
3. 先点 **「试运行 / 预览」**：只读地列出将要新增/覆盖的文件与将要改写的配置，不落盘。
4. 确认无误后点 **「开始安装」**：弹出确认框 → 确认 → 写盘。
5. 重启 Typora。右键菜单最下方的插件组里会出现该插件。

### 1.2 命令行

```bash
# 试运行
typora-plugin-installer-cli --source ./my-plugin --target "<Typora>/resources/plugin" --dry-run

# 实际安装
typora-plugin-installer-cli --source ./my-plugin --target "<Typora>/resources/plugin"

# 以 JSON 输出（便于脚本消费）
typora-plugin-installer-cli -s ./my-plugin -t <plugin目录> --json
```

退出码：`0` 成功、`1` 安装失败、`2` 参数错误。

---

## 2. 插件包需要提供哪些文件（充分必要条件）★

这一节是给**插件作者**看的规范。结论先行：

> **必要且充分的条件是三件事：① 一个 `installer.toml`；② 能落到 `plugin/<id>.js` 或 `plugin/<id>/index.js` 的核心文件；③ 插件代码里覆盖 `call`。**
> 除此之外**不需要**提供任何东西——不需要改 Typora 插件系统的任何源码，不需要 schema，不需要 locale，不需要 `settings.default.toml`。

### 2.1 必要条件（缺一不可）

| # | 必须提供 | 判定标准 | 缺了会怎样 |
| --- | --- | --- | --- |
| 1 | `installer.toml`（文件名固定，放在包根目录） | 含 `[plugin] id` 与 `[plugin] name` | 安装器直接拒绝：「找不到安装清单」/「缺少必填项」 |
| 2 | 核心文件，安装后产生 `plugin/<id>.js` 或 `plugin/<id>/index.js` | 由 `install.source` + `install.files` 决定映射 | 安装器直接拒绝：「安装后仍找不到插件入口」——**这一步在写盘前完成，不会留下半成品** |
| 3 | 插件代码 `module.exports = { plugin: class extends BasePlugin {...} }` 且**覆盖 `call`** | `call` 是右键菜单项的点击回调 | 没导出 `plugin` → 插件系统记 `Plugin not found`；没覆盖 `call` → 菜单项被置灰（`pointer-events: none`），看得见点不动 |

> 第 3 条里的"覆盖 `call`"只影响**菜单能否点击**，不影响"能否安装"。如果你把 `[menu] mode` 设为 `none`、只打算用快捷键触发，可以不覆盖它——但那样也不需要本安装器来注册菜单了。

### 2.2 充分条件

满足上面 3 条即已充分。安装器会自动补上剩下的运行时要求：

1. 复制核心文件到目标 `plugin/`；
2. 在 `settings.user.toml` 写入：

   ```toml
   [<id>]
   ENABLE = true
   NAME = "<name>"
   # installer.toml 里 [settings] 的其它键
   ```

3. 在 `settings.user.toml` 写入 `[right_click_menu] FIND_LOST_PLUGINS = true`
   （这会让插件系统把"已加载但没被 MENUS 列出"的插件自动追加到右键菜单的最后一个分组）；
4. 改写前把原 `settings.user.toml` 备份为 `settings.user.toml.bak`。

### 2.3 目录结构模板

```
my-plugin/                      ← 安装器里选的「插件包目录」
├── installer.toml              ← 必需：安装清单
├── core/                       ← 惯例目录（由 install.source 指定）
│   ├── myPlugin.js             ← → plugin/myPlugin.js
│   ├── myPlugin/               ← 或目录形态 → plugin/myPlugin/index.js
│   └── assets/                 ← 资源会一起复制
├── examples/                   ← 不想装的东西就别放在 source 目录里
└── README.md
```

也支持"包根目录就是核心目录"：

```toml
[install]
source = "."
```

此时安装器只复制包根下的运行文件，并自动排除：`installer.toml`、以 `.` 开头的路径段（`.git` 等）、`node_modules`、以及包根的 `*.md` / `README*` / `LICENSE*` / `CHANGELOG*`。

### 2.4 `installer.toml` 字段表

#### `[plugin]`

| 键 | 必需 | 类型 | 说明 |
| --- | --- | --- | --- |
| `id` | ✅ | string | **固定名**。同时是文件名（`plugin/<id>.js`）、TOML 段名（`[<id>]`）、i18n 命名空间。只允许 `^[A-Za-z_][A-Za-z0-9_]*$` |
| `name` | ✅ | string | 显示名。写进 `NAME`，也是右键菜单里显示的标题 |
| `version` | | string | 仅展示 |
| `description` | | string | 仅展示 |
| `author` | | string | 仅展示 |
| `homepage` | | string | 仅展示 |
| `min_typora` | | string | 仅作提示（安装器不做版本比较） |

#### `[install]`

| 键 | 必需 | 默认 | 说明 |
| --- | --- | --- | --- |
| `source` | | `"."` | 核心文件所在目录，相对 `installer.toml`；必须位于插件包目录内，不允许 `..` 逃逸 |
| `files` | | 空 | 显式条目列表（相对 `source`），可以是文件或目录。**填写后只复制这些条目**，忽略整目录扫描；绝对路径与 `..` 一律拒绝 |
| `overwrite` | | `true` | 目标已存在同名文件时是否覆盖。`false` 时跳过并提示 |
| `settings` | | `true` | 是否写 `settings.user.toml`。`false` 时只复制文件 |
| `settings_overwrite` | | `false` | 是否覆盖用户已有的同名配置值。`false` 时只补缺失的键（`ENABLE` 恒为 `true`，不受此开关影响） |

#### `[menu]`

| 键 | 必需 | 默认 | 说明 |
| --- | --- | --- | --- |
| `mode` | | `"auto"` | `auto`：写 `[right_click_menu] FIND_LOST_PLUGINS = true`，插件出现在最后一个菜单组（`__INTERACTIVE_PLUGINS__`）末尾。<br>`none`：不注册菜单 |

#### `[settings]`（可选）

任意 `key = value`（string / bool / int / float / string[]），会被写进 `[<id>]` 段，插件里用 `this.config.KEY` 读取。
不允许出现 `ENABLE` / `NAME`（这两个由 `[plugin]` 与管理逻辑决定）。

### 2.5 完整示例

```toml
[plugin]
id = "helloWorld"
name = "Hello World"
version = "1.0.0"
author = "your-name"

[install]
source = "core"
overwrite = true
settings = true

[menu]
mode = "auto"

[settings]
GREETING = "Hello World"
```

```js
// core/helloWorld.js  →  plugin/helloWorld.js
class helloWorld extends BasePlugin {
  call = () => {
    this.utils.notification.show(this.config.GREETING || "Hello World")
  }
}

module.exports = { plugin: helloWorld }
```

可直接运行的范例见 [`examples/helloWorld/`](examples/helloWorld/)。

---

## 3. 安装器会碰 / 不会碰哪些文件

| 路径 | 行为 |
| --- | --- |
| `<plugin>/<…核心文件…>` | ✅ 新增或覆盖 |
| `<plugin>/global/settings/settings.user.toml` 或 `~/.config/typora_plugin/settings.user.toml` | ✅ 合并写入（先备份 `.bak`） |
| `<plugin>/global/settings/settings.default.toml` | ❌ 绝不修改（它属于发行包，升级会被覆盖） |
| `<plugin>/global/locales/*.json` | ❌ 不修改 |
| `<plugin>/preferences/schemas.js` | ❌ 不修改 |
| `settings.user.toml` 里 `[right_click_menu] MENUS` 数组 | ❌ 不修改（只新增 `FIND_LOST_PLUGINS`，因此默认菜单分组原样保留） |
| 其它插件的配置段、注释、空行、键顺序 | ❌ 原样保留 |

**配置写到哪一份？** 安装器复刻运行时的 `utils.settings.getUserTomlPath()` 逻辑：
`~/.config/typora_plugin/settings.user.toml` 存在就用它，否则用 `<plugin>/global/settings/settings.user.toml`。
（Windows 下 `~` 即 `C:\Users\<你>`，所以是 `C:\Users\<你>\.config\typora_plugin\settings.user.toml`。）

---

## 4. 安装器帮你挡掉的坑

写盘**之前**就会拒绝的情况：

- 目标目录看起来不是 Typora 的 `plugin` 目录（不含 `global/settings/settings.default.toml`、`global/core/`、`index.js`）。
  确实想装到别处时，命令行加 `--allow-non-plugin-target`，GUI 勾选「允许目标目录不含插件系统」。
- 清单缺失、语法错误、缺 `id`/`name`、`id` 非法、`[menu] mode` 取值非法、`[settings]` 里出现保留键。
- `install.source` / `install.files` 指向不存在的路径，或用 `..`/绝对路径逃逸出插件包。
- 安装后仍然找不到 `plugin/<id>.js` 或 `plugin/<id>/index.js`。

只是**警告**、不阻断的情况：

- 插件文件里检测不到 `call` / `staticActions` / `getDynamicActions` → 提示菜单项会被置灰。
- 目标已有同名文件（将按 `overwrite` 处理）。
- 清单声明了 `min_typora`（安装器不做版本校验）。

---

## 5. 安装原理与边界

```text
插件包                    安装器                        Typora
─────────                ─────────                    ─────────
installer.toml  ──解析──▶ 校验 + 生成计划
core/myPlugin.js ─复制──▶ <plugin>/myPlugin.js
                          settings.user.toml  ──合并──▶ [myPlugin] ENABLE/NAME/...
                                                        [right_click_menu] FIND_LOST_PLUGINS = true
重启 Typora ──▶ core/index.js 的 loadPlugins() 遍历合并后的 settings
                └─ utils.require("./plugin","myPlugin") → 加载成功
                └─ right_click_menu 把未列入 MENUS 的插件追加到末组
```

为什么走 `FIND_LOST_PLUGINS` 而不是直接改 `MENUS`：

- `MENUS` 是数组，配置合并时是**整体替换**而不是逐项合并；写 `MENUS` 会把默认的 4 个分组整个替换掉。
- `settings.default.toml` 属于发行包，整包升级会被覆盖；`settings.user.toml` 才会被保留。

代价：插件出现在**最后一个菜单组末尾**，且不会出现在首选项面板里。要固定分组/顺序/首选项面板，那是"把插件并入插件系统源码"的路线（改 `settings.default.toml` + `schemas.js` + 三语 locale），不属于本安装器的职责。

---

## 6. 构建

需要 **.NET 8 SDK**（Windows / Linux / WSL 均可交叉编译出 Windows exe）。

```bash
# Windows
.\build\build.ps1                 # 自包含单文件 win-x64（推荐分发）
.\build\build.ps1 -Test           # 先跑单测
.\build\build.ps1 -FrameworkDependent   # 框架依赖，体积小，目标机需 .NET 8 运行时
.\build\build.ps1 -CliOnly        # 只要命令行版本

# Linux / WSL
./build/build.sh                  # 同上，默认 --test 关闭
./build/build.sh --test
./build/build.sh --cli-only
./build/build.sh --rid linux-x64  # 顺便产出 Linux 版本
```

产物：`dist/<rid>/TyporaPluginInstaller.exe`（GUI）与 `dist/<rid>/typora-plugin-installer-cli[.exe]`。
自包含单文件 exe 约 43 MB，目标机不需要安装任何运行时。

> 本仓库里的 `NuGet.config` 只配置官方源。若所在环境 `~/.nuget/packages` 只读，构建脚本默认会把包缓存与 CLI home 放到 `installer/.cache/` 下（已 gitignore）。

---

## 7. 源码结构

```
installer/
├── installer.sln
├── NuGet.config
├── README.md                     ← 本文件
├── src/
│   ├── TyporaPluginInstaller.Core/      # 纯逻辑，跨平台，可单测
│   │   ├── Toml/TomlDocument.cs         # TOML 值/表模型 + 字面量格式化
│   │   ├── Toml/TomlParser.cs           # installer.toml 用的 TOML 子集解析器
│   │   ├── Toml/TomlSettingsEditor.cs   # settings.user.toml 行级合并编辑器（保留注释/顺序）
│   │   ├── Manifest/InstallManifest.cs  # 清单模型
│   │   ├── Manifest/ManifestLoader.cs   # 清单读取 + 校验
│   │   └── Install/                     # 计划、执行、路径守卫、结果渲染
│   ├── TyporaPluginInstaller.Cli/       # 命令行宿主
│   └── TyporaPluginInstaller.Gui/       # Avalonia GUI（Windows exe）
├── tests/TyporaPluginInstaller.Tests/   # xunit
├── examples/helloWorld/                 # 可直接安装的范例插件包
└── build/build.sh · build/build.ps1     # 构建脚本
```

GUI 与 CLI 共用同一个 `InstallEngine`，因此两者的行为完全一致；GUI 只是多了目录选择器和日志面板。

---

## 8. 测试与验证

```bash
cd installer
dotnet test TyporaPluginInstaller.sln     # 42 个测试
```

覆盖范围：

- **TOML 解析**：跨行数组、转义、行内注释、非法输入（数组表 / 未闭合字符串 / 未知语法）。
- **settings 行级合并**：保留注释与顺序、CRLF、`[[数组表]]` 边界、空值填充、值比较、备份、UTF-8 无 BOM、结尾换行。
- **清单校验**：必填项、`id` 规则、`menu.mode` 取值、保留键、缺文件。
- **安装引擎**：复制/覆盖开关、目录形态插件、包根即核心目录、路径逃逸拒绝、非 plugin 目录拒绝、缺入口拒绝、用户目录优先、dry-run 不落盘、`call` 缺失告警、`settings=false`。
- **GUI 冒烟**：在无显示环境下用 `Avalonia.Headless` 真正构造 `MainWindow` / `ConfirmDialog`，确认 XAML 能加载且所有 `x:Name` 控件都能解析（Windows exe 无法在本机运行，这是 GUI 侧唯一可自动化的验证手段）。

此外做过一次真实端到端演练（已回滚）：把 `examples/helloWorld` 装进本仓库的 `plugin/`，然后用插件系统**真实**的 `settings.read()` / `utils.require()` / `right_click_menu._insertLevel2()` 验证：

```
PASS  settings.user.toml 被合并：helloWorld 段存在
PASS  helloWorld.ENABLE === true
PASS  helloWorld.NAME 已写入
PASS  right_click_menu.FIND_LOST_PLUGINS === true
PASS  默认 MENUS 仍完整（4 组）
PASS  helloWorld 未被显式列进 MENUS（应由兜底追加）
PASS  plugin/helloWorld.js 可被真实 require 解析
PASS  插件覆盖了 call（菜单可点击的必要条件）
PASS  右键菜单 HTML 里出现 helloWorld
PASS  菜单项未被置灰
PASS  菜单标题取自 NAME
11/11 passed
```

同时确认插件系统自带的 1369 个测试在安装后仍然全绿（`1368 pass / 0 fail / 1 skipped`）。

---

## 9. 已知限制 / 后续方向

- 菜单只支持 `auto`（追加到末组）与 `none`。要"指定分组/顺序/图标"需要安装器直接改 `MENUS` 数组（会整体替换默认分组，需谨慎设计合并策略）。
- 不做卸载 UI。手工回滚：删掉 `plugin/<id>.js`（或目录）、从 `settings.user.toml` 删掉 `[<id>]` 段，必要时用 `settings.user.toml.bak` 覆盖回去。
- 不做依赖管理、不做版本比较、不联网。
- 不修改 `settings.default.toml`（这是刻意的：它会被整包升级覆盖）。
- 首次安装后必须**重启 Typora**：插件系统只在启动时扫描一次插件目录。

---

## 10. Plugin package requirements (English summary)

To be installable by this installer, a plugin package must provide:

1. **`installer.toml`** at the package root with at least:
   ```toml
   [plugin]
   id = "myPlugin"      # ^[A-Za-z_][A-Za-z0-9_]*$ ; used as filename + settings section
   name = "My Plugin"   # written to NAME and used as the context-menu label

   [install]
   source = "core"      # optional, default "." ; directory holding the runtime files
   ```
2. **Runtime files that map to `plugin/<id>.js` or `plugin/<id>/index.js`** (via `install.source` and optional `install.files`).
3. **A plugin class that overrides `call`** (`module.exports = { plugin: class extends BasePlugin { call = () => {...} } }`) — otherwise the context-menu entry is rendered greyed out and is not clickable.

Nothing else is required: no changes to `settings.default.toml`, `schemas.js`, or locale files. The installer copies the files, merges `[<id>] ENABLE/NAME` plus `[settings]` into `settings.user.toml`, and sets `[right_click_menu] FIND_LOST_PLUGINS = true` so the plugin shows up in the context menu (appended to the last menu group). Optional manifest keys: `[plugin] version/description/author/homepage/min_typora`, `[install] files/overwrite/settings/settings_overwrite`, `[menu] mode = "auto" | "none"`.
