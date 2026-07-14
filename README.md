English | [简体中文](https://github.com/obgnail/typora_plugin/blob/master/README-cn.md)

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

## Plugin List

| Plugin：Navigation & Management             | Feature                    | Default |
| :------------------------------------------ | :------------------------- | :------ |
| [window_tab](#window_tab)                   | Window Tab Bar             |         |
| [search_multi](#search_multi)               | Multi-Fields File Searcher |         |
| [auto_number](#auto_number)                 | Auto numbering             |         |
| [bookmark](#bookmark)                       | Bookmark manager           | ×       |
| [cursor_history](#cursor_history)           | Cursor History             | ×       |
| [preferences](#preferences)                 | Preferences                |         |
| [updater](#updater)                         | One-click plugin update    |         |
| [asset_root_redirect](#asset_root_redirect) | Resource Redirection       | ×       |
| [repository](#repository)                   | Manage opened folders      | ×       |

| Plugin：Enhance Editing                     | Feature                                     | Default |
| :------------------------------------------ | :------------------------------------------ | :------ |
| [collapse_paragraph](#collapse_paragraph)   | Chapter Folding                             | ×       |
| [collapse_list](#collapse_list)             | List Folding                                | ×       |
| [collapse_table](#collapse_table)           | Table Folding                               | ×       |
| [md_padding](#md_padding)                   | Chinese-English Text Spacer                 |         |
| [slash_commands](#slash_commands)           | Slash Commands                              |         |
| [mouse_gestures](#mouse_gestures)           | Mouse Gestures                              | ×       |
| [templater](#templater)                     | File Templater                              |         |
| [fence_enhance](#fence_enhance)             | Enhance Fence                               |         |
| [right_outline](#right_outline)             | Right Outline                               |         |
| [commander](#commander)                     | Commander                                   |         |
| [command_palette](#command_palette)         | Command Palette                             |         |
| [right_click_menu](#right_click_menu)       | Right-Click Menu                            |         |
| [pie_menu](#pie_menu)                       | Pie menu                                    | ×       |
| [datatables](#datatables)                   | Enhance Table                               | ×       |
| [resize_table](#resize_table)               | Table Resizer                               |         |
| [resize_image](#resize_image)               | Image Resizer                               |         |
| [easy_modify](#easy_modify)                 | Editing tools                               |         |
| [editor_width_slider](#editor_width_slider) | Adjust writing area width                   |         |
| [cjk_symbol_pairing](#cjk_symbol_pairing)   | CJK Symbol Pairing                          |         |
| [text_stylize](#text_stylize)               | Text stylization                            |         |
| [resource_manager](#resource_manager)       | Resource Management                         |         |
| [markdownlint](#markdownlint)               | Markdownlint Check                          |         |
| [export_enhance](#export_enhance)           | Avoid image loss when exporting to HTML/PDF | ×       |
| [html_editor](#html_editor)                 | Preview and edit HTML in the main editor    | ×       |

| Plugin：View & Theme                | Feature                                                      | Default |
| :---------------------------------- | :----------------------------------------------------------- | :------ |
| [dark](#dark)                       | Dark mode                                                    |         |
| [no_image](#no_image)               | No image mode                                                |         |
| [blur](#blur)                       | Blur mode                                                    |         |
| [myopic_defocus](#myopic_defocus)   | Defocus Comfort Mode                                         |         |
| [read_only](#read_only)             | Read-only mode                                               |         |
| [truncate_text](#truncate_text)     | Hide content to improve performance for large files          | ×       |
| [image_viewer](#image_viewer)       | Image viewer                                                 |         |
| [diagram_enhance](#diagram_enhance) | Diagram zoom, pan, fullscreen, and resize                    | ×       |
| [static_markers](#static_markers)   | Static Markers                                               | ×       |
| [sidebar_enhance](#sidebar_enhance) | Drag & drop to rearrange、Display non-Markdown files、Keep Fold State |         |

| Plugin：Component     | Feature                       | Default |
| :-------------------- | :---------------------------- | :------ |
| [markmap](#markmap)   | Provides Markmap support      |         |
| [echarts](#echarts)   | Provides Echarts support      |         |
| [chart](#chart)       | Provides Chart.js support     |         |
| [drawIO](#drawIO)     | Provides DrawIO support       |         |
| [abc](#abc)           | Provides abc.js support       |         |
| [calendar](#calendar) | Provides tui.calendar support |         |
| [wavedrom](#wavedrom) | Provides WaveDrom support     |         |
| [marp](#marp)         | Provides Marp support         |         |
| [plantUML](#plantUML) | Provides PlantUML support     | ×       |
| [callouts](#callouts) | Provides Callouts support     |         |
| [kanban](#kanban)     | Kanban                        |         |
| [timeline](#timeline) | Timeline                      |         |
| [chat](#chat)         | Chat                          |         |

| Plugin：Advanced                      | Feature                                                   | Default |
| :------------------------------------ | :-------------------------------------------------------- | :------ |
| [hotkeys](#hotkeys)                   | Hotkey registration center (Advanced)                     |         |
| [action_buttons](#action_buttons)     | Add function buttons in the lower right corner (Advanced) |         |
| [custom](#custom)                     | Open platform for user-defined plugins (Advanced)         |         |
| [remote_control](#remote_control)     | Typora Automation (Advanced)                              | ×       |
| [cipher](#cipher)                     | Encrypt files                                             | ×       |
| [ripgrep](#ripgrep)                   | Search files using ripgrep                                | ×       |
| [article_uploader](#article_uploader) | One-click upload blog to supported platforms              | ×       |

> If you have other needs or find bugs, feel free to [open an issue](https://github.com/obgnail/typora_plugin/issues/new). PRs are also welcome. If you find this project helpful, please give me a star ⭐

## Q&A

- **Is my Typora supported?** Typora's version should be ≥ 0.9.98 (the last free version).
- **How to modify plugin configurations?** Right-click menu -> Interactive Plugins -> Preferences. **Respect all user choices**. Any plugin or feature can be permanently enabled/disabled.
- **How to upgrade plugins?** Right-click menu -> Interactive Plugins -> Preferences -> Check for Updates.
- **How to uninstall plugins?** Right-click menu -> Interactive Plugins -> Preferences -> Uninstall Plugins.
- **How to develop plugins?** No Build Time, No need to install development environment. Please refer to [Readme](https://github.com/obgnail/typora_plugin/blob/master/plugin/custom/README-en.md) for details.
- **Does it support Typora for Mac?** I don't have a Mac device, so I haven't tested it.
- **Any other questions?** Please ask [AI Wiki](https://deepwiki.com/obgnail/typora_plugin).

## How to Use: Windows/Linux Platform

Visit [Video Installation Tutorial](https://github.com/obgnail/typora_plugin/issues/847)

1. [Download](https://github.com/obgnail/typora_plugin/releases/latest) the plugin source code package and unzip it.

2. Go to the Typora installation path and find the folder A containing `window.html`.

   - For the official version of Typora, the path is `./resources/window.html`.

   - For the beta version of Typora, the path is `./resources/app/window.html`.

3. Paste the unzipped plugin folder into folder A.

4. Go to the folder `A/plugin/bin/`.

   - Windows: Right-Click on the file `install_windows.ps1`. Select 'Run with PowerShell'.
   - Linux: Run `install_linux.sh` as administrator.

5. Verification: Restart Typora, right-click in the main text area, and if you see the plugin items, everything is fine.

|           | Official Version                             | Beta Version                                 |
| --------- | -------------------------------------------- | -------------------------------------------- |
| Steps 2-3 | ![typora_dir_new](assets/typora_dir_new.png) | ![typora_dir_old](assets/typora_dir_old.png) |

|        | Windows                                        | Linux                                      |
| ------ | ---------------------------------------------- | ------------------------------------------ |
| Step 4 | ![install_windows](assets/install_windows.png) | ![install_linux](assets/install_linux.png) |

## How to Use: Archlinux Platform

> Currently, this method is only for the Archlinux platform, see [aur/typora-plugin](https://aur.archlinux.org/packages/typora-plugin)

```sh
yay -S typora-plugin
```

## Plugin Usage Instructions

All plugins provide seven usage methods:

- Keyboard enthusiasts:
  - Command Palette (see `command_palette` plugin)
  - Slash commands  (see `slash_commands` plugin)
  - Shortcut keys (see `hotkeys` plugin)
- Mouse enthusiasts:
  - Right-click in the main text area (see `right_click_menu` plugin)
  - Mouse gestures (see `mouse_gestures` plugin)
  - Quick buttons (see `action_buttons` plugin)
  - Pie menu（see `pie_menu` plugin）

## Navigation & Management

### window_tab

![window_tab](assets/window_tab.gif)

### search_multi

By using Google search syntax and combining different criteria to accurately search for files.

![search_mutli](assets/search_mutli.gif)

### auto_number

![auto_number](assets/auto_number.png)

Unlike other implementations using theme CSS, this plugin perfectly solves the problem of no numbering in the sidebar after exporting to PDF by modifying the built-in function :)

### bookmark

Usage:

1. Use alt + click on the text content to bookmark.
2. This will automatically bring up the bookmark manager. Click on the bookmark above to jump to the bookmark.

### cursor_history

- hotkey for the previous cursor: alt+←
- hotkey for the next cursor: alt+→

> This plugin is disabled by default and needs to be manually enabled.

### preferences

Preferences

### updater

Upgrade Plugin.

### asset_root_redirect

If you mainly use Obsidian or Joplin to manage files and occasionally use Typora to open files, you will encounter a problem: both Obsidian and Joplin put local resources in the same directory, but Typora defaults to using relative paths to reference local resources.

> This plugin is disabled by default and needs to be manually enabled.

### repository

Records folders explicitly opened by Typora and provides a manager for searching, sorting, assigning aliases, opening, or removing records. Removing a record never deletes the real folder. Data is stored in local storage under the `repository.data` key.

> This plugin is disabled by default. Configure a hotkey in Preferences or invoke `repository.call` through `action_buttons`.

## Enhance Editing

### collapse_paragraph

![collapse_paragraph](assets/collapse_paragraph.gif)

### collapse_list

Fold/expand unordered lists, ordered lists, task lists.

### collapse_table

Fold/expand tables.

### md_padding

Add spaces between Chinese and English, Chinese and numbers when mixed.

![md_padding](assets/md_padding.gif)

### slash_commands

Similar to Notion's slash command.

![slash_commands](assets/slash_commands.gif)

### mouse_gestures

Mouse gestures in Typora.

### templater

Similar to Obsidian's file template function, quickly create files based on templates.

![templater](assets/templater.gif)

### fence_enhance

![fence_enhance](assets/fence_enhance.png)

### right_outline

Typora's sidebar cannot display both [File] and [Outline] simultaneously. To solve this problem, this plugin adds an [Outline] on the right.

### commander

![commander](assets/commander.gif)

### command_palette

Similar to VSCode's command palette (Ctrl+Shift+P)

![command_palette](assets/command_palette.png)

### right_click_menu

All plugins support direct invocation through the right-click menu. Mouse enthusiasts can use the right-click menu as the main way to call all plugins.

### pie_menu

Pie Menu. Usage:

- `Open circular menu`: Ctrl + right mouse button
- `Rotate circular menu`: Middle mouse button
- `Pin the circular menu, so it doesn't automatically disappear`: Left mouse button in the middle of the circle
- `Expand the circular menu, so it doesn't automatically collapse`: Right mouse button in the middle of the circle

### datatables

Enhance tables. Provides functions such as search, filter, pagination, and sorting.

Usage: Place the cursor on the table -> Right-click menu -> Interactive Plugins -> Table Enhancement.

![datatables](assets/datatables.png)

### resize_table

`ctrl + mouse drag`: Modify the row height and column width of the table.

![resize_table](assets/resize_table.gif)

### resize_image

`alt + mouse scroll`: Adjust the image size.

### easy_modify

This plugin is a collection of commonly used editing tools, currently including:

1. Copy title path
2. Promote the title level of the selected paragraph
3. Demote the title level of the selected paragraph
4. Convert line break CRLF to LF
5. Convert line break LF to CRLF
6. Remove invisible characters
7. Generate mind map based on the document outline: mindmap
8. Generate mind map based on the document outline: graph
9. Extract selected text to a new file
10. Add trailing spaces

### editor_width_slider

Adjust the width of the writing area.

### cjk_symbol_pairing

Automatically pair symbols when typing `《 【 （ ' " 「`.

### text_stylize

![text_stylize](assets/text_stylize.gif)

### resource_manager

Resource management, cleanup of unused images

### markdownlint

Check whether the current file complies with the markdown best practices.

### export_enhance

When exporting HTML/PDF, convert images to base64 to avoid image loss.

### html_editor

Opens `.html` and `.htm` files in Typora's main editor with source, preview, and split views, live preview, element inspection, related-document navigation, and save conflict checks.

Preview scripts and network resources are disabled by default. Enable `PREVIEW_ALLOW_SCRIPTS` or `PREVIEW_ALLOW_NETWORK` only for trusted files.

> This plugin is disabled by default and needs to be manually enabled.

## View & Theme

### dark

Dark Mode

### no_image

No Image Mode

### blur

After enabling, only the currently focused component is visible, the rest are blurred. It can be used to prevent peeking.

> This plugin can only be used with the official version of Typora.

### myopic_defocus

Defocus Comfort Mode

### read_only

In read-only mode, the document cannot be edited (after enabling, the bottom right corner of the statistics area will show `ReadOnly`).

### truncate_text

The rendering performance of large files in Typora is very poor. Use this plugin to temporarily hide content (just hide the display, not modify the file) to improve rendering performance. It can also be used to prevent peeking.

> Principle: By setting the display style of DOM elements to none, elements are hidden so that they do not occupy a position in the rendering tree, and operations on hidden elements do not cause reflow of other elements.

### image_viewer

One-stop image viewing, and provides simple image editing.

![image_viewer](./assets/image_viewer.png)

### diagram_enhance

Adds cursor-centered zoom, drag panning, touch gestures, original-DOM fullscreen viewing, and eight-direction container resizing to Typora diagrams. The context-menu action resets the current diagram's zoom and position.

> This plugin is disabled by default and needs to be manually enabled.

### static_markers

Say goodbye to distracting format refreshes. This plugin keeps your Markdown syntax markers always visible and static.

This plugin disables the auto-hiding feature for syntax markers in WYSIWYG mode. It ensures that all Markdown characters—like **, ##, and _—remain persistently visible around your text, just as they would in a source code editor.

![static_markers](./assets/static_markers.png)

> This plugin is disabled by default and needs to be manually enabled.

### sidebar_enhance

- Drag & drop outline to rearrange
- Display non-Markdown files in the sidebar
- Keep Fold Outline State
- Customize Sidebar File Icons
- Display File Count

## Component

### markmap

![markmap](assets/markmap.gif)

### echarts

![echarts](assets/echarts.png)

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

Use markdown to create PPT.

### plantUML

![plantUML](./assets/plantUML.png)

Due to the B/S architecture of plantUML, a rendering server is required. Suggest using Docker to install:

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

## Advanced

### hotkeys

> This plugin is an advanced plugin, only available to users with a JavaScript background.

Bind hotkeys to [any plugin system function] or [any custom function] in a declarative form.

### action_buttons

> This plugin is an advanced plugin, only available to users with a JavaScript background.

Similar to hotkeys, set function buttons for [any plugin system function] in a declarative form.

### custom

> This plugin is an advanced plugin, only available to users with a JavaScript background.

Provide open capabilities, support users to write their own plugins.

For specific usage, please refer to [README.md](https://github.com/obgnail/typora_plugin/blob/master/plugin/custom/README.md).

### remote_control

Expose all capabilities including the typora-plugin in the form of `JSON RPC` for external manipulation of Typora.

For specific usage, please refer to [README.md](https://github.com/obgnail/typora_plugin/blob/master/plugin/remote_control/README.md).

> This plugin is an advanced plugin, only available to developers. After enabling this plugin, the external will have both node and browser environments, which can fully control the computer, so if you are not a developer, please do not enable it.

### cipher

Encrypt File.

### ripgrep

Typora comes with ripgrep. This plugin supports using the built-in ripgrep to search files.

> To use this plugin, you need to be familiar with the ripgrep tool. This plugin is disabled by default and needs to be manually enabled.

### article_uploader

The user clicks or uses a shortcut key to trigger the automatic publishing function of the current article. The program automatically publishes blog articles to major platforms according to user configuration.

For specific usage, refer to: [README.md](https://github.com/obgnail/typora_plugin/blob/master/plugin/article_uploader/README.md). Taking uploading to CSDN as an example, the GIF is as follows:

![CSDN Success Demonstration](https://my-picture-bed1-1321100201.cos.ap-beijing.myqcloud.com/mypictures/CSDN%E6%88%90%E5%8A%9F%E6%BC%94%E7%A4%BA.gif)

## Acknowledgements

- GPL: [PlantUML](https://plantuml.com/) | [Refractify Myopic Defocus](https://chromewebstore.google.com/detail/refractify-myopic-defocus/dpnfdlnkgojjihdmgmacnmheflkojijm?hl=en)
- Apache: [ECharts](https://echarts.apache.org/zh/index.html) | [draw.io](https://github.com/jgraph/drawio)
- MIT: [markmap](https://markmap.js.org/) | [Chart.js](https://www.chartjs.org/) | [abcjs](https://github.com/paulrosen/abcjs) | [tui.calendar](https://github.com/nhn/tui.calendar) | [Marp](https://marp.app/) | [WaveDrom](https://wavedrom.com/) | [DataTables](https://github.com/DataTables/DataTables) | [markdownlint](https://github.com/DavidAnson/markdownlint)
- no-licence: [typora-tabbar-plugin](https://github.com/gatziourasd/typora-tabbar-plugin) | [typora-side-by-side](https://github.com/gruvw/typora-side-by-side) | [md-padding](https://github.com/)

## Conclusion

**This project follows the MIT license, feel free to enjoy it.**

If you find it useful, please give it a star ⭐, and feel free to recommend it to like-minded friends.
