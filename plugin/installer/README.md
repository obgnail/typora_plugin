# 插件安装器（installer）

把第三方 Typora 插件包装进当前 Typora 的 `plugin` 目录：**复制文件 + 合并配置**。装完重启 Typora，插件就能被加载，并出现在右键菜单里可以点击。

- 它是插件系统自带的一个插件，不需要另外下载可执行文件，也不联网。
- 只写 `plugin/<id>…` 和 `settings.user.toml`；`settings.default.toml`、`global/locales/*.json`、`preferences/schemas.js` 一律不动。

---

## 1. 怎么用

打开方式（任选一个）：

- 右键菜单 →「交互插件」组里的 **插件安装器**
- 命令面板（`>`）→ Plugins → 插件安装器
- 首选项面板 → 插件安装器

界面里三步：

1. **插件包目录**：填（或点「浏览…」选）含 `installer.toml` 的那个目录。上次成功安装用过的目录会自动填上。
2. **右键菜单**：三选一
   - **新建分组**：填分组名（默认按当前界面语言填「自定义插件」），位置选最前或最后
   - **放进已有分组**：从列出的分组里挑一个，插件会追加到该分组末尾
   - **不注册菜单**：只装文件，不碰菜单
3. 点**确定**：会先列出将要新增/覆盖的文件、菜单落点和要写的配置。确认无误后再点一次确定；这一页点取消就什么都不会写。

装完**重启 Typora**。插件的启用、改名、快捷键在首选项面板里；菜单分组是安装时定的，之后想换分组就再装一次。

卸载：删掉 `plugin/<id>.js`（或 `plugin/<id>/` 目录），再从 `settings.user.toml` 里删掉 `[<id>]` 段。原来那份 `settings.user.toml` 如果存在，安装前会先备份成 `settings.user.toml.bak`，可以用它整体还原。

---

## 2. 插件包需要提供什么

一个插件包就是一个目录，安装器只要求三件事。满足这三条就够了：**不需要**改插件系统的任何源码，不需要 `schemas.js`、locale，也不需要 `settings.default.toml`。

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

**落点规则**：`install.source` 目录下的目录结构**原样铺到 `plugin/` 下**。想让插件自己的文件都待在 `plugin/<id>/` 里，就把它们放进 `core/<id>/`。

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

**`[plugin]`**

| 键 | 必需 | 说明 |
| --- | --- | --- |
| `id` | ✅ | 只允许 `^[A-Za-z_][A-Za-z0-9_]*$`。它决定了插件文件名与配置段名，**安装后不要再改** |
| `name` | ✅ | 显示名 |
| `version` / `description` / `author` / `homepage` | | 仅展示 |
| `min_typora` | | 仅提示，安装器不做版本比较 |

`id` 不能与 Typora 自带插件重名（如 `window_tab`、`search_multi`，完整名单就是 `settings.default.toml` 里的段名），不能叫 `global`，装出来的文件也不能落在自带插件的位置上——这几种情况会直接拒绝，换个名字即可。

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
| `mode` | `"group"` | `group`：上右键菜单（放哪个分组由安装器在安装时决定）；`none`：不注册菜单 |
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

---

## 3. 安装器会改哪些文件

| 路径 | 行为 |
| --- | --- |
| `<plugin>/<核心文件>` | ✅ 新增或覆盖 |
| `settings.user.toml`（位置见下） | ✅ 合并写入，先备份为 `.bak` |
| `settings.user.toml` 里的 `[right_click_menu] MENUS` | ✅ 上菜单时整段覆盖；选「不注册菜单」时完全不碰 |
| `<plugin>/global/settings/settings.default.toml` | ❌ 不修改 |
| `<plugin>/global/locales/*.json`、`<plugin>/preferences/schemas.js` | ❌ 不修改 |

配置写到哪一份：

1. 如果 `~/.config/typora_plugin/settings.user.toml` 存在 → 写它（Windows 下即 `C:\Users\<你>\.config\typora_plugin\settings.user.toml`）；
2. 否则写 `<plugin>/global/settings/settings.user.toml`。

两点结果值得知道：上菜单时整份菜单（含所有内置分组）会被写进 `settings.user.toml`，所以之后即使上游更新了默认菜单，也不会自动反映到这份配置里；`settings.user.toml` 是按合并后的结果重新生成的，手写的注释和格式不会保留（和首选项面板保存时一样）。

---

## 4. 装不上时

| 报错 | 怎么办 |
| --- | --- |
| `Cannot find the install manifest` | 插件包根目录缺 `installer.toml`。 |
| `installer.toml could not be parsed` | 清单的 TOML 语法有问题，按报错里的行号检查。 |
| `missing the [plugin] section` / `missing the required key id` / `name` | `[plugin]` 段缺了，或者没写全 `id`、`name`。 |
| `[plugin] id is invalid` | `id` 只能有字母、数字、下划线，且不能以数字开头。 |
| `collides with a built-in plugin` / `would overwrite the built-in plugin "x"` | 换了自带插件要用的名字，或要写自带插件的位置；换个 `id`，或把文件挪进自己的目录（常见原因是 `install.source = "."` 时包根有重名文件）。 |
| `into the plugin system's global/ directory` | 插件不能写 `global/`，把文件放进 `plugin/<id>/`。 |
| `[install] source points at a directory that does not exist` / `entry does not exist` | `[install] source` / `files` 的路径写错了（都相对 `installer.toml`）。 |
| `must stay inside the package` / `may not use absolute paths` / `escapes the content directory` | 路径用了 `..` 或绝对路径，改回包内相对路径。 |
| `No plugin entry point after installing` | 包要提供 `<id>.js` 或 `<id>/index.js`，并且能被 `install.source` 映射到 `plugin/` 根下。 |
| `has no installable files` | `install.source` 指向的目录是空的（或全被跳过）。 |
| `[menu] may not set group/position` | 删掉清单里的这两个键，插件只能表达「要不要上菜单」。 |
| `[menu] mode only accepts "group" or "none"` | 改成这两个值之一。 |
| `may not override the reserved key ENABLE/NAME` | `[settings]` 里不能写 `ENABLE`、`NAME`。 |
| `The target has no context-menu group named "x"` | 分组名写错了，按提示里列出的可用分组重选。 |
| `looks like a built-in group key` | 想放进内置分组，要用它真实的键（提示里会列出）。 |
| 警告：`No call / staticActions / getDynamicActions found` | 插件代码里覆盖 `call`，否则菜单项会被置灰、点不动。 |

---

## 5. 测试

```bash
cd develop
node --require ../plugin/global/core/polyfill.js --test test/installer.test.js   # 只跑安装器
npm test                                                                        # 全量
```

测试用真实的临时目录跑完整安装流程（清单校验、落点、各项拒绝、三种菜单选择、配置合并、备份、试运行），界面部分用桩表单驱动。

---

## 附录：Plugin package requirements (English)

To be installable, a plugin package must provide exactly three things:

1. **`installer.toml`** at the package root, with at least `[plugin] id` (matching `^[A-Za-z_][A-Za-z0-9_]*$`) and `[plugin] name`.
2. **Runtime files that map to `plugin/<id>.js` or `plugin/<id>/index.js`**, decided by `[install] source` (default `"."`) and the optional `[install] files` list.
3. **A plugin class that overrides `call`** — without it the context-menu entry is rendered greyed out and is not clickable.

The contents of `install.source` are mirrored onto `plugin/` as-is, so keep everything in `core/<id>/` if you want it under your own directory. `[settings]` accepts flat values only (string / bool / int / float / string[]); use `[install] settings = false` if you need nested config. The installer merges `[<id>]` (plus `ENABLE`/`NAME`) into `settings.user.toml` and registers the context menu in the group **you** pick at install time. `[menu] group` and `[menu] position` are rejected, and an `id` that collides with a built-in plugin is refused.
