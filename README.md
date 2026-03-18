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


| #    | Plugin              | Function                                                     | Enabled by Default |
| ---- | ------------------- | ------------------------------------------------------------ | ------------------ |
| 1    | window_tab          | Window Tab Bar                                               |                    |
| 2    | search_multi        | Multi-Fields File Searcher                                   |                    |
| 3    | collapse_paragraph  | Chapter Folding                                              | ×                  |
| 4    | collapse_list       | List Folding                                                 | ×                  |
| 5    | collapse_table      | Table Folding                                                | ×                  |
| 6    | md_padding          | Chinese-English Text Spacer                                  |                    |
| 7    | slash_commands      | Slash Commands                                               |                    |
| 8    | templater           | File Templater                                               |                    |
| 9    | resource_manager    | Resource Management                                          |                    |
| 10   | fence_enhance       | Enhance Fence                                                |                    |
| 11   | right_outline       | Right Outline                                                |                    |
| 12   | commander           | Commander                                                    |                    |
| 13   | toolbar             | Multi-Purpose Searcher                                       |                    |
| 14   | right_click_menu    | Right-Click Menu                                             |                    |
| 15   | pie_menu            | Pie menu                                                     | ×                  |
| 16   | datatables          | Enhance Table                                                | ×                  |
| 17   | preferences         | Preferences                                                  |                    |
| 18   | markmap             | Provides Markmap support                                     |                    |
| 19   | echarts             | Provides Echarts support                                     |                    |
| 20   | chart               | Provides Chart.js support                                    |                    |
| 21   | drawIO              | Provides DrawIO support                                      |                    |
| 22   | abc                 | Provides abc.js support                                      |                    |
| 23   | calendar            | Provides tui.calendar support                                |                    |
| 24   | wavedrom            | Provides WaveDrom support                                    |                    |
| 25   | marp                | Provides Marp support                                        |                    |
| 26   | plantUML            | Provides PlantUML support                                    | ×                  |
| 27   | callouts            | Provides Callouts support                                    |                    |
| 28   | text_stylize        | Text stylization                                             |                    |
| 29   | read_only           | Read-only mode                                               |                    |
| 30   | blur                | Blur mode                                                    |                    |
| 31   | kanban              | Kanban                                                       |                    |
| 32   | timeline            | Timeline                                                     |                    |
| 33   | chat                | Chat                                                         |                    |
| 34   | auto_number         | Auto numbering                                               |                    |
| 35   | image_viewer        | Image viewer                                                 |                    |
| 36   | cjk_symbol_pairing  | CJK Symbol Pairing                                           |                    |
| 37   | resize_table        | Table Resizer                                                |                    |
| 38   | resize_image        | Image Resizer                                                |                    |
| 39   | export_enhance      | Avoid image loss when exporting to HTML                      |                    |
| 40   | sidebar_enhance     | Drag & drop to rearrange、Display non-Markdown files、Keep Fold State |                    |
| 41   | markdownlint        | Markdownlint Check                                           |                    |
| 42   | truncate_text       | Hide content to improve performance for large files          | ×                  |
| 43   | dark                | Dark mode                                                    |                    |
| 44   | no_image            | No image mode                                                |                    |
| 45   | myopic_defocus      | Defocus Comfort Mode                                         |                    |
| 46   | updater             | One-click plugin update                                      |                    |
| 47   | easy_modify         | Editing tools                                                |                    |
| 48   | editor_width_slider | Adjust writing area width                                    |                    |
| 59   | asset_root_redirect | Resource Redirection                                         | ×                  |
| 50   | bookmark            | Bookmark manager                                             | ×                  |
| 51   | cipher              | Encrypt files                                                | ×                  |
| 52   | ripgrep             | Search files using ripgrep                                   | ×                  |
| 53   | article_uploader    | One-click upload blog to supported platforms                 | ×                  |
| 54   | cursor_history      | Cursor History                                               | ×                  |
| 55   | static_markers      | Static Markers                                               | ×                  |
| 56   | custom              | Open platform for user-defined plugins (Advanced)            |                    |
| 57   | hotkeys             | Hotkey registration center (Advanced)                        |                    |
| 58   | action_buttons      | Add function buttons in the lower right corner (Advanced)    |                    |
| 59   | json_rpc            | Typora Automation (Advanced)                                 | ×                  |

> If you have other needs or find bugs, feel free to [open an issue](https://github.com/obgnail/typora_plugin/issues/new). PRs are also welcome. If you find this project helpful, please give me a star ⭐



## Q&A

- **Is my Typora supported?** Typora's version should be ≥ 0.9.98 (the last free version).
- **How to modify plugin configurations?** Right-click menu -> Interactive Plugins -> Preferences. **Respect all user choices**. Any plugin or feature can be permanently enabled/disabled.
- **How to upgrade plugins?** Right-click menu -> Interactive Plugins -> Upgrade Plugins.
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

   - Windows: Right-Click on the file `installw_windows.ps1`. Select 'Run with PowerShell'.
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

All plugins provide four usage methods:

- Keyboard enthusiasts:
  - `Ctrl+J` to bring up the plugin list (see `toolbar` plugin)
  - Shortcut keys (see `hotkeys` plugin)
- Mouse enthusiasts:
  - Right-click in the main text area (see `right_click_menu` plugin)
  - Quick buttons (see `action_buttons` plugin)


### window_tab

![window_tab](assets/window_tab.gif)


### search_multi

Function: Search through a combination of different conditions to accurately find files.


Usage example: The search syntax is similar to Google search syntax and supports regular expressions.

| Input                                                 | Search File                                                 |
| ----------------------------------------------------- | ------------------------------------------------------------ |
| `pear`                                                | Contains pear                                                |
| `sour pear`                                           | Contains sour and pear                                       |
| `sour OR pear`                                        | Contains sour or pear                                        |
| `"sour pear"`                                         | Contains the phrase sour pear                                |
| `sour pear -apple`                                    | Contains sour and pear, but not apple                        |
| `/\bsour\b/ pear mtime=2024-03-12`                    | Matches regex \bsour\b, contains pear, and file modification date is 2024-03-12 |
| `frontmatter:development OR head=plugin OR strong:MIT` | YAML Front Matter contains development or title content is plugin or bold text contains MIT |
| `size>10kb (linenum>=1000 OR hasimage=true)`          | File size exceeds 10KB, and the file either has at least 1000 lines or contains images |
| `thead:k8s h2:prometheus blockcode:"kubectl apply"`   | Table header contains k8s, h2 contains prometheus, code block contains kubectl apply |

![search_mutli](assets/search_mutli.gif)


### collapse_paragraph

![collapse_paragraph](assets/collapse_paragraph.gif)


### collapse_list

Function: Fold/expand unordered lists, ordered lists, task lists.


### collapse_table

Function: Fold/expand tables.


### md_padding

Function: Add spaces between Chinese and English, Chinese and numbers when mixed.

Shortcut: ctrl + shift + B

![md_padding](assets/md_padding.gif)


### slash_commands

Function: Similar to Notion's slash command.

Supports:

- Insert text snippets (snippet)
- Insert components
- Edit styles
- Execute arbitrary logic

![slash_commands](assets/slash_commands.gif)


### templater

Function: Similar to Obsidian's file template function, quickly create files based on templates.

![templater](assets/templater.gif)


### resource_manager

Function: Resource management, cleanup of unused images


### fence_enhance

![fence_enhance](assets/fence_enhance.png)


### right_outline

Function: Typora's sidebar cannot display both [File] and [Outline] simultaneously. To solve this problem, this plugin adds an [Outline] on the right.


### commander

![commander](assets/commander.gif)


### markmap

![markmap](assets/markmap.gif)


### toolbar

Function: Similar to VSCode's ctrl + shift + p function

Supports search:

- `his`: Recently opened files
- `plu`: Plugins
- `tab`: Open tabs
- `ops`: Common operations
- `out`: Document outline
- `mode`: Switch file mode
- `theme`: Temporarily switch theme
- `func`: Function list
- `all`: Mixed search (search all items mixed together)

Input content description:

- Input content = search tool name + space + search content
- Supports `intersection queries`, `difference queries`, and can be freely combined (similar to Google's positive and negative queries)

Examples:

- `his node learn`: Find recently opened files that have titles containing both node and learn keywords
- `plu multi -search`: Find plugins whose names contain the multi keyword but do not contain the search keyword
- `tab -messing`: Find all open tabs whose names do not contain the messing keyword
- `his close -win -mark tab`: Find recently opened files whose titles contain close and tab keywords, but do not contain win and mark keywords

![toolbar](assets/toolbar.gif)


### right_click_menu

All plugins support direct invocation through the right-click menu. Mouse enthusiasts can use the right-click menu as the main way to call all plugins.


### pie_menu

Usage:

- `Open circular menu`: Ctrl + right mouse button
- `Rotate circular menu`: Middle mouse button
- `Pin the circular menu, so it doesn't automatically disappear`: Left mouse button on the center of the circle
- `Expand the circular menu, so it doesn't automatically collapse`: Right mouse button on the center of the circle

### preferences

Preferences

### echarts

![echarts](assets/echarts.png)

### chart

Usage: Right-click menu -> Language plugins -> Chart

![chart](./assets/chart.png)

### drawIO

![drawIO](./assets/drawIO.png)

### abc

Usage: Right-click menu -> Language plugins -> ABC

![abcjs](./assets/abcjs.png)

### calendar

Usage: Right-click menu -> Language plugins -> Calendar

![calendar](./assets/calendar.png)

### wavedrom

Usage: Right-click menu -> Language plugins -> Wavedrom

![wavedrom](./assets/wavedrom.png)

### marp

Function: Use markdown to create PPT.

Usage: Right-click menu -> Language plugins -> Marp

### plantUML

Usage: Right-click menu -> Language plugins -> PlantUML

![plantUML](./assets/plantUML.png)

Due to the B/S architecture of plantUML, users are required to provide a rendering server. Suggest using Docker to install rendering server:

```bash
docker pull plantuml/plantuml-server:jetty
docker run -d --name plantuml-server -p 8080:8080 plantuml/plantuml-server:jetty
```

### callouts

![callouts](./assets/callouts.png)

The quantity, type, color, and icon can all be defined by yourself. Please modify the configuration.

### kanban

Extend the code syntax to add Kanban functionality.

![kanban](assets/kanban.png)

### timeline

Extend the code syntax to add timeline functionality.

![timeline](./assets/timeline.png)

### chat

Extend the code syntax to add chat functionality.

![chat](./assets/chat.png)

### text_stylize

Function: Convert text to HTML format, changing the text style.

![text_stylize](./assets/text_stylize.gif)

### read_only

Function: In read-only mode, the document cannot be edited (after enabling, the bottom right corner of the statistics area will show `ReadOnly`).

Shortcut: ctrl+shift+R

### blur

Function: After enabling, only the currently focused component is visible, the rest are blurred. It can be used to prevent peeking.

> This plugin can only be used with the official version of Typora.

### auto_number

![auto_number](assets/auto_number.png)

Unlike other implementations using theme CSS, this plugin perfectly solves the problem of no numbering in the sidebar after exporting to PDF by modifying the built-in function :)



### image_viewer

Function: One-stop image viewing, and provides simple image editing.

![image-reviewer](./assets/image-reviewer.png)

### cjk_symbol_pairing

Function: Automatically pair symbols when typing `《 【 （ ‘ “ 「`.

### datatables

Function: Enhance tables. Provides functions such as search, filter, pagination, and sorting.

Usage: Place the cursor on the table -> Right-click menu -> Interactive Plugins -> Table Enhancement.

![datatables](assets/datatables.png)

### resize_table

Function: `ctrl + mouse drag`: Modify the row height and column width of the table.

![resize_table](assets/resize_table.gif)

### resize_image

Function: `alt + mouse scroll`: Adjust the image size.

### export_enhance

Function: When exporting HTML, convert images to base64 to avoid image loss.

### sidebar_enhance

Function: 

- Drag & drop outline to rearrange
- Display non-Markdown files in the sidebar
- Keep Fold Outline State
- Customize Sidebar File Icons
- Display File Count

### dark

Dark Mode

### no_image

No Image Mode

### myopic_defocus

Defocus Comfort Mode

### markdownlint

Function: Check whether the current file complies with the markdown best practices.

Usage:Click the small square in the top right corner

### updater

Upgrade Plugin

> As we all know, some users cannot download the latest plugin directly from GitHub, so a proxy setting function is provided (default is system proxy).

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

Function: Adjust the width of the writing area.

### asset_root_redirect

Function: If you mainly use Obsidian or Joplin to manage files and occasionally use Typora to open files, you will encounter a problem: both Obsidian and Joplin put local resources in the same directory, but Typora defaults to using relative paths to reference local resources.

> This plugin is disabled by default and needs to be manually enabled.

### bookmark

Usage:

1. Use alt + click on the text content to bookmark.
2. This will automatically bring up the bookmark manager. Click on the bookmark above to jump to the bookmark.

### cipher

Encrypt File.

### truncate_text

Function: The rendering performance of large files in Typora is very poor. Use this plugin to temporarily hide content (just hide the display, not modify the file) to improve rendering performance. It can also be used to prevent peeking.

> Principle: By setting the display style of DOM elements to none, elements are hidden so that they do not occupy a position in the rendering tree, and operations on hidden elements do not cause reflow of other elements.

### ripgrep

Typora comes with ripgrep. This plugin supports using the built-in ripgrep to search files.

> To use this plugin, you need to be familiar with the ripgrep tool. This plugin is disabled by default and needs to be manually enabled.

### cursor_history

- hotkey for the previous cursor: alt+←
- hotkey for the next cursor: alt+→

> This plugin is disabled by default and needs to be manually enabled.

### static_markers

Say goodbye to distracting format refreshes. This plugin keeps your Markdown syntax markers always visible and static.

This plugin disables the auto-hiding feature for syntax markers in WYSIWYG mode. It ensures that all Markdown characters—like **, ##, and _—remain persistently visible around your text, just as they would in a source code editor.

![static_markers](./assets/static_markers.png)

> This plugin is disabled by default and needs to be manually enabled.

### hotkeys

> This plugin is an advanced plugin, only available to users with a JavaScript background.

Function: Bind hotkeys to [any plugin system function] or [any custom function] in a declarative form.

### action_buttons

> This plugin is an advanced plugin, only available to users with a JavaScript background.

Function: Similar to hotkeys, set function buttons for [any plugin system function] in a declarative form.

### custom

> This plugin is an advanced plugin, only available to users with a JavaScript background.

Function: Provide open capabilities, support users to write their own plugins.

For specific usage, please refer to [README.md](https://github.com/obgnail/typora_plugin/blob/master/plugin/custom/README.md).

### json_rpc

Function: Expose all capabilities including the typora-plugin in the form of `json-rpc` for external manipulation of Typora.

For specific usage, please refer to [README.md](https://github.com/obgnail/typora_plugin/blob/master/plugin/json_rpc/README.md).

> This plugin is an advanced plugin, only available to developers. After enabling this plugin, the external will have both node and browser environments, which can fully control the computer, so if you are not a developer, please do not enable it.

### article_uploader

Function: The user clicks or uses a shortcut key to trigger the automatic publishing function of the current article. The program automatically publishes blog articles to major platforms according to user configuration.

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

