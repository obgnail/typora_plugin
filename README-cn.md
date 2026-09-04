[English](https://github.com/obgnail/typora_plugin/blob/master/README.md) | 简体中文

<div align="center">
  <h1>Typora Plugin</h1>
  <img src="assets/typora_plugin.png" alt="typora_plugin" width="400">
  <p align="center">
    <a href="https://github.com/obgnail/typora_plugin/releases/latest"><img src="https://img.shields.io/github/v/release/obgnail/typora_plugin"></a>
    <a href="https://github.com/obgnail/typora_plugin/stargazers"><img src="https://img.shields.io/github/stars/obgnail/typora_plugin?style=flat"></a>
    <a href="https://github.com/obgnail/typora_plugin/issues"><img src="https://img.shields.io/github/issues-closed/obgnail/typora_plugin.svg"></a>
    <a href="https://github.com/obgnail/typora_plugin/tree/master/plugin"><img src="https://img.shields.io/badge/implementation-Native-greenbule"></a>
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
| [repository](#repository)                   | 管理 Typora 打开过的文件夹         | ×        |

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

| 插件：组件            | 功能                   | 默认启用 |
| :-------------------- | :--------------------- | :------- |
| [markmap](#markmap)   | 集成 Markmap 组件      |          |
| [echarts](#echarts)   | 集成 Echarts 组件      |          |
| [chart](#chart)       | 集成 Chart.js 组件     |          |
| [drawIO](#drawIO)     | 集成 DrawIO 组件       |          |
| [abc](#abc)           | 集成 abc.js 组件       |          |
| [calendar](#calendar) | 集成 tui.calendar 组件 |          |
| [wavedrom](#wavedrom) | 集成 Wavedrom 组件     |          |
| [marp](#marp)         | 集成 Marp 组件         |          |
| [plantUML](#plantUML) | 集成 PlantUML 组件     |          |
| [callouts](#callouts) | 集成 Callouts          |          |
| [kanban](#kanban)     | 看板组件               |          |
| [timeline](#timeline) | 时间线组件             |          |
| [chat](#chat)         | 对话视图组件           |          |

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

| 插件：高级功能                        | 功能                        | 默认启用 |
| :------------------------------------ | :-------------------------- | :------- |
| [hotkeys](#hotkeys)                   | 快捷键注册中心              |          |
| [action_buttons](#action_buttons)     | 悬浮功能按钮注入            |          |
| [remote_control](#remote_control)     | JSON-RPC 外部控制接口       | ×        |
| [cipher](#cipher)                     | 文件加密与解密              | ×        |
| [ripgrep](#ripgrep)                   | 封装基于 ripgrep 的文件检索 | ×        |
| [article_uploader](#article_uploader) | 跨平台文档发布引擎          | ×        |

> 欢迎提交 [Issue](https://github.com/obgnail/typora_plugin/issues/new) 报告异常或探讨需求，欢迎发起 Pull Request。若本项目为您的工作流程带来提升，欢迎点亮 Star ⭐ 支持。

## Q&A

- **适用的 Typora 版本？** 要求 Typora 版本 ≥ 0.9.98（涵盖最后一个免费版本及后续的正式版）。
- **如何调整或修改插件配置？** `右键菜单` -> `交互插件` -> `插件配置`。所有插件与附加功能均支持独立且永久地启用或禁用。
- **如何执行插件系统升级？** `右键菜单` -> `交互插件` -> `插件配置` -> `检查更新`。
- **如何安全卸载插件组件？** `右键菜单` -> `交互插件` -> `插件配置` -> `卸载插件`。
- **是否支持 macOS 端的 Typora？** 由于缺乏测试环境及硬件设备，目前暂不提供 macOS 版本的原生支持。
- **有其他技术疑问或需要查阅讨论？** 请移步至 [AI Wiki](https://deepwiki.com/obgnail/typora_plugin) 检索文档，或在社区中发起讨论。

## 如何使用：Windows/Linux 平台

参考 [安装教程](https://github.com/obgnail/typora_plugin/issues/847) 获取图文支持。

1. **获取源码压缩包**：通过 [Release 页面](https://github.com/obgnail/typora_plugin/releases/latest) 下载最新版本并解压。

2. **定位注入点**：进入 Typora 安装目录，定位至包含 `window.html` 的目标文件夹（记为目录 A）。
   - 正式版 Typora 的相对路径为：`./resources/`
   - 免费版 Typora 的相对路径为：`./resources/app/`

3. **部署文件**：将解压后得到的 `plugin` 文件夹整体复制并粘贴至目录 A 内部。

4. **执行安装脚本**：进入 `A/plugin/bin/` 目录。
   - Windows 环境：右键点击 `install_windows.ps1`，选择 **使用 PowerShell 运行**。
   - Linux 环境：在终端以管理员权限执行 `install_linux.sh`。

5. **验证安装状态**：重启 Typora，在编辑器正文区域单击右键调出上下文菜单。若菜单面板中呈现插件相关选项，即表示底层逻辑注入与初始化成功。

![install](./assets/install.gif)

|          | 正式版 Typora                                | 免费版 Typora                                |
| -------- | -------------------------------------------- | -------------------------------------------- |
| 步骤 2-3 | ![typora_dir_new](./assets/typora_dir_new.png) | ![typora_dir_old](./assets/typora_dir_old.png) |

|        | Windows 环境                                   | Linux 环境                                 |
| ------ | ---------------------------------------------- | ------------------------------------------ |
| 步骤 4 | ![install_windows](./assets/install_windows.png) | ![install_linux](./assets/install_linux.png) |

## 如何使用：archlinux 平台

> 注意：此包管理方式目前仅限 archlinux 生态体系使用。详情请见 [aur/typora-plugin](https://aur.archlinux.org/packages/typora-plugin)。

```sh
yay -S typora-plugin
```

## 插件使用说明

插件系统提供以下七类交互入口，满足不同操作习惯的工作流：

- **基于键盘的交互：**
  - 命令面板（依托 `command_palette` 插件）
  - 斜杠命令菜单（依托 `slash_commands` 插件）
  - 全局快捷键（依托 `hotkeys` 插件）
- **基于鼠标/指针的交互：**
  - 右键上下文菜单（依托 `right_click_menu` 插件）
  - 鼠标手势识别（依托 `mouse_gestures` 插件）
  - 悬浮动作按钮（依托 `action_buttons` 插件）
  - 圆盘放射状菜单（依托 `pie_menu` 插件）

## 导航与管理

### window_tab

提供多文档标签页（Tab）管理功能。

![window_tab](./assets/window_tab.gif)

### search_multi

支持使用类似搜索引擎的指令语法，通过多条件组合进行高精度文件检索。

![search_mutli](./assets/search_mutli.gif)

### auto_number

为文档内的各层级章节、表格、图片及代码块等元素自动生成序号。

![auto_number](./assets/auto_number.png)

> 与纯 CSS 渲染方案不同，本插件通过拦截底层核心函数实现，解决了导出 PDF 时侧边栏目录丢失编号的技术缺陷。

### bookmark

书签管理器。使用方式如下：

1. 使用 `Alt + 左键点击` 正文指定位置，插入书签标记。
2. 插入后将自动唤出书签管理面板，点击对应条目即可实现文档内的快速跳转。

### cursor_history

记录光标活动轨迹，支持上下文穿梭。

- 跳转至上一个光标位置：`Alt + ←`
- 跳转至下一个光标位置：`Alt + →`

> 提示：此插件默认禁用，需手动在配置选项中开启。

### preferences

提供统一的图形化控制面板，用于调整全局插件配置。

### updater

支持在当前环境下一键在线检测并拉取更新包以升级插件系统。

### asset_root_redirect

解决跨端工具（如 Obsidian 或 Joplin）协同管理 Markdown 文件时引发的本地静态资源解析异常。此类工具通常设定了特定的资源根路径，直接使用 Typora 独立打开往往导致链接失效。本插件允许用户在 Typora 内强制重定向本地资源引用的根目录。

> 提示：此插件默认禁用，需手动在配置选项中开启。

### repository

追踪并持久化记录 Typora 打开过的工作区目录。支持在专用的管理面板中对历史记录执行检索、排序、设置别名、移除及快捷重新打开操作。

> 提示：此插件默认禁用，需手动在配置选项中开启。可在设置内绑定特定快捷键，或通过 `action_buttons` 触发 `repository.call` 接口。

## 编辑增强

### collapse_paragraph

支持对 `h1` 至 `h6` 标题节点下的所有文本段落执行折叠与展开操作。

![collapse_paragraph](./assets/collapse_paragraph.gif)

### collapse_list

支持对无序列表、有序列表及任务列表节点执行折叠与展开操作。

### collapse_table

支持对表格节点执行整体的折叠与展开操作。

### md_padding

规范中英文排版体验：在文档的中文与英文、中文与数字相交边界自动插入适当的盘古之白（空格）。

![md_padding](./assets/md_padding.gif)

### slash_commands

提供类似 Notion 的斜杠（`/`）唤出式命令菜单。

![slash_commands](./assets/slash_commands.gif)

### mouse_gestures

提供全局的鼠标手势识别及操作映射支持。

### templater

提供轻量级文档模板引擎。支持预定义内容架构并据此快速初始化新文件。

![templater](./assets/templater.gif)

### fence_enhance

增强代码块功能，提供一键复制、折叠视图及代码格式化操作。

![fence_enhance](./assets/fence_enhance.png)

### right_outline

在编辑区域右侧注入独立的大纲目录视图，解决原生 Typora 侧边栏无法同时显示【文件树】与【文档大纲】的限制。

### commander

提供内嵌的轻量级命令行环境，支持快速执行自定义 Shell 指令及简单的交互式脚本操作。

![commander](./assets/commander.png)

### command_palette

实现类似 VS Code 的全局命令面板（快捷键：`Ctrl+Shift+P`）。

![command_palette](./assets/command_palette.png)

### right_click_menu

整合插件系统的各项接口功能至原生的右键菜单中，集中处理交互逻辑。

### pie_menu

图形化圆盘菜单组件。基础交互协议：

- `唤出圆盘菜单`：`Ctrl + 鼠标右键点击`
- `循环旋转圆盘`：拨动鼠标中键（滚轮）
- `锁定菜单状态（解除自动消隐）`：鼠标左键点击圆心区域
- `展开次级菜单（解除自动收缩）`：鼠标右键点击圆心区域

### datatables

为标准 Markdown 表格注入高级交互特性，包括数据检索、实时过滤、前端分页及多列联合排序功能。

![datatables](./assets/datatables.png)

### resize_table

通过 `Ctrl + 鼠标拖拽` 的交互方式，动态调整当前表格的行高与列宽样式。

![resize_table](./assets/resize_table.gif)

### resize_image

通过 `Alt + 鼠标滚轮` 的交互方式，实时动态缩放目标图片的渲染尺寸。

### easy_modify

内置高频编辑工具集，目前提供如下功能模块：

1. 提取并复制当前标题层级的完整大纲路径
2. 提升选区文本对应的标题层级
3. 降低选区文本对应的标题层级
4. 强制转换换行符：`CRLF` 转换为 `LF`
5. 强制转换换行符：`LF` 转换为 `CRLF`
6. 批量移除不可见控制字符
7. 基于当前文档大纲一键生成思维导图（Markmap 视图）
8. 基于当前文档大纲一键生成思维导图（Graph 视图）
9. 剥离选区文本并直接派生为新文件
10. 在文档末尾追加规范化空行
11. 格式化所有表格源码

### editor_width_slider

提供拖拽滑块机制以动态调节编辑器核心视图的文本区宽度界限。

### cjk_symbol_pairing

实现中文字符域标点（如 `《`、`【`、`（`、`「`）及引号输入时的自动成对闭合与光标后撤补全。

### text_stylize

通过封装内联 HTML 标签的方式，对当前选定文本快速应用自定义或预设的富文本样式。

![text_stylize](./assets/text_stylize.gif)

### markdownlint

Markdown 规范分析器。检测偏离最佳实践规范的语法并提供自动化修复。

![markdownlint](./assets/markdownlint.png)

### resource_manager

工作区静态资源管理器。执行依赖性分析并安全清除当前目录下未被任何 Markdown 文档引用的冗余图片。

### export_enhance

拦截底层的 HTML/PDF 导出流，在生成渲染文件前，强制将引用的本地图片转换为 Base64 编码内联格式，防止后续外部资源依赖断裂。

### html_editor

在 Typora 核心编辑区直接加载并渲染 `.html` / `.htm` 文件。支持查看源码、实时预览与双视窗分栏模式，集成元素检视器、文档间导航跳转及写入冲突安全确认机制。

预览模式默认实行严格策略（拦截页面内脚本执行与外部网络请求）；建议仅在操作受信环境下的文件时显式开启 `PREVIEW_ALLOW_SCRIPTS` 或 `PREVIEW_ALLOW_NETWORK` 标记。

> 提示：此插件默认禁用，需手动在配置选项中开启。

## 组件渲染

<table width="100%">
<tr>
<td width="33.33%" align="center"><a id="chart"><b>Chart.js</b></a><br><img src="./assets/chart.png" width="100%"></td>
<td width="33.33%" align="center"><a id="echarts"><b>ECharts</b></a><br><img src="./assets/echarts.png" width="100%"></td>
<td width="33.33%" align="center"><a id="markmap"><b>Markmap</b></a><br><img src="./assets/markmap.png" width="100%"></td>
</tr>
<tr>
<td width="33.33%" align="center"><a id="plantUML"><b>PlantUML</b></a><br><img src="./assets/plantUML.png" width="100%"></td>
<td width="33.33%" align="center"><a id="drawIO"><b>Draw.io</b></a><br><img src="./assets/drawIO.png" width="100%"></td>
<td width="33.33%" align="center"><a id="abc"><b>ABC</b></a><br><img src="./assets/abcjs.png" width="100%"></td>
</tr>
<tr>
<td width="33.33%" align="center"><a id="wavedrom"><b>WaveDrom</b></a><br><img src="./assets/wavedrom.png" width="100%"></td>
<td width="33.33%" align="center"><a id="marp"><b>Marp</b></a><br><img src="./assets/marp.png" width="100%"></td>
<td width="33.33%" align="center"><a id="calendar"><b>Calendar</b></a><br><img src="./assets/calendar.png" width="100%"></td>
</tr>
<tr>
<td width="33.33%" align="center"><a id="timeline"><b>Timeline</b></a><br><img src="./assets/timeline.png" width="100%"></td>
<td width="33.33%" align="center"><a id="kanban"><b>Kanban</b></a><br><img src="./assets/kanban.png" width="100%"></td>
<td width="33.33%" align="center"><a id="chat"><b>Chat</b></a><br><img src="./assets/chat.png" width="100%"></td>
</tr>
</table>

<table width="100%">
<tr>
<td width="50%" align="center"><a id="markmap (TOC)"><b>Markmap (TOC)</b></a><br><img src="./assets/markmap.gif" width="100%"></td>
<td width="50%" align="center"><a id="callouts"><b>Callouts</b></a><br><img src="./assets/callouts.png" width="100%"></td>
</tr>
</table>

## 视图与主题

### dark

提供暗色（夜间）模式渲染主题。

### no_image

提供无图（纯文本优先）模式。

### blur

焦点管理优化：仅当前活跃且聚焦的节点区域保持清晰渲染，周围非活动区域自动应用高斯模糊效果以屏蔽视觉干扰。

> 提示：此功能依赖特定的环境上下文，仅支持于正式版 Typora 中启用。

### myopic_defocus

提供离焦视力舒缓视觉滤镜支持。

### read_only

锁定当前文档内容，阻断一切修改操作。激活状态下，右下角字数统计区将显式挂载 `ReadOnly` 状态标识。

### truncate_text

针对超大型文档的渲染性能优化方案。通过将处于视口（Viewport）外的 DOM 节点样式设置为 `display: none` 实现临时脱离文档流，阻止浏览器执行高昂的全局重排（Reflow），从而显著提高滚动及编辑的帧率；亦可兼作防窥手段。

> 原理：不修改底层源文件数据，仅在呈现层剥离指定节点，使其暂时卸载出渲染树结构。

### image_viewer

集成内置的独立图片浏览器模块，支持全屏无干扰预览及基础图像变换编辑操作。

### diagram_enhance

为基于 Typora 渲染引擎的图表提供交互增强：支持以鼠标指针为中心的滚轮缩放、拖拽平移视口、触屏手势识别、拉起原始 DOM 全屏查看机制，以及八向容器边界自适应调整。右键上下文菜单可快速触发视图位置与比例重置。

> 提示：此插件默认禁用，需手动在配置选项中开启。

### static_markers

强制保留 Markdown 语法标记符（标记常驻）。

禁用所见即所得（WYSIWYG）模式下的标记符自动隐藏回调逻辑，确保 `**`、`##`、`_` 等所有源码排版标记始终处于显式渲染状态。

![static_markers](./assets/static_markers.png)

> 提示：此插件默认禁用，需手动在配置选项中开启。

### sidebar_enhance

扩展原生文件侧边栏的功能边界：

- 支持通过拖拽大纲标题节点进行文档物理结构的重排
- 文件树视图支持声明并呈现非 Markdown 扩展名的系统文件
- 持久化记忆大纲树节点的折叠展开状态
- 支持挂载自定义的文件图标规则
- 在目录节点显示下属文件的统计计数


## 高级功能

### hotkeys

提供声明式的快捷键注册调度器。支持将内部插件系统提供的任意暴露接口，或由用户注入的任意自定义函数，绑定至全局物理快捷键。

### action_buttons

采用与 `hotkeys` 同源的声明式配置逻辑，支持将插件系统的任意接口函数映射为界面底部的悬浮交互按钮。

### remote_control

提供基于 `JSON-RPC` 协议的外部通信层，将包含 `typora-plugin` 在内的核心控制权暴露为标准接口，允许外部第三方脚本或进程以编程方式操控 Typora。

具体接口定义与技术规约，请参阅子文档：[README.md](https://github.com/obgnail/typora_plugin/blob/master/plugin/remote_control/README.md)。

> 提示：此插件默认禁用，需手动在配置选项中开启。

### cipher

提供基于标准密码学算法的文档安全模块，支持本地文件的加密存储与解密挂载。

> 提示：此插件默认禁用，需手动在配置选项中开启。

### ripgrep

在 Typora 内部封装并集成原生的 `ripgrep` 检索引擎，实现极速的全局文本匹配与文件搜索。

> 提示：此功能模块要求使用者具备基础的 `ripgrep` 命令行工具使用经验。该插件默认禁用，需手动在配置选项中开启。

### article_uploader

跨平台文档发布引擎。支持通过触发行为（如快捷键或界面交互），将当前工作区渲染完毕的 Markdown 文档自动化推送至预先配置的各第三方内容平台。

详细的平台支持列表与配置指南请参阅子文档：[README.md](https://github.com/obgnail/typora_plugin/blob/master/plugin/article_uploader/README.md)。

> 提示：此插件默认禁用，需手动在配置选项中开启。

## 致谢

- **GPL 协议**: [PlantUML](https://plantuml.com/) | [Refractify Myopic Defocus](https://chromewebstore.google.com/detail/refractify-myopic-defocus/dpnfdlnkgojjihdmgmacnmheflkojijm?hl=en)
- **Apache 协议**: [ECharts](https://echarts.apache.org/zh/index.html) | [draw.io](https://github.com/jgraph/drawio)
- **MIT 协议**: [markmap](https://markmap.js.org/) | [Chart.js](https://www.chartjs.org/) | [abcjs](https://github.com/paulrosen/abcjs) | [tui.calendar](https://github.com/nhn/tui.calendar) | [Marp](https://marp.app/) | [WaveDrom](https://wavedrom.com/) | [DataTables](https://github.com/DataTables/DataTables) | [markdownlint](https://github.com/DavidAnson/markdownlint)
- **无显式协议/公共领域**: [typora-tabbar-plugin](https://github.com/gatziourasd/typora-tabbar-plugin) | [typora-side-by-side](https://github.com/gruvw/typora-side-by-side) | [md-padding](https://github.com/harttle/md-padding)

## 结语

**本项目遵循 MIT 协议，请自由地享受。**

若本工具集对您的生产力有实质性提升，欢迎在 GitHub 点亮 Star ⭐ 支持，并将其分享给具有同等工作流需求的开发者。
