[English](https://github.com/obgnail/typora_plugin/blob/master/README.md) | 简体中文

<div align="center">
    <h1>Typora Plugin</h1>
    <img src="assets/typora_plugin.png" alt="typora_plugin" width="400">
    <p align="center">
        <a href="https://github.com/obgnail/typora_plugin/releases/latest"><img src="https://img.shields.io/github/v/release/obgnail/typora_plugin"></a>
        <a href="https://github.com/obgnail/typora_plugin/stargazers"><img src="https://img.shields.io/github/stars/obgnail/typora_plugin?style=flat"></a>
        <a href="https://github.com/obgnail/typora_plugin/issues"><img src="https://img.shields.io/github/issues-closed/obgnail/typora_plugin.svg"></a>
        <a href="https://github.com/obgnail/typora_plugin/tree/master/plugin"><img src="https://img.shields.io/badge/implementation-native-greenbule"></a>
        <a href="https://github.com/obgnail/typora_plugin?tab=readme-ov-file#%E5%A6%82%E4%BD%95%E4%BD%BF%E7%94%A8%E6%96%B9%E6%B3%95%E4%B8%80%E8%87%AA%E5%8A%A8"><img src="https://img.shields.io/badge/platform-Windows%20%7C%20Linux-0085a1"></a>
        <a href="https://github.com/obgnail/typora_plugin/blob/master/LICENSE"><img src="https://img.shields.io/github/license/obgnail/typora_plugin"></a>
        <a href="https://deepwiki.com/obgnail/typora_plugin"><img src="https://deepwiki.com/badge.svg" alt="Ask DeepWiki"></a>
    </p>
</div>


## 插件列表

| 插件：导航与管理                            | 功能                               | 默认启用 |
| :------------------------------------------ | :--------------------------------- | :------- |
| [window_tab](#window_tab)                   | 标签页管理                         |          |
| [search_multi](#search_multi)               | 多元文件搜索                       |          |
| [auto_number](#auto_number)                 | 章节、表格、图片、代码块等自动编号 |          |
| [bookmark](#bookmark)                       | 书签管理器                         | ×        |
| [cursor_history](#cursor_history)           | 光标跳转                           | ×        |
| [preferences](#preferences)                 | 插件配置                           |          |
| [updater](#updater)                         | 一键升级插件                       |          |
| [asset_root_redirect](#asset_root_redirect) | 资源重定向                         | ×        |
| [repository](#repository)                   | 管理 Typora 打开过的文件夹          | ×        |

| 插件：编辑增强                              | 功能                                 | 默认启用 |
| :------------------------------------------ | :----------------------------------- | :------- |
| [collapse_paragraph](#collapse_paragraph)   | 章节折叠                             | ×        |
| [collapse_list](#collapse_list)             | 列表折叠                             | ×        |
| [collapse_table](#collapse_table)           | 表格折叠                             | ×        |
| [md_padding](#md_padding)                   | 中英文混排优化                       |          |
| [slash_commands](#slash_commands)           | 斜杠命令                             |          |
| [mouse_gestures](#mouse_gestures)           | 鼠标手势                             | ×        |
| [templater](#templater)                     | 文件模板                             |          |
| [fence_enhance](#fence_enhance)             | 复制、折叠、格式化代码               |          |
| [right_outline](#right_outline)             | 在右侧生成大纲目录                   |          |
| [commander](#commander)                     | 命令行环境                           |          |
| [command_palette](#command_palette)         | 命令面板                             |          |
| [right_click_menu](#right_click_menu)       | 右键菜单统一管理插件                 |          |
| [pie_menu](#pie_menu)                       | 圆盘菜单                             | ×        |
| [datatables](#datatables)                   | 表格增强（搜索、过滤、分页、排序等） | ×        |
| [resize_table](#resize_table)               | 调整表格行高列宽                     |          |
| [resize_image](#resize_image)               | 调整图片显示大小                     |          |
| [easy_modify](#easy_modify)                 | 编辑工具                             |          |
| [editor_width_slider](#editor_width_slider) | 写作区宽度调整                       |          |
| [cjk_symbol_pairing](#cjk_symbol_pairing)   | 中文符号配对                         |          |
| [text_stylize](#text_stylize)               | 文字风格化                           |          |
| [resource_manager](#resource_manager)       | 一键清除无用图片                     |          |
| [markdownlint](#markdownlint)               | markdown 格式检查                    |          |
| [export_enhance](#export_enhance)           | 导出 HTML/PDF 时避免图片丢失         | ×        |
| [html_editor](#html_editor)                 | 在主编辑区预览和编辑 HTML 文件       | ×        |

| 插件：视图与主题                    | 功能                                       | 默认启用 |
| :---------------------------------- | :----------------------------------------- | :------- |
| [dark](#dark)                       | 夜间模式                                   |          |
| [no_image](#no_image)               | 无图模式                                   |          |
| [blur](#blur)                       | 模糊模式                                   |          |
| [myopic_defocus](#myopic_defocus)   | 离焦视力舒缓                               |          |
| [read_only](#read_only)             | 只读模式                                   |          |
| [truncate_text](#truncate_text)     | 暂时隐藏内容，提高大文件渲染性能           | ×        |
| [image_viewer](#image_viewer)       | 图片查看器                                 |          |
| [diagram_enhance](#diagram_enhance) | 图表缩放、平移、全屏与尺寸调整             | ×        |
| [static_markers](#static_markers)   | Markdown 标记常显                          | ×        |
| [sidebar_enhance](#sidebar_enhance) | 显示其他扩展名文件、记忆折叠状态、拖拽排序 |          |

| 插件：组件            | 功能                       | 默认启用 |
| :-------------------- | :------------------------- | :------- |
| [markmap](#markmap)   | 提供 Markmap 组件支持      |          |
| [echarts](#echarts)   | 提供 Echarts 组件支持      |          |
| [chart](#chart)       | 提供 Chart.js 组件支持     |          |
| [drawIO](#drawIO)     | 提供 DrawIO 组件支持       |          |
| [abc](#abc)           | 提供 abc.js 组件支持       |          |
| [calendar](#calendar) | 提供 tui.calendar 组件支持 |          |
| [wavedrom](#wavedrom) | 提供 Wavedrom 组件支持     |          |
| [marp](#marp)         | 提供 Marp 组件支持         |          |
| [plantUML](#plantUML) | 提供 PlantUML 组件支持     | ×        |
| [callouts](#callouts) | 提供 Callouts 支持         |          |
| [kanban](#kanban)     | 看板                       |          |
| [timeline](#timeline) | 时间线                     |          |
| [chat](#chat)         | 聊天                       |          |

| 插件：高级功能                        | 功能                         | 默认启用 |
| :------------------------------------ | :--------------------------- | :------- |
| [hotkeys](#hotkeys)                   | 快捷键注册中心               |          |
| [action_buttons](#action_buttons)     | 于右下角添加功能按钮         |          |
| [custom](#custom)                     | 开放平台，用户自定义插件     |          |
| [remote_control](#remote_control)     | 外部操控 Typora              | ×        |
| [cipher](#cipher)                     | 加密文件                     | ×        |
| [ripgrep](#ripgrep)                   | 使用 ripgrep 搜索文件        | ×        |
| [article_uploader](#article_uploader) | 一键上传博客到支持的所有平台 | ×        |

> 如果有需求或发现 BUG，欢迎 [提 issue](https://github.com/obgnail/typora_plugin/issues/new)，欢迎 PR。如果觉得本项目对您有帮助，请不吝点亮一个 Star ⭐！

## Q&A

- **我的 Typora 能用吗？** 要求 Typora 版本大于等于 0.9.98（最后一个免费版本）。
- **如何修改插件配置？** 右键菜单 -> 交互插件 -> 插件配置。**尊重用户的一切选择，所有的插件和功能皆可永久启用 / 禁用**。
- **如何升级插件？** 右键菜单 -> 交互插件 -> 插件配置 -> 检查更新。
- **如何卸载插件？** 右键菜单 -> 交互插件 -> 插件配置 -> 卸载插件。
- **如何编写插件？** No Build Time，无需安装开发环境，详情请参考 [Readme](https://github.com/obgnail/typora_plugin/blob/master/plugin/custom/README.md)。
- **支持 Typora for Mac 吗？** 我没有 Mac 设备，暂不支持。
- **还有其他问题？** 欢迎前往 [AI Wiki](https://deepwiki.com/obgnail/typora_plugin) 提问或查阅社区讨论。

## 如何使用：Windows/Linux 平台

前往 [视频安装教程](https://github.com/obgnail/typora_plugin/issues/847)

1. [下载](https://github.com/obgnail/typora_plugin/releases/latest) 插件源码的压缩包，并解压

2. 进入 Typora 安装路径，找到包含 `window.html` 的文件夹 A

   - 正式版 Typora 对应的路径为 `./resources/window.html`

   - 免费版 Typora 对应的路径为 `./resources/app/window.html`

3. 将解压得到的 plugin 文件夹粘贴进文件夹 A 下

4. 进入文件夹 `A/plugin/bin/`

   - Windows 系统：右键 `install_windows.ps1` 文件，点击 `使用 PowerShell 运行`

   - Linux 系统：以管理员运行 `install_linux.sh`

5. 验证：重启 Typora，在正文区域点击鼠标右键，弹出右键菜单栏，如果能看到插件栏目，说明一切顺利

|          | 正式版                                       | 免费版                                       |
| -------- | -------------------------------------------- | -------------------------------------------- |
| 步骤 2-3 | ![typora_dir_new](assets/typora_dir_new.png) | ![typora_dir_old](assets/typora_dir_old.png) |

|        | Windows                                        | Linux                                      |
| ------ | ---------------------------------------------- | ------------------------------------------ |
| 步骤 4 | ![install_windows](assets/install_windows.png) | ![install_linux](assets/install_linux.png) |

## 如何使用：archlinux 平台

> 目前此方法仅限 archlinux 平台，aur 见 [aur/typora-plugin](https://aur.archlinux.org/packages/typora-plugin)

```sh
yay -S typora-plugin
```

## 插件使用说明

所有的插件都提供了七种使用方法：

- 键盘党：
  - 命令面板（`command_palette` 插件）
  - 斜杆命令（`slash_commands` 插件）
  - 快捷键（`hotkeys` 插件）
- 鼠标党：
  - 右键菜单（`right_click_menu` 插件）
  - 鼠标手势（`mouse_gestures` 插件）
  - 悬浮按钮（`action_buttons` 插件）
  - 圆盘菜单（`pie_menu` 插件）

## 导航与管理

### window_tab

![window_tab](assets/window_tab.gif)

### search_multi

通过类似于 Google 搜索语法，组合不同的条件来精确查找文件。

![search_mutli](assets/search_mutli.gif)

### auto_number

![auto_number](assets/auto_number.png)

> 和其他使用 Theme CSS 的实现方式不同，此插件通过修改内置函数，完美解决导出 PDF 后侧边栏没有编号的问题 :)

### bookmark

书签。使用方式：

1. 使用 alt+click 正文内容，打上书签。
2. 此时会自动调出书签管理器，点击上面的书签，即可跳转到书签。

### cursor_history

- 上一个光标历史的快捷键：alt+←
- 下一个光标历史的快捷键：alt+→

> 此插件默认关闭，需手动开启。

### preferences

插件配置窗口。

### updater

升级插件

### asset_root_redirect

如果你主要使用 obsidian 或 joplin 来管理文件，偶尔用 typora 打开文件。就会遇到一个问题：obsidian 或 joplin 都是将本地资源放在同一个目录中，这导致在 typora 打开后文件由于路径错误，无法访问本地资源。此插件就是为了解决此问题，重定向本地资源根目录。

> 此插件默认关闭，需手动开启。

### repository

记录 Typora 明确打开过的文件夹，并在管理窗口中搜索、排序、设置别名、打开或移除记录。删除记录不会删除真实文件夹；数据通过 `utils.getStorage` 保存在本地存储的 `repository.data` 键中。

> 此插件默认关闭，需手动开启。可在设置中配置快捷键，也可通过 `action_buttons` 调用 `repository.call`。

## 编辑增强

### collapse_paragraph

折叠 / 展开 章节下所有文本。支持折叠的标签：h1~h6

![collapse_paragraph](assets/collapse_paragraph.gif)

### collapse_list

折叠 / 展开 无序列表、有序列表、任务列表。

### collapse_table

折叠 / 展开 表格。

### md_padding

中英文混排时，中文与英文之间、中文与数字之间添加空格。

![md_padding](assets/md_padding.gif)

### slash_commands

类似于 notion 的 slash command。

![slash_commands](assets/slash_commands.gif)

### mouse_gestures

鼠标手势。

### templater

类似于 obsidian 的文件模板功能，根据模板快速创建文件。

![templater](assets/templater.gif)

### fence_enhance

![fence_enhance](assets/fence_enhance.png)

### right_outline

Typora 侧边栏的【文件】和【大纲】不能同时显示，为了解决此问题，此插件会在右侧新增一个【大纲】。

### commander

类似于 total commander 的命令行，一个快速执行命令的工具，并提供少量交互。

![commander](assets/commander.gif)

### command_palette

类似于 vscode 的命令面板功能 (Ctrl+Shift+P)

![command_palette](assets/command_palette.png)

### right_click_menu

在右键菜单中调用所有的插件功能。

### pie_menu

圆盘菜单。使用方式：

- `弹出圆盘菜单`：Ctrl+鼠标右键
- `旋转圆盘菜单`：鼠标中键
- `固定圆盘菜单，圆盘不再自动消失`：鼠标左键圆心
- `展开圆盘菜单，圆盘不再自动收缩`：鼠标右键圆心

### datatables

增强表格。提供搜索、过滤、分页、排序等功能。

![datatables](assets/datatables.png)

### resize_table

`ctrl+鼠标拖动` 修改表格的行高列宽。

![resize_table](assets/resize_table.gif)

### resize_image

`alt+鼠标滚轮滚动` 调整图片大小。

### easy_modify

常用的编辑工具集合，目前包括：

1. 复制标题路径
2. 提升选中文段的标题等级
3. 降低选中文段的标题等级
4. 换行符 CRLF 转为 LF
5. 换行符 LF 转为 CRLF
6. 移除不可见字符
7. 根据文档大纲一键生成思维导图：mindmap
8. 根据文档大纲一键生成思维导图：graph
9. 提取选区文字到新文件
10. 添加结尾空格

### editor_width_slider

调整写作区的宽度

### cjk_symbol_pairing

输入 `《 【 （ ' " 「` 符号时自动补全。

### text_stylize

将文字转为 HTML 格式，改变文字样式。

![text_stylize](./assets/text_stylize.gif)

### resource_manager

资源管理，清除无用图片

### markdownlint

检测当前文件是否符合 markdown 最佳实践规范，并自动修复。

### export_enhance

导出 HTML/PDF 时，将图片转为 base64，避免图片丢失。

### html_editor

在 Typora 主编辑区打开 `.html` / `.htm`，支持源码、预览和分栏模式、自动预览、元素检查、关联文档导航以及保存冲突确认。

预览默认禁止页面脚本和网络资源；仅应为可信文件开启 `PREVIEW_ALLOW_SCRIPTS` 或 `PREVIEW_ALLOW_NETWORK`。

> 此插件默认关闭，需手动开启。

## 视图与主题

### dark

夜间模式

### no_image

无图模式

### blur

开启后，只有当前聚焦的组件可见，其余模糊。

> 此插件只能于正式版 Typora 使用。

### myopic_defocus

离焦视力舒缓

### read_only

只读模式下文档不可编辑（开启后，右下角数字统计区域会出现 `ReadOnly` 字样）

### truncate_text

大文件在 Typora 的渲染性能很糟糕，用此插件暂时隐藏内容（只是隐藏显示，不修改文件），提高渲染性能。也可以用于防偷窥。

> 原理：通过设置 DOM 元素的 display 样式为 none 来隐藏元素，让元素不占用渲染树中的位置，对隐藏的元素操作不会引发其他元素的重排。

### image_viewer

一站式图片查看，并且提供简单图片编辑。

![image_viewer](./assets/image_viewer.png)

### diagram_enhance

为 Typora 图表提供围绕鼠标位置缩放、拖拽平移、触控手势、原始 DOM 全屏查看和八方向容器尺寸调整。右键菜单动作可重置当前图表的缩放和位置。

> 此插件默认关闭，需手动开启。

### static_markers

告别格式刷新的干扰，让您的 Markdown 语法标记 **始终可见、保持静态**。

禁用所见即所得模式下的语法标记自动隐藏功能，让 **、##、_ 等所有 Markdown 标记像在源码模式中一样，永远清晰地展示在您的文本周围。

![static_markers](./assets/static_markers.png)

> 此插件默认关闭，需手动开启。

### sidebar_enhance

侧边栏增强：

- 拖动大纲标题，调整文章结构
- 目录树显示其他扩展名文件
- 记忆大纲折叠状态
- 定制侧边栏文件图标
- 显示目录下的文件数

## 组件渲染

### markmap

![markmap](assets/markmap.gif)

### echarts

![echats](assets/echarts.png)

### chart

![chart](./assets/chart.png)

### drawIO

![drawIO](./assets/drawIO.png)

### abc

![abcjs](./assets/abcjs.png)

### calendar

![calendar](./assets/calendar.png)

### wavedrom

![wavedrom](./assets/wavedrom.png)

### marp

使用 markdown 做 PPT。

### plantUML

![plantUML](./assets/plantUML.png)

由于 plantUML 是 B/S 架构，需要用户提供渲染服务器。建议使用 Docker 安装渲染服务器：

```bash
docker pull plantuml/plantuml-server:jetty
docker run -d --name plantuml-server -p 8080:8080 plantuml/plantuml-server:jetty
```

### callouts

![callouts](./assets/callouts.png)

### kanban

![kanban](assets/kanban.png)

### timeline

![timeline](./assets/timeline.png)

### chat

![chat](./assets/chat.png)

## 高级功能

### hotkeys

> 此插件是高级插件，仅对有 JavaScript 基础的用户开放。

以声明的形式，为【任意插件系统函数】或【任意自定义函数】绑定快捷键。

### action_buttons

> 此插件是高级插件，仅对有 JavaScript 基础的用户开放。

和 hotkeys 类似，以声明的形式，为【任意插件系统函数】设置快捷按钮。

### custom

> 此插件是高级插件，仅对有 JavaScript 基础的用户开放。

提供开放能力，支持用户自己写插件。

具体使用请参考 [README.md](https://github.com/obgnail/typora_plugin/blob/master/plugin/custom/README.md)。



### remote_control

将包括 typora-plugin 所有功能在内的一切能力通过 `JSON RPC` 的形式暴露出去，以供外部操纵 Typora。

具体使用请参考 [README.md](https://github.com/obgnail/typora_plugin/blob/master/plugin/remote_control/README.md)。

> 此插件是高级插件，仅对开发人员开放。开启此插件后，外部将拥有 node、browser 两套环境，能完全控制电脑，因此如果您不是开发人员，请勿开启此插件。

### cipher

加密文件。

### ripgrep

Typora 自带 ripgrep。此插件支持使用内建的 ripgrep 进行文件搜索。

> 使用此插件需要您熟悉 ripgrep 工具。此插件默认关闭，需手动开启。

### article_uploader

用户点击或者使用快捷键触发当前文章的自动发布功能，程序根据用户配置自动发布博客文章到各大平台

具体使用参考： [README.md](https://github.com/obgnail/typora_plugin/blob/master/plugin/article_uploader/README.md)。以上传到 CSDN 为例，Gif 图如下：

![CSDN 成功演示](https://my-picture-bed1-1321100201.cos.ap-beijing.myqcloud.com/mypictures/CSDN%E6%88%90%E5%8A%9F%E6%BC%94%E7%A4%BA.gif)

## 致谢

- GPL: [PlantUML](https://plantuml.com/) | [Refractify Myopic Defocus](https://chromewebstore.google.com/detail/refractify-myopic-defocus/dpnfdlnkgojjihdmgmacnmheflkojijm?hl=en)
- Apache：[ECharts](https://echarts.apache.org/zh/index.html) | [draw.io](https://github.com/jgraph/drawio)
- MIT：[markmap](https://markmap.js.org/) | [Chart.js](https://www.chartjs.org/) | [abcjs](https://github.com/paulrosen/abcjs) | [tui.calendar](https://github.com/nhn/tui.calendar) | [Marp](https://marp.app/) | [WaveDrom](https://wavedrom.com/) | [DataTables](https://github.com/DataTables/DataTables) | [markdownlint](https://github.com/DavidAnson/markdownlint)
- no-licence：[typora-tabbar-plugin](https://github.com/gatziourasd/typora-tabbar-plugin) | [typora-side-by-side](https://github.com/gruvw/typora-side-by-side) | [md-padding](https://github.com/harttle/md-padding)

## 结语

**本项目遵循 MIT 协议，请自由地享受。**

如果对各位有用的话，欢迎 star ⭐，欢迎推荐给你志同道合的朋友使用。
