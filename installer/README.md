# Typora 插件安装器（installer）

把第三方 Typora 插件包装进 Typora 的 `plugin` 目录：**复制文件 + 合并配置**，让插件能被加载、能出现在右键菜单里、点击有效。

- **形态**：Windows GUI 可执行文件（自包含单文件 exe，目标机无需安装 .NET）；另附命令行版本供自动化使用。
- **范围**：本目录自成一体，不改动 `plugin/`、`develop/` 下的任何产品代码。
- **网络**：完全离线，只读取本地目录。

---

## 1. 快速开始

### 1.1 GUI

1. 运行 `dist/win-x64/TyporaPluginInstaller.exe`（自行构建见[第 6 节](#6-构建)）。
2. 填两个目录：
   - **插件包目录**：插件作者提供的目录，里面必须有 `installer.toml`。
   - **plugin 目录**：Typora 的插件目录，通常是 `<Typora 安装目录>/resources/plugin`（0.9.98 免费版是 `<Typora>/resources/app/plugin`）。
3. 选**右键菜单分组**（选好 plugin 目录后会自动列出可选项）：
   - 默认「新建分组…」，名字预填目标语言对应的「自定义插件」，位置可选「最前 / 最后」；
   - 也可以从列表里挑一个**已有分组**（含内置分组）把插件放进去。
4. 点 **「试运行 / 预览」**：只会列出将要新增/覆盖的文件、菜单落点和要改写的配置，不写盘。
5. 点 **「开始安装」** → 确认 → 写盘。原 `settings.user.toml` 会先备份为 `settings.user.toml.bak`。
6. **重启 Typora**，右键菜单里就会出现该插件。

### 1.2 命令行

```bash
# 安装（最常用）
typora-plugin-installer-cli -s ./my-plugin -t "<plugin目录>"

# 先预览一遍，确认要写哪些文件
typora-plugin-installer-cli -s ./my-plugin -t "<plugin目录>" --dry-run

# 装进指定的右键菜单分组（名字不存在就新建；也可以写内置分组的键或显示名）
typora-plugin-installer-cli -s ./my-plugin -t "<plugin目录>" --menu-group "自定义插件"
```

| 选项 | 说明 |
| --- | --- |
| `-s, --source <dir>` | 插件包目录（含 `installer.toml`） |
| `-t, --target <dir>` | Typora 的 `plugin` 目录 |
| `-n, --dry-run` | 只演练、不写盘（别名 `--check`） |
| `--menu-group <名字>` | 放进该分组；名字不存在则新建 |
| `--menu-position first\|last` | 新建分组时的位置，默认 `first`（最前） |
| `--menu-none` | 不注册右键菜单 |
| `--list-groups` | 只列出目标当前的菜单分组后退出 |
| `-m, --manifest <file>` | 显式指定清单文件（默认 `<source>/installer.toml`） |
| `--json` | 以 JSON 输出结果 |
| `-h, --help` | 显示完整帮助 |

退出码：`0` 成功、`1` 安装失败、`2` 参数错误。

### 1.3 卸载

安装器不提供卸载。删掉 `plugin/<id>.js`（或 `plugin/<id>/` 目录），再从 `settings.user.toml` 里删掉 `[<id>]` 段即可；必要时用 `settings.user.toml.bak` 覆盖回配置。

---

## 2. 插件包需要提供什么

一个插件包就是一个目录。安装器只要求三件事——满足这三条就够了，**不需要**改插件系统的任何源码，不需要 `schemas.js`、locale，也不需要 `settings.default.toml`。

| # | 必须提供 | 判定标准 | 缺了会怎样 |
| --- | --- | --- | --- |
| 1 | 包根目录下的 `installer.toml` | 含 `[plugin] id` 与 `[plugin] name` | 拒绝安装 |
| 2 | 能映射到 `plugin/<id>.js` 或 `plugin/<id>/index.js` 的核心文件 | 由 `install.source`、`install.files` 决定 | 拒绝安装 |
| 3 | 插件代码里**覆盖 `call`** | `call` 是右键菜单项的点击回调 | 菜单项可见但被置灰，点不动 |

第 3 条只影响「菜单能不能点」。如果 `[menu] mode = "none"`、插件只靠快捷键触发，可以不覆盖它。

### 2.1 目录结构

```text
my-plugin/                      ← 安装器里选的「插件包目录」
├── installer.toml              ← 必需：安装清单（自己不会被装进 plugin/）
├── core/                       ← 核心文件目录，由 install.source 指定
│   ├── myPlugin.js             → plugin/myPlugin.js
│   └── myPlugin/               → plugin/myPlugin/
│       ├── index.js            → plugin/myPlugin/index.js
│       └── assets/logo.png     → plugin/myPlugin/assets/logo.png
└── README.md                   ← 不会装进 plugin/
```

**落点规则**：`install.source` 目录下的目录结构**原样铺到 `plugin/` 下**。所以想让插件自己的文件都待在 `plugin/<id>/` 里，就把它们放进 `core/<id>/`。

这点容易搞错：写在核心目录根上的 `core/assets/` 会落成 **`plugin/assets/`**（不是 `plugin/myPlugin/assets/`），不同插件的同名目录会互相覆盖。

`[install] source` 默认 `"."`，即**包根目录就是核心目录**。这种情况下安装器会跳过：`installer.toml`、以 `.` 开头的路径段（`.git` 等）、`node_modules`，以及包根下的 `*.md` / `README*` / `LICENSE*` / `CHANGELOG*`。

### 2.2 `installer.toml`（必需）

最小可用内容：

```toml
[plugin]
id = "myPlugin"          # 固定名。同时是文件名 plugin/myPlugin.js、配置段名 [myPlugin]
name = "My Plugin"       # 显示名。写进 NAME，也是右键菜单里显示的标题

[install]
source = "core"          # 核心文件所在目录，相对本文件

[menu]
mode = "group"           # 只表达「要不要上菜单」；放哪个分组由安装器在安装时决定

[settings]               # 可选：写进 [myPlugin] 段，插件里用 this.config.GREETING 读取
GREETING = "Hello"
```

字段说明：

**`[plugin]`**

| 键 | 必需 | 说明 |
| --- | --- | --- |
| `id` | ✅ | 只允许 `^[A-Za-z_][A-Za-z0-9_]*$`。它决定了插件文件名与配置段名，**安装后不要再改** |
| `name` | ✅ | 显示名 |
| `version` / `description` / `author` / `homepage` | | 仅展示 |
| `min_typora` | | 仅提示，安装器不做版本比较 |

`id` 也**不能与 Typora 自带插件重名**（如 `window_tab`、`search_multi`，完整名单就是目标 `settings.default.toml` 里的段名），不能叫 `global`，装出来的文件也不能落在自带插件的位置上——这几种情况安装器会直接拒绝，换个名字即可。

**`[install]`**

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `source` | `"."` | 核心文件所在目录，相对 `installer.toml`；必须在插件包内，不允许 `..` 逃逸 |
| `files` | 空 | 显式条目列表（相对 `source`），可以是文件或目录。填写后**只复制这些条目**，不再扫描整个目录 |
| `overwrite` | `true` | 目标已存在同名文件时是否覆盖；`false` 时跳过并提示 |
| `settings` | `true` | 是否写 `settings.user.toml`；`false` 时只复制文件 |
| `settings_overwrite` | `false` | 是否覆盖用户已有的同名配置值；`false` 时只补缺失的键（`ENABLE` 恒为 `true`） |

**`[menu]`**

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `mode` | `"group"` | `group`：上右键菜单（**放哪个分组由安装器在安装时决定**）；`none`：不注册菜单 |
| ~~`group`~~ / ~~`position`~~ | | **不允许**。清单里出现这两个键，安装器直接报错 |

**`[settings]`**（可选）

写进 `[<id>]` 段的配置项，插件里用 `this.config.KEY` 读取。**只支持扁平值**：`string` / `bool` / `int` / `float` / `string[]`。

- 不允许出现 `ENABLE`、`NAME`（由 `[plugin]` 决定）。
- 嵌套的表（`[settings.sub]`）会被忽略，数组表（`[[settings.ITEMS]]`）会直接报错。需要这类结构化配置的插件，请设 `[install] settings = false`，自己在插件里处理配置。

### 2.3 核心文件（必需）

```js
// core/myPlugin.js  →  plugin/myPlugin.js
class myPlugin extends BasePlugin {
  // 右键菜单点击时调用；不覆盖 call 的话菜单项会被置灰
  call = () => {
    this.utils.notification.show(this.config.GREETING || "Hello")
  }
}

module.exports = { plugin: myPlugin }
```

关键点：

- 必须**导出 `plugin`**（`module.exports = { plugin: <类> }`），否则插件系统记 `Plugin not found`。
- 必须**继承 `BasePlugin`**：安装后由插件系统注入 `global.BasePlugin`，不需要自己 `require`。
- 插件在 `plugin/` 下的路径必须与 `id` 对应：`plugin/<id>.js` 或 `plugin/<id>/index.js`，否则插件系统扫不到。
- 生命周期钩子 `prepare` / `style` / `html` / `hotkey` / `init` / `process` / `postprocess` 都是可选的，基类里是空实现。
- 插件**不会出现在 Typora 的首选项面板**里，只能用右键菜单或快捷键触发。

### 2.4 可直接运行的范例

[`examples/helloWorld/`](examples/helloWorld/) 是一个完整的可安装插件包，可直接拿来对照或复制：

```bash
typora-plugin-installer-cli --source examples/helloWorld --target "<plugin目录>" --dry-run
```

---

## 3. 安装器会改哪些文件

| 路径 | 行为 |
| --- | --- |
| `<plugin>/<核心文件>` | ✅ 新增或覆盖 |
| `settings.user.toml`（位置见下） | ✅ 合并写入，先备份为 `.bak` |
| `settings.user.toml` 里的 `[right_click_menu] MENUS` | ✅ 上菜单时**整段覆盖**；选「不注册右键菜单」时完全不碰 |
| 其它插件的配置段、注释、空行、键顺序 | ❌ 原样保留 |
| `<plugin>/global/settings/settings.default.toml` | ❌ 绝不修改 |
| `<plugin>/global/locales/*.json`、`<plugin>/preferences/schemas.js` | ❌ 不修改 |

配置写到哪一份：

1. 如果 `~/.config/typora_plugin/settings.user.toml` 存在 → 写它（Windows 下即 `C:\Users\<你>\.config\typora_plugin\settings.user.toml`）；
2. 否则写 `<plugin>/global/settings/settings.user.toml`。

注意：上菜单时整份菜单（含所有内置分组）会被写进你的 `settings.user.toml`。所以装完插件后，即使上游更新了默认菜单，也不会自动反映到这份配置里。

---

## 4. 安装失败怎么办

| 安装器说 | 怎么办 |
| --- | --- |
| `这个目录看起来不是 Typora 的 plugin 目录` | 目标选错了。它需要包含 `global/settings/settings.default.toml` 或 `global/core/`；通常就是 `<Typora>/resources/plugin`。 |
| `找不到安装清单` / `缺少 [plugin] 段` / `缺少必填项 id` / `缺少必填项 name` | 插件包根目录缺 `installer.toml`，或里面没有写全 `[plugin] id` 与 `[plugin] name`。 |
| `[plugin] id 非法` | `id` 只能有字母、数字、下划线，且不能以数字开头。 |
| `id ... 与插件系统自带插件同名` / `落在插件系统自带插件「x」的位置上` | 换个 `id`，或把文件挪进自己的目录（常见原因是 `install.source = "."` 时包根有重名文件）。 |
| `落在插件系统的 global/ 目录里` | 插件不能写 `global/`，把文件放进 `plugin/<id>/`。 |
| `install.source 指向的目录不存在` / `install.files 条目不存在` | 检查 `[install] source` / `files` 的路径是否写对（都相对 `installer.toml`）。 |
| `安装后仍找不到插件入口` | 插件包要提供 `<id>.js` 或 `<id>/index.js`，且能被 `install.source` 映射到 `plugin/` 根下。 |
| `[menu] 不允许指定 group/position` | 删掉这两个键，插件只能表达「要不要上菜单」。 |
| `[menu] mode 只支持 "group" 或 "none"` | 改成这两个值之一。 |
| `找不到 .../settings.default.toml，无法读取默认右键菜单` | 目标不是完整的 plugin 目录，或你只想装文件：用 `--menu-none`（GUI 上选「不注册右键菜单」）。 |
| `目标里没有名为 "x" 的菜单分组` | 分组名写错了，按提示里列出的可用分组重填。 |
| 警告：`没有检测到 call / staticActions / getDynamicActions` | 插件代码里覆盖 `call`，否则菜单项会被置灰。 |

---

## 5. 测试

```bash
cd installer
dotnet test TyporaPluginInstaller.sln          # 全部测试
dotnet test TyporaPluginInstaller.sln --filter FullyQualifiedName~InstallEngineTests   # 单个测试类
```

---

## 6. 构建

需要 **.NET 8 SDK**。Windows / Linux / WSL 均可，且都能交叉编译出 Windows exe。

```bash
# Windows
.\build\build.ps1                       # 自包含单文件 win-x64（目标机无需 .NET）
.\build\build.ps1 -Test                 # 先跑单元测试再发布
.\build\build.ps1 -FrameworkDependent   # 框架依赖，体积小，目标机需 .NET 8 运行时
.\build\build.ps1 -CliOnly              # 只发布命令行版本

# Linux / WSL
./build/build.sh
./build/build.sh --test
./build/build.sh --cli-only
./build/build.sh --rid linux-x64        # 顺带产出 Linux 版本
```

产物在 `dist/<rid>/`：`TyporaPluginInstaller.exe`（GUI）与 `typora-plugin-installer-cli[.exe]`。自包含单文件约 43 MB，目标机不需要安装任何运行时。

两点注意：

- `build.ps1` 必须保持**纯 ASCII**（注释也用英文）。Windows PowerShell 5.1 会用系统代码页读取无 BOM 的 `.ps1`，非 ASCII 字节会导致解析失败；仓库里有测试守着这条规则。`build.sh` 不受此限。
- 若机器禁止运行未签名脚本，用 `powershell -NoProfile -ExecutionPolicy Bypass -File .\build\build.ps1`。

---

## 7. 源码结构

```text
installer/
├── TyporaPluginInstaller.sln
├── src/
│   ├── TyporaPluginInstaller.Core/       # 纯逻辑，跨平台，可单测
│   │   ├── Toml/                        # TOML 子集解析 + settings 行级合并编辑器
│   │   ├── Manifest/                    # 清单模型与校验
│   │   └── Install/                     # 安装计划、执行、路径守卫、结果渲染
│   ├── TyporaPluginInstaller.Cli/        # 命令行宿主
│   └── TyporaPluginInstaller.Gui/        # Avalonia GUI（Windows exe）
├── tests/TyporaPluginInstaller.Tests/    # xunit
├── examples/helloWorld/                  # 可直接安装的范例插件包
└── build/build.ps1 · build/build.sh      # 构建脚本
```

GUI 与 CLI 共用同一个 `InstallEngine`，行为完全一致；GUI 只是多了目录选择器与日志面板。

---

## 附录：Plugin package requirements (English)

To be installable, a plugin package must provide exactly three things:

1. **`installer.toml`** at the package root, with at least `[plugin] id` (matching `^[A-Za-z_][A-Za-z0-9_]*$`) and `[plugin] name`.
2. **Runtime files that map to `plugin/<id>.js` or `plugin/<id>/index.js`**, decided by `[install] source` (default `"."`) and the optional `[install] files` list.
3. **A plugin class that overrides `call`** — without it the context-menu entry is rendered greyed out and is not clickable.

The contents of `install.source` are mirrored onto `plugin/` as-is, so keep everything in `core/<id>/` if you want it under your own directory. `[settings]` accepts flat values only (string / bool / int / float / string[]); use `[install] settings = false` if you need nested config. The installer merges `[<id>]` (plus `ENABLE`/`NAME`) into `settings.user.toml` and registers the context menu in the group **you** pick at install time. `[menu] group` and `[menu] position` are rejected on purpose, and an `id` that collides with a built-in plugin is refused.
